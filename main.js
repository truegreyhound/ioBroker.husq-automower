/* jshint -W097 */ // jshint strict:false
/*jslint node: true */
"use strict";

//!V! 0.3.1.0

//!I! in den Husqvarna-GPS-Daten fehlt Zeitstempel!


// !P! wenn Adapter beendet wird dailyData sichern, Welche? : ???

// !P! mWaitAfterRainTimer is not used !?
// !P! mWaitAutoTimer is not used !?

// !P! NextStartTime == UTC + 2h

//!P! in config button to test connection data and fill Combobox to select a mower, on one, fill direct

//!P! kurz vor Autostart mower (wie auslesen, sonst manuell eintragen) prüfen ob Regen, wenn ja, dann mower stop

//!P! Bei Fehler die aktuellen GPS-Koordinaten speichern, passiert doch oder?

//!P! mover.isCutting scheint nicht gesetzt zu werden!?

//!P! es scheint einen Befehl "Pause" zu geben, unklar ist zumindest, wie der Status Pause entsteht und ob Pause bedeutet auf aktueller Position bleiben oder Pause in Ladestation
//!P! Wenn Mover in Status Pause wechselt, prüfen, ob in Ladestation (GPS + Abweichung, Druckschalter (in Arbeit), ???), Wenn nicht, dann Telegram-Nachricht und nach Zeit XXX automatisch parken lassen ?!
//!P! Druckschalter an Raspberry anschließen, der erkennt, ob Mover in Ladestation
//!P! Wenn Druckschalter anspricht und letzter Status != LEAVING und altueller Status != CUTTING (testen!) --> ALARM

//!P! via einem Scheduler (setInterval) prüfen, dass Status etc. aktualisiert wird, wenn nicht bzw. http-Fehler oder sich trotz CUTTING GPS-Daten nicht ändern --> ALARM

//!P! Aus Batteriestand beim Start (cutting) und bei Rückkehr (park) und dem Verbrauch den aktuellen Wirkungsgrad der Batterie berechnen

//!P! Beim Start (cutting) Startzeitpunkt setzen (do) und Endzeit löschen.
//!P! Wenn fertig (parking) dann Endzeit speichern

//!P! Batteriekapazität überwachen, wenn unter xx (10% ?) sinkt, Alarm per telegramm

//!P! Wenn Mover geparkt, dann Timer programmieren ermöglichen, der Mover wieder startet

//!P! Wenn Mover durch Regenfunktion geparkt, prüfen, warum restart nicht klappt

//!P! Regentaste, wenn gedrückt den Mäher parken und erst wieder starten, wenn Regentimer den Start wieder freigibt
//!P! Taste wirkt // zum "Regensensor"

//!P! idStopOnRain
//!P! - gesetzt durch forecast
//!P! - gesetzt durch Regensensor (in Vorbereitung), muss per telegramm or MQTT von Uelitz nach Berlin


//!P! "Pause"-Taste --> mover parken, startet Timer mit einstellbarer Zeit (oder jeder Pausendruck erhöht Pausenwert um X), nach Ablaus geht Mover wieder in Normalbetrieb

//!P! Es gibt wohl noch weitere Befehle ?? add_push_id, remove_push_id <-- ggf. nur für iOS/Android; geo_status, get_mower_settings

//!P! beim Speichern der Datumsinformationen Zeitzone beachten, scheint lokale Zeit zu sein LC --> GC
//!P! iOS-App sagt nächster Start "Dienstag 00:00"; in Datensatz steht "2017-07-11 02:00:00"; Welche Anzeige ist richtig?
//!P! im DP müsste doch dann "2017-07-10 22:00:00" stehen als GC

//!P! Idee, Wenn Cutting und bei den letzten 2 Statusabfragen keine Änderung des Standortes wahrscheinlich Fehler oder?

//!P! dpAutoTimerWatch anzeigen

/*
Handy-App
- sollte Mähdauer anzeigen und wahrscheinlich nächsten Boxenstop
- letzte Datenaktualisierung
- Akkustatus (% Kapazität) beim Mähen anzeigen, wird jetzt angezeigt
- bei bestimmten Fehlern (hängt fest), sollte ein Start per App möglich sein
- Mäher hatte Netzverbindung verloren, via App nicht erkennbar, es fehlt Datum/Uhrzeit letzte Aktualisierung vom Mäher
- Datum/Uhrzeit == lokale Zeit ???
- Rückmeldung Mähen erforderlich (Mähwiderstand)
- Rückmeldung aktiver Mähbereich
- bei Statusänderung sollte der Auslöser "festgehalten" werden: mover timer, App + account, via Web-API + account
*/

/*
Actions
- Start
- Park
- Stop


*/

/*
Status
- OFF_HATCH_OPEN
- OFF_HATCH_CLOSED_DISABLED - deaktiviert, manueller Start erforderlich
- OK_CHARGING
- OK_CUTTING
- OK_LEAVING
- OK_SEARCHING
- PARKED_AUTOTIMER
- OFF_DISABLED
- ERROR
- PARKED_PARKED_SELECTED
- PAUSED

ErrorCodes
 2 - kein Schleifensignal, Mover fährt aber weiter, unkritisch
13 - kein Antrieb
25 - Mäheinheit ist blockiert
69 - ????
71 - Mäher angehoben

next start source
- MOWER_CHARGING
- NO_SOURCE
- COMPLETED_CUTTING_TODAY_AUTO --> nextStartTimestamp --> 2017-07-07 02:00:00
- WEEK_TIMER --> nextStartTimestamp --> 2017-07-07 02:00:00

OperatingMode
- Auto
- HOME --> PARKED_PARKED_SELECTED

*/


// you have to require the utils module and call adapter function
var utils = require(__dirname + '/lib/utils'); // Get common adapter utils
// you have to call the adapter function and pass a options object
// name has to be set and has to be equal to adapters folder name and main file name excluding extension
// adapter will be restarted automatically every time as the configuration changed, e.g system.adapter.template.0
var adapter = utils.Adapter('husq-automower');

var HusqApiRequest = require(__dirname + '/lib/HusqApiRequest');
var husqApi = new HusqApiRequest(adapter);
var husqSchedule = require('node-schedule');

//var weekday = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

