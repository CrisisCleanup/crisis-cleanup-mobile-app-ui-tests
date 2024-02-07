const fs = require('fs')

const timestampKey = new Date()
  .toISOString()
  .replace(/-/g, '')
  .replace('T', '')
  .replace(/\.\d{3}Z$/, '')
  .replace(/:/g, '')

const exec = require('util').promisify(require('child_process').exec)
const { spawn } = require('node:child_process')

const getIosDeviceId = async () => {
  const output = await exec('xcrun simctl list devices booted')
  const { stdout } = output
  if (!stdout) {
    throw new Error('Start an iOS simulator (with apps installed)')
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

const mkScreenshotDir = async (platform, deviceType = 'phone') => {
  const screenshotDirPath = `screenshots/${platform}-${deviceType}-${timestampKey}`
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

mkScreenshotDir('android')
  .then(async (dirPath) => {
    // TODO Query and loop through Android devices
    const deviceIds = ['emulator-5554']
    for (const deviceId of deviceIds) {
      await takePlatformScreenshots(
        'com.crisiscleanup.demo.debug',
        deviceId,
        dirPath
      )
    }
  })
  .then(() => getIosDeviceId())
  .then((iosDeviceIds) => {
    mkScreenshotDir('ios').then(async (dirPath) => {
      for (const deviceId of iosDeviceIds) {
        await takePlatformScreenshots(
          'com.crisiscleanup.dev',
          deviceId,
          dirPath
        )
      }
    })
  })
  .then(console.log)
  .catch(console.error)
