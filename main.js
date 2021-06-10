/*
 *
 *      ioBroker Husqvarna Automower Adapter
 *
 *      (c) 2018-2021 Greyhound <truegreyhound@gmx.net>
 *
 *      MIT License
 *
 */


/* jshint -W097 */ // jshint strict:false
/*jslint node: true */
"use strict";

//!V! 1.1.2.0
/*
mower.lastStartTime --> mower.statistics.mowingStartTime, alter Wert wird übernommen und lastStartTime gelöscht, ggf. in View(s) anpassen
Regenwertvergleich bei number: bei 0 oder 1 ==, sonst >=, Typ des Wertes wird aus DP des Sensors gelesen
Zähler für Anzahl WebRequests je Tag und kumulativ Monat (idnWebRequestCountXXXXX)
Workaround für Erkennung Änderung Regensensor (subscribe)
Überarbeitung Logik bei Regen/wieder trocken
*/

//!P! Beim daily-Lauf eine Kopie aller Datenpunkte erstellen und im Dateisystem speichern und dann??

//!I! in den Husqvarna-GPS-Daten fehlt Zeitstempel!
//!I! Adapter setzt voraus, dass Mower spätestens Mitternacht eingeparkt hat

//!I! Option in Cfg für automatischen Neustart nach Regen ( <0 - disabled, >= - aktiv)

/* !I! Zähler für Anzahl WebRequests je Tag
    Wenn mobjMower kein valides Objekt, dann das nicht als Statusaktualisierung werten, sondern als Fehler in WebRequest, neuer DP?
    !P!Ggf. bei max count == 10000 - 1000 WarnMessage und count for timer runter setzen
    bei dailyAccumulation werden Werte zurückgesetzt

    mnWebRequestCountDay
    mnWebRequestCountDay_success
    mnWebRequestCountDay_error  -- beim 4. error wird auf mQueryIntervalInactive_s umgeschaltet und Nachricht/error-message gesendet, bei 10. Error wird Adapter auf rot gesetzt !?

    idnWebRequestCountDay
    idnWebRequestCountDay_success
    idnWebRequestCountDay_error

    idnWebRequestCountMonth     - Month-Werte werden am ersten Tag des Monats auf 0 gesetzt oder wenn letzte Aktualisierung im letzten Monat
    idnWebRequestCountMonth_success
    idnWebRequestCountMonth_error
*/

//!P! ERROR_CODES_MT mehrsprachig ausfühen, dann in Konfiguration AUswahlbox für Anzeige Fehlercodes

//!P! Option in Cfg für Aktion bei Regen --> park bis auf weiters | Start mit nächster Timereinstellung | parken für 3, 6 oder 12h

//!P! auf Handy-App gibt es bei Parken 4 Möglichkeiten: " BIS AUF WEITERES" | Start mit nächster Timereinstellung | parken für "3 STUNDEN" |"6 STUNDEN" |"12 STUNDEN"
//!P! auf Handy-App gibt es bei Starten: "IM HAUPTBEREICH FORTSETZEN" | Timer aufheben für "3 STUNDEN" |"6 STUNDEN" |"12 STUNDEN"

//!P! auf Handy-App gibt es einen Befehl "Pause", dieser bewirkt das Stehenbleiben, sprich pausieren für unbestimmte Zeit oder gibt es weitere Optionen analog zu parken?
//!P! Wenn Mower in Status Pause wechselt, prüfen, ob in Ladestation (GPS + Abweichung, Druckschalter (in Arbeit), ???), Wenn nicht, dann Telegram-Nachricht und nach Zeit XXX automatisch parken lassen ?!

//!P! Prüfen. wenn Adapter neu gestartet wird, ob einige Werte falsch hochgezählt werden, z. B. Batterieladung Anzahl

//!P! Statuswerte in Variablen in Abhängigkeit vom Mähertyp laden und im Skript verwenden

//!P! updateStatus prüfen, dass Status etc. aktualisiert wird, wenn nicht bzw. http-Fehler oder sich trotz CUTTING GPS-Daten nicht ändern --> ALARM
//!P! - Status Timestamp muss sich ändern (keine Ahnung ob von Husqvarna gesetzt oder nur aktuell vom Webserver)

//!P! in Adapter-config button to test connection data and fill Combobox to select a mower, on one, fill direct

//!P! Idee, Wenn Cutting und bei den letzten 2 Statusabfragen keine Änderung des Standortes wahrscheinlich Fehler oder?


//!P! mower.isCutting scheint in HMower nicht gesetzt zu werden!?

//!P! Magnetschalter (Magnet am Mowergehäuse, Reedkontakt an Station) um zu erkennen, ob Mower in Ladestation
//!P! Wenn Magnetschalter anspricht (off) und letzter Status != LEAVING und aktueller Status != CUTTING (testen!) --> ALARM

//!P! Wenn Mower geparkt, dann Timer programmieren ermöglichen, der Mower wieder startet

//!P! "Pause"-Taste --> mower parken, startet Timer mit einstellbarer Zeit (oder jeder Pausendruck erhöht Pausenwert um X), nach Ablaus geht Mower wieder in Normalbetrieb

//!P! Es gibt wohl noch weitere Befehle ?? add_push_id, remove_push_id <-- ggf. nur für iOS/Android; get_mower_settings
//!P! die Apps können
//!P! - Timer laden/modifizieren
//!P! - Schnitthöhe abfragen/ festlegen
//!P! - Wettertimer, ECO-Modus und Spiralschnitt einstellen
//!P! - Blinkt bei Störung, Scheinwerfer ein/aus

/*
"model": "H" ==? 450X
"command": {
			"park": "PARK",
			"stop": "STOP",
			"start": "START"
		},
		"status": {
			"error": "ERROR",
			"cutting": "OK_CUTTING",
			"manualCutting": "OK_CUTTING_NOT_AUTO",
			"parked": "PARKED_TIMER",
			"manualParked": "PARKED_PARKED_SELECTED",
			"paused": "PAUSED",
			"searching": "OK_SEARCHING"
		},

"model": "L" ==?  315X
		"command": {
			"park": "PARK",
			"stop": "STOP",
			"start": "START"
		},
		"status": {
			"error": "ERROR",
			"cutting": "OK_CUTTING",
			"manualCutting": "OK_CUTTING_NOT_AUTO",
			"parked": "PARKED_TIMER",
			"manualParked": "PARKED_PARKED_SELECTED",
			"paused": "PAUSED",
			"searching": "OK_SEARCHING"
		},
*/