var idnMowerConnected = 'info.connected',
    idnMowerFirmware = 'info.firmware',
    idnMowerNickname = 'info.nickname',
    idnMowerID = 'info.mower_id',
    idnMowerModel = 'info.model',
    idnMowersIndex = 'info.mowers_index',
    idnMowersJson = 'info.mowers_json',

    idnHomeLocationName = 'mower.homeLocation.name',
    idnHomeLocationLongitude = 'mower.homeLocation.longitude',
    idnHomeLocationLatitude = 'mower.homeLocation.latitude',
    idnHomeLocationLongitudeCP = 'mower.homeLocation.longitudeCP',      // CP == Husqvarna central point record
    idnHomeLocationLatitudeCP = 'mower.homeLocation.latitudeCP',
    idnHomeLocationLongitudeOffset = 'mower.homeLocation.longitudeOffset',
    idnHomeLocationLatitudeOffset = 'mower.homeLocation.latitudeOffset',
    idnHomeLocationCurrentDistance = 'mower.homeLocation.currentDistance',
    idnHomeLocationMaxDistance = 'mower.homeLocation.maxDistance',
    idnHomeLocationSensitivityLevel = 'mower.homeLocation.sensitivityLevel',
    idnHomeLocationSensitivityRadius = 'mower.homeLocation.sensitivityRadius',

    idnLastLocationLatitude = 'mower.lastLocation.latitude',
    idnLastLocationLongitude = 'mower.lastLocation.longitude',
    idnLastLocationTimestamp = 'mower.lastLocation.timestamp',

    idnBladeTime = 'mower.statistics.bladeTime',
    idnBladeTimeStart = 'mower.bladeTimeStart',
    idnBladeTimeBatteryCurrent = 'mower.statistics.bladeTimeBatteryCurrent',
    idnBladeTimeBatteryNew = 'mower.statistics.bladeTimeBatteryNew',
    idnBatteryChargeCycle = 'mower.statistics.batteryChargeCycle',
    idnCharchingStartTime = 'mower.statistics.chargingBatteryStarttime',
    idnChargingTimeBatteryCurrent = 'mower.statistics.chargingTimeBatteryCurrent',
    idnChargingTimeBatteryNew = 'mower.statistics.chargingTimeBatteryNew',
    idnCurrentCoveredDistance = 'mower.statistics.currentCoveredDistance',
    idnLastBladeTime = 'mower.statistics.lastBladeTime',
    idnLastCoveredDistance = 'mower.statistics.lastCoveredDistance',
    idnLastStationReturnTime = 'mower.statistics.lastStationReturnTime',
    idnOverallBladeTime = 'mower.statistics.overallBladeTime',
    idnOverallCoveredDistance = 'mower.statistics.overallCoveredDistance',

    idnAMAction = 'mower.action',
    idnBatteryPercent = 'mower.batteryPercent',
    idnCurrentErrorCode = 'mower.currentErrorCode',
    idnCurrentErrorCodeTS = 'mower.currentErrorCodeTimestamp',
    idnLastAction = 'mower.lastAction',
    idnLastDockingTime = 'mower.lastDockingTime',
    idnLastErrorCode = 'mower.lastErrorCode',
    idnLastErrorCodeTS = 'mower.lastErrorCodeTimestamp',
    idnLastHttpStatus = 'mower.lastHttpStatus',
    idnLastLocations = 'mower.lastLocations',
    idnLastStatus = 'mower.lastStatus',
    idnLastStatusTime = 'mower.lastStatusTime',
    idnLastStatusChangeTime = 'mower.lastStatusChangeTime',
    idnLastDayLocations = 'mower.lastdayLocations',
    idnNextStartSource = 'mower.nextStartSource',
    idnNextStartTime = 'mower.nextStartTime',        // --> io-package
    idnNextStartWatching = 'mower.nextStartWatching',
    idnOperatingMode = 'mower.operatingMode',
    idnStopOnRainEnabled = 'mower.stopOnRainEnabled',
    idnStoppedDueRain = 'mower.stoppedDueRain',
    idnTimerAfterRainStartAt = 'mower.timerAfterRainStartAt',
    //!P! ??idnWaitAfterRain = 'mower.waitAfterRain',
    idnRawSend = 'mower.rawSend',
    idnRawResponse = 'mower.rawResponse',
    idnRawResponseGeo = 'mower.rawResponse_geo',
    idnSendMessage = 'mower.sendMessage',
    ThisIsTheEnd;


var mobjMower = [],
    mQueryIntervalActive_s = 30,
    mQueryIntervalInactive_s = 300,
    mCurrentStatus = 'unknown',
    mLastStatus = 'unknown',
    mHomeLocationLongitude = 0,
    mHomeLocationLatitude = 0,
    mNextStart = 0,
    mStoppedDueRain = false,
    mLastErrorCode = 0,
    mLastErrorCodeTimestamp = 0,
    mJsonLastLocations = [],
    mDist = 0,
    mMaxDistance = 0,
    mMaxDistance = 0,
    mLastLocationLongi = 0,
    mLastLocationLati = 0,
    mTime = 0,
    mStartBladeTime = 0,
    mBladeTime = 0,
    mSearchingStartTime = 0,
    mCharchingStartTime = 0,
    mChargingTimeBatteryCurrent = 0,
    mChargingTimeBatteryNew = 0,
    mScheduleStatus = null,
    mScheduleTime = 1,
    mTimeZoneOffset = 0,
    mWaitAfterRainTimer = null,
    mWaitAutoTimer = null,
    mBatteryChargeCycle = 0,
    mLastStatusChangeTime = 0,
    mScheduleDailyAccumulation = null,
    mUrlGoogleMaps = 'http://maps.google.com/maps?q=',
    ThisIsTheEnd2;


adapter.on('unload', function (callback) {
    try {
        husqApi.logout();
        if(mScheduleStatus !== null) clearInterval(mScheduleStatus);    //.cancel;
        if(mScheduleDailyAccumulation !== null) mScheduleDailyAccumulation.cancel;

        if (adapter.setState) adapter.setState('info.connection', false, true);

        adapter.log.info('cleaned everything up...');

        callback();
    } catch (e) {
        callback();
    }
});


adapter.on('objectChange', function (id, obj) {
    if (!state || state.ack) return;
    // output to parser
});


/**
 * Function to create a state and set its value
 * only if it hasn't been set to this value before
 * from 'node_modules/iobroker.unifi/main.js'
 */
function createState(name, value, desc, _write, _unit) {

    if(typeof(desc) === 'undefined')
        desc = name;
    if(typeof(_write) === 'undefined')
        _write = false;
    if(typeof(_write) !== 'boolean')
        _write = false;

    if(Array.isArray(value))
        value = value.toString();

    if(typeof(_unit) === 'undefined') {
        adapter.setObjectNotExists(name, {
            type: 'state',
            common: {
                name: name,
                desc: desc,
                type: typeof(value),
                read: true,
                write: _write
            },
            native: {id: name}
        }, function(err, obj) {
            if (!err && obj) {
                if(typeof(value) !== 'undefined') {
                    adapter.setState(name, {
                        val: value,
                        ack: true
                    });
                }
            }
        });
    } else {
        adapter.setObjectNotExists(name, {
            type: 'state',
            common: {
                name: name,
                desc: desc,
                type: typeof(value),
                read: true,
                write: _write,
                unit: _unit
            },
            native: {id: name}
        }, function(err, obj) {
            if (!err && obj) {
                if(typeof(value) !== 'undefined') {
                    adapter.setState(name, {
                        val: value,
                        ack: true
                    });
                }
            }
        });
    }
//    if(typeof(value) !== 'undefined')
//        setStateArray.push({name: name, val: value});
}


function createChannels() {

    var fctName = 'createChannels';
    adapter.log.debug(fctName + ' started');

    adapter.setObjectNotExists('info', {
        type: 'channel',
        role: 'info',
        common: {
            name: 'information',
        },
        native: {}
    }, function(err) {
        if (err) adapter.log.error('Cannot write object: ' + err);
    });

    adapter.setObjectNotExists('mower', {
        type: 'channel',
        role: 'info',
        common: {
            name: 'mower',
        },
        native: {}
    }, function(err) {
        if (err) adapter.log.error('Cannot write object: ' + err);
    });

    adapter.setObjectNotExists('mower.homeLocation', {
        type: 'channel',
        role: 'info',
        common: {
            name: 'mower.homeLocation',
        },
        native: {}
    }, function(err) {
        if (err) adapter.log.error('Cannot write object: ' + err);
    });

    adapter.setObjectNotExists('mower.lastLocation', {
        type: 'channel',
        role: 'info',
        common: {
            name: 'mower.lastLocation',
        },
        native: {}
    }, function(err) {
        if (err) adapter.log.error('Cannot write object: ' + err);
    });

    adapter.setObjectNotExists('mower.statistics', {
        type: 'channel',
        role: 'info',
        common: {
            name: 'mower.statistics',
        },
        native: {}
    }, function(err) {
        if (err) adapter.log.error('Cannot write object: ' + err);
    });

    adapter.log.debug(fctName + ' finished');

} // createChannels()


