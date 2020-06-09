# Manufacturing Line PackML MQTT Simulator

| Manufacturing line simulator interfaced using PackML over MQTT.

PackML MQTT Simulator is a virtual line that interfaces using PackML implemented over MQTT. For use with the development of Industry 4.0 software solutions. The simulator implements the following PackML State model:

![](./docs/PackML-StateModel.png)

and communicates over MQTT using `<SITE>/<AREA>/<LINE>/*` topics as defined by environmental variables.

## Interfacing
Interfacing with the virtual line is done via MQTT. The virtual line subscribes to `<SITE>/<AREA>/<LINE>/Command/*` and publishes information to `<SITE>/<AREA>/<LINE>/Status` and `<SITE>/<AREA>/<LINE>/Admin`. `<SITE>`, `<AREA>` and `<LINE>` are set using environmental variables.

### Commands
Available Commands

| Topic                                                                         | Values  | Function                                      |
|-------------------------------------------------------------------------------|---------|-----------------------------------------------|
| `<SITE>/<AREA>/<LINE>/Command/Clear`                                          | 1, 0    | Clear Command                                 |
| `<SITE>/<AREA>/<LINE>/Command/Reset`                                          | 1, 0    | Reset Command                                 |
| `<SITE>/<AREA>/<LINE>/Command/Start`                                          | 1, 0    | Start Command                                 |
| `<SITE>/<AREA>/<LINE>/Command/Hold`                                           | 1, 0    | Hold Command                                  |
| `<SITE>/<AREA>/<LINE>/Command/Unhold`                                         | 1, 0    | Unhold Command                                |
| `<SITE>/<AREA>/<LINE>/Command/Complete`                                       | 1, 0    | Complete Command                              |
| `<SITE>/<AREA>/<LINE>/Command/Stop`                                           | 1, 0    | Stop Command                                  |
| `<SITE>/<AREA>/<LINE>/Command/Abort`                                          | 1, 0    | Abort Command                                 |
| `<SITE>/<AREA>/<LINE>/Command/UnitMode`                                       | Integer | Unit Mode Command                             |
| `<SITE>/<AREA>/<LINE>/Command/MachSpeed`                                      | Decimal | Machine Speed Command                         |
| `<SITE>/<AREA>/<LINE>/Command/Parameter/*n*/ID`                               | Integer | Parameter *n* ID                              |
| `<SITE>/<AREA>/<LINE>/Command/Parameter/*n*/Name`                             | String  | Parameter *n* Name                            |
| `<SITE>/<AREA>/<LINE>/Command/Parameter/*n*/Unit`                             | String  | Parameter *n* Unit                            |
| `<SITE>/<AREA>/<LINE>/Command/Parameter/*n*/Value`                            | Decimal | Parameter *n* Value                           |
| `<SITE>/<AREA>/<LINE>/Command/Product/*i*/ID`                                 | Integer | Product *n* ID                                |
| `<SITE>/<AREA>/<LINE>/Command/Product/*i*/ProcessParameter/*j*/ID`            | Integer | Product *i* Process Parameter *j* ID          |
| `<SITE>/<AREA>/<LINE>/Command/Product/*i*/ProcessParameter/*j*/Name`          | Integer | Product *i* Process Parameter *j* Name        |
| `<SITE>/<AREA>/<LINE>/Command/Product/*i*/ProcessParameter/*j*/Unit`          | Integer | Product *i* Process Parameter *j* Unit        |
| `<SITE>/<AREA>/<LINE>/Command/Product/*i*/ProcessParameter/*j*/Value`         | Integer | Product *i* Process Parameter *j* Value       |
| `<SITE>/<AREA>/<LINE>/Command/Product/*i*/Ingredient/*j*/ID`                  | Integer | Product *i* Ingredient *n* ID                 |
| `<SITE>/<AREA>/<LINE>/Command/Product/*i*/Ingredient/*j*/Parameter/*k*/ID`    | Integer | Product *i* Ingredient *j* Paramter *k* ID    |
| `<SITE>/<AREA>/<LINE>/Command/Product/*i*/Ingredient/*j*/Parameter/*k*/Name`  | Integer | Product *i* Ingredient *j* Paramter *k* Name  |
| `<SITE>/<AREA>/<LINE>/Command/Product/*i*/Ingredient/*j*/Parameter/*k*/Unit`  | Integer | Product *i* Ingredient *j* Paramter *k* Unit  |
| `<SITE>/<AREA>/<LINE>/Command/Product/*i*/Ingredient/*j*/Parameter/*k*/Value` | Integer | Product *i* Ingredient *j* Paramter *k* Value |

### Status
Available Status'
| Topic                                    | Values  | Function              |
|-------------------------------------------|---------|-----------------------|
| `<SITE>/<AREA>/<LINE>/Status/StateCurrent` | Undefined, Clearing, Cleared, Stopping, Stopped, Aborting, Aborted, Resetting, Idle, Starting, Execute, Holding, Held, Unholding, Suspending, Suspended, Unsuspending, Completing, Complete | Current PackML State |
| `<SITE>/<AREA>/<LINE>/Status/UnitMode` | 0, 1, n | Current PackML Model |

## Environmental Variables

The image is configured using the following environmental variables:

#### SITE
The ISA-95 Model site name of this line. SITE used as the parent topic in the MQTT structure. If this is unset, _Site_ will be used.

#### AREA
The ISA-95 Model area name of this line. AREA used as the second topic in the MQTT structure. If this is unset, _Area_ will be used.

#### LINE
The ISA-95 model line name of this line. LINE used as the third topic in the MQTT structure. If this is unset, _Line_ will be used.

#### MQTT_URL
The address of the MQTT server. If this is unset, _mqtt://broker.hivemq.com_ will be used.

#### MQTT_USERNAME
The name of the MQTT user with subscribe and publish permissions.

#### MQTT_PASSWORD
The password for the MQTT user with subscribe and publish permissions.

## Enterprise Simulation
A docker-compose can be used to simulate multiple independent lines at once. E.g.
```yml
version: "3.7"

services:
  greenville-packaging-line1:
    image: spruiktec/packml-simulator
    environment:
      SITE: Greenville
      AREA: Packaging
      LINE: 'Line 1'
  greenville-packaging-line1:
    image: spruiktec/packml-simulator
    environment:
      SITE: Greenville
      AREA: Packaging
      LINE: 'Line 2'
  ...
```

## Changelog

  - 0.0.2
    - Fixes #1 Add sc state change handling
  - 0.0.1
    - Add winston logging
  - 0.0.0
    - Initial Commit