/*
Handy-App
- sollte Mähdauer anzeigen und wahrscheinlichen nächsten Boxenstop
- letzte Datenaktualisierung
- Akkustatus (% Kapazität) beim Mähen anzeigen, wird seit 2018 angezeigt
- bei bestimmten Fehlern (hängt fest), sollte ein Start per App möglich sein
- Mäher hatte Netzverbindung verloren, via App nicht erkennbar, es fehlt Datum/Uhrzeit letzte Aktualisierung vom Mäher
- Datum/Uhrzeit == lokale Zeit ???
- Rückmeldung Mähen erforderlich (Mähwiderstand)
- Rückmeldung aktiver Mähbereich
- bei Statusänderung sollte der Auslöser "festgehalten" werden: mower timer, App + account, via Web-API + account
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
- OK_CUTTING_NOT_AUTO
- OK_LEAVING
- OK_SEARCHING
- PARKED_AUTOTIMER
- OFF_DISABLED
- ERROR
- PARKED_PARKED_SELECTED
- PARKED_TIMER
- PAUSED

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
const utils = require(__dirname + '/lib/utils'); // Get common adapter utils
// you have to call the adapter function and pass a options object
// name has to be set and has to be equal to adapters folder name and main file name excluding extension
// adapter will be restarted automatically every time as the configuration changed, e.g system.adapter.template.0
const adapter = utils.Adapter('husq-automower');

const HusqApiRequest = require(__dirname + '/lib/HusqApiRequest');
const husqApi = new HusqApiRequest(adapter);
const husqSchedule = require('node-schedule');

const idnMowerConnected = 'info.connected',
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

    idnBatteryChargeCycleDaily = 'mower.statistics.batteryChargeCycleDaily',
    idnBatteryEfficiencyFactor = 'mower.statistics.batteryEfficiencyFactor',
    idnChargingStartTime = 'mower.statistics.chargingBatteryStarttime',
    idnChargingTimeBatteryCurrent = 'mower.statistics.chargingTimeBatteryCurrent',
    idnChargingTimeBatteryDaily = 'mower.statistics.chargingTimeBatteryDaily',
    idnChargingTimeBatteryNew = 'mower.statistics.chargingTimeBatteryNew',
    idnLastChargingTimeBattery = 'mower.statistics.lastChargingTimeBattery',
    idnCurrentCoveredDistance = 'mower.statistics.currentCoveredDistance',
    idnCoveredDistanceDaily = 'mower.statistics.coveredDistanceDaily',
    idnLastMowingTime = 'mower.statistics.lastMowingTime',
    idnLastCoveredDistance = 'mower.statistics.lastCoveredDistance',
    idnLastStationReturnTime = 'mower.statistics.lastStationReturnTime',
    idnMowingTime = 'mower.statistics.mowingTime',
    idnMowingTimeDaily = 'mower.statistics.mowingTimeDaily',
    idnMowingStartTime = 'mower.statistics.mowingStartTime',
    idnMowingTimeBatteryNew = 'mower.statistics.mowingTimeBatteryNew',
    idnOverallBatteryChargeCycle = 'mower.statistics.overallBatteryChargeCycle',
    idnOverallMowingTime = 'mower.statistics.overallMowingTime',
    idnOverallCoveredDistance = 'mower.statistics.overallCoveredDistance',

    idnAMAction = 'mower.action',
    idnBatteryPercent = 'mower.batteryPercent',
    idnCurrentErrorCode = 'mower.currentErrorCode',
    idnCurrentErrorMsg = 'mower.currentErrorMsg',
    idnCurrentErrorCodeTS = 'mower.currentErrorCodeTimestamp',
    idnLastAction = 'mower.lastAction',
    idnLastDockingTime = 'mower.lastDockingTime',
    idnLastErrorCode = 'mower.lastErrorCode',
    idnLastErrorMsg = 'mower.lastErrorMsg',
    idnLastErrorCodeTS = 'mower.lastErrorCodeTimestamp',
    idnLastHttpStatus = 'mower.lastHttpStatus',
    idnLastLocations = 'mower.lastLocations',
    idnLastStatus = 'mower.lastStatus',
    idnLastStatusTime = 'mower.lastStatusTime',
    idnLastStatusChangeTime = 'mower.lastStatusChangeTime',
    idnLastDayLocations = 'mower.lastdayLocations',
    idnNextStartSource = 'mower.nextStartSource',
    idnNextStartTime = 'mower.nextStartTime',                       // --> io-package
    idnNextStartWatching = 'mower.nextStartWatching',               // ?????
    idnOperatingMode = 'mower.operatingMode',
    idnStopOnRainEnabled = 'mower.stopOnRainEnabled',               // copy from config
    idnStoppedDueToRain = 'mower.stoppedDueRain',                   // stopped due to rain 
    idnTimerAfterRainStartAt = 'mower.timerAfterRainStartAt',
    idnWaitAfterRain = 'mower.waitAfterRain',                       // copy from config
    idnRawSend = 'mower.rawSend',
    idnRawResponse = 'mower.rawResponse',
    idnRawResponseGeo = 'mower.rawResponse_geo',
    idnRawResponseMowers = 'mower.rawResponse_mowers',
    idnSendMessage = 'mower.sendMessage',
    idnScheduleTime = 'mower.scheduleTime',
    idnWebRequestCountDay = 'mower.http_request_count_day',
    idnWebRequestCountDay_success = 'mower.http_request_count_day_success',
    idnWebRequestCountDay_error = 'mower.http_request_count_day_error',

    idnWebRequestCountMonth = 'mower.http_request_count_month',
    idnWebRequestCountMonth_success = 'mower.http_request_count_month_success',
    idnWebRequestCountMonth_error = 'mower.http_request_count_month_error',
    

    UrlGoogleMaps = 'http://maps.google.com/maps?q=',
    ThisIsTheEnd = 'ThisIsTheEnd';


let mobjMower = null,
    mQueryIntervalActive_s = 30,
    mQueryIntervalInactive_s = 300,
    mCurrentStatus = 'unknown',
    mLastStatus = 'unknown',
    mHomeLocationLongitude = 0,
    mHomeLocationLatitude = 0,
    mNextStartTime = 0,
    mLastStartTime = 0, 	        // workaround, until we get the real times from API, P#03
    mbStoppedDueToRain = false,
    mLastErrorCode = 0,
    mLastErrorCodeTimestamp = 0,
    mJsonLastLocations = [],
    mDist = 0,
    mDistDaily = 0,
    mMaxDistance = 0,
    mLastLocationLongi = 0,
    mLastLocationLati = 0,
    mBatteryPercent = 0,
    mAlarmOnBatteryPercent = false,
    mMowingTime = 0,
    mLastMowingTime = 0,
    mMowingTimeDaily = 0,
    mMowingTimeBatteryNew = 0,
    mStartMowingTime = 0,
    mSearchingStartTime = 0,
    mChargingStartTime = 0,
    mChargingTimeBatteryCurrent = 0,
    mChargingTimeBatteryDaily = 0,
    mChargingTimeBatteryNew = 0,
    mScheduleStatus = null,
    mScheduleTime = 1,
    mTimeZoneOffset = new Date().getTimezoneOffset(),       // offset in minutes
    mWaitAfterRainTimer = null,
    mWaitAutoTimer = null,
    mBatteryChargeCycleDaily = 0,
    mLastStatusChangeTime = 0,
    mScheduleDailyAccumulation = null,
    mWaitAfterRain_min = 0,
    mUpdateStatusRunning = false,
    mnWebRequestCountDay = 0,
    mnWebRequestCountDay_success = 0,
    mnWebRequestCountDay_error = 0,
    mnWebRequestCountDay_error_Check = 0,
    ThisIsTheEnd2;

const MSG_PRIO = {'info': 3, 'warn': 2, 'alarm': 1, 'intern': 9};

const ERROR_CODES_MT = {
    '320': {        // 330X
        '0': {'alarm': false, 'language': {'ger': ''}},
        '1': {'alarm': true, 'language': {'ger': 'Außerhalb des Arbeitsbereichs'}},
        '2': {'alarm': false, 'language': {'ger': 'Kein Schleifensignal'}},
        '4': {'alarm': false, 'language': {'ger': 'Problem Schleifensensor, vorne'}},
        '5': {'alarm': false, 'language': {'ger': 'Problem Schleifensensor, hinten'}},
        '6': {'alarm': false, 'language': {'ger': 'Problem Schleifensensor'}},
        '7': {'alarm': false, 'language': {'ger': 'Problem Schleifensensor'}},
        '8': {'alarm': true, 'language': {'ger': 'Falscher PIN-Code'}},
        '9': {'alarm': false, 'language': {'ger': 'Eingeschlossen'}},
        '10': {'alarm': false, 'language': {'ger': 'Steht auf dem Kopf'}},
        '11': {'alarm': false, 'language': {'ger': 'Niedriger Batteriestand'}},
        '12': {'alarm': false, 'language': {'ger': 'Batterie leer'}},      // 450X - angehoben?
        '13': {'alarm': false, 'language': {'ger': 'Kein Antrieb'}},
        '15': {'alarm': true, 'language': {'ger': 'Mäher angehoben'}},    // 450X - kein Schleifensignal?
        '16': {'alarm': false, 'language': {'ger': 'Eingeklemmt in Ladestation'}},
        '17': {'alarm': false, 'language': {'ger': 'Ladestation blockiert'}},
        '18': {'alarm': false, 'language': {'ger': 'Problem Stoßsensor hinten'}},
        '19': {'alarm': false, 'language': {'ger': 'Problem Stoßsensor vorne'}},
        '20': {'alarm': false, 'language': {'ger': 'Radmotor rechts blockiert'}},
        '21': {'alarm': false, 'language': {'ger': 'Radmotor links blockiert'}},
        '22': {'alarm': false, 'language': {'ger': 'Problem Antrieb links'}},
        '23': {'alarm': false, 'language': {'ger': 'Problem Antrieb rechts'}},
        '24': {'alarm': false, 'language': {'ger': 'Problem Mähmotor'}},
        '25': {'alarm': false, 'language': {'ger': 'Schneidsystem blockiert'}},
        '26': {'alarm': false, 'language': {'ger': 'Fehlerhafte Bauteileverbindung'}},
        '27': {'alarm': false, 'language': {'ger': 'Standardeinstellungen'}},
        '28': {'alarm': false, 'language': {'ger': 'Speicher defekt'}},
        '30': {'alarm': false, 'language': {'ger': 'Batterieproblem'}},
        '31': {'alarm': false, 'language': {'ger': 'STOP-Tastenproblem'}},
        '32': {'alarm': false, 'language': {'ger': 'Kippsensorproblem'}},
        '33': {'alarm': true, 'language': {'ger': 'Mäher gekippt'}},
        '35': {'alarm': false, 'language': {'ger': 'Rechter Radmotor überlastet'}},
        '36': {'alarm': false, 'language': {'ger': 'Linker Radmotor überlastet'}},
        '37': {'alarm': false, 'language': {'ger': 'Ladestrom zu hoch'}},
        '38': {'alarm': false, 'language': {'ger': 'Vorübergehendes Problem'}},
        '42': {'alarm': false, 'language': {'ger': 'Begrenzter Schnitthöhenbereich'}},
        '43': {'alarm': false, 'language': {'ger': 'Unerwartete Schnitthöhenverstellung/Problem Antrieb Schnitthöhe'}},
        '44': {'alarm': false, 'language': {'ger': 'Unerwartete Schnitthöhenverstellung/Problem Antrieb Schnitthöhe'}},
        '45': {'alarm': false, 'language': {'ger': 'Unerwartete Schnitthöhenverstellung/Problem Antrieb Schnitthöhe'}},
        '46': {'alarm': false, 'language': {'ger': 'Begrenzter Schnitthöhenbereich'}},
        '47': {'alarm': false, 'language': {'ger': 'Unerwartete Schnitthöhenverstellung/Problem Antrieb Schnitthöhe'}},
        '49': {'alarm': false, 'language': {'ger': 'unknown code 49'}},
        '70': {'alarm': false, 'language': {'ger': 'Mäher/Klingen reinigen'}},
        '71': {'alarm': true, 'language': {'ger': 'Mäher angehoben'}}     // 430 oder 450?
    }   
};

//!P! abhängig vom Typ zuweisen
let ERROR_CODES = ERROR_CODES_MT['320'];


adapter.on('unload', function (callback) {
    try {
        husqApi.logout();
        if(mScheduleStatus !== null) clearInterval(mScheduleStatus);    //.cancel;
        if(mScheduleDailyAccumulation !== null) husqSchedule.cancelJob(mScheduleDailyAccumulation);

        //!P!if (adapter.setState) adapter.setState('info.connection', false, true);
        if (adapter.setState) adapter.setState(idnMowerConnected, false, true);

        adapter.log.info('cleaned everything up...');

        callback();
    } catch (e) {
        callback();
    }
});


// is called if a subscribed object changes
adapter.on('objectChange', function (id, obj) {
    // Warning, obj can be null if it was deleted
    adapter.log.info("objectChange " + id + " " + JSON.stringify(obj));
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
} // createState()


function createChannels(adapter) {
    return new Promise((resolve, reject) => {
        const fctName = 'createChannels';
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

            reject(err);
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

        const successObject = {
            msg: 'Success',
            data: true,
        };
        resolve(successObject); 
    });

} // createChannels()


function createDPs(adapter) {
    const fctName = 'createDPs';
    const saveRawData = adapter.config.saveRawData;

    adapter.log.debug(fctName + ' started');

    createState(idnMowerConnected, false);
    createState(idnMowerFirmware, '');
    createState(idnMowerNickname, '');
    createState(idnMowerID, '');
    createState(idnMowerModel, '');
    createState(idnMowersIndex, -1);

    if(saveRawData) { createState(idnMowersJson, []); }

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

    createState(idnMowingTime, 0, idnMowingTime, false, "min.");
    createState(idnMowingTimeDaily, 0, idnMowingTimeDaily, false, "min.");

    // check for old state lastStartTime
    adapter.getObject('mower.lastStartTime', function (err, oidState) {
        if (err || !(oidState)) {
            // not exist
            createState(idnMowingStartTime, 0);
        } else {
            adapter.getState('mower.lastStartTime', function (err, stateLST) {
                if (!err && stateLST) {
                    createState(idnMowingStartTime, stateLST.val);

                    adapter.deleteState('mower.lastStartTime');
                } else {
                    createState(idnMowingStartTime, 0);
                }
            });
        }
    });

    createState(idnMowingTimeBatteryNew, 0, idnMowingTimeBatteryNew, false, "min.");
    createState(idnBatteryChargeCycleDaily, 0);
    createState(idnBatteryEfficiencyFactor, 0, idnBatteryEfficiencyFactor, false, "%");
    createState(idnChargingStartTime, 0);
    createState(idnChargingTimeBatteryCurrent, 0, idnChargingTimeBatteryCurrent, false, "min.");
    createState(idnChargingTimeBatteryDaily, 0, idnChargingTimeBatteryDaily, false, "min.");
    createState(idnChargingTimeBatteryNew, 0, idnChargingTimeBatteryNew, false, "min.");
    createState(idnLastChargingTimeBattery, 0, idnLastChargingTimeBattery, false, "min.");
    createState(idnCurrentCoveredDistance, 0, idnCurrentCoveredDistance, false, "m");
    createState(idnCoveredDistanceDaily, 0, idnCoveredDistanceDaily, false, "m");
    createState(idnLastMowingTime, 0, idnLastMowingTime, false, "min.");
    createState(idnLastCoveredDistance, 0, idnLastCoveredDistance, false, "m");
    createState(idnLastStationReturnTime, 0, idnLastStationReturnTime, false, "min.");
    createState(idnOverallBatteryChargeCycle, 0);
    createState(idnOverallMowingTime, 0, idnOverallMowingTime, false, "h");
    createState(idnOverallCoveredDistance, 0, idnOverallCoveredDistance, false, "km");

    createState(idnAMAction, 0, idnAMAction, true);
    createState(idnBatteryPercent, 0, idnBatteryPercent, false, "%");
    createState(idnCurrentErrorCode, 0);
    createState(idnCurrentErrorMsg, '');
    createState(idnCurrentErrorCodeTS, 0);
    createState(idnLastAction, 'unkonwn');
    createState(idnLastDockingTime, 0);
    createState(idnLastErrorCode, 0);
    createState(idnLastErrorMsg, '');
    createState(idnLastErrorCodeTS, 0);
    createState(idnLastHttpStatus, 0);
    createState(idnLastLocations, '[]');
    createState(idnLastStatus, 'unkonwn');
    createState(idnLastStatusTime, 0);
    createState(idnLastStatusChangeTime, 0);
    createState(idnLastDayLocations, '[]');
    createState(idnNextStartSource, '');
    createState(idnNextStartTime, 0);
    createState(idnNextStartWatching, 0);
    createState(idnOperatingMode, 'unkonwn');
    createState(idnStopOnRainEnabled, false);
    createState(idnStoppedDueToRain, false, idnStoppedDueToRain, true);
    createState(idnTimerAfterRainStartAt, 0, idnTimerAfterRainStartAt, true);
    createState(idnWaitAfterRain, 0, idnWaitAfterRain, false, "min.");
    createState(idnSendMessage, '');
    createState(idnScheduleTime, 0, idnScheduleTime, false, "s");

    createState(idnWebRequestCountDay, 0);
    createState(idnWebRequestCountDay_success, 0);
    createState(idnWebRequestCountDay_error, 0);
    createState(idnWebRequestCountMonth, 0);
    createState(idnWebRequestCountMonth_success, 0);
    createState(idnWebRequestCountMonth_error, 0);
 
    //States for testing
    if (saveRawData) {
        createState(idnRawSend, '', 'object for sending raw messages to the mower');
        createState(idnRawResponse, '', 'Display the raw message from the mower');
        createState(idnRawResponseGeo, '', 'Display the raw message from the mower locations');
        createState(idnRawResponseMowers, '', 'Display the raw message from get mowers');
    } else {    //delete Teststates
        adapter.deleteState(adapter.namespace, 'mower', 'rawSend');
        adapter.deleteState(adapter.namespace, 'mower', 'rawResponse');
        adapter.deleteState(adapter.namespace, 'mower', 'rawResponse_geo');
        adapter.deleteState(adapter.namespace, 'mower', 'rawResponse_mowers');
    }

    adapter.log.debug(fctName + ' finished');

} // createDPs()


function createDataStructure(adapter) {
    const fctName = 'createDataStructure';
    adapter.log.debug(fctName + ' started');

    createChannels(adapter)
    .then(result => {
        adapter.log.debug(fctName + ', createChannels() finished; result: ' + JSON.stringify(result));

        createDPs(adapter);
    })
    .catch(err => {
        adapter.log.error(fctName + ', createChannels() finished; result: ' + JSON.stringify(err));
    });

    adapter.log.debug(fctName + ' finished');

} // createDataStructure()


function parseBool(value) {
    if (typeof value === "boolean") return value;

    if (typeof value === "number") {
        return value === 1 ? true : value === 0 ? false : undefined;
    }

    if (typeof value != "string") return undefined;

    return value.toLowerCase() === 'true' ? true : value.toLowerCase() === 'false' ? false : undefined;

} // parseBool()


function precisionRound(number, precision) {
    let factor = Math.pow(10, precision);

    return Math.round(number * factor) / factor;
} // precisionRound()


function checkIfItsRaining() {
    const fctName = 'checkIfItsRaining';
    adapter.log.debug(fctName + ' started');

    if(adapter.config.idRainSensor !== '' && adapter.config.stopOnRainEnabled == true) {
        adapter.log.debug(fctName + ', idRainSensor: ' + adapter.config.idRainSensor);            // mqtt.0.hm-rpc.0.OEQ0996420.1.STATE

        // get current state
        adapter.getForeignState(adapter.config.idRainSensor, function (err, idState) {
            if (err) {
                adapter.log.error(err);

                return;
            }
            if (!idState) {
                adapter.log.error(fctName + ', getForeignState; idRainSensor: ' + adapter.config.idRainSensor + ';  object for "getForeignState(adapter.config.idRainSensor, ...)" is: ' + JSON.stringify(idState));

                return;
            }
            adapter.log.debug(fctName + ', getForeignState; idRainSensor: ' + adapter.config.idRainSensor + '; idState: ' + JSON.stringify(idState)); 
            // idState: {"val":0,"ack":true,"ts":1596924551829,"q":0,"from":"system.adapter.mqtt.0","user":"system.user.admin","lc":1596220067889}


            adapter.getForeignObject(adapter.config.idRainSensor, function (err, oidState) {
                if (err) {
                    adapter.log.error(err);
    
                    return;
                }

                const idStateType = oidState.common.type;

                let bRain = false;

                adapter.log.debug(fctName + ', getForeignState; adapter.config.rainSensorValue: "' + adapter.config.rainSensorValue + '"; idStateType: ' + idStateType); 

                switch (idStateType) {
                    case 'boolean':
                        bRain = (parseBool(idState.val) === parseBool(adapter.config.rainSensorValue));
                        break;
                    case 'number':
                        if (adapter.config.rainSensorValue == '0' || adapter.config.rainSensorValue == '1') {
                            // compare equal
                            bRain = (parseInt(idState.val) === parseInt(adapter.config.rainSensorValue));
                        } else {
                            // compare >=
                            bRain = (parseFloat(idState.val) >= parseFloat(adapter.config.rainSensorValue.replace(',', '.')));
                        }
                        break;
                    default:
                        bRain = (idState.val === adapter.config.rainSensorValue);
                        break;
                }

                if (mbStoppedDueToRain != bRain) {
                    if(bRain) {
                        adapter.setState(idnStoppedDueToRain, true, true);
                        adapter.log.debug(fctName + ', getForeignState; idRainSensor (it`s raining)');
                    } else {
                        adapter.setState(idnStoppedDueToRain, false, true);
                        adapter.log.debug(fctName + ', getForeignState; idRainSensor (no rain)');
                    }
                }
            });
        });
    } // if(adapter.config.idRainSensor !== '' && adapter.config.stopOnRainEnabled == true)

    adapter.log.debug(fctName + ' finished');

} // checkIfItsRaining()


function handleMowerOnRain(isRaining) {
    const fctName = 'handleMowerOnRain';
    let sMsg = '';

    adapter.log.debug(fctName + ', isRaining: ' + isRaining + '; mCurrentStatus: ' + mCurrentStatus + ';  adapter.config.stopOnRainEnabled: ' + adapter.config.stopOnRainEnabled);

    if(typeof isRaining !== 'boolean') {
        adapter.log.debug(fctName + ' finished, isRaining has false object type: ' + typeof isRaining);

        return;
    }

    if(adapter.config.stopOnRainEnabled === false) {
        adapter.log.debug(fctName + ' finished, stopOnRainEnabled === false');

        return;
    }

    if (isRaining === true) {
        // it's raining
        adapter.log.debug(fctName + ', it`s raining; mWaitAutoTimer: ' + JSON.stringify(mWaitAutoTimer) + '; mCurrentStatus: ' + mCurrentStatus);

        if (mWaitAutoTimer !== null) {
            clearTimeout(mWaitAutoTimer);
            //!P!mWaitAutoTimer.cancel;

            mWaitAutoTimer = null;

            adapter.setState(idnNextStartWatching, 0, true);
        }

        if(mCurrentStatus === 'OK_LEAVING' || mCurrentStatus === 'OK_CUTTING' || mCurrentStatus === 'OK_CUTTING_NOT_AUTO' || mCurrentStatus === 'OK_CHARGING') {	// PARKED_PARKED_SELECTED ??
            //!P! beim Laden parken möglich? hat das einen Effekt
            // mower is working
            parkMower();

            if (mWaitAfterRainTimer !== null) {
                clearTimeout(mWaitAfterRainTimer);
                //!P!mWaitAfterRainTimer.cancel;
    
                mWaitAfterRainTimer = null;
    
                adapter.setState(idnTimerAfterRainStartAt, 0, true);
            }
    
            sMsg = fctName + ' switched to rain; send mower ' + mobjMower.mower.name + ' command "park"';
            adapter.setState(idnSendMessage, JSON.stringify([new Date().getTime(), sMsg, fctName, 'rain sensor', MSG_PRIO.warn]), true);
        }

        if(mCurrentStatus === 'PARKED_AUTOTIMER' || mCurrentStatus === 'PARKED_TIMER') {        //!P! || mCurrentStatus === 'PARKED_PARKED_SELECTED'  --> manueller Start zum Fortsetzen notwendig, kein Timer aktiv oder?
            // mower internal timer next auto start läuft
            if (mNextStartTime <= 0 && mLastStartTime <= 0) {       //!P! mLastStartTime is workaround P#03
                adapter.log.warn(fctName + ', mCurrentStatus === "' + mCurrentStatus + '" and mNextStartTime == ' + JSON.stringify(mNextStartTime));
            } else {
                // start time given
                if (mNextStartTime <= 0) mNextStartTime = mLastStartTime;       //!P! mLastStartTime is workaround P#03

                let nTimeDiff = mNextStartTime - new Date().getTime();
                adapter.log.debug(fctName + ', mCurrentStatus === "' + mCurrentStatus + '", minutes to next start: ' + (nTimeDiff / 1000 / 60));

                //!P!const nNextStartLC = dateAdd(mNextStart, - mTimeZoneOffset, 'hours');          // get local time
                //!P!let nextStart2 = nextStart - (1000 * 60 * mTimeZoneOffset) ;
                //!P!adapter.log.debug(fctName + '; mCurrentStatus === "PARKED_AUTOTIMER", mWaitAutoTimer' + nextStart + '; nextStart2: ' + nextStart2 + '; current time:' + new Date().getTime());
        
                if ((nTimeDiff / 1000 / 60) <= mWaitAfterRain_min) {
                    adapter.log.debug(fctName + ', stop autostart from parking while rain');

                    parkMower();

                    sMsg = 'mower ' + mobjMower.mower.name + ' stop autostart while rain, send mower command "park"';
                    adapter.setState(idnSendMessage, JSON.stringify([new Date().getTime(), sMsg, 'mower ' + mobjMower.mower.name + ' stop send', '', MSG_PRIO.warn]), true);

                } else {
                    // Timer starten bis kurz vor Startzeit - mWaitAfterRain_min

                    mWaitAutoTimer = setTimeout(checkIfItKeepsRaining, mNextStartTime - (mWaitAfterRain_min * 60 * 1000) + 60000);       // plant auto start - WaitAfterRain + 60s
                    //mWaitAutoTimer = setTimeout(startMowerAfterAutoTimerCheck, nextStart - new Date().getTime() + 60000);       //plant start + 60s
        
                    adapter.setState(idnNextStartWatching, mNextStartTime - (mWaitAfterRain_min * 60 * 1000) + 60000, true);
        
                    sMsg = fctName + ' switched to rain; check mower ' + mobjMower.mower.name + ' next autostart on "' + adapter.formatDate(mNextStartTime - (mWaitAfterRain_min * 60 * 1000) + 60000, "JJJJ.MM.TT SS:mm:ss") + '"';
                    adapter.setState(idnSendMessage, JSON.stringify([new Date().getTime(), sMsg, fctName, 'rain sensor', MSG_PRIO.info]), true);
                }
            }
        }

    }

    if (isRaining === false) {
        if (mWaitAfterRain_min >= 0) {
            // rain is over, wait until the grass is "dry"
            adapter.log.debug(fctName + ', rain is over; mWaitAfterRainTimer: ' + JSON.stringify(mWaitAfterRainTimer) + '; mCurrentStatus: ' + mCurrentStatus);

            if (mWaitAfterRainTimer !== null) {
                clearTimeout(mWaitAfterRainTimer);
                mWaitAfterRainTimer = null;

                adapter.setState(idnTimerAfterRainStartAt, 0, true);
            }

            let timeout = mWaitAfterRain_min * 60 * 1000;          // 10800000

            mWaitAfterRainTimer = setTimeout(startMowerAfterAutoTimerCheck, timeout);

            adapter.setState(idnTimerAfterRainStartAt, new Date().getTime(), true);
            adapter.log.debug(fctName + '; no rain, wait for ' + mWaitAfterRain_min + ' min. for start mower.');

            sMsg = fctName + ' switched to no rain; wait ' + mWaitAfterRain_min + ' min. for starting mower ' + mobjMower.mower.name ;
            adapter.setState(idnSendMessage, JSON.stringify([new Date().getTime(), sMsg, fctName + ' changed', 'rain sensor', MSG_PRIO.warn]), true);
        } else {
            adapter.log.debug(fctName + '; no rain and no next start time known.');
        }
    }

    adapter.log.debug(fctName + ' finished');

} // handleMowerOnRain()


function startMower() {
    const fctName = 'startMower';

    mobjMower.sendCommand(mobjMower.command.start, (err, msg) => {
        if (err) {
            adapter.log.error(msg);
        } else {
            adapter.log.debug(fctName + ', mower started');
        }
    });
} // startMower()


function stoptMower() {
    const fctName = 'stoptMower';

    mobjMower.sendCommand(mobjMower.command.stop, (err, msg) => {
        if (err) {
            adapter.log.error(msg);
        } else {
            adapter.log.debug(fctName + ', mower stopped');
        }
    });
} // stoptMower()


function parkMower() {
    const fctName = 'parkMower';

    mobjMower.sendCommand(mobjMower.command.park, (err, msg) => {
        if (err) {
            adapter.log.error(msg);
        } else {
            adapter.log.debug(fctName + ', mower parked');
        }
    });
} // parkMower()


adapter.on('stateChange', function (id, state) {
    const fctName = 'subscription stateChange';
    let fctNameId = '';

    if (state) {
        adapter.log.debug(fctName + ', id: ' + id + '; state: ' + JSON.stringify(state));       // ld: husq-automower.0.mower.lastLocation.longitude; state: {"val":11.435046666666667,"ack":false,"ts":1524829008532,"q":0,"from":"system.adapter.husq-automower.0","lc":1524829008532}

        let iddp = id.substr(adapter.namespace.length + 1);

        if(id !== '' && id === adapter.config.idRainSensor) {
            // adapter.config.rainSensorValue - true|1|3.2|?
            fctNameId = 'subscription rainsensor change';

            checkIfItsRaining();

            adapter.log.debug(fctNameId + ' finished');
        }

        // own IDs
        //!P! if (!state.ack) {   ?? muss/sollte ack nun true oder false sein???
        switch (iddp) {
            case idnAMAction:
                fctNameId = 'subscription mower.action changed';

                if (state.val > 0) {
                    if (state.val === 1) {
                        adapter.log.debug(fctNameId + ',  start mower');
                        startMower();
                    } else if (state.val === 2) {
                        adapter.log.debug(fctNameId + ',  stop mower');

                        stoptMower();
                    } else if (state.val === 3) {
                        adapter.log.debug(fctNameId + ',  park mower');

                        parkMower();
                    } else if (state.val === 9) {
                        if(mScheduleTime === 0) {
                            adapter.log.debug(fctNameId + ', status mower');

                            updateStatus();
                        } else {
                            adapter.log.debug(fctNameId + ', execute status mower impossible, scheduler is running.');
                        }

                    } else if (state.val === 77) {
                        adapter.log.debug(fctNameId + ', toggle rain detected');

                        adapter.getState(idnStoppedDueToRain, function (err, stateSDR) {
                            if (!err && stateSDR) {
                                adapter.setState(idnStoppedDueToRain, parseBool(stateSDR.val), true);

                                mbStoppedDueToRain = parseBool(!stateSDR.val);

                                handleMowerOnRain(parseBool(!stateSDR.val));        // but not event trouhg seState !?
                            }
                        });

                    } else if (state.val === 91) {
                        adapter.log.debug(fctNameId + ',  stop status scheduler');

                        mScheduleTime = 0;

                        createStatusScheduler();

                    } else if (state.val === 92) {
                        adapter.log.debug(fctNameId + ',  start status scheduler');

                        mScheduleTime = mQueryIntervalActive_s;

                        createStatusScheduler();

                    } else if (state.val === 95) {
                        adapter.log.debug(fctNameId + ',  pause');
// !P! ??
                    } else if (state.val === 96) {
                        adapter.log.debug(fctNameId + ',  led on/off');
// !P! ??
                    } else if (state.val === 101) {     // print nodul variables
                        adapter.log.info(fctNameId + ', modul variable mCurrentStatus:' + mCurrentStatus);
                        adapter.log.info(fctNameId + ', modul variable mLastStatus:' + mLastStatus);
                        adapter.log.info(fctNameId + ', modul variable mHomeLocationLongitude:' + mHomeLocationLongitude);
                        adapter.log.info(fctNameId + ', modul variable mHomeLocationLatitude:' + mHomeLocationLatitude);
                        adapter.log.info(fctNameId + ', modul variable mNextStartTime:' + mNextStartTime);
                        adapter.log.info(fctNameId + ', modul variable mLastStartTime:' + mLastStartTime);
                        adapter.log.info(fctNameId + ', modul variable mStoppedDueToRain:' + mbStoppedDueToRain);
                        adapter.log.info(fctNameId + ', modul variable mLastErrorCode:' + mLastErrorCode);
                        adapter.log.info(fctNameId + ', modul variable mLastErrorCodeTimestamp:' + mLastErrorCodeTimestamp);
                        adapter.log.info(fctNameId + ', modul variable mJsonLastLocations:' + mJsonLastLocations);
                        adapter.log.info(fctNameId + ', modul variable mDist:' + mDist);
                        adapter.log.info(fctNameId + ', modul variable mDistDaily:' + mDistDaily);
                        adapter.log.info(fctNameId + ', modul variable mMaxDistance:' + mMaxDistance);
                        adapter.log.info(fctNameId + ', modul variable mLastLocationLongi:' + mLastLocationLongi);
                        adapter.log.info(fctNameId + ', modul variable mLastLocationLati:' + mLastLocationLati);
                        adapter.log.info(fctNameId + ', modul variable mBatteryPercent:' + mBatteryPercent);
                        adapter.log.info(fctNameId + ', modul variable mAlarmOnBatteryPercent:' + mAlarmOnBatteryPercent);
                        adapter.log.info(fctNameId + ', modul variable mMowingTime:' + mMowingTime);
                        adapter.log.info(fctNameId + ', modul variable mLastMowingTime:' + mLastMowingTime);
                        adapter.log.info(fctNameId + ', modul variable mMowingTimeDaily:' + mMowingTimeDaily);
                        adapter.log.info(fctNameId + ', modul variable mMowingTimeBatteryNew:' + mMowingTimeBatteryNew);
                        adapter.log.info(fctNameId + ', modul variable mStartMowingTime:' + mStartMowingTime);
                        adapter.log.info(fctNameId + ', modul variable mSearchingStartTime:' + mSearchingStartTime);
                        adapter.log.info(fctNameId + ', modul variable mChargingStartTime:' + mChargingStartTime);
                        adapter.log.info(fctNameId + ', modul variable mChargingTimeBatteryCurrent:' + mChargingTimeBatteryCurrent);
                        adapter.log.info(fctNameId + ', modul variable mChargingTimeBatteryDaily:' + mChargingTimeBatteryDaily);
                        adapter.log.info(fctNameId + ', modul variable mChargingTimeBatteryNew:' + mChargingTimeBatteryNew);
                        //!P! circular JSON  adapter.log.info(fctNameId + ', modul variable mScheduleStatus:' + JSON.stringify(mScheduleStatus));
                        //!P! circular JSON  adapter.log.info(fctNameId + ', modul variable mScheduleTime:' + JSON.stringify(mScheduleTime));
                        adapter.log.info(fctNameId + ', modul variable mTimeZoneOffset:' + mTimeZoneOffset);
                        adapter.log.info(fctNameId + ', modul variable mWaitAfterRainTimer:' + mWaitAfterRainTimer);
                        //!P! circular JSON  adapter.log.info(fctNameId + ', modul variable mWaitAutoTimer:' + JSON.stringify(mWaitAutoTimer));
                        adapter.log.info(fctNameId + ', modul variable mBatteryChargeCycleDaily:' + mBatteryChargeCycleDaily);
                        //!P! circular JSON  adapter.log.info(fctNameId + ', modul variable mScheduleDailyAccumulation:' + JSON.stringify(mScheduleDailyAccumulation));
                        adapter.log.info(fctNameId + ', modul variable mWaitAfterRain_min:' + mWaitAfterRain_min);
                        adapter.log.info(fctNameId + ', modul variable mUpdateStatusRunning:' + mUpdateStatusRunning);
                        adapter.log.info(fctNameId + ', modul variable mnWebRequestCountDay:' + mnWebRequestCountDay);
                        adapter.log.info(fctNameId + ', modul variable mnWebRequestCountDay_success:' + mnWebRequestCountDay_success);
                        adapter.log.info(fctNameId + ', modul variable mnWebRequestCountDay_error:' + mnWebRequestCountDay_error);
                        adapter.log.info(fctNameId + ', modul variable mnWebRequestCountDay_error_Check:' + mnWebRequestCountDay_error_Check);
                    }
                    adapter.setState(idnAMAction, 0, true);
                }
                adapter.log.debug(fctNameId + ' finished');
                break;

            case idnStoppedDueToRain:
                fctNameId = 'subscription StoppedDueToRain changed';
                adapter.log.debug(fctNameId + ',  id: "' + idnStoppedDueToRain + '"; state.val: ' + state.val + '; adapter.config.stopOnRainEnabled: ' + adapter.config.stopOnRainEnabled);

                mbStoppedDueToRain = state.val;

                handleMowerOnRain(state.val);

                adapter.log.debug(fctNameId + ' finished');

                break;

            case idnMowerConnected:
                fctNameId = 'subscription mower base connected changed';
                adapter.log.debug(fctNameId + ',  id: "' + idnMowerConnected + '"; state.val: ' + state.val);

                if(state.val === false) {
                    const sMsg = fctNameId + ' for mower ' + mobjMower.mower.name + ' to FALSE';
                    adapter.setState(idnSendMessage, JSON.stringify([new Date().getTime(), sMsg, fctNameId + ' for mower ' + mobjMower.mower.name , idnMowerConnected, MSG_PRIO.warn]), true);
                }

                adapter.log.debug(fctNameId + ' finished');

                break;
        }

    }
}); // adapter.on('stateChange')


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
    const fctName = 'getDistance';
    //adapter.log.debug(fctName + ' started' + '; lat1: ' + lat1 + '; long1: ' + long1 + '; lat2: ' + lat2 + '; long2: ' + long2);

    let R = 6371, // Radius of the earth in km
        dLat = (lat2 - lat1) * Math.PI / 180,  // deg2rad below
        dLon = (long2 - long1) * Math.PI / 180,
        a = 0.5 - Math.cos(dLat)/2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * (1 - Math.cos(dLon))/2,

        dist = R * 2 * Math.asin(Math.sqrt(a)) * 1000;  // m

    //adapter.log.debug(fctName + ' finished; dist: ' + dist);

    return dist;

} // getDistance()


function checkAMatHome(lat2, long2) {
    // GPS_DISTANCE(lat1 DOUBLE, long1 DOUBLE, lat2 DOUBLE, long2 DOUBLE)
    const fctName = 'checkAMatHome';
    adapter.log.debug(fctName + ' started' + '; lat2: ' + lat2 + '; long2: ' + long2);
    adapter.log.debug(fctName + ' mHomeLocationLatitude: ' + mHomeLocationLatitude + '; mHomeLocationLongitude: ' + mHomeLocationLongitude + '; mMaxDistance: ' + mMaxDistance);

    if(mHomeLocationLatitude === 0 || mHomeLocationLongitude === 0) {
        adapter.log.warn(fctName + ' >> homeLocation.latitude and/or homeLocation.longitude not set or failure on reading!');

        return;
    }

    let R = 6371, // Radius of the earth in km
        dLat = (lat2 - mHomeLocationLatitude) * Math.PI / 180,  // deg2rad below
        dLon = (long2 - mHomeLocationLongitude) * Math.PI / 180,
        a = 0.5 - Math.cos(dLat)/2 + Math.cos(mHomeLocationLatitude * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * (1 - Math.cos(dLon)) / 2,
        dist = R * 2 * Math.asin(Math.sqrt(a)) * 1000;

    adapter.setState(idnHomeLocationCurrentDistance, Math.round(dist), true);
    //let dist = Math.acos(Math.sin(degrees_to_radians(mHomeLocationLatitude)) * Math.sin(degrees_to_radians(lat2)) + Math.cos(degrees_to_radians(mHomeLocationLatitude)) * Math.cos(degrees_to_radians(lat2)) * Math.cos(degrees_to_radians(long2) - degrees_to_radians(mHomeLocationLongitude))) * 6371 * 1000;

    if (dist > mMaxDistance && mMaxDistance > 0) {
        // alarm
        adapter.log.error(fctName + ' dist > mMaxDistance: ' + (dist - mMaxDistance));

        adapter.setState(idnSendMessage, JSON.stringify([new Date().getTime(), 'max disctance exceeded (' + Math.round(dist) + ' m), current position ' + UrlGoogleMaps + lat2 + ',' + long2, 'mower ' + mobjMower.mower.name + ' state changed', 'GPS data', MSG_PRIO.alarm]), true);
    }

    adapter.log.debug(fctName + ' finished; dist: ' + dist);

} // checkAMatHome()


function createStatusScheduler() {
    const fctName = 'createStatusScheduler';
    adapter.log.debug(fctName + ' started');

    if(mScheduleStatus !== null) {
        //clearSchedule(mScheduleStatus);
        //mScheduleStatus.cancel;
        clearInterval(mScheduleStatus);

        mScheduleStatus = null;

        adapter.log.debug(fctName + ' scheduler stopped');
    }

    if (isNaN(mScheduleTime)) {
        mScheduleTime = 61; // s
    }

    if(mScheduleTime > 0) {
        mScheduleStatus = setInterval(updateStatus, mScheduleTime * 1000);

        adapter.log.debug(fctName + ' scheduler created, start every ' + mScheduleTime + ' secands');
    }
    adapter.setState(idnScheduleTime, mScheduleTime, true);

    //mScheduleStatus = husqSchedule.scheduleJob('*/' + (mScheduleTime * 1000) + ' * * * * *', function () {
    //    updateStatus();
    //});
    adapter.log.debug(fctName + ' finished');

} // createStatusScheduler()