function createDPs() {

    var fctName = 'createDPs',
        enableJson = adapter.config.enableJson;

    adapter.log.debug(fctName + ' started');

    createState(idnMowerConnected, false);
    createState(idnMowerFirmware, '');
    createState(idnMowerNickname, '');
    createState(idnMowerID, '');
    createState(idnMowerModel, '');
    createState(idnMowersIndex, -1);

    if(enableJson) { createState(idnMowersJson, []); }

    createState(idnHomeLocationName, '', idnHomeLocationName, true);
    createState(idnHomeLocationLongitude, 0, idnHomeLocationLongitude, true);
    createState(idnHomeLocationLatitude, 0, idnHomeLocationLatitude, true);
    createState(idnHomeLocationLongitudeCP, 0);
    createState(idnHomeLocationLatitudeCP, 0);
    createState(idnHomeLocationLongitudeOffset, 0, idnHomeLocationLongitudeOffset, true);
    createState(idnHomeLocationLatitudeOffset, 0, idnHomeLocationLatitudeOffset, true);
    createState(idnHomeLocationCurrentDistance, 0, idnHomeLocationCurrentDistance, false, "m");
    createState(idnHomeLocationMaxDistance, 100, idnHomeLocationMaxDistance, true, "m");
    createState(idnHomeLocationSensitivityLevel, 3);
    createState(idnHomeLocationSensitivityRadius, 1000);

    createState(idnLastLocationLatitude, 0);
    createState(idnLastLocationLongitude, 0);
    createState(idnLastLocationTimestamp, 0);

    createState(idnBladeTime, 0, idnBladeTime, false, "min.");
    createState(idnBladeTimeStart, 0);
    createState(idnBladeTimeBatteryCurrent, 0, idnBladeTimeBatteryCurrent, false, "min.");
    createState(idnBladeTimeBatteryNew, 0, idnBladeTimeBatteryNew, false, "min.");
    createState(idnBatteryChargeCycle, 0);
    createState(idnCharchingStartTime, 0);
    createState(idnChargingTimeBatteryCurrent, 0, idnChargingTimeBatteryCurrent, false, "min.");
    createState(idnChargingTimeBatteryNew, 0, idnChargingTimeBatteryNew, false, "min.");
    createState(idnCurrentCoveredDistance, 0, idnCurrentCoveredDistance, false, "m");
    createState(idnLastBladeTime, 0, idnLastBladeTime, false, "min.");
    createState(idnLastCoveredDistance, 0, idnLastCoveredDistance, false, "m");
    createState(idnLastStationReturnTime, 0, idnLastStationReturnTime, false, "min.");
    createState(idnOverallBladeTime, 0, idnOverallBladeTime, false, "h");
    createState(idnOverallCoveredDistance, 0, idnOverallCoveredDistance, false, "km");

    createState(idnAMAction, 0);
    createState(idnBatteryPercent, 0, idnBatteryPercent, false, "%");
    createState(idnCurrentErrorCode, 0);
    createState(idnCurrentErrorCodeTS, 0);
    createState(idnLastAction, 'unkonwn');
    createState(idnLastDockingTime, 0, idnLastDockingTime, false, "min.");
    createState(idnLastErrorCode, 0);
    createState(idnLastErrorCodeTS, 0);
    createState(idnLastHttpStatus, 0);
    createState(idnLastLocations, '[]');
    createState(idnLastStatus, 'unkonwn');
    createState(idnLastStatusTime, 0);
    createState(idnLastStatusChangeTime, 0);
    createState(idnLastDayLocations, '[]');
    createState(idnNextStartSource, '');
    createState(idnNextStartTime, 0);
    createState(idnNextStartWatching, false);
    createState(idnOperatingMode, 'unkonwn');
    createState(idnStopOnRainEnabled, false, idnStopOnRainEnabled, true);
    createState(idnStoppedDueRain, false, idnStoppedDueRain, true);
    createState(idnTimerAfterRainStartAt, 0);
    createState(idnSendMessage, '');


    //States for testing
    if (enableJson) {
        createState('mower.rawSend', '', 'object for sending raw messages to the mower');
        createState('mower.rawResponse', '', 'Display the raw message from the mower');
        createState(idnRawResponseGeo, '', 'Display the raw message from the mower locations');
    } else {    //delete Teststates
        adapter.deleteState(adapter.namespace, 'mower', 'rawSend');
        adapter.deleteState(adapter.namespace, 'mower', 'rawResponse');
    }

    adapter.log.debug(fctName + ' finished', 'debug2');

} // createDPs()


function createDataStructure(adapter) {

    createChannels();

    createDPs();

}


function parseBool(value) {
    if (typeof value === "boolean") return value;

    if (typeof value === "number") {
        return value === 1 ? true : value === 0 ? false : undefined;
    }

    if (typeof value != "string") return undefined;

    return value.toLowerCase() === 'true' ? true : value.toLowerCase() === 'false' ? false : undefined;


} // parseBool()


adapter.on('stateChange', function (id, state) {
    if (state && !state.ack) {
        adapter.log.debug('stateChange, id: ' + id + '; state: ' + JSON.stringify(state));       // ld: husq-automower.0.mower.lastLocation.longitude; state: {"val":11.435046666666667,"ack":false,"ts":1524829008532,"q":0,"from":"system.adapter.husq-automower.0","lc":1524829008532}

        var iddp = id.substr(adapter.namespace.length + 1),
            fctName = '';

        if(id === adapter.config.idRainSensor) {
            // adapter.config.RainSensorValue - [bool, true]
            fctName = 'subscription rainsensor change';
            var bRain = parseBool(state.val),
                sMsg = '',
                vTest = dapter.config.RainSensorValue;

            if(vTest !== '' && typeof vTest === 'object') {
                bRain = (typeof state.val === vTest[0] && state.val === vTest[1]) ? true : false;
            }

            adapter.log.debug(fctName + ',  id: "' + id + '"; state.val: ' + state.val);
            adapter.log.debug(fctName + ', mLastStatus: ' + mLastStatus);

            if(bRain) {
                adapter.setState(idnStoppedDueRain, true, true);
                adapter.log.debug(fctName + ' stopped due rain activated');
            } else {
                adapter.setState(idnStoppedDueRain, false, true);
                adapter.log.debug(fctName + ' stopped due rain deactivated');
            }

            adapter.log.debug(fctName + ' finished', 'debug2');
        }
        else if(id === adapter.config.idWeatherRainForecast) {
            // !P! adapter.config.stopOnRainPercent
            fctName = 'Subscriber rainforcast';
            adapter.log.debug(fctName + ',  id: "' + id + '"; state.val: ' + state.val);
//!P!
            var sMsg = '',
                mRainPercent = getState(idWeatherRainForecastPercent).val,
                mRain1h = getState(idWeatherRainForecast1h).val,
                mRainPercent1h = getState(idWeatherRainForecastPercent1h).val;
            adapter.log.debug(fctName + ', mLastStatus: ' + mLastStatus + ',  stopOnRainPercent: ' + adapter.config.stopOnRainPercent + '; mRainPercent: ' + mRainPercent + ',  mRain1h: ' + mRain1h + ',  mRainPercent1h: ' + mRainPercent1h);

            if (state.val > 0 || (state.val === 0 && mRainPercent > adapter.config.stopOnRainPercent)) {
                adapter.setState(idnStoppedDueRain, true, true);
                adapter.log.debug(fctName + ' idnStoppedDueRain activated', 'debug2');
            }

            if (state.val === 0 && mRainPercent === 0) {
                // no rain in forcast
                if (waitAfterRainTimer !== null) {
                    clearTimeout(waitAfterRainTimer);

                    adapter.setState(idnTimerAfterRainStartAt, 0, true);
                }

                var timeout = waitAfterRain_m * 60 * 1000;          // 7200000
                waitAfterRainTimer = setTimeout(startMowerAfterAutoTimerCheck, timeout);

                adapter.setState(idnTimerAfterRainStartAt, new Date().getTime(), true);

                sMsg = fctName + ' changed to no rain; wait ' + waitAfterRain_m + ' min. for starting mower';
                adapter.setState(idnSendMessage, JSON.stringify([new Date().getTime(), sMsg, fctName + ' changed', state.val, 1, 'Tg,EL']), true);
            }

            if ((new Date().getTime() - obj.state.ts) / 1000 / 60 > 20) {
                // weather forcast not uptodate ?!
                adapter.log.error(fctName + ' error, last update for "' + idWeatherRainForecast + '" us older then ' + ((new Date().getTime() - obj.state.ts) / 1000 / 60) + ' minutes!');

                //!P! telegram message?
            }

            adapter.log.debug(fctName + ' finished');
        }

        switch (iddp) {
            case idnAMAction:
                fctName = 'subscription mower.action changed';

                if (state.val > 0) {
                    if (state.val === 1) {
                        adapter.log.debug(fctName + ',  start mower');

                        mobjMower.sendCommand(mobjMower.command.start, (err, msg) => {
                            if (err) {
                                adapter.log(msg);
                            } else {
                                adapter.log("Parked the mower");
                            }
                        });
                    } else if (state.val === 2) {
                        adapter.log.debug(fctName + ',  stop mower');

                        mobjMower.sendCommand(mobjMower.command.stop, (err, msg) => {
                            if (err) {
                                adapter.log(msg);
                            } else {
                                adapter.log("Parked the mower");
                            }
                        });
                    } else if (state.val === 3) {
                        adapter.log.debug(fctName + ',  park mower');

                        mobjMower.sendCommand(mobjMower.command.park, (err, msg) => {
                            if (err) {
                                adapter.log(msg);
                            } else {
                                adapter.log("Parked the mower");
                            }
                        });
                    } else if (state.val === 4) {
                        adapter.log.debug(fctName + ',  geostatus');
// !P! ??
                    } else if (state.val === 9) {
                        adapter.log.debug(fctName + ',  status mower');
// !P! ?? --> updateStatus, prüfen ob schedule nicht läuft
                    } else if (state.val === 77) {
                        adapter.log.debug(fctName + ',  toggle rain detected');

                        adapter.getState(idnStoppedDueRain, function (err, stateSDR) {
                            if (!err && stateOCD) {
                                adapter.setState(idnStoppedDueRain, !parseBool(stateSDR.val), true);
                            }
                        });

                    } else if (state.val === 95) {
                        adapter.log.debug(fctName + ',  pause');
// !P! ??
                    } else if (state.val === 96) {
                        adapter.log.debug(fctName + ',  led on/off');
// !P! ??
                    }
                    adapter.setState(idnAMAction, 0, true);
                }
                adapter.log.debug(fctName + ' finished');
                break;

            case idnStoppedDueRain:
                fctName = 'subscrition StoppedDueRain changed';
                adapter.log.debug(fctName + ',  id: "' + idnStoppedDueRain + '"; state.val: ' + state.val);

                var sMsg = '';
                adapter.log.debug(fctName + ' mLastStatus: ' + mLastStatus + ',  adapter.config.stopOnRainEnabled: ' + adapter.config.stopOnRainEnabled);

                if (state.val === true && adapter.config.stopOnRainEnabled === true) {
                    if(mLastStatus === 'OK_CUTTING' || mLastStatus === 'OK_CHARGING') {	// PARKED_PARKED_SELECTED ??
                        mobjMower.sendCommand(mobjMower.command.park, (err, msg) => {
                            if (err) {
                                adapter.log(msg);
                            } else {
                                adapter.log("Parked the mower");
                            }
                        });

                        if (waitAfterRainTimer !== null) {
                            clearTimeout(waitAfterRainTimer);

                            adapter.setState(idTimerAfterRainStartAt, 0, true);
                        }

                        sMsg = fctName + ' is activated; send mower command "park"';
                        adapter.setState(idnSendMessage, JSON.stringify([new Date().getTime(), sMsg, fctName, state.val, 1, 'Tg,EL']), true);
                    }
                }

                if (state.val === false && adapter.config.stopOnRainEnabled === true) {
                    // rain is over, wait if gras is dry
                    if (waitAfterRainTimer !== null) {
                        clearTimeout(waitAfterRainTimer);

                        adapter.setState(idTimerAfterRainStartAt, 0, true);
                    }

                    var timeout = waitAfterRain_m * 60 * 1000;          // 7200000

                    waitAfterRainTimer = setTimeout(startMowerAfterAutoTimerCheck, timeout);

                    adapter.setState(idTimerAfterRainStartAt, new Date().getTime(), true);

                    sMsg = fctName + ' changed to no rain; wait ' + waitAfterRain_m + ' min. for starting mower';
                    adapter.setState(idnSendMessage, JSON.stringify([new Date().getTime(), sMsg, fctName + ' changed', state.val, 1, 'Tg,EL']), true);
                }

                adapter.log.debug(fctName + ' finished');

                break;
        }

    }
});


