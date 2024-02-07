const fs = require('fs')

const timestampKey = new Date()
  .toISOString()
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
  const screenshotDirPath = `screenshots/${platform}-${devicePostfix}-${timestampKey}`
  fs.mkdirSync(screenshotDirPath)
  return Promise.resolve(screenshotDirPath)
}

const takePlatformScreenshots = async (appId, deviceId, screenshotDirPath) => {
  return new Promise((resolve, reject) => {
    const cmd = spawn('env', [
      `MAESTRO_APP_ID=${appId}`,
      'maestro',
      '--device',
      deviceId,
      'test',
      '-e',
      `SCREENSHOT_DIR=${screenshotDirPath}`,
      'screenshot-tests/all-screenshots.yaml',
    ])

    cmd.stdout.on('data', (data) => {
      console.log(data.toString())
    })

    cmd.stderr.on('data', (data) => {
      console.error(`Error: ${data}`)
    })

    cmd.on('close', (code) => {
      if (code) {
        reject(
          new Error(
            `Screenshots for ${appId} ${deviceId} failed with code ${code}`
          )
        )
      } else {
        resolve()
      }
    })
  })
}

getAndroidDeviceIds()
  .then(async (deviceIds) => {
    for (const deviceId of deviceIds) {
      const dirPath = await mkScreenshotDir('android', deviceId)
      await takePlatformScreenshots(
        'com.crisiscleanup.demo.debug',
        deviceId,
        dirPath
      )
    }
  })
  .then(() => getIosDeviceIds())
  .then(async (iosDeviceIds) => {
    for (const deviceId of iosDeviceIds) {
      const dirPath = await mkScreenshotDir('ios', deviceId)
      await takePlatformScreenshots('com.crisiscleanup.dev', deviceId, dirPath)
    }
  })
  .then(console.log)
  .catch(console.error)
