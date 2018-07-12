![Logo](admin/husq-automower.png)
ioBroker.husq-automower
=============

[![NPM](https://www.npmjs.com/package/iobroker.husq-automower.png?downloads=true)](https://www.npmjs.com/package/iobroker.husq-automower/)

**Tests:** Linux/Mac: [![Travis-CI](https://travis-ci.org/truegreyhound/ioBroker.husq-automower.svg?branch=master)](https://travis-ci.org/truegreyhound/ioBroker.husq-automower)
Windows: [![AppVeyor](https://ci.appveyor.com/project/truegreyhound/iobroker-husq-automower?branch=master&svg=true)](https://ci.appveyor.com/project/truegreyhound/iobroker-husq-automower/)

Dieser Adapter verbindet IoBroker mit deinem Husqvarna Automower mit Connect-Modul
Es werden Mähzeiten, Akkustand und diverse weitere Daten ausgelesen.
Einige Grundfunktionen (Start, Stopp, Parken) des Mähers können durch den Adapter gesteuert werden.
Getestet mit 450X und 315X.

Für die Kommunikation mit dem Husqvarna-Webserver werden die Skripte von [rannmann] verwendet (https://github.com/rannmann/node-husqvarna-automower).

Via dem Aktions-State "husq-automower.x.mower.action" können folgende Aktionen ausgelöst werden:
=  1 - start Mäher
=  2 - stopp Mäher
=  3 - park Mäher
=  9 - query Status (wenn Schdeuler gestoppt, mower.scheduleTime == 0)
= 77 - Regentaste, toggle mower.stoppedDueRain: true - park Mäher wegen Regen, false - nach konfigurierter Wartezeit wird Mäher wieder gestartet
       arbeitet parallel zum optionalem Regensensor
= 91 - stopp Statusscheduler (mower.scheduleTime == 0)
= 92 - start Statusscheduler

## Installation
Es muss mindestens Node 4.X.X Installiert sein, Node 0.10 und 0.12 werden von diesem Adapter nicht mehr unterstützt.

## Einstellungen
- Bei E-mail und Passwort müssen die Daten eingeben werden, mit denen man bei Husqvarna registriert und der Mower verbunden ist.
- max. Entfernung von der Basis, wird diese überschritten (> 0), wird eine Alarmmessage generiert --> mover.sendMessage


## Changelog

#### 0.3.10
* (Greyhound) Status des Regensensors wird beim Adapterstart eingelesen
* (Greyhound) fix geänderte Statuserkennung (CHARGING wird seit 12.06.2018 nicht mehr gesetzt)
* (Greyhound) neuer Datenpunkt mower.rawResponse_mowers mit den ausgelesenen Werten bei Anmeldung an Webserver
* (Greyhound) fix Variablennaming for adapter.config (no '_')
* (Greyhound) bei Erkennung Regen wird Mäher bis auf weiteres geparkt, es erfolgt kein automatischer Start wenn trocken
#### 0.3.9
* (Greyhound) complete configuration fields in io-package.json
* (Greyhound) add message, if mower base disconnected or mower lifted
* (Greyhound) new limit for batterycharge for mower.sendMessage
* (Greyhound) correct small errors in translation configuration
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
* (Greyhound) Korrektur Automower datetime mit ZeitzonenOffset
* (Greyhound) weitere kleinere Korrekturen
#### 0.3.2
* (Greyhound) fixing eines Problems in adapter.on('objectChange', ...
* (Greyhound) div. Umbenennungen und Bugfixes
#### 0.3.1
* (Greyhound) initial release
#### < 0.3.1
* (Greyhound) diverse Version als JS-Skript
 
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