// Some message was sent to adapter instance over message box. Used by email, pushover, text2speech, ...
adapter.on('message', function (obj) {
    if (typeof obj == 'object' && obj.message) {
        /*        if (obj.command == 'send') {
                    // e.g. send email or pushover or whatever
                    adapter.log.info('send command');

                    // Send response in callback if required
                    if (obj.callback) adapter.sendTo(obj.from, obj.command, 'Message received', obj.callback);
                } */
    }
});


function getDistance(lat1, long1, lat2, long2) {
    // GPS_DISTANCE(lat1 DOUBLE, long1 DOUBLE, lat2 DOUBLE, long2 DOUBLE)
    var fctName = 'getDistance';
    adapter.log.debug(fctName + ' started' + '; lat1: ' + lat1 + '; long1: ' + long1 + '; lat2: ' + lat2 + '; long2: ' + long2);

    var R = 6371, // Radius of the earth in km
        dLat = (lat2 - lat1) * Math.PI / 180,  // deg2rad below
        dLon = (long2 - long1) * Math.PI / 180,
        a = 0.5 - Math.cos(dLat)/2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * (1 - Math.cos(dLon))/2,

        dist = R * 2 * Math.asin(Math.sqrt(a)) * 1000;  // m

    adapter.log.debug(fctName + ' finished; dist: ' + dist);

    return dist;

} // getDistance()


