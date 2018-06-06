![Logo](admin/husq-automower.png)
ioBroker.husq-automower
=============

[![NPM](https://www.npmjs.com/package/iobroker.husq-automower.png?downloads=true)](https://www.npmjs.com/package/iobroker.husq-automower/)

**Tests:** Linux/Mac: [![Travis-CI](https://travis-ci.org/truegreyhound/ioBroker.husq-automower.svg?branch=master)](https://travis-ci.org/truegreyhound/ioBroker.husq-automower)
Windows: [![AppVeyor](https://ci.appveyor.com/project/truegreyhound/iobroker-husq-automower?branch=master&svg=true)](https://ci.appveyor.com/project/truegreyhound/iobroker-husq-automower/)

[Deutsche Beschreibung hier](README_de.md)

This adapter connects IoBroker with your Husqvarna Automower with Connect-Modul
Mowing times, battery level and various other data are read out from the mower.
The adapter can control the mower (start, stop, park).
Tested with 450X and 315X.

For communication with Husqvarna web server, the adapter use scripts from [rannmann] (https://github.com/rannmann/node-husqvarna-automower).

Over the action state "husq-automower.x.mower.action" you can do following actions:
=  1 - start mower
=  2 - stop mower
=  3 - park mower
=  9 - query Status (if schdeuler stopped, mower.scheduleTime == 0)
= 77 - Rainbutton, toggle mower.stoppedDueRain: true - park mower it's raining, false - after configered standby time, the mower automatic start
       button work parallel with optional sensor for rain detection
= 91 - stop status scheduler (mower.scheduleTime == 0)
= 92 - start status scheduler


## installation
At least Node 4.X.X must be installed, Node 0.10 and 0.12 are no longer supported by this adapter.

## settings
- to connect to the mower, type in email and password from your Husqvarna account in the config.
- max. distance from base, if exceeded (value > 0), adapter write message to mover.sendMessage

## Changelog

#### 0.3.8
* (Greyhound) fix problem with configuration off new instance
* (Greyhound) add testing with appveyor
#### 0.3.7
* (Greyhound) mower nickname in mower.sendMessage
* (Greyhound) translations complete
#### 0.3.6
* (Greyhound) change header files in index.html for admin v2
#### 0.3.5
* (Greyhound) remove dir widgets and www
* (Greyhound) clean io-package.json, datapoints created on start from adaptercode
* (Greyhound) add to Travis CI
#### 0.3.4
* (Greyhound) new configuration site
* (Greyhound) correction in accumulate statistic values
* (Greyhound) additional statistic values
* (Greyhound) bugfixes in rain handler
#### 0.3.3
* (Greyhound) correct automower datetime with timezone offset
* (Greyhound) other small corrections
#### 0.3.2
* (Greyhound) fix a problem in adapter.on('objectChange', ...
* (Greyhound) div. renamings and bugfixes
#### 0.3.1
* (Greyhound) initial release
#### < 0.3.1
* (Greyhound) miscellaneous js-script versions
 
 
## License
The MIT License (MIT)

Copyright (c) 2018 truegreyhound <truegreyhound@gmx.net>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