function checkIfItKeepsRaining() {
    const fctName = 'checkIfItKeepsRaining';
    adapter.log.debug(fctName + ' started');

    handleMowerOnRain(parseBool(mbStoppedDueToRain));

    adapter.log.debug(fctName + ' finished');

} // checkIfItKeepsRaining()


function startMowerAfterAutoTimerCheck() {
    const fctName = 'startMowerAfterAutoTimerCheck';
    adapter.log.debug(fctName + ' started');

//!P! ?? welcher Status noch?
    if(mCurrentStatus === 'PARKED_AUTOTIMER' || mCurrentStatus !== 'PARKED_PARKED_SELECTED' || mCurrentStatus !== 'PARKED_TIMER') {
        // !P!laut App gibt es hier mehrere Möglichkeiten: nextSchedule, in 3 Stunden, in 6 Stunden, sofort ???
        startMower();
    }

    if (mWaitAfterRainTimer !== null) {
        clearTimeout(mWaitAfterRainTimer);
        mWaitAutoTimer = null;
    }

    adapter.setState(idnNextStartWatching, 0, true);

    adapter.log.debug(fctName + ' finished');

} // startMowerAfterAutoTimerCheck()


function dailyAccumulation(bCheck) {
    const fctName = 'dailyAccumulation';

    if(typeof(bCheck) === 'undefined')
        bCheck = false;

    adapter.log.debug(fctName + ' started');

    adapter.log.debug(fctName + ', stop status timer');
    // stop status timer
    if(mScheduleStatus !== null) {
        //clearSchedule(mScheduleStatus);
        //mScheduleStatus.cancel;
        clearInterval(mScheduleStatus);

        mScheduleStatus = null;
    }

    adapter.log.debug(fctName + ', add current covered distance to overall distance ...');
    // add current covered distance to overall distance in km
    adapter.getState(idnCoveredDistanceDaily, function (errCDD, stateCDD) {
        if (!errCDD && stateCDD) {
            adapter.log.debug(fctName + ', add current covered distance; bCheck: ' + bCheck + '; stateCDD.ts: ' + stateCDD.ts + '; new Date(00): ' + (new Date().setHours(0, 0, 0, 0)) + '; stateCDD.val: ' + stateCDD.val);
            if(bCheck === false || (stateCDD.ts <= (new Date().setHours(0, 0, 0, 0)) && stateCDD.val > 0)) {
                adapter.getState(idnOverallCoveredDistance, function (errOCD, stateOCD) {
                    if (!errOCD && stateOCD) {
                        adapter.setState(idnOverallCoveredDistance, precisionRound(stateOCD.val + (stateCDD.val / 1000), 3), true);       // distance in km
                        adapter.log.debug(fctName + ', overall distance: ' + stateOCD.val + ': current covered distance: ' + stateCDD.val / 1000);

                        // move current covered distance to last distance and reset current
                        adapter.setState(idnCurrentCoveredDistance, 0, true);
                        adapter.setState(idnCoveredDistanceDaily, 0, true);
                        mDist = 0;
                        mDistDaily = 0;
                    }
                });
            }
        }
    });

    adapter.log.debug(fctName + ', move lastlocations to lastday locations');
    // move lastlocations to lastday locations
    adapter.getState(idnLastLocations, function (errLC, stateLC) {
        if (!errLC && stateLC) {
            if(bCheck === false || (stateLC.ts <= new Date().setHours(0, 0, 0, 0) && stateLC.val !== '[]')) {
                adapter.setState(idnLastDayLocations, stateLC.val, true);
                adapter.setState(idnLastLocations, '[]', true);
            }
        }
    });

    adapter.log.debug(fctName + ', add daily mowing time to overall mowing time ...');
    // add current mowing time to overall mowing time
    adapter.getState(idnMowingTimeDaily, function (errMTD, stateMTD) {
        if (!errMTD && stateMTD) {
            if(bCheck === false || (stateMTD.ts <= new Date().setHours(0, 0, 0, 0) && stateMTD.val > 0)) {
                adapter.getState(idnOverallMowingTime, function (errOMT, stateOMT) {
                    if (!errOMT && stateOMT) {
                        adapter.setState(idnOverallMowingTime, Math.round(stateOMT.val + (stateMTD.val / 60)), true);       // in h
                        adapter.log.debug(fctName + ', overall mowing time: ' + stateOMT.val + '; daily mowing time: ' + (stateMTD.val / 60) + '; Math.round: ' + Math.round(stateOMT.val + (stateMTD.val / 60)));

                        // reset daily mowing time
                        adapter.setState(idnMowingTime, 0, true);
                        adapter.setState(idnMowingTimeDaily, 0, true);
                        mMowingTimeDaily = 0;
                        mMowingTime = 0;
                    }
                });
            }
        }
    });

    adapter.log.debug(fctName + ', add daily battery charging cycle to overall charging cycle ...');
    // add daily battery charging cycle to overall charging cycle
    adapter.getState(idnBatteryChargeCycleDaily, function (errCCD, stateCCD) {
        if (!errCCD && stateCCD) {
            if(bCheck === false || (stateCCD.ts <= new Date().setHours(0, 0, 0, 0) && stateCCD.val > 0)) {
                adapter.getState(idnOverallBatteryChargeCycle, function (errOBCC, stateOBCC) {
                    if (!errOBCC && stateOBCC) {
                        adapter.setState(idnOverallBatteryChargeCycle, (stateCCD.val + stateOBCC.val), true);
                        adapter.log.debug(fctName + ', overall charging cycle: ' + stateOBCC.val + ': daily charging cycle: ' + stateCCD.val);

                        // reset daily charging cycle
                        adapter.setState(idnBatteryChargeCycleDaily, 0, true);
                        mBatteryChargeCycleDaily = 0;
                    }
                });
            }
        }
    });
    adapter.setState(idnChargingTimeBatteryCurrent, 0, true);
    mChargingTimeBatteryCurrent = 0;
    adapter.setState(idnChargingTimeBatteryDaily, 0, true);
    mChargingTimeBatteryDaily = 0;

    // reset daily values
    //!P!adapter.setState(idnMowingStartTime, 0, true);

    adapter.log.debug(fctName + ', add daily http request counter to month ...');
    // add to month values
    let nDateMonth = (new Date()).getMonth();
    let nDateDay = (new Date()).getDay();

    let nDateRCM_Month_TS = 0;
    adapter.getState(idnWebRequestCountMonth, function (errRCM, stateRCM) {
        if (!errRCM && stateRCM) {
            adapter.log.debug(fctName + ', stateRCM.ts: ' + stateRCM.ts + '; Date: ' + new Date(stateRCM.ts));

            nDateRCM_Month_TS = (new Date(stateRCM.ts)).getMonth();

            adapter.log.debug(fctName + ', nDateMonth: ' + nDateMonth + '; nDateRCM_Month_TS: ' + nDateRCM_Month_TS);

            let nDateRCD_Month_TS = 0;
            let nDateRCD_Day_TS = 0;
            adapter.getState(idnWebRequestCountDay, function (errRCD, stateRCD) {
                if (!errRCD && stateRCD) {
                    adapter.log.debug(fctName + ', stateRCD.ts: ' + stateRCD.ts + '; Date: ' + new Date(stateRCD.ts));
        
                    nDateRCD_Month_TS = (new Date(stateRCD.ts)).getMonth();
                    nDateRCD_Day_TS = (new Date(stateRCD.ts)).getDay();
        
                    adapter.log.debug(fctName + ', nDateMonth: ' + nDateMonth + '; nDateRCD_Month_TS: ' + nDateRCD_Month_TS + '; nDateRCD_Day_TS: ' + nDateRCD_Day_TS);
        
                    adapter.getState(idnWebRequestCountMonth, function (errWRCM, stWebRequestCountMonth) {
                        adapter.getState(idnWebRequestCountMonth_success, function (errWRCMs, stWebRequestCountMonth_success) {
                            adapter.getState(idnWebRequestCountMonth_error, function (errWRCMe, stWebRequestCountMonth_error) {

                                if (nDateMonth != nDateRCD_Month_TS || nDateDay != nDateRCD_Day_TS) {
                                    // set cummulate counters
                                    adapter.setState(idnWebRequestCountMonth, stWebRequestCountMonth.val + mnWebRequestCountDay, true);
                                    adapter.setState(idnWebRequestCountMonth_success, stWebRequestCountMonth_success.val + mnWebRequestCountDay_success, true);
                                    adapter.setState(idnWebRequestCountMonth_error, stWebRequestCountMonth_error.val + mnWebRequestCountDay_error, true);

                                    // reset http status counter for day
                                    mnWebRequestCountDay = 0;
                                    mnWebRequestCountDay_success = 0;
                                    mnWebRequestCountDay_error = 0;
                                    mnWebRequestCountDay_error_Check = 0;

                                    adapter.setState(idnWebRequestCountDay, 0, true);
                                    adapter.setState(idnWebRequestCountDay_success, 0, true);
                                    adapter.setState(idnWebRequestCountDay_error, 0, true);
                                }

                                if (nDateMonth != nDateRCM_Month_TS) {
                                    // first day of month or script has paused --> reset http status counter for month
                                    adapter.setState(idnWebRequestCountMonth, 0, true);
                                    adapter.setState(idnWebRequestCountMonth_success, 0, true);
                                    adapter.setState(idnWebRequestCountMonth_error, 0, true);
                                } 
                            });
                        });
                    });
                }
            });
        }
    });


    // start status scheduler, use last timer value
    createStatusScheduler();

    adapter.log.debug(fctName + ' finished');

} // dailyAccumulation()


