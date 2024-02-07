Run UI tests and take screenshots of Crisis Cleanup mobile app across all open devices

## Setup

1. Install Maestro.
1. Start emulators, simulators, devices. Be sure computer has permissions to devices and devices on and pass the lock screen.
1. Install apps on the devices.
1. Run tests.

## Maestro overview

[Flow file structure](https://maestro.mobile.dev/api-reference/configuration/flow-configuration)

Target app
`MAESTRO_APP_ID=com.crisiscleanup.demo maestro test auth-tests`

[Specify device](https://maestro.mobile.dev/advanced/specify-a-device)
`maestro --device emulator-5554 test auth-tests`

List devices

- Android `adb devices`
- iOS `xcrun simctl list devices booted`

Full test command

- Android `MAESTRO_APP_ID=com.crisiscleanup.demo.debug maestro --device emulator-5554 test auth-tests`
- iOS `MAESTRO_APP_ID=com.crisiscleanup.dev maestro --device device-uuid-from-list test auth-tests`
