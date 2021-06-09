// @ts-check

const path = require("path");
const { tests } = require("@iobroker/testing");
const adapterDir = path.join(__dirname, "..");

// Run integration tests - See https://github.com/ioBroker/testing for a detailed explanation and further options
tests.integration(adapterDir, { });