function updateStatus() {
    const fctName = 'updateStatus';

    if(mobjMower == null) {
        adapter.log.info(fctName + ' mower object is NULL');

        return;
    }

    if(mUpdateStatusRunning === true) {
        adapter.log.debug(fctName + ' already running, exit');

        return;
    }
    adapter.log.debug(fctName + ' started');

    mUpdateStatusRunning = true;

    // normaly the subscription on adapter.config.idRainSensor should set the rain flag
    checkIfItsRaining();

    adapter.log.debug(fctName + ' typeof mobjMower: ' + typeof mobjMower + ' mNextStartTime: ' + mNextStartTime);

    // timestamps in seconds
    mobjMower.getStatus(function (error, response, result) {
        adapter.log.debug(fctName + ' error: ' + JSON.stringify(error));	// null
//!D!                adapter.log.debug(fctName + ' response: ' + JSON.stringify(response));
        adapter.log.debug(fctName + ' result: ' + JSON.stringify(result));

        mnWebRequestCountDay++;
        adapter.setState(idnWebRequestCountDay, mnWebRequestCountDay, true);

        let sMsg = '',
            sLastLatitide = '',
            sLastLongitude = '';

        if (typeof response === 'undefined' || typeof result === 'undefined') {
            mUpdateStatusRunning = false;

            adapter.log.warn(fctName + ' typeof response or result === undefined');

            mnWebRequestCountDay_error++;
            mnWebRequestCountDay_error_Check++;
            adapter.setState(idnWebRequestCountDay_error, mnWebRequestCountDay_error, true);

            if (mnWebRequestCountDay_error_Check == 4) {
                // Message
                const sMsg = fctName + ', error on getting status for mower ' + mobjMower.mower.name + ', error on getting status';
                adapter.setState(idnSendMessage, JSON.stringify([new Date().getTime(), sMsg, 'error on getting status for mower ' + mobjMower.mower.name, 'Mower.getStatus', MSG_PRIO.alarm]), true);
            }

            //!P!if ((adapter.setState) && mnWebRequestCountDay_error_Check > 10) adapter.setState('info.connection', false, true);
            if ((adapter.setState) && mnWebRequestCountDay_error_Check > 10) adapter.setState(idnMowerConnected, false, true);

            return;
        }

        if (result.lastLocations && result.lastLocations.length > 0) {
            sLastLatitide = result.lastLocations[0].latitude;
            sLastLongitude = result.lastLocations[0].longitude;
        }

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

        if (response.statusCode !== 200) {
            mUpdateStatusRunning = false;

            adapter.log.error(fctName + ' response.statusCode: ' + response.statusCode);

            mnWebRequestCountDay_error++;
            mnWebRequestCountDay_error_Check++;
            adapter.setState(idnWebRequestCountDay_error, mnWebRequestCountDay_error, true);

            return;
        }

        mLastStatus = mCurrentStatus;
        mCurrentStatus = result.mowerStatus;
        mnWebRequestCountDay_success++;

        adapter.setState(idnWebRequestCountDay_success, mnWebRequestCountDay_success, true);

        adapter.setState(idnWebRequestCountDay_error, mnWebRequestCountDay_error, true);

        if (adapter.config.saveRawData) {
            adapter.setState(idnRawResponse, JSON.stringify(response), true);
        }

        if (mLastErrorCode !== result.lastErrorCode) {
            adapter.log.debug('ERROR_CODES: ' + JSON.stringify(ERROR_CODES));

            adapter.setState(idnCurrentErrorCode, parseInt(result.lastErrorCode), true);
            // !P! umstellen auf Sprachkonfig
            let sErrorMsg = '';            // !P!?? oder lieber = <unknown>
            if (ERROR_CODES[result.lastErrorCode]) sErrorMsg = ERROR_CODES[result.lastErrorCode].language.ger;

            adapter.setState(idnCurrentErrorMsg, sErrorMsg, true);
            adapter.setState(idnCurrentErrorCodeTS, (result.lastErrorCodeTimestamp > 0) ? (result.lastErrorCodeTimestamp + (mTimeZoneOffset * 60)) : result.lastErrorCodeTimestamp, true);

            if ((ERROR_CODES[result.lastErrorCode]) && ERROR_CODES[result.lastErrorCode]['alarm']) {
            //!P! if(parseInt(result.lastErrorCode) === 71) {
                // mower lifted
                const sMsg = fctName + ' alarm for mower ' + mobjMower.mower.name + ' mower lifted, errorcode 71';
                adapter.setState(idnSendMessage, JSON.stringify([new Date().getTime(), sMsg, 'alarm for mower ' + mobjMower.mower.name, 'mower.status.response', MSG_PRIO.alarm]), true);
            }
            if (parseInt(result.lastErrorCode) === 0 && mLastErrorCode > 0) {
                adapter.setState(idnLastErrorCode, mLastErrorCode, true);

                sErrorMsg = '<unknown>';
                if (ERROR_CODES[mLastErrorCode]) sErrorMsg = ERROR_CODES[mLastErrorCode].language.ger;

                adapter.setState(idnLastErrorMsg, sErrorMsg, true);
                adapter.setState(idnLastErrorCodeTS, mLastErrorCodeTimestamp, true);
            }

            const sMsg = fctName + ' mower ' + mobjMower.mower.name + ' error state changed, from "' + mLastErrorCode + '" to "' + result.lastErrorCode + '", current position ' + UrlGoogleMaps + sLastLatitide + ',' + sLastLongitude;
            adapter.setState(idnSendMessage, JSON.stringify([new Date().getTime(), sMsg, 'mower ' + mobjMower.mower.name + ' error state changed', 'mower.status.response', MSG_PRIO.alarm]), true);

            mLastErrorCode = parseInt(result.lastErrorCode);
            mLastErrorCodeTimestamp = (result.lastErrorCodeTimestamp > 0) ? result.lastErrorCodeTimestamp + (mTimeZoneOffset * 60) : result.lastErrorCodeTimestamp;
        }

        adapter.setState(idnLastStatus, mCurrentStatus, true);
        adapter.setState(idnLastStatusTime, parseInt(result.storedTimestamp), true);

        adapter.setState(idnBatteryPercent, parseInt(result.batteryPercent), true);
        mBatteryPercent = parseInt(result.batteryPercent);
        adapter.setState(idnMowerConnected, result.connected, true);

        adapter.log.debug(fctName + ', idnNextStartSource: ' + idnNextStartSource + ', nextStartTimestamp: ' + result.nextStartTimestamp + ', mTimeZoneOffset: ' + mTimeZoneOffset);
        adapter.setState(idnNextStartSource, result.nextStartSource, true);
        adapter.setState(idnOperatingMode, result.operatingMode, true);
        adapter.setState(idnNextStartTime,(parseInt(result.nextStartTimestamp) > 0) ? ((parseInt(result.nextStartTimestamp) + (mTimeZoneOffset * 60)) * 1000) : result.nextStartTimestamp, true);

//!P! ???
        if (parseInt(result.batteryPercent) === 100 && result.operatingMode === 'HOME') {
            // manuel start required, start mower
            // !P! ?? adapter.setState(idnAMAction, 1, true);

            adapter.log.warn(fctName + ', result.operatingMode === ' + 'HOME', 'mower (should) started');
        }

        if (mCurrentStatus !== 'OK_CHARGING' && parseInt(result.batteryPercent) < adapter.config.alarmOnBatteryPercent && mAlarmOnBatteryPercent === false) {
            mAlarmOnBatteryPercent = true;

            const sMsg = fctName + ' mower ' + mobjMower.mower.name + ' battery charge too low: ' + result.batteryPercent;
            adapter.setState(idnSendMessage, JSON.stringify([new Date().getTime(), sMsg, fctName + ' mower ' + mobjMower.mower.name + ' battery charge too low!', 'mower.status.response', MSG_PRIO.warn]), true);
        }
        if(parseInt(result.batteryPercent) >= adapter.config.alarmOnBatteryPercent) {
            // reset alarm
            mAlarmOnBatteryPercent = false;
        }

        //adapter.log.info(' mCurrentStatus: ' + mCurrentStatus + ' mLastStatus: ' + mLastStatus + '; mLastErrorCode: ' + mLastErrorCode + '; mCurrentErrorCode: ' + mCurrentErrorCode + '; mCurrentErrorCodeTimestamp: ' + getDateTimeWseconds(mCurrentErrorCodeTimestamp) + '; mBatteryPercent: ' + mBatteryPercent);
        //mCurrentStatus: PARKED_AUTOTIMER mLastStatus: PARKED_TIMER; mLastErrorCode: 0; mCurrentErrorCode: 0; mCurrentErrorCodeTimestamp: 2018-04-19, 22:12:29; mBatteryPercent: 100
        //adapter.log.info(' mValueFound: ' + mValueFound + '; mStoredTimestamp: ' + getDateTimeWseconds(mStoredTimestamp) + '; mOperatingMode: ' + mOperatingMode + '; mConnected: ' + mConnected + '; mShowAsDisconnected: ' + mShowAsDisconnected);
        //mValueFound: true; mStoredTimestamp: 2018-04-19, 22:00:12; mOperatingMode: AUTO; mConnected: true; mShowAsDisconnected: false

        mobjMower.getGeoStatus(function (geo_error, geo_response, geo_result) {
            adapter.log.debug(fctName + ', geo_error: ' + JSON.stringify(geo_error));	// null
//!D!                adapter.log.debug(fctName + ', geo_response: ' + JSON.stringify(geo_response));
            adapter.log.debug(fctName + ', geo_result: ' + JSON.stringify(geo_result));
            //!D!console.log.debug(fctName + ', geo_result: ' + JSON.stringify(geo_result));

            adapter.setState(idnLastHttpStatus, geo_response.statusCode, true);

            if (geo_response.statusCode !== 200) {
                mUpdateStatusRunning = false;

                adapter.log.error(fctName + ' geo_response.statusCode: ' + geo_response.statusCode);

                return;
            }

            if (adapter.config.saveRawData) {
                adapter.setState(idnRawResponseGeo, JSON.stringify(geo_result), true);
            }

            let newDist = 0,
                position,
                jsonNewPositions = [],
                lpos = 0;       // last known position

            // assumption: newest data first, confirmed
            adapter.log.debug(fctName + ', geo_result.lastLocations.length:' + geo_result.lastLocations.length);
            adapter.log.debug(fctName + ', mLastLocationLongi:' + mLastLocationLongi + '; mLastLocationLati:' + mLastLocationLati);

            if (geo_result.lastLocations.length <= 0) {
                adapter.log.error(fctName + ', no geoinformation received from mower! Connection lost?', 'error');
            } else {
                // set home location data, if not set
                if (mHomeLocationLongitude === 0 || mHomeLocationLongitude === '' || mHomeLocationLatitude === 0 || mHomeLocationLatitude === '') {
                    mHomeLocationLatitude = geo_result.centralPoint.location.latitude;
                    mHomeLocationLongitude = geo_result.centralPoint.location.longitude;

                    adapter.setState(idnHomeLocationLatitude, mHomeLocationLatitude, true);
                    adapter.setState(idnHomeLocationLongitude, mHomeLocationLongitude, true);
                }
                // write server position data
                adapter.setState(idnHomeLocationLatitudeCP, geo_result.centralPoint.location.latitude, true);
                adapter.setState(idnHomeLocationLongitudeCP, geo_result.centralPoint.location.longitude, true);
                adapter.setState(idnHomeLocationSensitivityLevel, geo_result.centralPoint.sensitivity.level, true);
                adapter.setState(idnHomeLocationSensitivityRadius, geo_result.centralPoint.sensitivity.radius, true);

                if (adapter.config.extendedStatistic) {
                    if (mStartMowingTime > 0) {
                        // mowing time
                        // find last position
                        for (let j = 0; j < geo_result.lastLocations.length; j++) {
                            //adapter.log.debug(fctName + ', j:' + j + '; geo_result.lastLocations[j].longitude:' + geo_result.lastLocations[j].longitude + '; geo_result.lastLocations[j].latitude:' + geo_result.lastLocations[j].latitude);

                            if (geo_result.lastLocations[j].longitude === mLastLocationLongi && geo_result.lastLocations[j].latitude === mLastLocationLati) {
                                // should like the last known position, data has no timestamp
                                adapter.log.debug(fctName + ' last position found:' + JSON.stringify(geo_result.lastLocations[j]) + '; j:' + j);
                                lpos = j;
                            }
                        }

                        // accumulate positions and mileage beginnig from end if array (oldest positions)
                        for (let i = lpos; i >= 0; i--) {
                            //adapter.log.debug(fctName + ', i:' + i + '; geo_result.lastLocations[i].longitude:' + geo_result.lastLocations[i].longitude + '; geo_result.lastLocations[i].latitude:' + geo_result.lastLocations[i].latitude);

                            position = {
                                "longitude": geo_result.lastLocations[i].longitude,
                                "latitude": geo_result.lastLocations[i].latitude,
                                "time": result.storedTimestamp
                            };
                            //adapter.log.debug(fctName + ' position:' + JSON.stringify(position) + '; i:' + i + '; mCurrentStatus:' + mCurrentStatus + '; mLastStatus:' + mLastStatus);

                            jsonNewPositions.push(position);      // save position
                            //!P! check location; alle Positionen prüfen oder reicht letze Position --> checkAMatHome
                            //!P! if out of frame --> alarm

                            // add to distance, without timestamps it's not poosible to determine cutting position exactly
                            if ((mCurrentStatus === 'OK_CUTTING' || mCurrentStatus === 'OK_CUTTING_NOT_AUTO' || mCurrentStatus === 'OK_LEAVING') ||
                                ((mLastStatus === 'OK_CUTTING' || mLastStatus === 'OK_CUTTING_NOT_AUTO') && !(mCurrentStatus === 'OK_CUTTING' || mCurrentStatus === 'OK_CUTTING_NOT_AUTO'))) { // mileage only, if mower cutting
                                if (i === lpos) {
                                    // distance to lastLocation
                                    newDist = newDist + getDistance(mLastLocationLati, mLastLocationLongi, geo_result.lastLocations[i].latitude, geo_result.lastLocations[i].longitude);
                                } else {
                                    newDist = newDist + getDistance(geo_result.lastLocations[i + 1].latitude, geo_result.lastLocations[i + 1].longitude, geo_result.lastLocations[i].latitude, geo_result.lastLocations[i].longitude);
                                }
                                adapter.log.debug(fctName + ', i:' + i + '; newDist:' + newDist + '; [i + 1].latitude:' + geo_result.lastLocations[i + 1].latitude + '; [i + 1].longitude:' + geo_result.lastLocations[i + 1].longitude + '; [i].latitude:' + geo_result.lastLocations[i].latitude + '; [i].longitude:' + geo_result.lastLocations[i].longitude);
                            }
                        }
                        mJsonLastLocations = mJsonLastLocations.concat(jsonNewPositions);      // add new positions
                        mDist += newDist;
                        mDistDaily += newDist;
                        adapter.log.debug(fctName + ', add new distance; mDist: ' + mDist + '; mDistDaily: ' + mDistDaily + '; newDist: ' + newDist);

                        //adapter.log.debug(fctName + '; idnLastLocations: ' + JSON.stringify(mJsonLastLocations));
                        adapter.log.debug(fctName + '; idnCurrentCoveredDistance: ' + precisionRound(mDist, 2));
                        adapter.log.debug(fctName + '; idnCoveredDistanceDaily: ' + precisionRound(mDistDaily, 2));

                        adapter.setState(idnLastLocations, JSON.stringify(mJsonLastLocations), true);
                        adapter.setState(idnCurrentCoveredDistance, precisionRound(mDist, 2), true);
                        adapter.setState(idnCoveredDistanceDaily, precisionRound(mDistDaily, 2), true);
                    }
                }

                // check position in range
                //!P! if out of frame --> alarm
                checkAMatHome(geo_result.lastLocations[0].latitude, geo_result.lastLocations[0].longitude);

                if (mLastLocationLongi !== geo_result.lastLocations[0].longitude && mLastLocationLongi !== geo_result.lastLocations[0].latitude) {
                    // update last location
                    adapter.setState(idnLastLocationLongitude, geo_result.lastLocations[0].longitude, true);
                    adapter.setState(idnLastLocationLatitude, geo_result.lastLocations[0].latitude, true);

                    mLastLocationLongi = geo_result.lastLocations[0].longitude;
                    mLastLocationLati = geo_result.lastLocations[0].latitude;

                    adapter.setState(idnLastLocationTimestamp, result.storedTimestamp, true);      // !?

                    // Offset
                    if (mCurrentStatus === 'OK_CHARGING' || mCurrentStatus === 'PARKED_AUTOTIMER' || mCurrentStatus === 'PARKED_PARKED_SELECTED' || mCurrentStatus === 'PARKED_TIMER' || mCurrentStatus === 'OFF_DISABLED') {
                        adapter.setState(idnHomeLocationLongitudeOffset, geo_result.lastLocations[0].longitude, true);
                        adapter.setState(idnHomeLocationLatitudeOffset, geo_result.lastLocations[0].latitude, true);
                    }
                }
            }
            adapter.log.debug(fctName + ' geo finished');
        }); // mobjMower.getGeoStatus

        adapter.log.debug(fctName + ', mCurrentStatus: ' + mCurrentStatus + '; mCurrentStatus === \'OK_CUTTING\': ' + (mCurrentStatus === 'OK_CUTTING') + '; mLastStatus: ' + mLastStatus + '; mStartMowingTime: ' + mStartMowingTime + '; mMowingTime: ' + mMowingTime + '; currentDateTime: ' + new Date().getTime());

        // !P! wenn Status sich ändert haben wir tc oder? - Wofür?
        if (mCurrentStatus != mLastStatus && mLastStatus != 'unknown') {
            sMsg = 'updateStatus, mower ' + mobjMower.mower.name + ' state changed, from "' + mLastStatus + '" to "' + mCurrentStatus + '"';
            adapter.setState(idnSendMessage, JSON.stringify([new Date().getTime(), sMsg, 'mower ' + mobjMower.mower.name + ' state changed', 'mower.status.response', MSG_PRIO.info]), true);

            adapter.setState(idnLastStatusChangeTime, result.storedTimestamp, true);
        }

        // fallback rain action
        if (!(adapter.config.extendedStatistic) && mCurrentStatus === 'OK_LEAVING' && mLastStatus !== 'OK_LEAVING') {
            if (parseBool(mbStoppedDueToRain)) handleMowerOnRain(parseBool(mbStoppedDueToRain));                // wenn Regen, dann gleich wieder stoppen
        }
        if (!(adapter.config.extendedStatistic) && mCurrentStatus === 'OK_CUTTING' && mLastStatus !== 'OK_CUTTING_NOT_AUTO') {
            if (parseBool(mbStoppedDueToRain)) handleMowerOnRain(parseBool(mbStoppedDueToRain));                // wenn Regen, dann gleich wieder stoppen
        }

        if (adapter.config.extendedStatistic) {
            if (mCurrentStatus === 'OK_LEAVING' && mLastStatus !== 'OK_LEAVING' && mStartMowingTime === 0) {
                mStartMowingTime = new Date().getTime();        // start mowing

                adapter.setState(idnMowingStartTime, mStartMowingTime, true);
            }


            if (mCurrentStatus === 'OK_CUTTING' || mCurrentStatus === 'OK_CUTTING_NOT_AUTO') {
                // reset start timer after rain, mower is started manually?
                if (mWaitAfterRainTimer !== null) {
                    clearTimeout(mWaitAfterRainTimer);
                    //!P!mWaitAfterRainTimer.cancel;

                    adapter.setState(idnTimerAfterRainStartAt, 0, true);
                }

                // reset autostart timer, mower is started
                if (mWaitAutoTimer !== null) {
                    clearTimeout(mWaitAutoTimer);
                    //!P!mWaitAutoTimer.cancel;

                    mWaitAutoTimer = null;
                    adapter.setState(idnNextStartWatching, 0, true);
                }

                if (mStartMowingTime === 0) {        // if OK_LEAVING not detected
                    // start mowing
                    mStartMowingTime = new Date().getTime();
                    adapter.setState(idnMowingStartTime, mStartMowingTime, true);
                }
                if (((mLastStatus === 'OK_CUTTING' || mLastStatus === 'OK_CUTTING_NOT_AUTO') || mLastStatus === 'unknown') && mStartMowingTime > 0) {  //  === 0 --> processed in other action like OK_SEARCHING or adapter restarted
                    // mowing
                    let newMowingTime = ((new Date().getTime() - mStartMowingTime) / (1000 * 60));

                    mMowingTime += newMowingTime;
                    mMowingTimeDaily += newMowingTime;
                    mStartMowingTime = new Date().getTime();

                    adapter.setState(idnMowingTime, Math.round(mMowingTime), true);
                    adapter.setState(idnMowingTimeDaily, Math.round(mMowingTimeDaily), true);

                    adapter.log.debug(fctName + ', mower in action; mLastStatus: ' + mLastStatus + '; mStartMowingTime: ' + mStartMowingTime + '; mMowingTime: ' + mMowingTime + '; mMowingTimeDaily: ' + mMowingTimeDaily + '; newMowingTIme: ' + newMowingTime);
                }
            }
            if ((mLastStatus === 'OK_CUTTING' || mLastStatus === 'OK_CUTTING_NOT_AUTO') && (mCurrentStatus !== 'OK_CUTTING' && mCurrentStatus !== 'OK_CUTTING_NOT_AUTO') && mStartMowingTime > 0) {
                // mowing finished/break/error --> add last mowing time
                // timediff in ms --> min
                let newMowingTIme = ((new Date().getTime() - mStartMowingTime) / (1000 * 60));

                mMowingTime += newMowingTIme;
                mMowingTimeDaily += newMowingTIme;

                adapter.setState(idnMowingTime, Math.round(mMowingTime), true);
                adapter.setState(idnMowingTimeDaily, Math.round(mMowingTimeDaily), true);

                if (mMowingTimeBatteryNew === 0) {
                    // set first mowing time
                    mMowingTimeBatteryNew = mMowingTime;
                    adapter.setState(idnMowingTimeBatteryNew, Math.round(mMowingTimeBatteryNew), true);
                }

                // regular mowing finished, update last mowing time
                mLastMowingTime = mMowingTime;
                adapter.setState(idnLastMowingTime, Math.round(mLastMowingTime), true);

                if(mBatteryPercent < 21) {  // if >, then non regular end (timer, park or other)
                    // mLastMowingTime / mMowingTimeBatteryNew --> efficiency factor
                    if (mLastMowingTime > 0 && mMowingTimeBatteryNew > 0) adapter.setState(idnBatteryEfficiencyFactor, precisionRound(mLastMowingTime / mMowingTimeBatteryNew * 100, 2), true);
                }

                // save last covered distance
                adapter.setState(idnLastCoveredDistance, precisionRound(mDist, 2), true);

                adapter.log.debug(fctName + ', mowing finished/break; mLastStatus: ' + mLastStatus + '; mStartMowingTime: ' + mStartMowingTime + '; mMowingTime: ' + mMowingTime + '; mMowingTimeDaily: ' + mMowingTimeDaily);
                mStartMowingTime = 0;
                mMowingTime = 0;
                mDist = 0;
            }

            if (mCurrentStatus === 'OK_SEARCHING' && mLastStatus !== 'OK_SEARCHING' && mSearchingStartTime === 0) {
                // start searching
                mSearchingStartTime = new Date().getTime();
                adapter.setState(idnLastDockingTime, mSearchingStartTime, true);
                adapter.log.debug(fctName + ', start searching; mSearchingStartTime: ' + mSearchingStartTime);
            }

            // time too find station
            if ((mCurrentStatus === 'OK_CHARGING' || mCurrentStatus === 'PARKED_AUTOTIMER' || mCurrentStatus === 'XXXXXXX') && mSearchingStartTime > 0) {
                let searchTime = parseInt((new Date().getTime() - mSearchingStartTime) / (1000 * 60));

                adapter.setState(idnLastStationReturnTime, searchTime, true);

                adapter.log.debug(fctName + ', search finshed; mSearchingStartTime: ' + mSearchingStartTime + '; searchTime: ' + searchTime);

                mStartMowingTime = 0;
                mSearchingStartTime = 0;
            }

            // ? PARKED_PARKED_SELECTED ??
            if ((mCurrentStatus === 'OK_CHARGING' && mLastStatus !== 'OK_CHARGING') || (mCurrentStatus === 'PARKED_AUTOTIMER' && mLastStatus !== 'PARKED_AUTOTIMER' && mBatteryPercent < 100)) {     // mLastStatus === 'unknown' or other regular status
                // start charging?
                adapter.log.debug(fctName + ', mower start charging?; mChargingStartTime: ' + mChargingStartTime + '; new Date().getTime(): ' + new Date().getTime() + '; mChargingTimeBatteryNew: ' + (mChargingTimeBatteryNew * 60 * 1000) + ' ms');

                if (mChargingStartTime === 0 || mChargingStartTime < (new Date().getTime() - (mChargingTimeBatteryNew * 60 * 1000))) {
                    // start charging
                    mChargingStartTime = new Date().getTime();
                    adapter.setState(idnChargingStartTime, mChargingStartTime, true);

                    ++mBatteryChargeCycleDaily;
                    adapter.setState(idnBatteryChargeCycleDaily, mBatteryChargeCycleDaily, true);
                }

                adapter.log.debug(fctName + ', mower start charging; mChargingStartTime: ' + mChargingStartTime + '; mBatteryChargeCycleDaily: ' + mBatteryChargeCycleDaily);
            }
            if ((mCurrentStatus === 'OK_CHARGING' && mLastStatus === 'OK_CHARGING') || (mCurrentStatus === 'PARKED_AUTOTIMER' && mLastStatus === 'PARKED_AUTOTIMER' && mBatteryPercent < 100)) {
                // charging
                if (mChargingStartTime > 0) {
                    let newChargingTime = parseInt((new Date().getTime() - mChargingStartTime) / (1000 * 60));

                    adapter.log.debug(fctName + ', mower charging; newChargingTime: ' + newChargingTime + '; mChargingTimeBatteryCurrent: ' + mChargingTimeBatteryCurrent + '; mChargingTimeBatteryDaily: ' + mChargingTimeBatteryDaily);

                    mChargingTimeBatteryCurrent += newChargingTime;
                    mChargingTimeBatteryDaily += newChargingTime;
                    adapter.setState(idnChargingTimeBatteryCurrent, mChargingTimeBatteryCurrent, true);
                    adapter.setState(idnChargingTimeBatteryDaily, mChargingTimeBatteryDaily, true);
                }
                mChargingStartTime = new Date().getTime();
            }
            if (((mCurrentStatus !== 'OK_CHARGING' && mLastStatus === 'OK_CHARGING') || (mCurrentStatus === 'PARKED_AUTOTIMER' && mLastStatus === 'PARKED_AUTOTIMER' && mBatteryPercent === 100)) && mChargingStartTime > 0) {
                // charging end
                adapter.log.debug(fctName + ', mower charging end; mChargingStartTime: ' + mChargingStartTime + '; new Date().getTime(): ' + new Date().getTime() + '; mLastMowingTime: ' + mLastMowingTime + '; mMowingTimeBatteryNew: ' + mMowingTimeBatteryNew);
//mChargingStartTime: 1526479183267; new Date().getTime(): 1526479484644; mLastMowingTime: 0; mMowingTimeBatteryNew: 703

                let newChargingTime = parseInt((new Date().getTime() - mChargingStartTime) / (1000 * 60));

                mChargingTimeBatteryCurrent += newChargingTime;
                mChargingTimeBatteryDaily += newChargingTime;
                adapter.setState(idnChargingTimeBatteryCurrent, mChargingTimeBatteryCurrent, true);
                adapter.setState(idnLastChargingTimeBattery, mChargingTimeBatteryCurrent, true);
                adapter.setState(idnChargingTimeBatteryDaily, mChargingTimeBatteryDaily, true);
                adapter.log.debug(fctName + ', mower charging end; mChargingTimeBatteryCurrent: ' + mChargingTimeBatteryCurrent + '; mChargingTimeBatteryDaily: ' + mChargingTimeBatteryDaily + '; newChargingTime: ' + newChargingTime);

                if (mChargingTimeBatteryNew === 0) {
                    adapter.setState(idnChargingTimeBatteryNew, mChargingTimeBatteryCurrent, true);
                }

                mStartMowingTime = 0;
                mChargingStartTime = 0;
                mChargingTimeBatteryCurrent = 0;
                // !P! ??? adapter.setState(idnChargingStartTime, mChargingStartTime, true);
            }
        }
        adapter.log.debug(fctName + ', mBatteryPercent: ' + mBatteryPercent + '; mScheduleStatus: ' + mScheduleStatus + '; mScheduleTime: ' + mScheduleTime);
        if (mCurrentStatus === 'OK_CHARGING' || mCurrentStatus === 'PARKED_AUTOTIMER' || mCurrentStatus === 'PARKED_PARKED_SELECTED' || mCurrentStatus === 'PARKED_TIMER' ||
                mnWebRequestCountDay_error_Check >= 4) {
            // charging --> inactive poll timer
            if (mScheduleStatus === null || (mScheduleStatus !== null && mScheduleTime !== mQueryIntervalInactive_s)) {
                mScheduleTime = mQueryIntervalInactive_s;

                createStatusScheduler();
            }
        } else {
            // error or active or other
            if (mScheduleStatus === null || (mScheduleStatus !== null && mScheduleTime !== mQueryIntervalActive_s)) {
                mScheduleTime = mQueryIntervalActive_s;

                createStatusScheduler();
            }
        }
    });

    mUpdateStatusRunning = false;

    adapter.log.debug(fctName + ' finhed');

} // updateStatus()


