// @ts-check

const path = require("path");
const { tests } = require("@iobroker/testing");
const adapterDir = path.join(__dirname, "..");

// Run tests
// Run unit tests - See https://github.com/ioBroker/testing for a detailed explanation and further options
tests.unit(adapterDir, {});
