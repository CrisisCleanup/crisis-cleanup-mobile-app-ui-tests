#!/usr/bin/env node

const fs = require('fs')
const args = require('args')

args.option('platform', 'Run platform in isolation', '')
args.option('test', 'Test file name', 'all-screenshots')
const flags = args.parse(process.argv)
let targetPlatform = flags.platform.toLowerCase()
targetPlatform = targetPlatform.length ? targetPlatform[0] : ''
const targetPlatforms = ['a', 'i'].filter(
  (p) => !targetPlatform || p == targetPlatform
)
let testFileName = flags.test

const timestampIso = new Date().toISOString()
const timestampKey = timestampIso
  .replace(/-/g, '')
  .replace('T', '')
  .replace(/\.\d{3}Z$/, '')
  .replace(/:/g, '')

const exec = require('util').promisify(require('child_process').exec)
const { spawn } = require('node:child_process')

const getAndroidDeviceIds = async () => {
  const output = await exec('adb devices')
  const { stdout } = output
  if (!stdout) {
    throw new Error('Start an Android emulator/device (with apps installed)')
  }
  const androidDeviceIdRegex = /(\S+)\s*device\b/i
  const matchingDeviceIds = stdout
    .split('\n')
    .filter((s) => androidDeviceIdRegex.test(s))
    .map((s) => androidDeviceIdRegex.exec(s)[1])
  if (!matchingDeviceIds.length) {
    throw new Error(
      'Unable to parse Android device ID. Is an Android device running?'
    )
  }
  return matchingDeviceIds
}
const getIosDeviceIds = async () => {
  const output = await exec('xcrun simctl list devices booted')
  const { stdout } = output
  if (!stdout) {
    throw new Error('Start an iOS simulator/device (with apps installed)')
  }
  const iPhoneDeviceIdRegex = /iPhone.+\(([0-9a-f-]+)\)/i
  const matchingDeviceIds = stdout
    .split('\n')
    .filter((s) => iPhoneDeviceIdRegex.test(s))
    .map((s) => iPhoneDeviceIdRegex.exec(s)[1])
  if (!matchingDeviceIds.length) {
    throw new Error('Unable to parse iOS device ID. Is an iOS device running?')
  }
  return matchingDeviceIds
}

const mkScreenshotDir = async (platform, devicePostfix = 'phone') => {
  const screenshotDirPath = `screenshots/${timestampKey}-${platform}-${devicePostfix}`
  fs.mkdirSync(screenshotDirPath)
  return Promise.resolve(screenshotDirPath)
}

const takePlatformScreenshots = async (appId, deviceId, screenshotDirPath) => {
  return new Promise((resolve, reject) => {
    const cmdParts = [
      `MAESTRO_APP_ID=${appId}`,
      'maestro',
      '--device',
      deviceId,
      'test',
      '-e',
      `SCREENSHOT_DIR=${screenshotDirPath}`,
      '-e',
      `TIMESTAMP_ISO='${timestampIso}'`,
      `screenshot-tests/${testFileName}.yaml`,
    ]
    const cmd = spawn('env', cmdParts)

    cmd.stdout.on('data', (data) => {
      console.log(data.toString())
    })

    cmd.stderr.on('data', (data) => {
      console.error(`Error: ${data}`)
    })

    cmd.on('close', (code) => {
      if (code) {
        const fullCommand = cmdParts.join(' ')
        reject(
          new Error(`Screenshots for "${fullCommand}" failed with code ${code}`)
        )
      } else {
        resolve()
      }
    })
  })
}

const screenshotAndroid = () =>
  getAndroidDeviceIds().then(async (deviceIds) => {
    for (const deviceId of deviceIds) {
      const dirPath = await mkScreenshotDir('android', deviceId)
      await takePlatformScreenshots(
        'com.crisiscleanup.demo.debug',
        deviceId,
        dirPath
      )
    }

    return `Android ${deviceIds.join(', ')}`
  })
const screenshotIos = () =>
  getIosDeviceIds().then(async (deviceIds) => {
    for (const deviceId of deviceIds) {
      const dirPath = await mkScreenshotDir('ios', deviceId)
      await takePlatformScreenshots('com.crisiscleanup.dev', deviceId, dirPath)
    }
    return `iOS ${deviceIds.join(', ')}`
  })
const screenshotPlatforms = { a: screenshotAndroid, i: screenshotIos }

const runScreenshots = async () => {
  const skipped = []
  const performed = []
  for (const platform of targetPlatforms) {
    const job = screenshotPlatforms[platform]
    if (job) {
      const result = await job()
      performed.push(result)
    } else {
      skipped.push(platform)
    }
  }

  return { skipped, performed }
}

runScreenshots().then(console.log).catch(console.error)
