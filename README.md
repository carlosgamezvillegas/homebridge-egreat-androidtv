<span align="center">

# homebridge-egreat-androidtv
## Homebridge Plugin to control your Egreat A5/A10/A11/A13/A15


[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)
[![homebridge-egreat-androidtv](https://badgen.net/npm/v/homebridge-egreat-androidtv?icon=npm)](https://www.npmjs.com/package/homebridge-egreat-androidtv)
[![mit-license](https://badgen.net/npm/license/lodash)](https://github.com/merdok/homebridge-egreat-androidtv/blob/master/LICENSE)
</span>

# What is this?

`homebrige-egreat-androidtv` is a plugin for Homebridge to Control your Egreat A5 from your Home app. It should work with Egreat A5/A10/A11/A13/A15.


### Features
* HomeKit "TV Remote"
* HomeKit automations
* Play, Pause, and Stop switches
### Optional Features
* Media progress (as light bulb)
* The rests of the Remote Control buttons 

# Preparation
1. Get the IP address of the egreat device
2. Install the the egreat plugin and follow the steps

# Installation
install using the following command in terminal:
```sh
npm i homebridge-egreat-androidtv
```

# Configuration

Add the `egreatPlugin` platform in `config.json` in your home directory inside `.homebridge`.

Example configuration:

```js
{
  "platforms": [
    {
            "name": "Egreat",
            "ip": "Youre IP Address", 
            "pollingInterval": 1000,
            "modelName": "A5",
            "manufacture": "Egreat",
            "serialN": "1234567890",
            "platform": "egreatPlugin"
}
]
}
```

Make sure you change the IP Address the one the devices is currently using.


### Adding the Egreeat to the Home app
Since HomeKit expects only one Egreat per bridge they will be declared as external accessories and acts as a bridge.  
This means that a device will not appear in your Home app until you add it!

To add the Egreat to HomeKit follow this steps:

1. Open the Home <img src="https://user-images.githubusercontent.com/3979615/78010622-4ea1d380-738e-11ea-8a17-e6a465eeec35.png" height="16.42px"> app on your device.
2. Tap the Home tab, then tap <img src="https://user-images.githubusercontent.com/3979615/78010869-9aed1380-738e-11ea-9644-9f46b3633026.png" height="16.42px">.
3. Tap *Add Accessory*, and select *I Don't Have a Code or Cannot Scan*.
4. Select the accessory you want to pair.
5. Enter the Homebridge PIN, this can be found under the QR code in Homebridge UI or your Homebridge logs, alternatively you can select *Use Camera* and scan the QR code again.

For more info check the homebridge wiki [Connecting Homebridge To HomeKit](https://github.com/homebridge/homebridge/wiki/Connecting-Homebridge-To-HomeKit).

### Configuration
#### Platform Configuration fields
- `platform` [required]
Should always be **"egreatPlugin"**.
#### TV Configuration fields
- `name` [required]
Name of your Egreat.
- `ip` [required]
ip address of your TV.
- `pollingInterval` [optional]
The TV state background polling interval in seconds. **Default: 10000**
- `modelName` [optional]
Model name of your device
- `manufacture` [optional]
The manufcturer of your device
- `serialN` [optional]
Serial Number of your device
- `mediaButtons` [optional]
Allows control the playback state of your device. **Default: false**
- `inputButtons` [optional]
Adds input buttons. **Default: false**
- `NameOfTheButton` [optional]
Adds the button you want to add and can add as many as you want (refer to the button list bellow) **Default: false**

Button Name List is :
- cursorUpB
- cursorDownB 
- cursorLeftB
- cursorRightB
- cursorEnterB
- menuB
- homeB
- backButtonB
- clearB 
- guideB
- infoB
- pageUpB
- pageDownB
- redB
- yellowB
- blueB
- greenB
- audioB
- subtitleB
- pictureB
- holdRightB
- holdLeftB
- LEDOnOffB
- skipForwardB
- skipRewindB 


Note: You can add  buttons in the "Navagation Buttons" and "other Buttons" in Settings using Homebridge UI
- `newPlatformUUID` [optional]
Enable this if you do not see the accessory when you try to add it to the Home App after deleting it. It will also create a different accesssory every time you chage the Name of the device in Settings. If an old accessory already exists in the Home App you will have to remove it manually. **Default: false**

## Troubleshooting
If you have any issues with the plugin or Egreat services then you can run homebridge in debug mode, which will provide some additional information. This might be useful for debugging issues.

Homebridge debug mode:
```sh
homebridge -D
```

Deep debug log, add the following to your config.json:
```json
"deepDebugLog": true
```
This will enable additional extra log which might be helpful to debug all kind of issues. Just be aware that this will produce a lot of log information so it is recommended to use a service like https://pastebin.com/ when providing the log for inspection.

Note: Controls won't update if the plugin does not receive a confirmation message from the device

## Known Issues
-  For some reason the On and Off commands are not executed by the TV box so Turning On or Off the device is not possible at this momment.
 - The accurate state of the device cannot be determined since there are no query commands available 

## Special thanks
To Fernando for his patience and support.

If you have any suggestions/improvements please let know.

Enjoy!!
