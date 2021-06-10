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

Das Unterdrücken des Starts des Mowers bei Regen ist ohne Kenntnis der aktuellen Startzeit nicht sinnvoll umsetzbar. Irgendwie blödsinn
Mäher steht, wartet auf Erreichen Startzeit, Wenn vorher Regen == TRUE, dann prüfen, ob 
       nächster Start - Wartezeit =< akt. Zeit --> stop
       nächster Start - Wartezeit > akt. Zeit --> TimerT1, der nächster Start - Wartezeit endet, wenn dann immer noch Regen --> stop
wenn Regensensor auf TROCKEN, 
       dann TimerT1 beenden
       prüfen ob nächster Start - Wartezeit =< akt. Zeit --> Mäher stoppen (falls noch nicht erfolgt) und timer setzen TimerT2, der Mäher dann startet
       wenn Mäher startet und TimerT2 <> null, TimerT2 zurücksetzen


## Installation
Es muss mindestens Node 4.X.X Installiert sein, Node 0.10 und 0.12 werden von diesem Adapter nicht mehr unterstützt.

## Einstellungen
- Bei E-mail und Passwort müssen die Daten eingeben werden, mit denen man bei Husqvarna registriert und der Mower verbunden ist.
- max. Entfernung von der Basis, wird diese überschritten (> 0), wird eine Alarmmessage generiert --> mower.sendMessage

## Changelog
#### 1.1.2
* (Greyhound) einige fehlende setState mit ack=true gesetzt
* (Greyhound) error Handling für Mäher bei unbekannten Codes gefixt
#### 1.1.1
* (Greyhound) einige Verbesserungen im Adapter-handling
#### 1.1.0
* (Greyhound) mower.lastStartTime nach statistics verschoben: mower.statistics.mowingStartTime, alter Wert wird übernommen und lastStartTime gelöscht, ggf. in View(s) anpassen
* (Greyhound) subscription auf Regensensor (subscribeForeignStates) scheint nicht überall zu funktionieren, deshalb wird der Status auch im updateStatus direkt ausgelesen und auf Änderung geprüft
* (Greyhound) Regenwertvergleich geändert, in Konfiguration jetzt den Wert direkt eingeben, bei number: bei 0 oder 1 ==, sonst >=, Typ des Wertes wird aus DP des Sensors gelesen
* (Greyhound) Konfigurationswert für Wartezeit nach Regen wird wie folgt interpretiert: >= 0 - started mower nach angegebener Zeit, < 0 oder kein Wert - kein automatischer Start
* (Greyhound) Zähler für Anzahl WebRequests, erfolgreich, Fehler je Tag und kumulativ Monat (WebRequestCountXXXXX), nach 4 Fehlern wird Warnung ins Log geschrieben und das Abfrageinverval ggf. auf Inactive gesetzt, nach mehr als 10 Fehlern wird der Adapterstatus auf Fehler gesetzt.
* (Greyhound) Der Text zum aktuellen und letzten Fehlercode wird in currentErrorMsg und lastErrorMsg gespeichert (deutsch)
* (Greyhound) sendMessage, das letzte Feld des Empfängers ist entfallen, wird bei mir jetzt in Abhängigkeit von der Prio gesteuert
* (Greyhound) Fehler beim Erkennen der Startzeit des Mähens behoben (StartMowingTime)
* (Greyhound) verschiedene Änderungen um den Code robuster zu machen
#### 0.3.12
* (Greyhound) verbessertes Fehlerhandling bei updateStatus, GPS-Daten
* (Greyhound) Erkennung beim Start, ob Batterie geladen und Rücksetzen der Ladestartzeit
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