function syncConfigAsync() {
    return new Promise((resolve, reject) => {
        const fctName = 'syncConfigAsync';

        adapter.log.debug(fctName + ' started');

        adapter.getState(idnLastLocations, (err, idState) => {
            if (err) {
                adapter.log.error(err);

                /* !P!const errorObject = {
                    msg: 'An error occured',
                    err //...some error we got back
                 }; 
                 reject(errorObject); */

                 reject(err);
            }

            // on getStates serveral problems on reading, string too long?
            if(idState !== null && idState.val !== '') mJsonLastLocations = JSON.parse(idState.val);

            adapter.log.debug(fctName + ', mJsonLastLocations:' + JSON.stringify(mJsonLastLocations));

            adapter.getStates('mower.*', (err, idStates) => {
                if (err) {
                    adapter.log.error(err);

                    const errorObject = {
                        msg: 'An error occured',
                        err, //...some error we got back
                    };
                    reject(errorObject);
                }

                // gather states that need to be read
                //!D!adapter.log.debug(fctName + ' idStates: ' + JSON.stringify(idStates));      // complete list of state objects

                for (let idState in idStates) {
                    if (!idStates.hasOwnProperty(idState) || idStates[idState] === null) {
                        //if (!idStates.hasOwnProperty(idState)) {
                        continue;
                    }

                    let iddp = idState.substr(adapter.namespace.length + 1);
                    adapter.log.debug(fctName + ', processing state: "' + iddp + '" with value "' + idStates[idState].val + '"');

                    switch (iddp) {
                        case idnLastStatus:
                            mLastStatus = idStates[idState].val;
                            break;
                        case idnLastStatusChangeTime:
                            mLastStatusChangeTime = idStates[idState].val;
                            break;
                        case idnNextStartTime:
                            mNextStartTime = idStates[idState].val;
                            if (mNextStartTime > 0) mLastStartTime = mNextStartTime;
                            break;
                        case idnStoppedDueToRain:
                            mbStoppedDueToRain = idStates[idState].val;
                            break;
                        case idnCurrentErrorCode:
                            mLastErrorCode = idStates[idState].val;
                            break;
                        case idnCurrentErrorCodeTS:
                            mLastErrorCodeTimestamp = idStates[idState].val;
                            break;
                        case idnCurrentCoveredDistance:
                            if(adapter.config.extendedStatistic) mDist = JSON.parse(idStates[idState].val);
                            break;
                        case idnCoveredDistanceDaily:
                            if(adapter.config.extendedStatistic) mDistDaily = JSON.parse(idStates[idState].val);
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
                        case idnBatteryPercent:
                            mBatteryPercent = parseInt(idStates[idState].val);
                            break;
                        case idnBatteryChargeCycleDaily:
                            if(adapter.config.extendedStatistic) mBatteryChargeCycleDaily = parseInt(idStates[idState].val);
                            break;
                        case idnMowingStartTime:
                            mStartMowingTime = parseInt(idStates[idState].val);
                            break;
                        case idnLastMowingTime:
                            if(adapter.config.extendedStatistic) mLastMowingTime = parseInt(idStates[idState].val);
                            break;
                        case idnMowingTimeBatteryNew:
                            if(adapter.config.extendedStatistic) mMowingTimeBatteryNew = parseInt(idStates[idState].val);
                            break;
                        case idnChargingStartTime:
                            mChargingStartTime = parseInt(idStates[idState].val);
                            break;
                        case idnChargingTimeBatteryNew:
                            if(adapter.config.extendedStatistic) mChargingTimeBatteryNew = parseInt(idStates[idState].val);
                            break;
                        case idnChargingTimeBatteryCurrent:
                            if(idStates[idState].ts > new Date().setHours(0, 0, 0, 0)) {            // > last midnight?
                                mChargingTimeBatteryCurrent = parseInt(idStates[idState].val);
                            } else {
                                mChargingTimeBatteryCurrent = 0;        // new day
                            }
                            break;
                        case idnChargingTimeBatteryDaily:
                            if(idStates[idState].ts > new Date().setHours(0, 0, 0, 0)) {            // > last midnight?
                                mChargingTimeBatteryDaily = parseInt(idStates[idState].val);
                            } else {
                                mChargingTimeBatteryDaily = 0;  // new day
                            }
                            break;
                        case idnMowingTime:
                            if(adapter.config.extendedStatistic) mMowingTime = parseInt(idStates[idState].val);
                            break;
                        case idnMowingTimeDaily:
                            if(adapter.config.extendedStatistic) mMowingTimeDaily = parseInt(idStates[idState].val);
                            break;
                        case idnWebRequestCountDay:
                            mnWebRequestCountDay = parseInt(idStates[idState].val);
                            adapter.log.debug(fctName + ', processing state: "' + iddp + '" with value "' + idStates[idState].val + '", set in mnWebRequestCountDay');
                            break;
                        case idnWebRequestCountDay_success:
                            mnWebRequestCountDay_success = parseInt(idStates[idState].val);
                            break;
                        case idnWebRequestCountDay_error:
                            mnWebRequestCountDay_error = parseInt(idStates[idState].val);
                            break;
                    }
                }
                
                // if battery loaded, then reset stat charging
                if(mBatteryPercent == 100) {
                    mChargingStartTime = 0;
                }

                // if mower not working, reset mStartMowingTime
                if (mLastStatus !== 'OK_CUTTING' && mLastStatus !== 'OK_CUTTING_NOT_AUTO' && mLastStatus !== 'OK_LEAVING' && mLastStatus !== 'OK_SEARCHING') {
                    mStartMowingTime = 0;
                }

                adapter.log.debug(fctName + ', idnLastStatus: ' + mLastStatus + ', idnNextStartTime: ' + mNextStartTime + ', mStartMowingTime: ' + mStartMowingTime + ', idnStoppedDueRain: ' + mbStoppedDueToRain + ', idnCurrentErrorCode: ' + mLastErrorCode + ', idnCurrentErrorCodeTS: ' + mLastErrorCodeTimestamp);
                adapter.log.debug(fctName + ', idnCurrentCoveredDistance: ' + mDist + ', idnLastLocationLongitude: ' + mLastLocationLongi + ', idnLastLocationLatitude: ' + mLastLocationLati + ', idnHomeLocationLongitude: ' + mHomeLocationLongitude + ', idnHomeLocationLatitude: ' + mHomeLocationLongitude);
                adapter.log.debug(fctName + ', idnBatteryPercent: ' + mBatteryPercent + ', idnBatteryChargeCycleDaily: ' + mBatteryChargeCycleDaily + ', idnMowingTime: ' + mMowingTime + ', idnMowingTimeDaily: ' + mMowingTimeDaily);
                //adapter.log.debug(fctName + ', idnLastLocations: ' + JSON.stringify(mJsonLastLocations));
            });

            adapter.log.debug(fctName + ' finished');

            const successObject = {
                msg: 'Success',
                data: null,//...some data we got back
            };

            resolve(successObject); 
        });
    });

} // syncConfigAsync()


