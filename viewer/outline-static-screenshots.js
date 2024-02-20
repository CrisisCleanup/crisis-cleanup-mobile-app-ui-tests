#!/usr/bin/env node

const fs = require('fs')
const args = require('args')

args.option(
  'screenshot-root-dir',
  'Path to screenshots root dir',
  'screenshots'
)
args.option('static-site-dir', 'Path to static files for viewer site', 'public')
const flags = args.parse(process.argv)
const screenshotRootDir = flags.screenshotRootDir
const staticSiteDir = flags.staticSiteDir

const validateClearDirs = async () => {
  if (!fs.existsSync(screenshotRootDir)) {
    throw new Error(`Screenshots root dir ${screenshotRootDir} not found`)
  }

  try {
    fs.rmSync(staticSiteDir, { recursive: true, force: true })
  } catch (e) {
    if (!e.message.startsWith('ENOENT: no such file or directory')) {
      throw e
    }
  }

  fs.mkdirSync(staticSiteDir, { recursive: true })
}

const screenshotDirNameRegex = /^(\d{14})-(\w+)-/i
const numberDateRegex = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/
const listLatestScreenshots = async () => {
  const screenshotDirs = fs
    .readdirSync(screenshotRootDir)
    .filter((s) => !s.startsWith('.') && !s.endsWith('.sh'))
    .map((s) => ({
      dirName: s,
      dirPath: `${screenshotRootDir}/${s}`,
    }))
    .filter(({ dirPath }) => fs.statSync(dirPath).isDirectory())
    .map((data) => {
      const match = screenshotDirNameRegex.exec(data.dirName)
      if (match) {
        const dateName = match[1]
        const platform = match[2]
        const dateMatch = numberDateRegex.exec(dateName)
        const dateString = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}%${dateMatch[4]}:${dateMatch[5]}:${dateMatch[6]}`
        const destDirName = `${platform}-${dateName}`
        return {
          ...data,
          timestamp: new Date(dateString),
          platform,
          destDirName,
        }
      }
      return data
    })
    .filter((d) => d.platform)
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))

  const platformScreenshots = {}
  const fileExtensionRegex = /\.png$/i
  const getScreenshotFiles = (screenshotDir) => {
    return fs
      .readdirSync(screenshotDir)
      .filter((s) => fileExtensionRegex.test(s))
  }
  for (const screenshotDir of screenshotDirs) {
    const { platform, dirName, ...remainder } = screenshotDir

    if (!(platform in platformScreenshots)) {
      platformScreenshots[platform] = []
    }

    platformScreenshots[platform].push({
      ...remainder,
      files: getScreenshotFiles(screenshotDir.dirPath),
    })
  }

  return platformScreenshots
}

const saveStaticSite = async (platformData) => {
  if (!(platformData.android && platformData.ios)) {
    throw new Error('Missing platform screenshots')
  }

  const screenshotData = {}
  for (const key in platformData) {
    if (!(key in screenshotData)) {
      screenshotData[key] = []
    }

    for (const {
      dirPath: sourceScreenshotsDir,
      timestamp,
      files,
      destDirName,
    } of platformData[key]) {
      const destScreenshotsDir = `${staticSiteDir}/${destDirName}`
      fs.mkdirSync(destScreenshotsDir)

      fs.cpSync(sourceScreenshotsDir, destScreenshotsDir, { recursive: true })

      screenshotData[key].push({
        timestamp,
        dir: destDirName,
        files,
      })
    }
  }

  fs.copyFileSync(`${__dirname}/index.html`, `${staticSiteDir}/index.html`)

  const screenshotDataContent = JSON.stringify(screenshotData, null, 2)
  const screenshotDataFileContent = `window.screenshotData = ${screenshotDataContent}`
  fs.writeFileSync(
    `${staticSiteDir}/screenshot-data.js`,
    screenshotDataFileContent
  )

  return screenshotData
}

validateClearDirs()
  .then(listLatestScreenshots)
  .then(saveStaticSite)
  .then(console.log)
  .catch(console.error)