function checkAMatHome(lat2, long2) {
    // GPS_DISTANCE(lat1 DOUBLE, long1 DOUBLE, lat2 DOUBLE, long2 DOUBLE)
    var fctName = 'checkAMatHome';
    adapter.log.debug(fctName + ' started' + '; lat2: ' + lat2 + '; long2: ' + long2);
    adapter.log.debug(fctName + ' mHomeLocationLatitude: ' + mHomeLocationLatitude + '; mHomeLocationLongitude: ' + mHomeLocationLongitude + '; mMaxDistance: ' + mMaxDistance);

    if(mHomeLocationLatitude === 0 || mHomeLocationLongitude === 0) {
        adapter.log.warn(fctName + ' >> homeLocation.latitude and/or homeLocation.longitude not set or failure on reading!');

        return;
    }

    var R = 6371, // Radius of the earth in km
        dLat = (lat2 - mHomeLocationLatitude) * Math.PI / 180,  // deg2rad below
        dLon = (long2 - mHomeLocationLongitude) * Math.PI / 180,
        a = 0.5 - Math.cos(dLat)/2 + Math.cos(mHomeLocationLatitude * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * (1 - Math.cos(dLon))/2,

        dist = R * 2 * Math.asin(Math.sqrt(a)) * 1000;

    adapter.setState(idnHomeLocationCurrentDistance, Math.round(dist));
    //var dist = Math.acos(Math.sin(degrees_to_radians(mHomeLocationLatitude)) * Math.sin(degrees_to_radians(lat2)) + Math.cos(degrees_to_radians(mHomeLocationLatitude)) * Math.cos(degrees_to_radians(lat2)) * Math.cos(degrees_to_radians(long2) - degrees_to_radians(mHomeLocationLongitude))) * 6371 * 1000;

    if (dist > mMaxDistance) {
        // alarm
        adapter.log.error(fctName + ' dist > mMaxDistance: ' + dist - mMaxDistance);

        adapter.setState(idnSendMessage, JSON.stringify([new Date().getTime(), 'max disctance exceeded\r\ncurrent position ' + mUrlGoogleMaps + lat2 + ',' + long2, 'mower state changed', Math.round(dist) + ' m', 3, 'Tg,Ma,EL']), true);
    }

    adapter.log.debug(fctName + ' finished; dist: ' + dist);

} // checkAMatHome()


function createStatusScheduler() {
    var fctName = 'createStatusScheduler';
    adapter.log.debug(fctName + ' started');

    if(mScheduleStatus !== null) {
        //clearSchedule(mScheduleStatus);
        //mScheduleStatus.cancel;
        clearInterval(mScheduleStatus);

        mScheduleStatus = null;
    }

    if (isNaN(mScheduleTime) || mScheduleTime < 31) {
        mScheduleTime = 60;
    }

    mScheduleStatus = setInterval(updateStatus, mScheduleTime * 1000);

    //mScheduleStatus = husqSchedule.scheduleJob('*/' + (mScheduleTime * 1000) + ' * * * * *', function () {
    //    updateStatus();
    //});
    adapter.log.debug(fctName + ' finished');

} // createStatusScheduler()


function startMoverAfterAutoTimerCheck() {
    var fctName = 'startMoverAfterAutoTimerCheck';
    adapter.log.debug(fctName + ' started');

//!P! ?? welcher Status noch?
    if(mCurrentStatus === 'PARKED_AUTOTIMER' || mCurrentStatus !== 'PARKED_PARKED_SELECTED') {
        mobjMower.sendCommand(mobjMower.command.start, (err, msg) => {
            if (err) {
                adapter.log(msg);
            } else {
                adapter.log('Parked the mower');
            }
        });

        adapter.log.debug(fctName + '; mover started');
    }

    mWaitAutoTimer = null;
    adapter.setState(idnNextStartWatching, false, true);

    adapter.log.debug(fctName + ' finished');

} // startMoverAfterAutoTimerCheck()


function updateStatus() {

    mobjMower.getStatus(function (error, response, result) {
        adapter.log.debug('updateStatus' + ' error: ' + JSON.stringify(error));	// null
//!D!                logs('updateStatus' + ' response: ' + JSON.stringify(response), 'debug2');
        adapter.log.debug('updateStatus' + ' result: ' + JSON.stringify(result));
        result.lastLocations = [];
        // {"batteryPercent":89,"connected":true,"lastErrorCode":0,"lastErrorCodeTimestamp":0,"mowerStatus":"PARKED_AUTOTIMER","nextStartSource":"COMPLETED_CUTTING_TODAY_AUTO","nextStartTimestamp":1524225600,"operatingMode":"AUTO","storedTimestamp":1524158931955,"showAsDisconnected":false,"valueFound":true,"cachedSettingsUUID":"29f71a2b-525d-4c34-9962-0c3aaa0a12d3","lastLocations":null}

        /*
            "batteryPercent": 89,
            "connected": true,
            "lastErrorCode": 0,
            "lastErrorCodeTimestamp": 0,
            "mowerStatus": "PARKED_AUTOTIMER",
            "nextStartSource": "COMPLETED_CUTTING_TODAY_AUTO",
            "nextStartTimestamp": 1524225600,
            "operatingMode": "AUTO",
            "storedTimestamp": 1524158931955,
            "showAsDisconnected": false,
            "valueFound": true,
            "cachedSettingsUUID": "29f71a2b-525d-4c34-9962-0c3aaa0a12d3",
            "lastLocations": null
        */
        adapter.setState(idnLastHttpStatus, response.statusCode, true);
        adapter.setState(idnLastAction, 'status', true);         // aus header oder so --> status|...
        //adapter.setState(idLastActionTime, new Date().getTime());

        if(response.statusCode !== 200) return;

        mLastStatus =  mCurrentStatus;
        mCurrentStatus = result.mowerStatus;

        if(adapter.config.enableJson) {
            adapter.setState(idnRawResponse, JSON.stringify(response), true);
        }

        if(mLastErrorCode !== result.lastErrorCode) {
            adapter.setState(idnCurrentErrorCode, parseInt(result.lastErrorCode), true);
            adapter.setState(idnCurrentErrorCodeTS, result.lastErrorCodeTimestamp, true);

            if(parseInt(result.lastErrorCode) === 0 && mLastErrorCode > 0) {
                adapter.setState(idnLastErrorCode, mLastErrorCode, true);
                adapter.setState(idnLastErrorCodeTS, mLastErrorCodeTimestamp, true);
            }

            var sMsg = 'subscribe mower error state changed, from "' + mLastErrorCode + '" to "' + result.lastErrorCode + '"\r\ncurrent position ' + mUrlGoogleMaps + lat2 + ',' + long2;
            adapter.setState(idnSendMessage, JSON.stringify([new Date().getTime(), sMsg, 'subscribe mower error state changed', result.lastErrorCode, 2, 'Tg,EL']), true);

            mLastErrorCode = parseInt(result.lastErrorCode);
            mLastErrorCodeTimestamp = result.lastErrorCodeTimestamp;
        }

        adapter.setState(idnLastStatus, result.mowerStatus);
        adapter.setState(idnLastStatusTime, parseInt(result.storedTimestamp));

        adapter.setState(idnBatteryPercent, parseInt(result.batteryPercent), true);
        adapter.setState(idnMowerConnected, result.connected, true);

        adapter.setState(idnNextStartSource, result.nextStartSource, true);
        adapter.setState(idnNextStartTime, parseInt(result.nextStartTimestamp), true);
        adapter.setState(idnOperatingMode, result.operatingMode, true);
//!P! ???
        if(parseInt(result.batteryPercent) === 100 && result.operatingMode === 'HOME') {
            // manuel start required, start mower
            // !P! ?? adapter.setState(idnAMAction, 1, true);

            adapter.log.warn('updateStatus' + ', result.operatingMode === ' + 'HOME', 'mower started');
        }

        //adapter.log.info(' result.mowerStatus: ' + result.mowerStatus + ' mLastStatus: ' + mLastStatus + '; mLastErrorCode: ' + mLastErrorCode + '; mCurrentErrorCode: ' + mCurrentErrorCode + '; mCurrentErrorCodeTimestamp: ' + getDateTimeWseconds(mCurrentErrorCodeTimestamp) + '; mBatteryPercent: ' + mBatteryPercent);
        //result.mowerStatus: PARKED_AUTOTIMER mLastStatus: PARKED_TIMER; mLastErrorCode: 0; mCurrentErrorCode: 0; mCurrentErrorCodeTimestamp: 2018-04-19, 22:12:29; mBatteryPercent: 100
        //adapter.log.info(' mValueFound: ' + mValueFound + '; mStoredTimestamp: ' + getDateTimeWseconds(mStoredTimestamp) + '; mOperatingMode: ' + mOperatingMode + '; mConnected: ' + mConnected + '; mShowAsDisconnected: ' + mShowAsDisconnected);
        //mValueFound: true; mStoredTimestamp: 2018-04-19, 22:00:12; mOperatingMode: AUTO; mConnected: true; mShowAsDisconnected: false

        mobjMower.getGeoStatus(function (geo_error, geo_response, geo_result) {
            adapter.log.debug('updateStatus' + ' geo_error: ' + JSON.stringify(geo_error));	// null
//!D!                logs('updateStatus' + ' geo_response: ' + JSON.stringify(geo_response), 'debug2');
            adapter.log.debug('updateStatus' + ' geo_result: ' + JSON.stringify(geo_result));
            //!D!console.log('updateStatus' + ' geo_result: ' + JSON.stringify(geo_result));

            adapter.setState(idnLastHttpStatus, geo_response.statusCode, true);

            if(geo_response.statusCode !== 200) return;

            if(adapter.config.enableJson) {
                adapter.setState(idnRawResponseGeo, JSON.stringify(geo_result), true);
            }

            var newDist = 0,
                position,
                jsonNewPositions = [];

            // assumption: newest data first, confirmed
            // accumulate positions and mileage beginnig from end if array (oldest positions)
            adapter.log.debug('updateStatus' + ', geo_result.lastLocations.length:' + geo_result.lastLocations.length);
            adapter.log.debug('updateStatus' + ', mLastLocationLongi:' + mLastLocationLongi + '; mLastLocationLati:' + mLastLocationLati);
            for (var i = geo_result.lastLocations.length - 1; i >= 0; i--) {
                adapter.log.debug('updateStatus' + ', i:' + i + '; geo_result.lastLocations[i].longitude:' + geo_result.lastLocations[i].longitude + '; geo_result.lastLocations[i].latitude:' + geo_result.lastLocations[i].latitude);

                // set home location data, if not set
                if(mHomeLocationLongitude === 0 || mHomeLocationLongitude === '' || mHomeLocationLatitude === 0 || mHomeLocationLatitude === '') {
                    mHomeLocationLatitude = geo_result.centralPoint.location.latitude;
                    mHomeLocationLongitude = geo_result.centralPoint.location.longitude;

                    adapter.setState(idnHomeLocationLatitude, mHomeLocationLatitude, true);
                    adapter.setState(idnHomeLocationLongitude, mHomeLocationLongitude, true);
                }
                if(i === geo_result.lastLocations.length - 1) {
                    // write server position datat
                    adapter.setState(idnHomeLocationLatitudeCP, geo_result.centralPoint.location.latitude, true);
                    adapter.setState(idnHomeLocationLongitudeCP, geo_result.centralPoint.location.longitude, true);
                    adapter.setState(idnHomeLocationSensitivityLevel, geo_result.centralPoint.sensitivity.level, true);
                    adapter.setState(idnHomeLocationSensitivityRadius, geo_result.centralPoint.sensitivity.radius, true);
                }

                if(geo_result.lastLocations[i].longitude === mLastLocationLongi && geo_result.lastLocations[i].latitude === mLastLocationLati) {
                    // should like the last known position, data has no timestamp
                    // remove older positions and reset new distance
                    adapter.log.debug('updateStatus' + ' last position found:' + JSON.stringify(geo_result.lastLocations[i]) + '; i:' + i);

                    jsonNewPositions = [];
                    newDist = 0;

                } else {
                    position = { "longitude": geo_result.lastLocations[i].longitude, "latitude": geo_result.lastLocations[i].latitude, "time": result.storedTimestamp};
                    adapter.log.debug('updateStatus' + ' position:' + JSON.stringify(position) + '; i:' + i + '; mCurrentStatus:' + mCurrentStatus + '; mLastStatus:' + mLastStatus);

                    jsonNewPositions.push(position);      // save position
                    //!P! check location; alle Positionen prüfen oder reicht letze Position --> checkAMatHome
                    // if out of frame --> alarm

                    // add to distance, without timestams it's not poosible to determine cutting position exactly
                    if(i < (geo_result.lastLocations.length - 1) && (mCurrentStatus === 'OK_CUTTING' || (mLastStatus === 'OK_CUTTING' && !mCurrentStatus === 'OK_CUTTING'))) { // mileage only, if mower cutting
                        newDist = newDist + getDistance(geo_result.lastLocations[i + 1].latitude, geo_result.lastLocations[i + 1].longitude, geo_result.lastLocations[i].latitude, geo_result.lastLocations[i].longitude);
                        adapter.log.debug('updateStatus' + ' mDist:' + mDist + '; i:' + i);
                    }
                }
            }
            mJsonLastLocations = mJsonLastLocations.concat(jsonNewPositions);      // add new positions
            mDist = mDist + newDist;
            adapter.log.debug('updateStatus' + ', add new distance; mDist:' + mDist + '; newDist:' + newDist);

            // check position in range
            checkAMatHome(geo_result.lastLocations[0].latitude, geo_result.lastLocations[0].longitude);

            adapter.log.debug('updateStatus' + ' idnLastLocations:' + JSON.stringify(mJsonLastLocations) + '; idnCurrentCoveredDistance:' + Math.round(mDist, 2));
            adapter.setState(idnLastLocations, JSON.stringify(mJsonLastLocations), true);
            adapter.setState(idnCurrentCoveredDistance, Math.round(mDist, 2), true);

            if(mLastLocationLongi !== geo_result.lastLocations[0].longitude && mLastLocationLongi !== geo_result.lastLocations[0].latitude) {
                // update last location
                adapter.setState(idnLastLocationLongitude, geo_result.lastLocations[0].longitude, true);
                adapter.setState(idnLastLocationLatitude, geo_result.lastLocations[0].latitude, true);

                mLastLocationLongi = geo_result.lastLocations[0].longitude;
                mLastLocationLati = geo_result.lastLocations[0].latitude;

                adapter.setState(idnLastLocationTimestamp, result.storedTimestamp, true);      // !?

                // Offset
                if(result.mowerStatus === 'OK_CHARGING' || result.mowerStatus === 'PARKED_AUTOTIMER' || result.mowerStatus === 'PARKED_PARKED_SELECTED' || result.mowerStatus === 'OFF_DISABLED') {
                    adapter.setState(idnHomeLocationLongitudeOffset, geo_result.lastLocations[0].longitude, true);
                    adapter.setState(idnHomeLocationLatitudeOffset, geo_result.lastLocations[0].latitude, true);
                }
            }
        });

        adapter.log.debug('updateStatus' + ' result.mowerStatus:' + result.mowerStatus + '; mLastStatus:' + mLastStatus);
        // !P! wenn Status sich ändert haben wir tc oder? - Wofür?
        if(result.mowerStatus != mLastStatus) {
            sMsg = 'updateStatus, mower state changed, from "' + mLastStatus + '" to "' + result.mowerStatus + '"';
            adapter.setState(idnSendMessage, JSON.stringify([new Date().getTime(), sMsg, 'mower state changed', result.mowerStatus, 1, 'Tg,EL']), true);

            adapter.setState(idnLastStatusChangeTime, result.storedTimestamp, true);
        }

        if(result.mowerStatus === 'OK_CUTTING') {
            // reset start timer after rain, mower is started manually?
            if (mWaitAfterRainTimer !== null) {
                //!P! clearTimeout(mWaitAfterRainTimer);
                mWaitAfterRainTimer.cancel;

                adapter.setState(idnTimerAfterRainStartAt, 0, true);
            }

            // reset autostart timer, mower is started
            if (mWaitAutoTimer !== null) {
                //!P! clearTimeout(mWaitAutoTimer);
                mWaitAutoTimer.cancel;

                mWaitAutoTimer = null;
                adapter.setState(idnNextStartWatching, false, true);
            }

            if( mLastStatus !== 'OK_CUTTING' && mStartBladeTime === 0) {
                mStartBladeTime = new Date().getTime();

                adapter.setState(idnBladeTimeStart, mStartBladeTime, true);
            }
        }
        if(result.mowerStatus !== 'OK_CUTTING' && mLastStatus === 'OK_CUTTING') {
            // add working hours
            // timediff in ms --> min
            mBladeTime = mBladeTime + parseInt((new Date().getTime() - mStartBladeTime) / (1000 * 60 * 60 * 60)) % 24;
            adapter.setState(idnBladeTime, mBladeTime, true);

            mStartBladeTime = 0;

            adapter.setState(idnBladeTimeStart, mStartBladeTime, true);
        }

        if(result.mowerStatus === 'OK_LEAVING' && mLastStatus !== 'OK_LEAVING' && mStartBladeTime === 0) {
            mStartBladeTime = new Date().getTime();        // start cutting

            adapter.setState(idnBladeTimeStart, mStartBladeTime, true);
        }

        if((result.mowerStatus === 'OK_SEARCHING' && mLastStatus !== 'OK_SEARCHING' && mSearchingStartTime === 0) || (result.mowerStatus === 'ERROR' && mLastStatus === 'OK_CUTTING')) {
            if(result.mowerStatus === 'OK_SEARCHING' && mLastStatus !== 'OK_SEARCHING') {
                // searchtime start
                mSearchingStartTime = new Date().getTime();
            }

            if(mLastStatus === 'OK_CUTTING' && mStartBladeTime > 0) {
                // set blade time
                if(mBladeTimeBatteryNew > 0) {
                    mBladeTime = mBladeTime + parseInt((new Date().getTime() - mStartBladeTime) / (1000 * 60 * 60 * 60)) % 24;

                    adapter.setState(idnBladeTimeBatteryCurrent, mBladeTime, true);

                } else {
                    // set first blade time
                    adapter.setState(idnBladeTimeBatteryNew, parseInt((new Date().getTime() - mStartBladeTime) / (1000 * 60 * 60 * 60)) % 24, true);
                }
                mStartBladeTime = 0;
            }
        }

        // time too find station
        if((result.mowerStatus === 'OK_CHARGING' || result.mowerStatus === 'OK_PARKING') && mSearchingStartTime > 0) {
            adapter.setState(idnLastStationReturnTime, parseInt((new Date().getTime() - mSearchingStartTime) / (1000 * 60 * 60 * 60)) % 24, true);

            mSearchingStartTime = 0;
        }

        if(result.mowerStatus === 'OK_CHARGING' && mLastStatus !== 'OK_CHARGING') {
            // start charching
            mCharchingStartTime = new Date().getTime();
            adapter.setState(idnCharchingStartTime, mCharchingStartTime, true);

            ++mBatteryChargeCycle;
            adapter.setState(idnBatteryChargeCycle, mBatteryChargeCycle, true);
        }

        if(result.mowerStatus !== 'OK_CHARGING' && mLastStatus === 'OK_CHARGING' && mCharchingStartTime > 0) {
            // charching end
            if(mCharchingTimeBatteryNew > 0) {
                mChargingTimeBatteryCurrent = mChargingTimeBatteryCurrent + parseInt((new Date().getTime() - mCharchingStartTime) / (1000 * 60 * 60)) % 24

                adapter.setState(idnChargingTimeBatteryCurrent, mChargingTimeBatteryCurrent, true);
            } else {
                adapter.setState(idnChargingTimeBatteryNew, parseInt((new Date().getTime() - mCharchingStartTime) / (1000 * 60 * 60)) % 24, true);
            }
            mCharchingStartTime = 0;
            adapter.setState(idnCharchingStartTime, mCharchingStartTime, true);
        }

        if(result.mowerStatus === 'OK_CHARGING' && mBatteryPercent <= 95) {
            // laden
            if(mScheduleStatus === null || (mScheduleStatus !== null && mScheduleTime !== adapter.config.ScheduleInactiveTime)) {
                mScheduleTime= adapter.config.ScheduleInactiveTime;

                createStatusScheduler();
            }
        } else {
            // error or active or BatteryPercent > 95%
            if(mScheduleStatus === null || (mScheduleStatus !== null && mScheduleTime !== adapter.config.ScheduleActiveTime)) {
                mScheduleTime = adapter.config.ScheduleActiveTime;

                createStatusScheduler();
            }
        }

        /*
                                            if(result.mowerStatus === 'PARKED_AUTOTIMER' && mWaitAutoTimer === null) {
                                                // should be started on nextStarttimer --> watch
                                                var nextStart = adapter.getState(idNextStartTimestamp).val;
                                                nextStart = dateAdd(nextStart, - mTimeZoneOffset, 'hours');          // get local time
                                                var nextStart2 = nextStart - (1000 * 60 * 60 * mTimeZoneOffset) ;
                                                logs(fctName + '; result.mowerStatus === "PARKED_AUTOTIMER", mWaitAutoTimer' + nextStart + '; nextStart2: ' + nextStart2 + '; current time:' + new Date().getTime(), 'debug2');

                                                if(nextStart - new Date().getTime() > 0) {
                                                    mWaitAutoTimer = setTimeout(startMowerAfterAutoTimerCheck, nextStart - new Date().getTime() + 60000);       //plant start + 60s

                                                    setState(idNextStartWatching, true);

                                                    sMsg = 'mower state changed, next autostart on "' + formatDate(nextStart, "JJJJ.MM.TT SS:mm:ss") + '"';
                                                    adapter.setState(idnSendMessage, JSON.stringify([new Date().getTime(), sMsg, 'subscribe mower error state changed', nextStart - new Date().getTime() + 60000, 1, 'Tg,EL']), true);
                                                }
                                            }
        */
        if(result.mowerStatus === 'PARKED_AUTOTIMER') {
            mTime = mNextStart  - (1000 * 60 * 60 * mTimeZoneOffset) - new Date().getTime();
            adapter.log.debug('updateStatus' + '; result.mowerStatus === "PARKED_AUTOTIMER", miliseconds to next start' + mTime + '; mTimeZoneOffset: ' + mTimeZoneOffset);

            if(mStoppedDueRain === true && (mTime - 300 * 1000) < 5) {
                adapter.log.debug('updateStatus' + '; stop autostart while rain');

                mobjMower.sendCommand(mobjMower.command.stop, (err, msg) => {
                    if (err) {
                        adapter.log(msg);
                    } else {
                        adapter.log("Parked the mower");
                    }
                });

                sMsg = 'mower stop send while rain state is true';
                adapter.setState(idnSendMessage, JSON.stringify([new Date().getTime(), sMsg, 'mower stop send', '', 1, 'Tg,EL']), true);
            }
        }
    });
}


function dailyAccumulation() {
    fctName = 'dailyAccumulation';

    adapter.log.debug(fctName + ' started');

    adapter.log.debug(fctName + '; stop status timer');
    // stop status timer
    if(mScheduleStatus !== null) {
        //clearSchedule(mScheduleStatus);
        //mScheduleStatus.cancel;
        clearInterval(mScheduleStatus);

        mScheduleStatus = null;
    }

    adapter.log.debug(fctName + '; add current covered distance to overall distance: ' + (overallDist + (dist  / 1000)) + '; dist: ' + dist);
    // add current covered distance to overall distance in km
    adapter.getState(idCurrentCoveredDistance, function (err, stateCCD) {
        if (!err && stateCCD) {
            adapter.getState(idOverallCoveredDistance, function (err, stateOCD) {
                if (!err && stateOCD) {
                    adapter.setState(idOverallCoveredDistance, (stateOCD.val + (stateCCD.val / 1000)), true);       // distance in km

                    // move current covered distance to last distance and reset current
                    adapter.setState(idLastCoveredDistance, Math.round(stateCCD.va), true);
                    adapter.setState(idCurrentCoveredDistance, 0, true);
                }
            });
        }
    });

    adapter.log.debug(fctName + '; move lastlocations to lastday locations');
    // move lastlocations to lastday locations
    adapter.getState(idLastLocations, function (err, state) {
        if (!err && state) {
            adapter.setState(idLastdayLocations, state.val, true);
            adapter.setState(idLastLocations, '[]', true);
        }
    });

    adapter.log.debug(fctName + '; dd current working time to overall working time: ' + (overallHours + hours) + '; hours: ' + hours);
    // add current working time to overall working time
    adapter.getState(idWorkingTime, function (err, stateWT) {
        if (!err && stateWT) {
            adapter.getState(idOverallWorkingTime, function (err, stateOWT) {
                if (!err && stateOCD) {
                    adapter.setState(idOverallWorkingTime,  (stateOWT.val + (stateWT.val * 60)));

                    // move current working time to last working time and reset current
                    adapter.setState(idLastWorkingTime, stateWT.val, true);
                    adapter.setState(idWorkingTime, 0, true);
                }
            });
        }
    });

    // start status scheduler, use last timer value
    createStatusScheduler();

    adapter.log.debug(fctName + ' finished');

} // dailyAccumulation()


// is called when databases are connected and adapter received configuration.
// start here!
adapter.on('ready', function () {
    main();
});


function syncConfig() {
    adapter.log.debug('syncConfig' + ' started');	// null

    if(adapter.config.idTimeZoneOffset !== '') {
        adapter.getForeignState(adapter.config.idTimeZoneOffset, function (err, state) {
            if (!err && state) {
                mTimeZoneOffset = state.val;
            }
            adapter.log.debug('syncConfig' + ', adapter.config.idTimeZoneOffset:' + adapter.config.idTimeZoneOffset + '; mTimeZoneOffset:' + mTimeZoneOffset);
        });
    }

    adapter.getState(idnLastLocations, function (err, idState) {
        if (err) {
            adapter.log.error(err);

            return;
        }

        // on getStates serveral problems on reading, string too long?
        mJsonLastLocations = JSON.parse(idState.val);

        adapter.log.debug('syncConfig' + ', mJsonLastLocations:' + mJsonLastLocations);
    });

    adapter.getStates('mower.*', function (err, idStates) {
        if (err) {
            adapter.log.error(err);

            return;
        }

        // gather states that need to be read
        adapter.log.debug('syncConfig' + ' idStates: ' + JSON.stringify(idStates));

        for (var idState in idStates) {
            if (!idStates.hasOwnProperty(idState) || idStates[idState] === null) {
                //if (!idStates.hasOwnProperty(idState)) {
                continue;
            }

            var iddp = idState.substr(adapter.namespace.length + 1);
            adapter.log.debug('syncConfig' + ', processing state:' + iddp);

            switch (iddp) {
                case idnOverallBladeTime:
                    // check last dayly accumulation
                    adapter.getState(idnCurrentCoveredDistance, function (err, idStateCCD) {
                        if (err) {
                            adapter.log.error(err);

                            return;
                        }


                        if(idStates[idState].ts < new Date().setHours(0, 0, 0, 0) && idStateCCD.val > 0) {
                            // exec
                            dailyAccumulation();

                            adapter.log.info('syncConfig' + ', dailyAccumulation started');
                        }
                    });

                    break;
                case idnLastStatus:
                    mLastStatus = idStates[idState].val;
                    break;
                case idnLastStatusChangeTime:
                    mLastStatusChangeTime = idStates[idState].val;
                    break;
                case idnNextStartTime:
                    mNextStart = idStates[idState].val;
                    break;
                case idnStoppedDueRain:
                    mStoppedDueRain = idStates[idState].val;
                    break;
                case idnCurrentErrorCode:
                    mLastErrorCode = idStates[idState].val;
                    break;
                case idnCurrentErrorCodeTS:
                    mLastErrorCodeTimestamp = idStates[idState].val;
                    break;
                case idnCurrentCoveredDistance:
                    mDist = JSON.parse(idStates[idState].val);
                    break;
                case idnLastLocationLongitude:
                    mLastLocationLongi = JSON.parse(idStates[idState].val);
                    break;
                case idnLastLocationLatitude:
                    mLastLocationLati = JSON.parse(idStates[idState].val);
                    break;
                case idnHomeLocationLongitude:
                    mHomeLocationLongitude = idStates[idState].val;
                    break;
                case idnHomeLocationLatitude:
                    mHomeLocationLatitude = idStates[idState].val;
                    break;
                case idnHomeLocationMaxDistance:
                    mMaxDistance = parseInt(idStates[idState].val);
                    break;
                case idnBatteryChargeCycle:
                    mBatteryChargeCycle = parseInt(idStates[idState].val);
                    break;
                case idnBladeTimeStart:
                    mStartBladeTime = parseInt(idStates[idState].val);
                    break;
                case idnBladeTimeBatteryCurrent:
                    mBladeTime = parseInt(idStates[idState].val);
                    break;
                case idnCharchingStartTime:
                    mCharchingStartTime = parseInt(idStates[idState].val);
                    break;
                case idnChargingTimeBatteryNew:
                    mChargingTimeBatteryNew = parseInt(idStates[idState].val);
                    break;
                case idnChargingTimeBatteryCurrent:
                    mChargingTimeBatteryCurrent = parseInt(idStates[idState].val);
                    break;
            }
        }
        adapter.log.debug('syncConfig' + ', idnLastStatus: ' + mLastStatus + ', idnNextStartTime: ' + mNextStart + ', idnStoppedDueRain: ' + mStoppedDueRain + ', idnCurrentErrorCode: ' + mLastErrorCode + ', idTimeZoneOffset: ' + mTimeZoneOffset);
        adapter.log.debug('syncConfig' + ', idnCurrentCoveredDistance: ' + mDist + ', idnLastLocationLongitude: ' + mLastLocationLongi + ', idnLastLocationLatitude: ' + mLastLocationLati + ', idnHomeLocationLongitude: ' + mHomeLocationLongitude + ', idnHomeLocationLatitude: ' + mHomeLocationLongitude);
        adapter.log.debug('syncConfig' + ', idnHomeLocationMaxDistance: ' + mMaxDistance);
        //adapter.log.debug('syncConfig' + ', idnLastLocations: ' + JSON.stringify(mJsonLastLocations));
    });

    adapter.log.debug('syncConfig' + ' finished');

} // syncConfig()


// After API login
husqApi.on('login', () => {
    adapter.log.info("Logged on. Checking for mowers.");
    // Get a list of mowers belonging to this account
    husqApi.getMowers();
});


// After API logout
husqApi.on('logout', () => {
    adapter.log.info("Logged off.");
});


// When we get our intial list of mowers
// mowers = array of HMower objects
husqApi.on('mowersListUpdated', (mowers) => {
    adapter.log.info("Found " + mowers.length + " mower(s)");

    // configurierten Index --> adapter.config.index
    // !P! > mowerIndex && mowers[i].X.name === nickname
    if (mowers.length > 0) {
        //adapter.log.info("mobjMower: " + JSON.stringify(mobjMower));
        adapter.setState(idnMowersJson, JSON.stringify(mowers), true);

        if(mowers.length > 1) {
            var ix = 0;
            mowers.forEach(function (mower) {
                if (mower.mower.name === adapter.config.nickname) {
                    mobjMower = mower;
                    //adapter.log.debug('updateStatus' + ' mobjMower: ' + JSON.stringify(mobjMower));

                    adapter.setState(idnMowerID, mobjMower.mower.id, true);
                    adapter.setState(idnMowerModel, mobjMower.mower.model, true);
                    adapter.setState(idnMowersIndex, ix, true);

                    updateStatus();

                    return true;
                }
                ix++;
            });
        } else {
            mobjMower = mowers[0];
            //adapter.log.debug('updateStatus' + ' mobjMower: ' + JSON.stringify(mobjMower));

            adapter.setState(idnMowerNickname, mobjMower.mower.name, true);
            adapter.setState(idnMowerID, mobjMower.mower.id, true);
            adapter.setState(idnMowerModel, mobjMower.mower.model, true);
            adapter.setState(idnMowersIndex, 0, true);

            updateStatus();
        }
    }
}); // husqApi.on()


function createSubscriber() {

    if (adapter.setState) adapter.setState('info.connection', true, true);

    if(adapter.config.idRainSensor !== '') {        // use only rain sensor
        adapter.getForeignState(adapter.config.idRainSensor, function (err, idState) {
            if (err) {
                adapter.log.error(err);
                return;
            }

            // id rain sensor valid
            adapter.subscribeForeignStates(adapter.config.idRainSensor);
        });
    } else if (adapter.config.idWeatherRainForecast !== '') { // alternate use forecast
        adapter.getForeignState(adapter.config.idWeatherRainForecast, function (err, idState) {
            if (err) {
                adapter.log.error(err);
                return;
            }

            adapter.subscribeForeignStates(adapter.config.idWeatherRainForecast);
        });
    }

    // daily accumulation
    //!P!scheduleDailyAccumulation = schedule("0 0 * * *", function () {
    mScheduleDailyAccumulation = husqSchedule.scheduleJob({hour: 0, minute: 0}, function () {
        dailyAccumulation();
    });

} // createSubscriber()


function mover_login() {
    husqApi.logout();
    husqApi.login(adapter.config.email, adapter.config.pwd);
} // mover_login()


function main() {

    if (adapter.config.pwd === "PASSWORT") {

        adapter.log.error("Bitte die Felder E-Mail und Passwort ausfüllen!");
        adapter.setState('info.connected', false, true);
    }
    else {
        createDataStructure();

        //syncConfig();
        setTimeout(syncConfig, 500);

        adapter.log.debug('Mail address: ' + adapter.config.email);
        //adapter.log.debug('Password were set to: ' + adapter.config.pwd);

        mQueryIntervalActive_s = adapter.config.pollActive;
        if (isNaN(mQueryIntervalActive_s) || mQueryIntervalActive_s < 31) {
            mQueryIntervalActive_s = 60;
        }

        mQueryIntervalInactive_s = adapter.config.pollInactive;
        if (isNaN(mQueryIntervalInactive_s) || mQueryIntervalInactive_s < 300) {
            mQueryIntervalInactive_s = 300;
        }

        // !P! hier nicht oder? mScheduleStatus = setInterval(updateStatus, mQueryIntervalActive_s * 1000);

        // subscribe own events
        adapter.subscribeStates('*');

        setTimeout(mover_login, 1000);

        setTimeout(createSubscriber, 2000);
    }
} // main()

// cfg:
// email
// passwort
// Mäher-Index, disabled
// Nickname, identify mower
// Abfrage-Intervall aktiv
// Abfrage-Intervall inaktiv
// mower.homeLocation.latitude      // geladen von Husqvarana central point
// mower.homeLocation.longitude     // geladen von Husqvarana central point
// mower.homeLocation.maxDistance
// mower.homeLocation.name
// Rohdaten hinzufügen ???
// erweiterte Statistik
// id für TimeZoneOffset
// idRainSensor
// RainSensorValue - [bool, true]
// stopOnRainEnabled
// idWeatherRainForecast
// stopOnRainPercent

// mqtt.0.hm-rpc.0.OEQ0996420.1.STATE
// weatherunderground.1.forecast.0h.qpf