function syncConfig(callback) {
    const fctName = 'syncConfig';

    adapter.log.debug(fctName + ' started');

    adapter.getState(idnLastLocations, function (err, idState) {
        if (err) {
            adapter.log.error(err);

            callback();
        }

        // on getStates serveral problems on reading, string too long?
        if(idState !== null && idState.val !== '') mJsonLastLocations = JSON.parse(idState.val);

        adapter.log.debug(fctName + ', mJsonLastLocations:' + JSON.stringify(mJsonLastLocations));
    });

    adapter.getStates('mower.*', function (err, idStates) {
        if (err) {
            adapter.log.error(err);

            callback();
        }

        // gather states that need to be read
        adapter.log.debug(fctName + ' idStates: ' + JSON.stringify(idStates));      // complete list of state objects

        for (let idState in idStates) {
            if (!idStates.hasOwnProperty(idState) || idStates[idState] === null) {
                //if (!idStates.hasOwnProperty(idState)) {
                continue;
            }

            let iddp = idState.substr(adapter.namespace.length + 1);
            adapter.log.debug(fctName + ', processing state: "' + iddp + '" with value "' + idStates[idState].val + '"');

            switch (iddp) {
                case idnLastStatus:
                    mLastStatus = idStates[idState].val;
                    break;
                case idnLastStatusChangeTime:
                    mLastStatusChangeTime = idStates[idState].val;
                    break;
                case idnNextStartTime:
                    mNextStartTime = idStates[idState].val;
                    if (mNextStartTime > 0) mLastStartTime = mNextStartTime;
                    break;
                case idnStoppedDueToRain:
                    mbStoppedDueToRain = idStates[idState].val;
                    break;
                case idnCurrentErrorCode:
                    mLastErrorCode = idStates[idState].val;
                    break;
                case idnCurrentErrorCodeTS:
                    mLastErrorCodeTimestamp = idStates[idState].val;
                    break;
                case idnCurrentCoveredDistance:
                    if(adapter.config.extendedStatistic) mDist = JSON.parse(idStates[idState].val);
                    break;
                case idnCoveredDistanceDaily:
                    if(adapter.config.extendedStatistic) mDistDaily = JSON.parse(idStates[idState].val);
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
                case idnBatteryPercent:
                    mBatteryPercent = parseInt(idStates[idState].val);
                    break;
                case idnBatteryChargeCycleDaily:
                    if(adapter.config.extendedStatistic) mBatteryChargeCycleDaily = parseInt(idStates[idState].val);
                    break;
                case idnMowingStartTime:
                    mStartMowingTime = parseInt(idStates[idState].val);
                    break;
                case idnLastMowingTime:
                    if(adapter.config.extendedStatistic) mLastMowingTime = parseInt(idStates[idState].val);
                    break;
                case idnMowingTimeBatteryNew:
                    if(adapter.config.extendedStatistic) mMowingTimeBatteryNew = parseInt(idStates[idState].val);
                    break;
                case idnChargingStartTime:
                    mChargingStartTime = parseInt(idStates[idState].val);
                    break;
                case idnChargingTimeBatteryNew:
                    if(adapter.config.extendedStatistic) mChargingTimeBatteryNew = parseInt(idStates[idState].val);
                    break;
                case idnChargingTimeBatteryCurrent:
                    if(idStates[idState].ts > new Date().setHours(0, 0, 0, 0)) {            // > last midnight?
                        mChargingTimeBatteryCurrent = parseInt(idStates[idState].val);
                    } else {
                        mChargingTimeBatteryCurrent = 0;        // new day
                    }
                    break;
                case idnChargingTimeBatteryDaily:
                    if(idStates[idState].ts > new Date().setHours(0, 0, 0, 0)) {            // > last midnight?
                        mChargingTimeBatteryDaily = parseInt(idStates[idState].val);
                    } else {
                        mChargingTimeBatteryDaily = 0;  // new day
                    }
                    break;
                case idnMowingTime:
                    if(adapter.config.extendedStatistic) mMowingTime = parseInt(idStates[idState].val);
                    break;
                case idnMowingTimeDaily:
                    if(adapter.config.extendedStatistic) mMowingTimeDaily = parseInt(idStates[idState].val);
                    break;
                case idnWebRequestCountDay:
                    mnWebRequestCountDay = parseInt(idStates[idState].val);
                    adapter.log.debug(fctName + ', processing state: "' + iddp + '" with value "' + idStates[idState].val + '", set in mnWebRequestCountDay');
                    break;
                case idnWebRequestCountDay_success:
                    mnWebRequestCountDay_success = parseInt(idStates[idState].val);
                    break;
                case idnWebRequestCountDay_error:
                    mnWebRequestCountDay_error = parseInt(idStates[idState].val);
                    break;
            }
        }
        
        // if battery loaded, then reset stat charging
        if(mBatteryPercent == 100) {
            mChargingStartTime = 0;
        }

        // if mower not working, reset mStartMowingTime
        if (mLastStatus !== 'OK_CUTTING' && mLastStatus !== 'OK_CUTTING_NOT_AUTO' && mLastStatus !== 'OK_LEAVING' && mLastStatus !== 'OK_SEARCHING') {
            mStartMowingTime = 0;
        }

        adapter.log.debug(fctName + ', idnLastStatus: ' + mLastStatus + ', idnNextStartTime: ' + mNextStartTime + ', mStartMowingTime: ' + mStartMowingTime + ', idnStoppedDueRain: ' + mbStoppedDueToRain + ', idnCurrentErrorCode: ' + mLastErrorCode + ', idnCurrentErrorCodeTS: ' + mLastErrorCodeTimestamp);
        adapter.log.debug(fctName + ', idnCurrentCoveredDistance: ' + mDist + ', idnLastLocationLongitude: ' + mLastLocationLongi + ', idnLastLocationLatitude: ' + mLastLocationLati + ', idnHomeLocationLongitude: ' + mHomeLocationLongitude + ', idnHomeLocationLatitude: ' + mHomeLocationLongitude);
        adapter.log.debug(fctName + ', idnBatteryPercent: ' + mBatteryPercent + ', idnBatteryChargeCycleDaily: ' + mBatteryChargeCycleDaily + ', idnMowingTime: ' + mMowingTime + ', idnMowingTimeDaily: ' + mMowingTimeDaily);
        //adapter.log.debug(fctName + ', idnLastLocations: ' + JSON.stringify(mJsonLastLocations));
    });

    adapter.log.debug(fctName + ' finished');

    callback && callback();

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
    const fctName = 'connected, mowersListUpdated';

    adapter.log.debug(fctName + ' started');

    if (adapter.config.saveRawData) {
        adapter.setState(idnRawResponseMowers, JSON.stringify(mowers), true);
    }

    adapter.log.info(fctName + ', found ' + mowers.length + ' mower(s)');

    if (mowers.length > 0) {
        //adapter.log.info("mobjMower: " + JSON.stringify(mobjMower));
        adapter.setState(idnMowersJson, JSON.stringify(mowers), true);

        let ix = 0;
        if (mowers.length > 1) {
            mowers.forEach(function (mower) {
                if (mower.mower.name === adapter.config.nickname) {
                    mobjMower = mower;
                    //adapter.log.debug('updateStatus' + ' mobjMower: ' + JSON.stringify(mobjMower));
                    return;
                }
                ++ix;
            });
        } else {
            mobjMower = mowers[0];
            //adapter.log.debug('updateStatus' + ' mobjMower: ' + JSON.stringify(mobjMower));
        }

        if (mobjMower !== null) {
            adapter.getState(idnMowerNickname, function (err, idState) {
                if (err) {
                    adapter.log.error(err);

                    return;
                }

                // check, if correct instance
                if(!(idState) || idState.val === '' || (idState.val !== '' && idState.val === mobjMower.mower.name)) {
                    if(!(idState) || idState.val === '') adapter.setState(idnMowerNickname, mobjMower.mower.name, true);

                    adapter.setState(idnMowerID, mobjMower.mower.id, true);
                    adapter.setState(idnMowerModel, mobjMower.mower.model, true);
                    adapter.setState(idnMowersIndex, ix, true);

                    //!P! Warum sollte?? adapter.setState(idnWebRequestCountDay_error, 0, true);

                    updateStatus();

                } else if(idState.val !== '' && idState.val !== mobjMower.mower.name) {
                    adapter.log.error(fctName + ', current nickname "' + mobjMower.mower.name + '" is different from instance nickname "' + idState.val + '" !');
                }
            });
        }
    }

    adapter.log.debug(fctName + ' finished');
}); // husqApi.on()


