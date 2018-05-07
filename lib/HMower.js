"use strict";
const request = require('request');

/**
 * A Husqvarna mower
 * @param {object} mower - Object parsed from API response
 * @param {string} trackUrl - API Url for interacting with the mower
 * @param {object} headers - Headers with authentication data for interacting with the API
 * @constructor
 */
function HMower(mower, trackUrl, headers) {
    this.trackUrl = trackUrl;
    this.headers = headers;
    this.mower = mower;
    this.command = {
        park: 'PARK',
        stop: 'STOP',
        start: 'START'
    };
    this.status = {
        error: 'ERROR',
        cutting: 'OK_CUTTING',
        manualCutting: 'OK_CUTTING_NOT_AUTO',
        parked: 'PARKED_TIMER',
        manualParked: 'PARKED_PARKED_SELECTED',
        paused: 'PAUSED',
        searching: 'OK_SEARCHING', // Going home.
    };
    this.currentStatus = null;
}

/**
 * Is the mower currently cutting?
 * @returns {boolean}
 */
HMower.prototype.isCutting = function () {
    return [
        this.status.cutting,
        this.status.manualCutting
    ].indexOf(this.currentStatus) !== -1;
};

/**
 * Is the mower currently stopped or errored outside of the docking station?
 * @returns {boolean}
 */
HMower.prototype.isStopped = function () {
    return [
        this.status.error,
        this.status.paused
    ].indexOf(this.currentStatus) !== -1;

};

/**
 * Is the mower parked in the docking station?
 * @returns {boolean}
 */
HMower.prototype.isParked = function () {
    return [
        this.status.parked,
        this.status.manualParked
    ].indexOf(this.currentStatus) !== -1;
};

/**
 * Is the mower looking for its charging station?
 * @returns {boolean}
 */
HMower.prototype.isParking = function () {
    return this.currentStatus === this.status.searching;
};

/**
 * Is the mower in an errored state?
 * @returns {boolean}
 */
HMower.prototype.isErrored = function () {
    return this.currentStatus === this.status.error;
};

/**
 * Gets the status of the mower and returns the API response to a callback.
 * On success, the third parameter is an object with the status information.
 * @callback requestCallback
 */
HMower.prototype.getStatus = function (callback) {
    request({
        url: this.trackUrl + 'mowers/' + this.mower.id + '/status',
        method: "GET",
        headers: this.headers
    }, function (error, response, body) {
        let status = null;
        if (error || response.statusCode !== 200) {
            callback(error, response);
        } else {
            status = JSON.parse(body);
            this.currentStatus = status.mowerStatus; // TODO store as const
            callback(error, response, status);
        }
    });
};

/**
 * Gets the geo fence status with geolocation history and current location
 * @callback requestCallback
 */
HMower.prototype.getGeoStatus = function (callback) {
    request({
        url: this.trackUrl + 'mowers/' + this.mower.id + '/geofence',
        method: "GET",
        headers: this.headers
    }, function (error, response, body) {
        if (error || response.statusCode !== 200) {
            callback(error, response);
        } else {
            callback(error, response, JSON.parse(body));
        }
    });
};

/**
 * Sends a command to the mower
 * @param {string} action       An action as defined in HMower.command
 * @callback requestCallback    (boolean) Error, (String) Error Message
 * @returns {boolean} Success
 */
HMower.prototype.sendCommand = function (action, callback) {
    // Polyfill Object.values
    if (typeof Object.values !== 'function') {
        Object.values = function(obj) {
            var vals = [];
            for (var i in obj) {
                if (obj.hasOwnProperty(i)) {
                    vals.push(obj[i]);
                }
            }
            return vals;
        };
    }

    if (Object.values(this.command).indexOf(action) === -1) {
        callback(true, 'Unknown Command: ' + action);
        return false;
    }

    if (this.isErrored()) {
        callback(true, 'Cannot perform actions while mower is in error state');
        return false;
    }
    if (action === this.command.park && ( this.isParked() || this.isParking() )) {
        callback(true, 'Already in state: ' + this.currentStatus);
        return false;
    }

    if (action === this.command.start && this.isCutting()) {
        callback(true, 'Already in state: ' + this.currentStatus);
        return false;
    }

    request({
        url: this.trackUrl + 'mowers/' + this.mower.id + '/control',
        method: "POST",
        headers: this.headers,
        json: true,
        body: {
            action: action
        }
    }, (error, response, body) => {
        if (error || response.statusCode !== 200) {
            callback(error, response);
        } else {
            callback(false);
        }
    });
};

/**
 *
 * @returns {int}   Battery power from 0-100 (percent)
 */
HMower.prototype.getBatteryPower = function () {
    return this.mower.status.batteryPercent;
};

module.exports = HMower;