"use strict";
const PLATFORM_NAME = 'egreatPlugin';
const PLUGIN_NAME = 'homebridge-egreat-androidtv';
const net = require("net");
const EGREAT_PORT = 33080;
const timeout = 2000;
const tcpp = require('tcp-ping');


module.exports = (api) => {
    api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, egreatPlatform, true);
};
//// Platform/////////////////////////////////////////////////////////////////////////////////////////////////
class egreatPlatform {
    constructor(log, config, api) {
        this.log = log;
        this.config = config;
        this.api = api;
        this.Service = this.api.hap.Service;
        this.Characteristic = this.api.hap.Characteristic;
        this.config.name = this.config.name || 'Egreat A5';
        this.config.newPlatformUUID = this.config.newPlatformUUID || false;
        // this is used to track restored cached accessories
        this.accessories = [];
        this.log.debug('Finished initializing platform:', this.config.name);
        this.api.on('didFinishLaunching', () => {
            log.debug('didFinishLaunching callback');
            this.iniDevice();
        });
    }
    configureAccessory(accessory) {
        this.log.info('Loading accessory from cache:', accessory.displayName);
        this.accessories.push(accessory);
    }
    removeAccessory(accessory) {
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    }
    iniDevice() {
        if (this.config.newPlatformUUID === false) {
            this.egreatDevice =
            {
                egreatUniqueId: 'AB11233',
                egreatDisplayName: `${this.config.name}`
            };
        }
        if (this.config.newPlatformUUID === true) {
            this.egreatDevice =
            {
                egreatUniqueId: `${this.config.name}AB11233`,
                egreatDisplayName: `${this.config.name}`
            };
            this.log.debug('Generationg a new UUID');
        }
        const uuid = this.api.hap.uuid.generate(this.egreatDevice.egreatUniqueId);
        this.log.debug('Adding new accessory:', this.egreatDevice.egreatDisplayName);
        const accessory = new this.api.platformAccessory(this.egreatDevice.egreatDisplayName, uuid);
        accessory.category = this.api.hap.Accessory.Categories.TV_SET_TOP_BOX;
        accessory.context.device = this.egreatDevice;
        new egreatAccessory(this, accessory);
        this.api.publishExternalAccessories(PLUGIN_NAME, [accessory]);
    }
}
class egreatAccessory {
    constructor(platform, accessory) {
        this.platform = platform;
        this.accessory = accessory;
        this.config = platform.config;
        this.EGREAT_IP = this.config.ip;
        this.statelessTimeOut = 1000;
        //////Initial Switch and sensors state///////////////////////////////////////////////////////////////////////////////////////////////
        this.powerState = false;
        this.playBackState = [false, false, false];
        this.inputState = [false, false, false, false, false, false];
        this.audioType = [false, false];
        this.powerStateTV = 0;
        this.currentVolume = 0;
        this.targetVolume = 100;
        this.currentMuteState = true;
        this.currentVolumeSwitch = false;
        this.inputID = 1;
        this.mediaState = 4;
        this.videoState = false;
        this.inputName = 'Media Title';
        this.inputDuration = 'Runtime';
        this.key = this.pressedButton('POWER ON');
        this.isEgreatAlive = false;
        /////MovieConstants
        this.currentMovieProgress = 0;
        this.currentMovieProgressState = false;
        this.movieElapsed = 0;
        this.movieRemaining = 0;
        this.movieCounter = 0;
        this.pauseUpdate = false;
        this.newRemainingTime = 0;
        ////Connection parameters
        this.reconnectionCounter = 0;
        this.reconnectionTry = 5;
        this.connectionLimit = false;
        this.connectionLimitStatus = 0;
        this.reconnectionWait = platform.config.pollingInterval || 10000;
        this.newResponse = '';
        //Device Information//////////////////////////////////////////////////////////////////////////////////////
        this.config.name = platform.config.name || 'Egreat A5';
        this.config.ip = platform.config.ip;
        this.config.manufacture = platform.config.manufacture || 'Egreat';
        this.config.pollingInterval = platform.config.pollingInterval || 1000;
        this.config.modelName = platform.config.modelName || 'A5';
        this.config.serialN = platform.config.serialN || '1234567890';
        this.config.volume = platform.config.volume || false;
        this.config.mediaButtons = platform.config.mediaButtons || false;
        this.config.cursorUpB = platform.config.cursorUpB || false;
        this.config.cursorDownB = platform.config.cursorDownB || false;
        this.config.cursorLeftB = platform.config.cursorLeftB || false;
        this.config.cursorRightB = platform.config.cursorRightB || false;
        this.config.cursorEnterB = platform.config.cursorEnterB || false;
        this.config.menuB = platform.config.menuB || false;
        this.config.homeB = platform.config.homeB || false;
        this.config.backButtonB = platform.config.backButtonB || false;
        this.config.clearB = platform.config.clearB || false;
        this.config.guideB = platform.config.guideB || false;
        this.config.infoB = platform.config.infoB || false;
        this.config.pageUpB = platform.config.pageUpB || false;
        this.config.pageDownB = platform.config.pageDownB || false;
        this.config.redB = platform.config.redB || false;
        this.config.yellowB = platform.config.yellowB || false;
        this.config.blueB = platform.config.blueB || false;
        this.config.audioB = platform.config.audioB || false;
        this.config.greenB = platform.config.greenB || false;
        this.config.subtitleB = platform.config.subtitleB || false;
        this.config.pictureB = platform.config.pictureB || false;
        this.config.movieControl = platform.config.movieControl || false;
        this.config.holdRightB = platform.config.holdRightB || false;
        this.config.holdLeftB = platform.config.holdLeftB || false;
        this.config.LEDOnOffB = platform.config.LEDOnOffB || false;
        this.config.skipForwardB = platform.config.skipForwardB || false;
        this.config.skipRewindB = platform.config.skipRewindB || false;
        this.config.changeDimmersToFan = platform.config.changeDimmersToFan || false;
        this.config.infoToMenu = platform.config.infoToMenu || false;
        this.config.remainMovieTimer = platform.config.remainMovieTimer || false;
        ////Checking if the necessary information was given by the user////////////////////////////////////////////////////
        try {
            if (!this.config.ip) {
                throw new Error(`Egreat IP address is required for ${this.config.name}`);
            }
        } catch (error) {
            this.platform.log(error);
            this.platform.log('Failed to create platform device, missing mandatory information!');
            this.platform.log('Please check your device config!');
            return;
        }
        // set accessory information//////////////////////////////////////////////////////////////////////////////////////////
        this.accessory.getService(this.platform.Service.AccessoryInformation)
            .setCharacteristic(this.platform.Characteristic.Manufacturer, this.config.manufacture)
            .setCharacteristic(this.platform.Characteristic.Model, this.config.modelName)
            .setCharacteristic(this.platform.Characteristic.SerialNumber, this.config.serialN);

        /////////Television Controls///////////////////////////////////////////////////////////////////////////////////////////
        // add the tv service
        this.tvService = this.accessory.getService(this.config.name) ||
            this.accessory.addService(this.platform.Service.Television, this.config.name, 'YourUniqueIdentifier-7');
        this.tvService.setCharacteristic(this.platform.Characteristic.ConfiguredName, this.config.name);
        this.tvService.setCharacteristic(this.platform
            .Characteristic.SleepDiscoveryMode, this.platform.Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE);
        this.tvService.getCharacteristic(this.platform.Characteristic.Active)
            .on('set', (newValue, callback) => {
                this.pauseUpdate = true;
                this.platform.log.debug('Set Egreat Active to: ' + newValue);
                if (newValue === 1) {
                    this.pauseUpdate = true;
                    this.newPowerState(true);
                    this.sending([this.pressedButton('POWER ON')]);

                }
                else {
                    this.turnOffAll();

                    if (this.playBackState[0] === true) {
                        this.sending([this.pressedButton('PAUSE')]);
                        setTimeout(() => {
                            this.sending([this.pressedButton('POWER OFF')]);
                        }, 200);
                    }
                    else {
                        this.sending([this.pressedButton('POWER OFF')]);
                    }

                }
                callback(null);
            });
        this.tvService.getCharacteristic(this.platform.Characteristic.ClosedCaptions)
            .on('get', (callback) => {
                this.platform.log.debug('Subtitle GET On');
                let currentValue = 0;
                callback(null, currentValue);
            })
            .on('set', (value, callback) => {
                this.platform.log.debug('Subtitle SET On:', value);
                if (value === 1) {
                    this.sending([this.pressedButton('SUBTITLE')]);
                }
                this.tvService.updateCharacteristic(this.platform.Characteristic.ClosedCaptions, 0);
                callback(null);
            });
        this.tvService.getCharacteristic(this.platform.Characteristic.RemoteKey)
            .on('set', (newValue, callback) => {
                switch (newValue) {
                    case this.platform.Characteristic.RemoteKey.REWIND: {
                        this.platform.log.debug('set Remote Key Pressed: REWIND');
                        this.sending([this.pressedButton('REWIND')]);
                        break;
                    }
                    case this.platform.Characteristic.RemoteKey.FAST_FORWARD: {
                        this.platform.log.debug('set Remote Key Pressed: FAST_FORWARD');
                        this.sending([this.pressedButton('FORWARD')]);
                        break;
                    }
                    case this.platform.Characteristic.RemoteKey.NEXT_TRACK: {
                        this.platform.log.debug('set Remote Key Pressed: NEXT_TRACK');
                        this.sending([this.pressedButton('NEXT')]);
                        break;
                    }
                    case this.platform.Characteristic.RemoteKey.PREVIOUS_TRACK: {
                        this.platform.log.debug('set Remote Key Pressed: PREVIOUS_TRACK');
                        this.sending([this.pressedButton('PREVIOUS')]);
                        break;
                    }
                    case this.platform.Characteristic.RemoteKey.ARROW_UP: {
                        this.platform.log.debug('set Remote Key Pressed: ARROW_UP');
                        this.sending([this.pressedButton('CURSOR UP')]);
                        break;
                    }
                    case this.platform.Characteristic.RemoteKey.ARROW_DOWN: {
                        this.platform.log.debug('set Remote Key Pressed: ARROW_DOWN');
                        this.sending([this.pressedButton('CURSOR DOWN')]);
                        break;
                    }
                    case this.platform.Characteristic.RemoteKey.ARROW_LEFT: {
                        this.platform.log.debug('set Remote Key Pressed: ARROW_LEFT');
                        this.sending([this.pressedButton('CURSOR LEFT')]);
                        break;
                    }
                    case this.platform.Characteristic.RemoteKey.ARROW_RIGHT: {
                        this.platform.log.debug('set Remote Key Pressed: ARROW_RIGHT');
                        this.sending([this.pressedButton('CURSOR RIGHT')]);
                        break;
                    }
                    case this.platform.Characteristic.RemoteKey.SELECT: {
                        this.platform.log.debug('set Remote Key Pressed: SELECT');
                        this.sending([this.pressedButton('CURSOR ENTER')]);
                        break;
                    }
                    case this.platform.Characteristic.RemoteKey.BACK: {
                        this.platform.log.debug('set Remote Key Pressed: BACK');
                        this.sending([this.pressedButton('BACK')]);
                        break;
                    }
                    case this.platform.Characteristic.RemoteKey.EXIT: {
                        this.platform.log.debug('set Remote Key Pressed: EXIT');
                        this.sending([this.pressedButton('HOME MENU')]);
                        break;
                    }
                    case this.platform.Characteristic.RemoteKey.PLAY_PAUSE: {
                        this.platform.log.debug('set Remote Key Pressed: PLAY_PAUSE');
                        if (this.playBackState[0] === false) {
                            this.sending([this.pressedButton('PLAY')]);
                        }
                        else {
                            this.sending([this.pressedButton('PAUSE')]);
                        }
                        break;
                    }
                    case this.platform.Characteristic.RemoteKey.INFORMATION: {
                        if (this.config.infoToMenu) {
                            this.platform.log.debug('set Remote Key Pressed: MENU');
                            this.sending([this.pressedButton('MENU')]);
                        }
                        else {
                            this.platform.log.debug('set Remote Key Pressed: INFORMATION');
                            this.sending([this.pressedButton('INFO')]);
                        }
                        break;
                    }
                }
                callback(null);
            });
        //////////////////////////////////TV Service//////////////////////////////////////////////////////////////////////////
        this.tvService
            .setCharacteristic(this.platform.Characteristic.ActiveIdentifier, this.inputID);
        this.tvService
            .getCharacteristic(this.platform.Characteristic.ActiveIdentifier)
            .on('set', (inputIdentifier, callback) => {
                this.platform.log.debug('Active Identifier set to:', inputIdentifier);
                if (inputIdentifier === 999999) {
                    this.newInputState([false, false, false]);
                }
                if (inputIdentifier === 0) {
                    this.newInputState([false, false, false]);
                }
                else if (inputIdentifier === 1) {
                    this.inputID = 1;
                }
                else if (inputIdentifier === 2) {
                    this.inputID = 2;
                }
                else {
                    //
                }
                callback();
            })
            .on('get', (callback) => {
                let currentValue = this.inputID;
                this.platform.log.debug('Active Identifier set to:', currentValue);
                callback(null, currentValue);
            });
        this.tvService
            .getCharacteristic(this.platform.Characteristic.PowerModeSelection)
            .on('set', (newValue, callback) => {
                this.platform.log.debug('Requested Egreat Settings ' + newValue);
                if (this.playBackState[0] === false && this.playBackState[1] === false && this.playBackState[2] === false) {
                    this.sending([this.pressedButton('MENU')]);
                }
                else {
                    this.sending([this.pressedButton('MENU')]);
                }
                callback();
            });
        // Input Sources///////////////////////////////////////////////////////////////////////////////////////////////////////////
        this.movieTittle = this.accessory.getService('Movie-Video Tittle') ||
            this.accessory.addService(this.platform.Service.InputSource, 'Movie-Video Tittle', 'YourUniqueIdentifier-1003')
                .setCharacteristic(this.platform.Characteristic.Identifier, 1)
                .setCharacteristic(this.platform.Characteristic.ConfiguredName, this.inputName)
                .setCharacteristic(this.platform.Characteristic.IsConfigured, this.platform.Characteristic.IsConfigured.CONFIGURED)
                .setCharacteristic(this.platform.Characteristic.InputSourceType, this.platform.Characteristic.InputSourceType.APPLICATION)
                .setCharacteristic(this.platform.Characteristic.CurrentVisibilityState, this.platform.Characteristic.CurrentVisibilityState.SHOWN);
        this.movieTittle.getCharacteristic(this.platform.Characteristic.ConfiguredName)
            .on('get', (callback) => {
                let currentValue = this.inputName;
                callback(null, currentValue);
            });
        this.tvService.addLinkedService(this.movieTittle);
        this.movieDuration = this.accessory.getService('Runtime') ||
            this.accessory.addService(this.platform.Service.InputSource, 'Runtime', 'YourUniqueIdentifier-1004')
                .setCharacteristic(this.platform.Characteristic.Identifier, 2)
                .setCharacteristic(this.platform.Characteristic.ConfiguredName, this.inputDuration)
                .setCharacteristic(this.platform.Characteristic.IsConfigured, this.platform.Characteristic.IsConfigured.CONFIGURED)
                .setCharacteristic(this.platform.Characteristic.InputSourceType, this.platform.Characteristic.InputSourceType.APPLICATION)
                .setCharacteristic(this.platform.Characteristic.CurrentVisibilityState, this.platform.Characteristic.CurrentVisibilityState.SHOWN);
        this.movieDuration.getCharacteristic(this.platform.Characteristic.ConfiguredName)
            .on('get', (callback) => {
                let currentValue = this.inputDuration;
                callback(null, currentValue);
            });
        this.tvService.addLinkedService(this.movieDuration);
        /////Media State/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        this.tvService.getCharacteristic(this.platform.Characteristic.CurrentMediaState)
            .on('get', (callback) => {
                let currentValue = this.mediaState;
                this.platform.log.debug('Current Playback State', currentValue);
                callback(null, currentValue);
            });
        this.tvService.getCharacteristic(this.platform.Characteristic.TargetMediaState)
            .on('get', (callback) => {
                let currentValue = this.mediaState;
                if (this.mediaState === 4) {
                    currentValue = 2;
                }
                this.platform.log.debug('Current Playback State', currentValue);
                callback(null, currentValue);
            })
            .on('set', (value, callback) => {
                if (value === 0) {
                    this.sending([this.pressedButton('PLAY')]);
                }
                else if (value === 1) {
                    this.sending([this.pressedButton('PAUSE')]);
                }
                else if (value === 2) {
                    this.sending([this.pressedButton('STOP')]);
                }
                this.platform.log.debug('Playback State set to:', value);
                callback(null);
            });
        ////////Volume services for the Egreat/////////////////////////////////////////////////////////////////////////////////
        this.speakerService = this.accessory.getService('Egreat Volume Control') ||
            this.accessory.addService(this.platform.Service.TelevisionSpeaker, 'Egreat Volume Control', 'YourUniqueIdentifier-20');
        this.speakerService
            .setCharacteristic(this.platform.Characteristic.Active, this.platform.Characteristic.Active.ACTIVE)
            .setCharacteristic(this.platform.Characteristic.VolumeControlType, this.platform.Characteristic.VolumeControlType.ABSOLUTE);
        this.speakerService.getCharacteristic(this.platform.Characteristic.VolumeSelector)
            .on('set', (newValue, callback) => {
                if (newValue === 1) {
                    // this.sending([this.pressedButton('VOLUME DOWN')]);
                }
                if (newValue === 0) {
                    // this.sending([this.pressedButton('VOLUME UP')]);
                }
                this.platform.log.debug('Volume Value moved by: ' + newValue);
                callback(null);
            });
        this.speakerService.getCharacteristic(this.platform.Characteristic.Mute)
            .on('get', (callback) => {
                let currentValue = this.currentMuteState;
                callback(null, currentValue);
            })
            .on('set', (newValue, callback) => {
                let newVolume = this.targetVolume;
                if (newValue === false) {
                    this.sending([this.volumeChange(newVolume)]);
                    this.platform.log.debug('Volume Value set to: Unmute');
                }
                if (newValue === true) {
                    newVolume = 0;
                    this.sending([this.volumeChange(newVolume)]);
                    this.platform.log.debug('Volume Value set to: Mute');
                }

                callback(null);
            });
        this.speakerService.addCharacteristic(this.platform.Characteristic.Volume)
            .on('get', (callback) => {
                let currentValue = this.currentVolume;
                callback(null, currentValue);
            })
            .on('set', (newValue, callback) => {
                this.sending([this.volumeChange(newValue)]);
                this.platform.log.debug('Volume Value set to: ' + newValue);
                callback(null);
            });
        this.tvService.addLinkedService(this.speakerService);
        /////Video/Movie Controls/////////////////////////////////////////////////////////////////////
        if (this.config.movieControl === true) {
            if (this.config.changeDimmersToFan === false) {
                this.movieControlL = this.accessory.getService('Movie Progress') ||
                    this.accessory.addService(this.platform.Service.Lightbulb, 'Movie Progress', 'YourUniqueIdentifier-301');
                this.movieControlL.setCharacteristic(this.platform.Characteristic.Name, 'Movie Progress');
                this.movieControlL.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
                this.movieControlL.setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Movie Progress');
                this.movieControlL.getCharacteristic(this.platform.Characteristic.On)
                    .on('get', (callback) => {
                        let currentValue = this.currentMovieProgressState;
                        callback(null, currentValue);
                    })
                    .on('set', (newValue, callback) => {
                        this.platform.log.debug('Movie progress state set to: ' + newValue);
                        callback(null);
                    });
                this.movieControlL.addCharacteristic(new this.platform.Characteristic.Brightness())
                    .on('get', (callback) => {
                        let currentValue = this.currentMovieProgress;
                        callback(null, currentValue);
                    })
                    .on('set', (newValue, callback) => {
                        // let newSendValue = Math.round(newValue * (this.firstElapsedMovie + this.movieRemaining) / 100);
                        //let totalMovieTime = this.firstElapsedMovie + this.movieRemaining;
                        //if (newSendValue > totalMovieTime) { newSendValue = totalMovieTime; }
                        //this.sending([this.movieTime(this.secondsToTime(newSendValue))]);
                        //this.platform.log('Movie progress set to: ' + newValue + '%');
                        callback(null);
                    });
            }
            else {
                this.movieControlF = this.accessory.getService('Movie Progress') ||
                    this.accessory.addService(this.platform.Service.Fanv2, 'Movie Progress', 'YourUniqueIdentifier-301F');
                this.movieControlF.setCharacteristic(this.platform.Characteristic.Name, 'Movie Progress');
                this.movieControlF.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
                this.movieControlF.setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Movie Progress');
                this.movieControlF.getCharacteristic(this.platform.Characteristic.Active)
                    .on('get', (callback) => {
                        let currentValue = this.currentMovieProgressState ? 1 : 0;
                        callback(null, currentValue);
                    })
                    .on('set', (newValue, callback) => {
                        this.platform.log.debug('Movie progress state set to: ' + newValue);
                        callback(null);
                    });
                this.movieControlF.addCharacteristic(new this.platform.Characteristic.RotationSpeed)
                    .on('get', (callback) => {
                        let currentValue = this.currentMovieProgress;
                        callback(null, currentValue);
                    })
                    .on('set', (newValue, callback) => {
                        // let newSendValue = Math.round(newValue * (this.firstElapsedMovie + this.movieRemaining) / 100);
                        //let totalMovieTime = this.firstElapsedMovie + this.movieRemaining;
                        //if (newSendValue > totalMovieTime) { newSendValue = totalMovieTime; }
                        //this.sending([this.movieTime(this.secondsToTime(newSendValue))]);
                        //this.platform.log('Movie progress set to: ' + newValue + '%');
                        callback(null);
                    });
            }
        }
        /////////////Addtional Services////////////////////////////////////////////////////////////////////////////////////
        this.play = this.accessory.getService('Play') ||
            this.accessory.addService(this.platform.Service.Switch, 'Play', 'YourUniqueIdentifier-10');
        this.play.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
        this.play.setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Play');
        this.play.getCharacteristic(this.platform.Characteristic.On)
            .on('get', this.playSwitchStateGet.bind(this))
            .on('set', this.playSwitchStateSet.bind(this));
        this.pause = this.accessory.getService('Pause') ||
            this.accessory.addService(this.platform.Service.Switch, 'Pause', 'YourUniqueIdentifier-11');
        this.pause.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
        this.pause.setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Pause');
        this.pause.getCharacteristic(this.platform.Characteristic.On)
            .on('get', this.pauseSwitchStateGet.bind(this))
            .on('set', this.pauseSwitchStateSet.bind(this));
        this.stop = this.accessory.getService('Stop') ||
            this.accessory.addService(this.platform.Service.Switch, 'Stop', 'YourUniqueIdentifier-12');
        this.stop.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
        this.stop.setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Stop');
        this.stop.getCharacteristic(this.platform.Characteristic.On)
            .on('get', this.stopSwitchStateGet.bind(this))
            .on('set', this.stopSwitchStateSet.bind(this));
        //////Volume control Service as lightbulb////////////////////////////////////////////////////////////////////////////
        if (this.config.volume === true) {
            if (this.config.changeDimmersToFan === false) {
                this.volumeDimmer = this.accessory.getService('Egreat Volume') ||
                    this.accessory.addService(this.platform.Service.Lightbulb, 'Egreat Volume', 'YourUniqueIdentifier-98');
                this.volumeDimmer.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
                this.volumeDimmer.setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Egreat Volume');
                this.volumeDimmer.getCharacteristic(this.platform.Characteristic.On)
                    .on('get', (callback) => {
                        let currentValue = this.currentVolumeSwitch;
                        callback(null, currentValue);
                    })
                    .on('set', (newValue, callback) => {
                        let newVolume = this.targetVolume;
                        if (newValue === true) {
                            this.sending([this.volumeChange(newVolume)]);
                            this.platform.log.debug('Volume Value set to: Unmute');
                        }
                        if (newValue === false) {
                            newVolume = 0;
                            this.sending([this.volumeChange(newVolume)]);
                            this.platform.log.debug('Volume Value set to: Mute');
                        }

                        callback(null);
                    });

                this.volumeDimmer.addCharacteristic(new this.platform.Characteristic.Brightness())
                    .on('get', (callback) => {
                        let currentValue = this.currentVolume;
                        callback(null, currentValue);
                    })
                    .on('set', (newValue, callback) => {
                        this.sending([this.volumeChange(newValue)]);
                        this.platform.log.debug('Volume Value set to: ' + newValue);

                        callback(null);
                    });
            }
            else {
                this.volumeFan = this.accessory.getService('Egreat Volume') ||
                    this.accessory.addService(this.platform.Service.Fanv2, 'Egreat Volume', 'YourUniqueIdentifier-98F');
                this.volumeFan.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
                this.volumeFan.setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Egreat Volume');
                this.volumeFan.getCharacteristic(this.platform.Characteristic.Active)
                    .on('get', (callback) => {
                        let currentValue = this.currentVolumeSwitch ? 1 : 0;
                        callback(null, currentValue);
                    })
                    .on('set', (newValue, callback) => {
                        let newVolume = this.targetVolume;
                        if (newValue === 1) {
                            this.sending([this.volumeChange(newVolume)]);
                            this.platform.log.debug('Volume Value set to: Unmute');
                        }
                        if (newValue === 0) {
                            newVolume = 0;
                            this.sending([this.volumeChange(newVolume)]);
                            this.platform.log.debug('Volume Value set to: Mute');
                        }

                        callback(null);
                    });

                this.volumeFan.addCharacteristic(new this.platform.Characteristic.RotationSpeed)
                    .on('get', (callback) => {
                        let currentValue = this.currentVolume;
                        callback(null, currentValue);
                    })
                    .on('set', (newValue, callback) => {
                        this.sending([this.volumeChange(newValue)]);
                        this.platform.log.debug('Volume Value set to: ' + newValue);

                        callback(null);
                    });
            }
        }
        ////other Controls /////////////////////////////////////////////////////////
        if (this.config.cursorUpB === true) {
            this.cursorUp = this.accessory.getService('Cursor Up') ||
                this.accessory.addService(this.platform.Service.Switch, 'Cursor Up', 'YourUniqueIdentifier-31');
            this.cursorUp.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
            this.cursorUp.setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Cursor Up');
            this.cursorUp.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Cursor Up GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Cursor Up SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('CURSOR UP')]);
                    }
                    setTimeout(() => {
                        this.cursorUp.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);

                    callback(null);
                });
        }
        if (this.config.cursorDownB === true) {
            this.cursorDown = this.accessory.getService('Cursor Down') ||
                this.accessory.addService(this.platform.Service.Switch, 'Cursor Down', 'YourUniqueIdentifier-32');
            this.cursorDown.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
            this.cursorDown.setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Cursor Down');
            this.cursorDown.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Cursor Down GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Cursor Down SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('CURSOR DOWN')]);
                    }
                    setTimeout(() => {
                        this.cursorDown.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);

                    callback(null);
                });
        }
        if (this.config.cursorLeftB === true) {
            this.cursorLeft = this.accessory.getService('Cursor Left') ||
                this.accessory.addService(this.platform.Service.Switch, 'Cursor Left', 'YourUniqueIdentifier-33');
            this.cursorLeft.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
            this.cursorLeft.setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Cursor Left');
            this.cursorLeft.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Cursor Left GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Cursor Left SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('CURSOR LEFT')]);
                    }
                    setTimeout(() => {
                        this.cursorLeft.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);

                    callback(null);
                });
        }
        if (this.config.cursorRightB === true) {
            this.cursorRight = this.accessory.getService('Cursor Right') ||
                this.accessory.addService(this.platform.Service.Switch, 'Cursor Right', 'YourUniqueIdentifier-34');
            this.cursorRight.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
            this.cursorRight.setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Cursor Right');
            this.cursorRight.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Cursor Right GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Cursor Right SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('CURSOR RIGHT')]);
                    }
                    setTimeout(() => {
                        this.cursorRight.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);

                    callback(null);
                });
        }
        if (this.config.cursorEnterB === true) {
            this.cursorEnter = this.accessory.getService('Cursor Enter') ||
                this.accessory.addService(this.platform.Service.Switch, 'Cursor Enter', 'YourUniqueIdentifier-35');
            this.cursorEnter.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
            this.cursorEnter.setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Cursor Enter');
            this.cursorEnter.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Cursor Enter GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Cursor Enter SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('CURSOR ENTER')]);
                    }
                    setTimeout(() => {
                        this.cursorEnter.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);

                    callback(null);
                });
        }
        if (this.config.menuB === true) {
            this.menu = this.accessory.getService('Menu') ||
                this.accessory.addService(this.platform.Service.Switch, 'Menu', 'YourUniqueIdentifier-36');
            this.menu.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
            this.menu.setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Menu');
            this.menu.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Menu GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Menu SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('MENU')]);
                    }
                    setTimeout(() => {
                        this.menu.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);

                    callback(null);
                });
        }
        if (this.config.backButtonB === true) {
            this.backButton = this.accessory.getService('Back') ||
                this.accessory.addService(this.platform.Service.Switch, 'Back', 'YourUniqueIdentifier-37');
            this.backButton.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
            this.backButton.setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Back');
            this.backButton.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Back GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Back SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('BACK')]);
                    }
                    setTimeout(() => {
                        this.backButton.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);

                    callback(null);
                });
        }
        if (this.config.clearB === true) {
            this.clear = this.accessory.getService('Clear') ||
                this.accessory.addService(this.platform.Service.Switch, 'Clear', 'YourUniqueIdentifier-40');
            this.clear.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
            this.clear.setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Clear');
            this.clear.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Clear GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Clear SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('CLEAR')]);
                    }
                    setTimeout(() => {
                        this.clear.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);

                    callback(null);
                });
        }
        if (this.config.infoB === true) {
            this.infoButton = this.accessory.getService('Info') ||
                this.accessory.addService(this.platform.Service.Switch, 'Info', 'YourUniqueIdentifier-44');
            this.infoButton.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
            this.infoButton.setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Info');
            this.infoButton.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Info GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Info SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('INFO')]);
                    }
                    setTimeout(() => {
                        this.infoButton.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);

                    callback(null);
                });
        }
        if (this.config.pageUpB === true) {
            this.pageUp = this.accessory.getService('Page Up') ||
                this.accessory.addService(this.platform.Service.Switch, 'Page Up', 'YourUniqueIdentifier-50');
            this.pageUp.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
            this.pageUp.setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Page Up');
            this.pageUp.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Page Up GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Page Up SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('PAGE UP')]);
                    }
                    setTimeout(() => {
                        this.pageUp.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);
                    callback(null);
                });
        }
        if (this.config.pageDownB === true) {
            this.pageDown = this.accessory.getService('Page Down') ||
                this.accessory.addService(this.platform.Service.Switch, 'Page Down', 'YourUniqueIdentifier-51');
            this.pageDown.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
            this.pageDown.setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Page Down');
            this.pageDown.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Page Down GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Page Down SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('PAGE DOWN')]);
                    }
                    setTimeout(() => {
                        this.pageDown.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);

                    callback(null);
                });
        }
        //////Additional Media Buttons/////////////////////////////////////////////////
        if (this.config.mediaButtons === true) {
            this.previous = this.accessory.getService('Previous') ||
                this.accessory.addService(this.platform.Service.Switch, 'Previous', 'YourUniqueIdentifier-38');
            this.previous.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
            this.previous.setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Previous');
            this.previous.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Previous GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Previous SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('PREVIOUS')]);
                    }
                    setTimeout(() => {
                        this.previous.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);
                    callback(null);
                });
            this.next = this.accessory.getService('Next') ||
                this.accessory.addService(this.platform.Service.Switch, 'Next', 'YourUniqueIdentifier-39');
            this.next.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
            this.next.setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Next');
            this.next.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Next GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Next SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('NEXT')]);
                    }
                    setTimeout(() => {
                        this.next.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);
                    callback(null);
                });
            this.rewindButton = this.accessory.getService('Rewind') ||
                this.accessory.addService(this.platform.Service.Switch, 'Rewind', 'YourUniqueIdentifier-46');
            this.rewindButton.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
            this.rewindButton.setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Rewind');
            this.rewindButton.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Rewind GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Rewind SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('REWIND')]);
                    }
                    setTimeout(() => {
                        this.rewindButton.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);
                    callback(null);
                });
            this.forwardButton = this.accessory.getService('Forward') ||
                this.accessory.addService(this.platform.Service.Switch, 'Forward', 'YourUniqueIdentifier-80');
            this.forwardButton.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
            this.forwardButton.setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Forward');
            this.forwardButton.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Forward GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Forward SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('FORWARD')]);
                    }
                    setTimeout(() => {
                        this.forwardButton.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);

                    callback(null);
                });
        }
        /////The rest of the buttons///////////////////////////////////////////////////////////////////
        if (this.config.redB === true) {
            this.red = this.accessory.getService('Red') ||
                this.accessory.addService(this.platform.Service.Switch, 'Red', 'YourUniqueIdentifier-53');
            this.red.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
            this.red.setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Red');
            this.red.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Red GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Red SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('RED')]);
                    }
                    setTimeout(() => {
                        this.red.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);

                    callback(null);
                });
        }
        if (this.config.greenB === true) {
            this.green = this.accessory.getService('Green') ||
                this.accessory.addService(this.platform.Service.Switch, 'Green', 'YourUniqueIdentifier-54');
            this.green.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
            this.green.setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Green');
            this.green.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Green GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Green SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('GREEN')]);
                    }
                    setTimeout(() => {
                        this.green.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);

                    callback(null);
                });
        }
        if (this.config.blueB === true) {
            this.blue = this.accessory.getService('Blue') ||
                this.accessory.addService(this.platform.Service.Switch, 'Blue', 'YourUniqueIdentifier-55');
            this.blue.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
            this.blue.setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Blue');
            this.blue.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Blue GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Blue SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('BLUE')]);
                    }
                    setTimeout(() => {
                        this.blue.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);

                    callback(null);
                });
        }
        if (this.config.yellowB === true) {
            this.yellow = this.accessory.getService('Yellow') ||
                this.accessory.addService(this.platform.Service.Switch, 'Yellow', 'YourUniqueIdentifier-56');
            this.yellow.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
            this.yellow.setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Yellow');
            this.yellow.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Yellow GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Yellow SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('YELLOW')]);
                    }
                    setTimeout(() => {
                        this.yellow.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);

                    callback(null);
                });
        }
        if (this.config.subtitleB === true) {
            this.subtitle = this.accessory.getService('Subtitle') ||
                this.accessory.addService(this.platform.Service.Switch, 'Subtitle', 'YourUniqueIdentifier-58');
            this.subtitle.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
            this.subtitle.setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Subtitle');
            this.subtitle.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Subtitle GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Subtitle SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('SUBTITLE')]);
                    }
                    setTimeout(() => {
                        this.subtitle.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);

                    callback(null);
                });
        }
        if (this.config.pictureB === true) {
            this.picture = this.accessory.getService('Picture') ||
                this.accessory.addService(this.platform.Service.Switch, 'Picture', 'YourUniqueIdentifier-68');
            this.picture.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
            this.picture.setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Picture');
            this.picture.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Picture GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Picture SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('PIC')]);
                    }
                    setTimeout(() => {
                        this.picture.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);

                    callback(null);
                });
        }
        if (this.config.homeB === true) {
            this.homeB = this.accessory.getService('Home') ||
                this.accessory.addService(this.platform.Service.Switch, 'Home', 'YourUniqueIdentifier-7000');
            this.homeB.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
            this.homeB.setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Home');
            this.homeB.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Home GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Home SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('HOME MENU')]);
                    }
                    setTimeout(() => {
                        this.homeB.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);

                    callback(null);
                });
        }
        if (this.config.guideB === true) {
            this.guideB = this.accessory.getService('Guide') ||
                this.accessory.addService(this.platform.Service.Switch, 'Guide', 'YourUniqueIdentifier-7001');
            this.guideB.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
            this.guideB.setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Guide');
            this.guideB.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Guide GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Guide SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('TOP MENU')]);
                    }
                    setTimeout(() => {
                        this.guideB.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);

                    callback(null);
                });
        }
        if (this.config.audioB === true) {
            this.audioB = this.accessory.getService('Audio') ||
                this.accessory.addService(this.platform.Service.Switch, 'Audio', 'YourUniqueIdentifier-7002');
            this.audioB.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
            this.audioB.setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Audio');
            this.audioB.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Audio GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Audio SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('AUDIO')]);
                    }
                    setTimeout(() => {
                        this.audioB.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);

                    callback(null);
                });
        }
        if (this.config.LEDOnOffB === true) {
            this.LEDOnOffB = this.accessory.getService('LED On-Off') ||
                this.accessory.addService(this.platform.Service.Switch, 'LED On-Off', 'YourUniqueIdentifier-7003');
            this.LEDOnOffB.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
            this.LEDOnOffB.setCharacteristic(this.platform.Characteristic.ConfiguredName, 'LED On-Off');
            this.LEDOnOffB.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('LED GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('LED SET On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('LED ON/OFF')]);
                    }
                    setTimeout(() => {
                        this.LEDOnOffB.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);

                    callback(null);
                });
        }
        if (this.config.skipForwardB === true) {
            this.skipForwardB = this.accessory.getService('Skip Forward') ||
                this.accessory.addService(this.platform.Service.Switch, 'Skip Forward', 'YourUniqueIdentifier-7004');
            this.skipForwardB.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
            this.skipForwardB.setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Skip Forward');
            this.skipForwardB.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('SKIP FORWARD GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('SKIP FORWARD On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('SKIP FORWARD')]);
                    }
                    setTimeout(() => {
                        this.skipForwardB.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);

                    callback(null);
                });
        }
        if (this.config.skipRewindB === true) {
            this.skipRewindB = this.accessory.getService('Skip Rewind') ||
                this.accessory.addService(this.platform.Service.Switch, 'Skip Rewind', 'YourUniqueIdentifier-7005');
            this.skipRewindB.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
            this.skipRewindB.setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Skip Rewind');
            this.skipRewindB.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('SKIP REWIND GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('SKIP REWIND On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('SKIP REWIND')]);
                    }
                    setTimeout(() => {
                        this.skipRewindB.updateCharacteristic(this.platform.Characteristic.On, false);
                    }, this.statelessTimeOut);

                    callback(null);
                });
        }

        if (this.config.holdRightB === true) {
            this.holdRightB = this.accessory.getService('Hold Right') ||
                this.accessory.addService(this.platform.Service.Switch, 'Hold Right', 'YourUniqueIdentifier-7006');
            this.holdRightB.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
            this.holdRightB.setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Hold Right');
            this.holdRightB.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Hold Right GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Hold Right On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('HOLD RIGHT KEY (HOLD)')]);
                    }
                    else {
                        this.sending([this.pressedButton('RELEASE RIGHT KEY (HOLD)')]);
                    }
                    callback(null);
                });
        }
        if (this.config.holdLeftB === true) {
            this.holdLeftB = this.accessory.getService('Hold Left') ||
                this.accessory.addService(this.platform.Service.Switch, 'Hold Left', 'YourUniqueIdentifier-7007');
            this.holdLeftB.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
            this.holdLeftB.setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Hold Left');
            this.holdLeftB.getCharacteristic(this.platform.Characteristic.On)
                .on('get', (callback) => {
                    this.platform.log.debug('Hold Left GET On');
                    let currentValue = false;
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    this.platform.log.debug('Hold Left On:', value);
                    if (value === true) {
                        this.sending([this.pressedButton('HOLD LEFT KEY (HOLD)')]);
                    }
                    else {
                        this.sending([this.pressedButton('RELEASE LEFT KEY (HOLD)')]);
                    }
                    callback(null);
                });
        }
        if (this.config.remainMovieTimer) {
            this.movieTimer = accessory.getService(this.platform.Service.Valve) || accessory.addService(this.platform.Service.Valve, 'Movie Timer', 'Movie Timer');
            this.movieTimer.setCharacteristic(this.platform.Characteristic.Name, 'Movie Timer');
            this.movieTimer.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
            this.movieTimer.setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Egreat Movie Timer');
            this.movieTimer.setCharacteristic(this.platform.Characteristic.ValveType, this.platform.Characteristic.ValveType.IRRIGATION);
            this.movieTimer.getCharacteristic(this.platform.Characteristic.Active)
                .on('get', (callback) => {
                    let currentValue = this.currentMovieProgressState ? 1 : 0
                    callback(null, currentValue);
                })
                .on('set', (value, callback) => {
                    callback(null);
                });
            this.movieTimer.setCharacteristic(this.platform.Characteristic.InUse, this.platform.Characteristic.InUse.NOT_IN_USE);
            this.movieTimer.getCharacteristic(this.platform.Characteristic.RemainingDuration)
                .on('get', (callback) => {
                    let currentValue = this.movieRemaining;
                    callback(null, currentValue);
                })
                .setProps({
                    maxValue: 86400 / 4, // 1 day
                });
            this.movieTimer.getCharacteristic(this.platform.Characteristic.SetDuration)
                .on('get', (callback) => {
                    let currentValue = this.movieRemaining;
                    callback(null, currentValue);
                })
                .setProps({
                    maxValue: 86400 / 4, // 1 day
                });


        }
        ///////////////Clean up. Delete services not in used
        if (this.config.remainMovieTimer === false) {
            this.accessory.removeService(this.movieTimer);
        }
        if (this.config.movieControl === false) {
            this.accessory.removeService(this.movieControlL);
            this.accessory.removeService(this.movieControlF);
        }

        if (this.config.volume === false) {
            this.accessory.removeService(this.volumeDimmer);
            this.accessory.removeService(this.volumeFan);
        }
        if (this.config.cursorUpB === false) {
            this.accessory.removeService(this.cursorUp);
        }
        if (this.config.cursorLeftB === false) {
            this.accessory.removeService(this.cursorLeft);
        }
        if (this.config.cursorDownB === false) {
            this.accessory.removeService(this.cursorDown);
        }
        if (this.config.cursorRightB === false) {

            this.accessory.removeService(this.cursorRight);
        }
        if (this.config.cursorEnterB === false) {

            this.accessory.removeService(this.cursorEnter);
        }
        if (this.config.menuB === false) {
            this.accessory.removeService(this.menu);
        }
        if (this.config.backButtonB === false) {
            this.accessory.removeService(this.backButton);
        }
        if (this.config.clearB === false) {
            this.accessory.removeService(this.clear);
        }
        if (this.config.infoB === false) {
            this.accessory.removeService(this.infoButton);
        }
        if (this.config.pageDownB === false) {
            this.accessory.removeService(this.pageDown);
        }
        if (this.config.pageUpB === false) {
            this.accessory.removeService(this.pageUp);
        }
        if (this.config.mediaButtons === false) {
            this.accessory.removeService(this.previous);
            this.accessory.removeService(this.next);
            this.accessory.removeService(this.rewindButton);
            this.accessory.removeService(this.forwardButton);
        }
        if (this.config.redB === false) {
            this.accessory.removeService(this.red);
        }
        if (this.config.blueB === false) {
            this.accessory.removeService(this.blue);
        }
        if (this.config.yellowB === false) {
            this.accessory.removeService(this.yellow);
        }
        if (this.config.greenB === false) {
            this.accessory.removeService(this.green);
        }
        if (this.config.subtitleB === false) {
            this.accessory.removeService(this.subtitle);
        }
        if (this.config.pictureB === false) {
            this.accessory.removeService(this.picture);
        }
        if (this.config.homeB === false) {
            this.accessory.removeService(this.homeB);
        }
        if (this.config.guideB === false) {
            this.accessory.removeService(this.guideB);
        }
        if (this.config.audioB === false) {
            this.accessory.removeService(this.audioB);
        }
        if (this.config.holdLeftB === false) {
            this.accessory.removeService(this.holdLeftB);
        }
        if (this.config.holdRightB === false) {
            this.accessory.removeService(this.holdRightB);
        }
        if (this.config.LEDOnOffB === false) {
            this.accessory.removeService(this.LEDOnOffB);
        }
        if (this.config.skipForwardB === false) {
            this.accessory.removeService(this.skipForwardB);
        }
        if (this.config.skipRewindB === false) {
            this.accessory.removeService(this.skipRewindB);
        }
        if (this.config.changeDimmersToFan === false) {
            this.accessory.removeService(this.volumeFan);
            this.accessory.removeService(this.movieControlF);
        }
        if (this.config.changeDimmersToFan === true) {
            this.accessory.removeService(this.volumeDimmer);
            this.accessory.removeService(this.movieControlL);
        }
        //////////////////Connecting to Egreat
        this.netConnect();
        //syncing////////////////////////////////////////////////////////////////////////////////////////
        setInterval(() => {
            if (!this.pauseUpdate) {
                tcpp.probe(this.EGREAT_IP, EGREAT_PORT, (err, isAlive) => {
                    this.isEgreatAlive = isAlive;
                    this.platform.log.debug(isAlive);
                });

                if (this.reconnectionCounter >= this.reconnectionTry) {
                    this.platform.log.debug("Egreat Not Responding");
                    this.connectionLimit = true;
                    this.connectionLimitStatus = 1;
                    this.turnOffAll();
                    // this.netConnect()
                }
                if (this.isEgreatAlive === false) {
                    this.turnOffAll();
                    if (this.reconnectionCounter >= this.reconnectionTry) {
                        this.platform.log.debug("Egreat Not Responding");
                        this.connectionLimit = true;
                        this.connectionLimitStatus = 1;
                        this.turnOffAll();
                        // this.netConnect()
                    }
                    this.reconnectionCounter += 1;
                    //this.netConnect()
                }
                if (this.isEgreatAlive === true && this.powerStateTV === 0) {
                    this.client.end();
                    delete this.client
                    this.netConnect();
                    // this.sending([this.pressedButton('POWER ON')]);
                }
            }
            else {
                setTimeout(() => {
                    this.pauseUpdate = false;
                }, 15000);
            }
            if (this.playBackState[0] === true) {
                this.movieCounter += this.config.pollingInterval / 1000;
                this.newMovieTime(this.movieCounter);
            }
            this.platform.log.debug('Ready State: ', this.client.readyState);
            //this.platform.log('Number of reconnection tries: ' + this.reconnectionCounter);
            this.tvService.updateCharacteristic(this.platform.Characteristic.Active, this.powerStateTV);
            this.play.updateCharacteristic(this.platform.Characteristic.On, this.playBackState[0]);
            this.pause.updateCharacteristic(this.platform.Characteristic.On, this.playBackState[1]);
            this.stop.updateCharacteristic(this.platform.Characteristic.On, this.playBackState[2]);
            this.tvService.updateCharacteristic(this.platform.Characteristic.CurrentMediaState, this.mediaState);
            this.tvService.updateCharacteristic(this.platform.Characteristic.ActiveIdentifier, this.inputID);
            this.speakerService.updateCharacteristic(this.platform.Characteristic.Volume, this.currentVolume);
            this.speakerService.updateCharacteristic(this.platform.Characteristic.Mute, this.currentMuteState);
            this.movieTittle.updateCharacteristic(this.platform.Characteristic.ConfiguredName, this.inputName);
            if (this.config.volume === true) {
                if (this.config.changeDimmersToFan === false) {
                    this.volumeDimmer.updateCharacteristic(this.platform.Characteristic.Brightness, this.currentVolume);
                    //this.volumeDimmer.getCharacteristic(this.platform.Characteristic.Brightness).updateValue(this.currentVolume);
                    this.volumeDimmer.updateCharacteristic(this.platform.Characteristic.On, this.currentVolumeSwitch);
                    //this.volumeDimmer.getCharacteristic(this.platform.Characteristic.On).updateValue(this.currentVolumeSwitch);
                }
                else {
                    this.volumeFan.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.currentVolume);
                    // this.volumeFan.getCharacteristic(this.platform.Characteristic.RotationSpeed).updateValue(this.currentVolume);
                    this.volumeFan.updateCharacteristic(this.platform.Characteristic.Active, this.currentVolumeSwitch === true ? 1 : 0);
                    // this.volumeFan.getCharacteristic(this.platform.Characteristic.Active).updateValue(this.currentVolumeSwitch === true ? 1 : 0);
                }
            }
            if (this.config.movieControl === true) {
                if (this.config.changeDimmersToFan === false) {
                    if (this.movieControlL.getCharacteristic(this.platform.Characteristic.Brightness).value !== this.currentMovieProgress) {
                        this.movieControlL.updateCharacteristic(this.platform.Characteristic.Brightness, this.currentMovieProgress);
                        // this.movieControlL.getCharacteristic(this.platform.Characteristic.Brightness).updateValue(this.currentMovieProgress);
                        this.movieControlL.updateCharacteristic(this.platform.Characteristic.On, this.currentMovieProgressState);
                        //this.movieControlL.getCharacteristic(this.platform.Characteristic.On).updateValue(this.currentMovieProgressState);
                    }
                }
                else {
                    if (this.movieControlF.getCharacteristic(this.platform.Characteristic.RotationSpeed).value !== this.currentMovieProgress) {
                        this.movieControlF.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.currentMovieProgress);
                        // this.movieControlF.getCharacteristic(this.platform.Characteristic.RotationSpeed).updateValue(this.currentMovieProgress);
                        this.movieControlF.updateCharacteristic(this.platform.Characteristic.Active, this.currentMovieProgressState === true ? 1 : 0);
                        //this.movieControlF.getCharacteristic(this.platform.Characteristic.Active).updateValue(this.currentMovieProgressState === true ? 1 : 0);
                    }
                }
            }
        }, this.config.pollingInterval);
    }
    //////////////Create Client//////////////////////////////////////////////////////////////////////////
    netConnect() {
        ////Creating the connection
        this.client = new net.Socket();
        this.client.setKeepAlive(true, 15000);
        //////Connect to client
        this.client.connect(EGREAT_PORT, this.EGREAT_IP, () => {
            this.platform.log.debug(`Connecting to ${this.config.name}`);
            clearTimeout(timer);
        });
        this.client.on('ready', () => {
            clearTimeout(timer);
            this.platform.log.debug(`${this.config.name} is ready`);
            this.platform.log.debug(`Sending: ${this.commandName(this.key)}`);
            this.sending([this.key]);
        });
        /////Receiving Data
        this.client.on('data', (data) => {
            clearTimeout(timer);
            this.eventDecoder(data);
            this.newPowerState(true);
            this.resetCounter();
        });
        /////Errors
        this.client.on('error', (e) => {
            clearTimeout(timer);
            this.platform.log.debug(`Error: ${e}`);
            this.platform.log.debug(`Trying to reconnect to ${this.config.name} after an error`);
            this.platform.log.debug(`Turn on ${this.config.name} and check the IP Address`);
            this.client.end();
            this.client.removeAllListeners();
            this.client.destroy();
            this.reconnectionCounter += 1;
            this.platform.log.debug("Reconnection counter is " + this.reconnectionCounter);
            // if (this.reconnectionCounter < this.reconnectionTry) {
        });
        ////Connection Closed
        this.client.on('close', () => {
            this.platform.log.debug(`Disconnected from ${this.config.name}`);
            this.reconnectionCounter += 1;
            this.currentMovieProgressFirst = true;
            this.client.end();
            this.client.removeAllListeners();
            this.client.destroy();
        });
        this.client.on('end', () => {
            this.platform.log.debug(`Connection to ${this.config.name} ended`);
            this.reconnectionCounter += 1;
            this.currentMovieProgressFirst = true;
            this.client.end();
            this.client.removeAllListeners();
            this.client.destroy();
        });
        /////Time out Timer
        const timer = setTimeout(() => {
            this.platform.log.debug('ERROR. Attempt at connection exceeded timeout value');
            // client.destroy();
        }, timeout);
    }
    //////////////////UDP Server

    ///////Handlers////////////////////////////////////////////////////////////////////////////////////////
    setOn(value, callback) {
        let egreatState = value;
        if (egreatState === true) {
            this.newPowerState(true);
            this.sending([this.pressedButton('POWER ON')]);
        }
        else {
            if (this.playBackState[0] === true) {
                this.sending([this.pressedButton('PAUSE')]);
                setTimeout(() => {
                    this.sending([this.pressedButton('POWER OFF')]);
                }, 200);
                // turnOffAll();
            }
            else {
                this.sending([this.pressedButton('POWER OFF')]);
                // turnOffAll();
            }
        }
        this.platform.log.debug('Set Power to ->', value);
        callback(null);
    }
    getOn(callback) {
        let isOn = this.powerState;
        this.platform.log.debug('Get Power ->', isOn);
        callback(null, isOn);
    }
    ///////////////////////////////////////////////////////////////////////////////////////////////////Play
    playSwitchStateGet(callback) {
        this.platform.log.debug('Play State');
        let currentValue = this.playBackState[0];
        callback(null, currentValue);
    }
    playSwitchStateSet(value, callback) {
        this.platform.log.debug('Play set to:', value);
        if (value === true) {
            this.sending([this.pressedButton('PLAY')]);
        }
        callback(null);
    }
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////Pause
    pauseSwitchStateGet(callback) {
        this.platform.log.debug('Pause State');
        let currentValue = this.playBackState[1];
        callback(null, currentValue);
    }
    pauseSwitchStateSet(value, callback) {
        this.platform.log.debug('Pause set to', value);
        if (value === true) {
            this.sending([this.pressedButton('PAUSE')]);
        }
        callback(null);
    }
    /////////////////////////////////////////////////////////////////////////////////////stop
    stopSwitchStateGet(callback) {
        this.platform.log.debug('Stop State');
        let currentValue = this.playBackState[2];
        callback(null, currentValue);
    }
    stopSwitchStateSet(value, callback) {
        this.platform.log.debug('Stop set to:', value);
        if (value === true) {
            this.sending([this.pressedButton('STOP')]);
        }
        callback(null);
    }
    /////////////////Command Log
    commandLog(commandPress) {
        //this.platform.log(commandPress);
        if (commandPress.includes("on")) {
            this.platform.log.debug(`Sending: ${this.commandName(commandPress)} ${this.newResponse}`);
        }
        else {
            this.platform.log(`Sending: ${this.commandName(commandPress)} ${this.newResponse}`);
        }
    }

    /////Sending Instructions/////////////////////////////////////////////////////////////////////////////////////////////////////
    sending(press) {
        this.platform.log.debug(`Connection counter is ${this.reconnectionCounter} `);
        // this.platform.log(`${press}`);

        let i = 0;
        while (i < press.length) {
            if (press[i].includes('keycode_on') || press[i].includes('play') || press[i].includes('pause') || press[i].includes('stop') || press[i].includes('keycode_off')) {
                this.reconnectionCounter += 1;
            }
            if (this.client.readyState === 'Closed') {
                this.client.end();
                delete this.client;
                this.key = press[i];
                this.netConnect();
                this.commandLog(press[i]);
                this.keyReset();
            }
            else {
                this.newResponse = `by TCP (${this.reconnectionCounter})`;
                this.platform.log.debug(`${press[i]} sent by TCP`);
                this.client.write(press[i]);
                this.commandLog(press[i]);
            }

            i += 1;
        }
    }
    //////////////////Make URL for HTTP///////////////
    //////////Current Status//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /*
    newVolumeStatus(newVolumeNum) {
        this.currentVolume = newVolumeNum;
        if (newVolumeNum === 0) {
            this.currentMuteState = true;
            this.currentVolumeSwitch = false;
        }
        if (newVolumeNum !== 0) {
            this.currentMuteState = false;
            this.currentVolumeSwitch = true;
        }
        this.speakerService.updateCharacteristic(this.platform.Characteristic.Volume, this.currentVolume);
        this.speakerService.updateCharacteristic(this.platform.Characteristic.Mute, this.currentMuteState);
        this.speakerService.getCharacteristic(this.platform.Characteristic.Volume).updateValue(this.currentVolume);
        this.speakerService.getCharacteristic(this.platform.Characteristic.Mute).updateValue(this.currentMuteState)
        if (this.config.volume === true) {
            this.volumeDimmer.updateCharacteristic(this.platform.Characteristic.Brightness, this.currentVolume);
            this.volumeDimmer.getCharacteristic(this.platform.Characteristic.Brightness).updateValue(this.currentVolume);
            this.volumeDimmer.updateCharacteristic(this.platform.Characteristic.On, this.currentVolumeSwitch);
            this.volumeDimmer.getCharacteristic(this.platform.Characteristic.On).updateValue(this.currentVolumeSwitch);
        }
    }
    */
    newInputName(newName) {
        if (newName.includes('.iso') || newName.includes('.ISO') || newName.includes('.MKV') || newName.includes('.mkv') || newName.includes('.mp4') || newName.includes('.mp4')) {
            newName = newName.substring(0, newName.length - 4);
        }
        if (newName.length >= 64) {
            newName = newName.slice(0, 60) + "...";
        }
        this.inputName = newName;
        this.platform.log.debug(this.inputName);
        if (this.movieTittle.getCharacteristic(this.platform.Characteristic.ConfiguredName).value !== this.inputName) {
            this.movieTittle.updateCharacteristic(this.platform.Characteristic.ConfiguredName, this.inputName)
        }
    }
    newInputDuration(newDuration) {
        if (!newDuration.includes('Runtime')) {
            let hourMintue = ''
            if (this.movieRemaining > 3600) {
                hourMintue = 'Hours';
            }
            else if (this.movieRemaining == 3600) {
                hourMintue = 'Hour';
            }
            else {
                hourMintue = 'Minutes';
            }
            this.inputDuration = 'Runtime: ' + newDuration + ' ' + hourMintue;
        }
        else {
            this.inputDuration = newDuration;
        }
        if (this.movieDuration.getCharacteristic(this.platform.Characteristic.ConfiguredName).value !== this.inputDuration) {
            this.movieDuration.updateCharacteristic(this.platform.Characteristic.ConfiguredName, this.inputDuration)
        }
    }
    newMovieTime(newMovieTime) {
        if (newMovieTime === 0) {
            this.currentMovieProgressState = false;
            this.currentMovieProgress = 0;
        }
        if (newMovieTime !== 0) {
            this.currentMovieProgressState = true;
        }
        if (this.movieRemaining !== 0) {
            this.currentMovieProgress = Math.round(newMovieTime * 100 / (this.movieRemaining));
        }
        if (this.currentMovieProgressState === true && this.currentMovieProgress === 0) {
            this.currentMovieProgress = 1;
        }
        if (this.currentMovieProgress > 100) { this.currentMovieProgress = 100 }
        if (this.config.movieControl === true) {
            if (this.config.changeDimmersToFan === false) {
                if (this.movieControlL.getCharacteristic(this.platform.Characteristic.Brightness).value !== this.currentMovieProgress) {
                    this.movieControlL.updateCharacteristic(this.platform.Characteristic.Brightness, this.currentMovieProgress);
                    // this.movieControlL.getCharacteristic(this.platform.Characteristic.Brightness).updateValue(this.currentMovieProgress);
                    this.movieControlL.updateCharacteristic(this.platform.Characteristic.On, this.currentMovieProgressState);
                    //this.movieControlL.getCharacteristic(this.platform.Characteristic.On).updateValue(this.currentMovieProgressState);
                }
            }
            else {
                if (this.movieControlF.getCharacteristic(this.platform.Characteristic.RotationSpeed).value !== this.currentMovieProgress) {
                    this.movieControlF.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.currentMovieProgress);
                    // this.movieControlF.getCharacteristic(this.platform.Characteristic.RotationSpeed).updateValue(this.currentMovieProgress);
                    this.movieControlF.updateCharacteristic(this.platform.Characteristic.Active, this.currentMovieProgressState === true ? 1 : 0);
                    //this.movieControlF.getCharacteristic(this.platform.Characteristic.Active).updateValue(this.currentMovieProgressState === true ? 1 : 0);
                }
            }
        }
        if (this.config.remainMovieTimer) {
            this.newRemainingTime = (this.movieRemaining - newMovieTime);
            if (this.movieTimer.getCharacteristic(this.platform.Characteristic.Active).value != this.currentMovieProgressState ? 1 : 0) {
                this.movieTimer.updateCharacteristic(this.platform.Characteristic.Active, this.currentMovieProgressState ? 1 : 0);
                this.movieTimer.updateCharacteristic(this.platform.Characteristic.InUse, this.currentMovieProgressState ? 1 : 0);
            }
            if (this.newRemainingTime !== this.movieTimer.getCharacteristic(this.platform.Characteristic.RemainingDuration).value) {
                this.movieTimer.updateCharacteristic(this.platform.Characteristic.RemainingDuration, this.newRemainingTime);
            }
            if (this.movieRemaining !== this.movieTimer.getCharacteristic(this.platform.Characteristic.SetDuration).value) {
                this.movieTimer.updateCharacteristic(this.platform.Characteristic.SetDuration, this.movieRemaining);
            }
        }
    }
    newPowerState(newValue) {
        if (newValue === true) {
            this.powerStateTV = 1;
        }
        else {
            this.powerStateTV = 0;
        }
        this.powerState = newValue;
        this.tvService.updateCharacteristic(this.platform.Characteristic.Active, this.powerStateTV);
        this.tvService.getCharacteristic(this.platform.Characteristic.Active).updateValue(this.powerStateTV);
    }
    newPlayBackState(newPlay) {
        this.playBackState = newPlay;
        if (this.playBackState[0] === true) {
            this.mediaState = 0;
        }
        if (this.playBackState[1] === true) {
            this.mediaState = 1;
        }
        if (this.playBackState[2] === true) {
            this.mediaState = 2;
        }
        if (this.playBackState[0] === false && this.playBackState[1] === false && this.playBackState[2] === false) {
            this.mediaState = 4;
        }
        this.play.updateCharacteristic(this.platform.Characteristic.On, this.playBackState[0]);
        this.play.getCharacteristic(this.platform.Characteristic.On).updateValue(this.playBackState[0]);
        this.pause.updateCharacteristic(this.platform.Characteristic.On, this.playBackState[1]);
        this.pause.getCharacteristic(this.platform.Characteristic.On).updateValue(this.playBackState[1]);
        this.stop.updateCharacteristic(this.platform.Characteristic.On, this.playBackState[2]);
        this.stop.getCharacteristic(this.platform.Characteristic.On).updateValue(this.playBackState[2]);
        this.tvService.updateCharacteristic(this.platform.Characteristic.CurrentMediaState, this.mediaState);
        this.tvService.getCharacteristic(this.platform.Characteristic.CurrentMediaState).updateValue(this.mediaState);
    }
    newInputState(newInput) {
        this.inputState = newInput;
        if (this.inputState[0] === true) {
            this.inputID = 1;
        }
        else if (this.inputState[1] === true) {
            this.inputID = 2;
        }
        else if (this.inputState[2] === true) {
            this.inputID = 3;
        }

        else if (this.inputState[0] === false && this.inputState[1] === false && this.inputState[2] === false) {
            this.inputID = 0;
        }
        else {
        }
        this.tvService.updateCharacteristic(this.platform.Characteristic.ActiveIdentifier, this.inputID);
        this.tvService.getCharacteristic(this.platform.Characteristic.ActiveIdentifier).updateValue(this.inputID);
    }
    ///Event decoder//////////////////////////////////////////////////////////////////////////////////////////////////////////////
    eventDecoder(dataReceived) {
        let str = (`${dataReceived}`);
        this.platform.log.debug(str);
        let res = str.split(',');
        let i = 0;
        while (i < res.length) {
            this.platform.log.debug(i);
            this.platform.log.debug(res[i]);
            if (res[i] === '' || res[i].includes('CMD') || res[i].includes('END') || res[i].includes('NOTIFY') || res[i].includes('on')) {
                //
            }
            ///////////////Power Status/////////////////////////////////////////////////////////////////////
            else if (res[i].includes('standby')) {
                this.platform.log(`Response: ${this.commandName(res[i])} ${this.newResponse}`);
                this.resetCounter();
                this.newPowerState(true);
            }
            //////Playback update/////////////////////////////////////////////////////////////
            else if (res[i].includes('PLAYINFO')) {
                this.platform.log(`Response: New Movie/Video Title`);
                let tittle = res[i].split('"');
                this.platform.log.debug(tittle[3])
                this.newInputName(tittle[3]);
                this.newPowerState(true);
            }
            else if (res[i].includes('runtime')) {
                this.platform.log(`Response: New Video Runtime`);
                let runtime = res[i].split(':');
                this.movieRemaining = parseInt(runtime[1]) / 1000;
                let runtimeNumber = this.secondsToTime(parseInt(runtime[1]) / 1000);
                if (runtimeNumber.startsWith('0')) {
                    runtimeNumber = runtimeNumber.substring(1);
                }
                this.platform.log.debug(runtimeNumber);
                this.newInputDuration(runtimeNumber);
                this.newPowerState(true);
            }
            else if (res[i].includes('PLAY')) {
                this.platform.log(`Response: Play Executed`);
                this.resetCounter();
                this.newPlayBackState([true, false, false]);
                this.newPowerState(true);
            }

            else if (res[i].includes('PAUSE')) {
                this.platform.log(`Response: Pause Executed`);
                this.resetCounter();
                this.newPowerState(true);
            }
            else if (res[i].includes('STOP')) {
                this.platform.log(`Response: Stop Executed`);
                this.resetCounter();
                this.newPlayBackState([false, false, false]);
                this.newInputName('Media Title');
                this.newInputDuration('Runtime');
                this.newPowerState(true);
                this.movieChapterDefault();
            }
            else {
                this.platform.log(`Response: ${this.commandName(res[i])}`);
            }
            i += 1;
        }

    }
    ///Query////////////////////////////////////////////////////////////////////////////////////////////////////
    //////////Sending Command Dame Decoder///////////
    commandName(keyS) {
        let keySent = '';
        if (keyS.includes('on')) {
            keySent = 'Power On';
        }
        else if (keyS.includes('off')) {
            keySent = 'Power Off';
        }
        else if (keyS.includes('dpad_up')) {
            keySent = 'Cursor Up';
        }
        else if (keyS.includes('dpad_down')) {
            keySent = 'Cursor Down';
        }
        else if (keyS.includes('dpad_left')) {
            keySent = 'Cursor Left';
        }
        else if (keyS.includes('dpad_right')) {
            keySent = 'Cursor Right';
        }
        else if (keyS.includes('dpad_center')) {
            keySent = 'Enter';
        }
        else if (keyS.includes('menu')) {
            keySent = 'Menu';
        }
        else if (keyS.includes('back')) {
            keySent = 'Back';
        }
        else if (keyS.includes('media_pause')) {
            keySent = 'Pause';
        }
        else if (keyS.includes('media_stop')) {
            keySent = 'Stop';
        }
        else if (keyS.includes('media_previous')) {
            keySent = 'Previous Chapter';
        }
        else if (keyS.includes('media_next')) {
            keySent = 'Next Chapter';
        }
        else if (keyS.includes('dot')) {
            keySent = 'Clear';
        }
        else if (keyS.includes('guide')) {
            keySent = 'Guide';
        }
        else if (keyS.includes('home')) {
            keySent = 'Home';
        }
        else if (keyS.includes('info')) {
            keySent = 'Information';
        }
        else if (keyS.includes('scan_rev')) {
            keySent = 'Rewind';
        }
        else if (keyS.includes('scan_fwd')) {
            keySent = 'Forward';
        }
        else if (keyS.includes('page_up')) {
            keySent = 'Page Up';
        }
        else if (keyS.includes('page_down')) {
            keySent = 'Page Down';
        }
        else if (keyS.includes('program_a')) {
            keySent = 'Red';
        }
        else if (keyS.includes('program_b')) {
            keySent = 'Green';
        }
        else if (keyS.includes('program_d')) {
            keySent = 'Blue';
        }
        else if (keyS.includes('program_c')) {
            keySent = 'Yellow';
        }
        else if (keyS.includes('audio')) {
            keySent = 'Audio';
        }
        else if (keyS.includes('subtitle')) {
            keySent = 'Subtitle';
        }
        else if (keyS.includes('ratio')) {
            keySent = 'Screen Ratio';
        }
        else if (keyS.includes('dpad_start_left')) {
            keySent = 'Hold Left Key';
        }
        else if (keyS.includes('dpad_start_right')) {
            keySent = 'Hold Right Key';
        }
        else if (keyS.includes('dpad_stop_left')) {
            keySent = 'Releae left Key';
        }
        else if (keyS.includes('dpad_stop_right')) {
            keySent = 'Release Right Key';
        }
        else if (keyS.includes('led_off')) {
            keySent = 'LED On/Off';
        }
        else if (keyS.includes('skip_fwd')) {
            keySent = 'Skip Forward';
        }
        else if (keyS.includes('skip_rev')) {
            keySent = 'Skip Rewind';
        }

        else {
            keySent = keyS;
            keySent += ' Executed';
            return keySent
        }
        if (keyS.includes('NOTIFY')) {
            keySent += ' Executed';
        }
        else if (keyS.includes('INVALID')) {
            keySent += ' Invalid Command';
        }
        else {
            keySent += ' Command';
        }
        return keySent
    }
    /////egreat controls/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    pressedButton(name) {
        let key;
        key = 'CMD,keycode_';
        switch (name) {
            //POWER ButtonGroup
            case 'POWER ON':
                key += 'on';
                break;
            case 'POWER OFF':
                key += 'off';
                break;
            case 'CURSOR UP':
                key += 'dpad_up';
                break;
            case 'CURSOR DOWN':
                key += 'dpad_down';
                break;
            case 'CURSOR LEFT':
                key += 'dpad_left';
                break;
            case 'CURSOR RIGHT':
                key += 'dpad_right';
                break;
            case 'CURSOR ENTER':
                key += 'dpad_center';
                break;
            case 'MENU':
                key += 'menu';
                break;
            case 'BACK':
                key += 'back';
                break;
            case 'PLAY':
                key += 'media_play';
                break;
            case 'PAUSE':
                key += 'media_pause';
                break;
            case 'STOP':
                key += 'media_stop';
                break;
            case 'PREVIOUS':
                key += 'media_previous';
                break;
            case 'NEXT':
                key += 'media_next';
                break;
            case 'CLEAR':
                key += 'dot';
                break;
            case 'TOP MENU':
                key += 'guide';
                break;
            case 'HOME MENU':
                key += 'home';
                break;
            case 'INFO':
                key += 'info';
                break;
            case 'REWIND':
                key += 'scan_rev';
                break;
            case 'FORWAD':
                key += 'scan_fwd';
                break;
            case 'PAGE UP':
                key += 'page_up';
                break;
            case 'PAGE DOWN':
                key += 'page_down';
                break;
            case 'RED':
                key += 'program_a';
                break;
            case 'GREEN':
                key += 'program_b';
                break;
            case 'BLUE':
                key += 'program_d';
                break;
            case 'YELLOW':
                key += 'program_c';
                break;
            case 'AUDIO':
                key += 'audio';
                break;
            case 'SUBTITLE':
                key += 'subtitle';
                break;
            case 'PIC':
                key += 'ratio';
                break;
            case 'HOLD LEFT KEY (HOLD)':
                key += 'dpad_start_left';
                break;
            case 'RELEASE LEFT KEY (HOLD)':
                key += 'dpad_stop_left';
                break;
            case 'HOLD RIGHT KEY (HOLD)':
                key += 'dpad_start_right';
                break;
            case 'RELEASE RIGHT KEY (HOLD)':
                key += 'dpad_stop_right';
                break;
            case 'LED ON/OFF':
                key += 'led_off';
                break;
            case 'SKIP FORWARD':
                key += 'skip_fwd';
                break;
            case 'SKIP REWIND':
                key += 'skip_rev';
                break;
        }
        key += ',END';
        return key;
    }
    /////////Data Management/////////////////////////////////////////////////////////////
    keyReset() {
        setTimeout(() => {
            this.key = this.pressedButton('POWER ON');
        }, 1000)
    }
    timeToSeconds(hms) {
        let a = hms.split(':');
        let seconds = (+a[0]) * 60 * 60 + (+a[1]) * 60 + (+a[2]);
        return seconds;
    }

    justNumber(number) {
        let timeDate = number.replace(/^\D+/g, '')
        return timeDate
    }
    secondsToTime(seconds) {
        let date = new Date(0);
        date.setSeconds(parseInt(seconds)); // specify value for SECONDS here
        let timeString = date.toISOString().substr(11, 8);
        return timeString
    }


    ////Update instructions
    resetCounter() {
        this.reconnectionCounter = 0;
        this.connectionLimit = false;
        this.connectionLimitStatus = 0;
        this.newResponse = '';
    }

    movieChapterDefault() {
        if (this.config.movieControl === true) {
            this.currentMovieProgressFirst = true;
            this.movieRemaining = 0;
            this.newMovieTime(0);
            this.movieCounter = 0;
        }
    }
    turnOffAll() {
        this.newRemainingTime = 0;
        this.pauseUpdate = false;
        this.newPowerState(false);
        this.newPlayBackState([false, false, false]);
        this.newInputState([false, false, false]);
        //this.newVolumeStatus(0);
        this.newInputName('Media Title');
        this.newInputDuration('Runtime');
        this.movieChapterDefault();
    }
}