function createSubscriber() {
    const fctName = 'createSubscriber';
    adapter.log.debug(fctName + ' started');

    checkIfItsRaining();

    if(adapter.config.idRainSensor !== '' && adapter.config.stopOnRainEnabled == true) {
        adapter.log.debug(fctName + ', idRainSensor: ' + adapter.config.idRainSensor);            // mqtt.0.hm-rpc.0.OEQ0996420.1.STATE

        //!P! subscribeForeignStates scheint nicht zu funktionieren, deshalb '*' angehangen
        adapter.subscribeForeignStates(adapter.config.idRainSensor + '*', function (error) {
            if (error) {
                adapter.log.error(fctName + ', error on create subsciption for idRainSensor "' + adapter.config.idRainSensor + '" (' + JSON.stringify(error) + ')');
            } else {
                adapter.log.debug(fctName + ', subsciption for idRainSensor "' + adapter.config.idRainSensor + '" created');
            }
        });
        adapter.log.debug(fctName + ', subsciption for idRainSensor "' + adapter.config.idRainSensor + '" finished');

    } else {
        adapter.log.info(fctName + ', idRainSensor; stop due rain not enabled.');
        adapter.setState(idnStoppedDueToRain, false, true);
    }

    /* Beim Start prüfen ob idnTimerAfterRainStartAt > 0 --> Wenn ja
        idnTimerAfterRainStartAt + mWaitAfterRain_min > currentTime && no rain --> Timer mit Restzeit starten
        ELSE idnTimerAfterRainStartAt = 0 setzen
    */
    adapter.getState(idnTimerAfterRainStartAt, function (err, stateTARSA) {
        if (!err && stateTARSA) {
            const dpvTimerAfterRainStartAt = stateTARSA.val;

            if (dpvTimerAfterRainStartAt > 0) {
                const nWaitAfterRain = mWaitAfterRain_min * 60 * 1000;
                const nRestTime = (new Date().getTime()) - dpvTimerAfterRainStartAt - nWaitAfterRain;

                if (!mbStoppedDueToRain && nRestTime > 0) {
                    
                    mWaitAfterRainTimer = setTimeout(startMowerAfterAutoTimerCheck, nRestTime);

                    adapter.log.debug(fctName + '; timer wait after rain active, wait for ' + (nRestTime / 60 / 1000) + ' min. for start mower.');
                } else {
                    adapter.setState(idnTimerAfterRainStartAt, 0, true);
                }
            }
        }
    });

    /* Beim Start prüfen ob idnNextStartWatching > 0 --> Wenn ja
        idnNextStartWatching > currentTime && rain --> Timer mit Restzeit starten
        ELSE idnNextStartWatching = 0 setzen
    */
   adapter.getState(idnNextStartWatching, function (err, stateNSW) {
        if (!err && stateNSW) {
            const dpvNextStartWatching = stateNSW.val;

            if (dpvNextStartWatching > 0) {
                if (mbStoppedDueToRain && (dpvNextStartWatching > (new Date().getTime()))) {
                    const nRestTime = new Date().getTime() - dpvNextStartWatching;
                    
                    mWaitAutoTimer = setTimeout(checkIfItKeepsRaining, nRestTime);
        
                    const sMsg = fctName + ' while rain; check mower ' + mobjMower.mower.name + ' next autostart on "' + adapter.formatDate(mNextStartTime - (mWaitAfterRain_min * 60 * 1000) + 60000, "JJJJ.MM.TT SS:mm:ss") + '"';
                    adapter.setState(idnSendMessage, JSON.stringify([new Date().getTime(), sMsg, fctName, 'rain sensor', MSG_PRIO.info]), true);
                } else {
                        adapter.setState(idnNextStartWatching, 0, true);
                }
            }
        }});


    if(adapter.config.extendedStatistic) {
        // daily accumulation
        adapter.log.debug(fctName + ', scheduler for dailyAccumulation created');

        //!P!scheduleDailyAccumulation = schedule("0 0 * * *", function () {
        mScheduleDailyAccumulation = husqSchedule.scheduleJob({hour: 0, minute: 0}, function () {
            dailyAccumulation();
        });
    }

    //!P!if (adapter.setState) adapter.setState('info.connection', true, true);
    if (adapter.setState) adapter.setState(idnMowerConnected, true, true);

    adapter.log.debug(fctName + ' finished');

} // createSubscriber()


function createSubscriberAsync() {
    return new Promise((resolve, reject) => {
        const fctName = 'createSubscriberAsync';
        adapter.log.debug(fctName + ' started');

        checkIfItsRaining();

        if(adapter.config.idRainSensor !== '' && adapter.config.stopOnRainEnabled == true) {
            adapter.log.debug(fctName + ', idRainSensor: ' + adapter.config.idRainSensor);            // mqtt.0.hm-rpc.0.OEQ0996420.1.STATE

            //!P! subscribeForeignStates scheint nicht zu funktionieren, deshalb '*' angehangen
            adapter.subscribeForeignStates(adapter.config.idRainSensor + '*', function (error) {
                if (error) {
                    adapter.log.error(fctName + ', error on create subsciption for idRainSensor "' + adapter.config.idRainSensor + '" (' + JSON.stringify(error) + ')');
                } else {
                    adapter.log.debug(fctName + ', subsciption for idRainSensor "' + adapter.config.idRainSensor + '" created');
                }
            });
            adapter.log.debug(fctName + ', subsciption for idRainSensor "' + adapter.config.idRainSensor + '" finished');

        } else {
            adapter.log.info(fctName + ', idRainSensor; stop due rain not enabled.');
            adapter.setState(idnStoppedDueToRain, false, true);
        }

        /* Beim Start prüfen ob idnTimerAfterRainStartAt > 0 --> Wenn ja
            idnTimerAfterRainStartAt + mWaitAfterRain_min > currentTime && no rain --> Timer mit Restzeit starten
            ELSE idnTimerAfterRainStartAt = 0 setzen
        */
        adapter.getState(idnTimerAfterRainStartAt, function (err, stateTARSA) {
            if (!err && stateTARSA) {
                const dpvTimerAfterRainStartAt = stateTARSA.val;

                if (dpvTimerAfterRainStartAt > 0) {
                    const nWaitAfterRain = mWaitAfterRain_min * 60 * 1000;
                    const nRestTime = (new Date().getTime()) - dpvTimerAfterRainStartAt - nWaitAfterRain;

                    if (!mbStoppedDueToRain && nRestTime > 0) {
                        
                        mWaitAfterRainTimer = setTimeout(startMowerAfterAutoTimerCheck, nRestTime);

                        adapter.log.debug(fctName + '; timer wait after rain active, wait for ' + (nRestTime / 60 / 1000) + ' min. for start mower.');
                    } else {
                        adapter.setState(idnTimerAfterRainStartAt, 0, true);
                    }
                }
            }
        });

        /* Beim Start prüfen ob idnNextStartWatching > 0 --> Wenn ja
            idnNextStartWatching > currentTime && rain --> Timer mit Restzeit starten
            ELSE idnNextStartWatching = 0 setzen
        */
        adapter.getState(idnNextStartWatching, function (err, stateNSW) {
            if (!err && stateNSW) {
                const dpvNextStartWatching = stateNSW.val;

                if (dpvNextStartWatching > 0) {
                    if (mbStoppedDueToRain && (dpvNextStartWatching > (new Date().getTime()))) {
                        const nRestTime = new Date().getTime() - dpvNextStartWatching;
                        
                        mWaitAutoTimer = setTimeout(checkIfItKeepsRaining, nRestTime);
            
                        const sMsg = fctName + ' while rain; check mower ' + mobjMower.mower.name + ' next autostart on "' + adapter.formatDate(mNextStartTime - (mWaitAfterRain_min * 60 * 1000) + 60000, "JJJJ.MM.TT SS:mm:ss") + '"';
                        adapter.setState(idnSendMessage, JSON.stringify([new Date().getTime(), sMsg, fctName, 'rain sensor', MSG_PRIO.info]), true);
                    } else {
                            adapter.setState(idnNextStartWatching, 0, true);
                    }
                }
            }});


        if(adapter.config.extendedStatistic) {
            // daily accumulation
            adapter.log.debug(fctName + ', scheduler for dailyAccumulation created');

            //!P!scheduleDailyAccumulation = schedule("0 0 * * *", function () {
            mScheduleDailyAccumulation = husqSchedule.scheduleJob({hour: 0, minute: 0}, function () {
                dailyAccumulation();
            });
        }

        //!P!if (adapter.setState) adapter.setState('info.connection', true, true);
        if (adapter.setState) adapter.setState(idnMowerConnected, true, true);

        adapter.log.debug(fctName + ' finished');

        resolve();
    });
} // createSubscriberAsync()


function mower_login() {
    husqApi.logout();
    husqApi.login(adapter.config.email, adapter.config.pwd);
} // mower_login()


// is called when databases are connected and adapter received configuration.
// start here!
adapter.on('ready', function () {
    main();
});


function main() {

    if (adapter.config.pwd === "PASSWORD") {

        adapter.log.error("Bitte die Felder E-Mail und Passwort ausfüllen!");
        adapter.setState(idnMowerConnected, false, true);
    }
    else {
        createDataStructure(adapter);

        adapter.log.debug('Mail address: ' + adapter.config.email);
        //adapter.log.debug('Password were set to: ' + adapter.config.pwd);

        //!T!adapter.log.debug('adapter.config: ' + JSON.stringify(adapter.config));

        // set adapter config data
        adapter.setState(idnStopOnRainEnabled, adapter.config.stopOnRainEnabled, true);

        mQueryIntervalActive_s = adapter.config.pollActive;
        if (isNaN(mQueryIntervalActive_s) || (mQueryIntervalActive_s > 0 && mQueryIntervalActive_s < 31)) {
            mQueryIntervalActive_s = 61;
        }

        mQueryIntervalInactive_s = adapter.config.pollInactive;
        if (isNaN(mQueryIntervalInactive_s) || (mQueryIntervalInactive_s > 0 && mQueryIntervalInactive_s < 301)) {
            mQueryIntervalInactive_s = 301;
        }

        mMaxDistance = adapter.config.homeLocationMaxDistance;
        if (isNaN(mMaxDistance)) {
            mMaxDistance = 40;
        }
        adapter.setState(idnHomeLocationMaxDistance, mMaxDistance, true);

        mWaitAfterRain_min = adapter.config.waitAfterRain;
        adapter.log.debug('waitAfterRain: ' + adapter.config.waitAfterRain);
        if (isNaN(mWaitAfterRain_min)) {            //  || mWaitAfterRain_min < 60
            mWaitAfterRain_min = -1;
        }
        adapter.setState(idnWaitAfterRain, mWaitAfterRain_min, true);

/*        syncConfig(function () {
            if(adapter.config.extendedStatistic) {
                dailyAccumulation(true);        // test, if untouched values from yesterday
            }

            mower_login();

            createSubscriber(function (){
                // subscribe own events
                adapter.subscribeStates('*');
            });
        }); */

        /* !P!syncConfigAsync()
            .then(result => {
                if(adapter.config.extendedStatistic) {
                    dailyAccumulation(true);        // test, if untouched values from yesterday
                }

                mower_login();

                createSubscriberAsync()
                    .then(result => {
                    // subscribe own events
                    adapter.subscribeStates('*');
                });
            })
            .catch(error => adapter.log.error(error)); */

        syncConfigAsync();

        setTimeout(() => {
            if(adapter.config.extendedStatistic) {
                dailyAccumulation(true);        // test, if untouched values from yesterday
            }
        }, 1000);

        setTimeout(mower_login, 2000);

        setTimeout(() => {
            createSubscriberAsync()
            .catch(err => adapter.log.error(err));
        }, 3000);

        setTimeout(() => {
            // subscribe own events
            adapter.subscribeStates('*');
        }, 4000);


    } // if (adapter.config.pwd === "PASSWORD")
} // main()

// cfg:
// email
// password
// nickname, identify mower
// pollActive, Abfrage-Intervall aktiv
// pollInactive, Abfrage-Intervall inaktiv
// Rohdaten hinzufügen ???
// erweiterte Statistik
// id für TimeZoneOffset
// idRainSensor
// RainSensorValue - [bool, true]
// stopOnRainEnabled
//!P! aktualisieren

// !I! value of Name "waitAfterRain_m" is saved as {"m": "180"} in adapter.config

// mower.homeLocation.latitude      // geladen von Husqvarana central point
// mower.homeLocation.longitude     // geladen von Husqvarana central point
// mower.homeLocation.maxDistance
// mower.homeLocation.name
