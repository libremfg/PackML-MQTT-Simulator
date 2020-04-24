# Manufacturing Line PackML MQTT Simulator

| Manufacturing line simulator that interfaces using PackML over MQTT.

PackML MQTT Simulator is a virtual line that interfaces using PackML implemented over MQTT. It is meant to be used for the development of Industry 4.0 software solutions.

### Environmental Variables

The image is configured using the following environmental variables:

##### SITE
The ISA-95 Model site name of this line. Used as the parent topic in the MQTT structure. If this is unset, _Site_ will be used.

##### AREA
The ISA-95 Model area name of this line. Used as the second topic in the MQTT structure. If this is unset, _Area_ will be used.

##### LINE
The ISA-95 model line name of this line. Used as the third topic in the MQTT structure. If this is unset, _Line_ will be used.

##### MQTT_URL
The address of the MQTT server. If this is unset, _mqtt://broker.hivemq.com_ will be used.

##### MQTT_USERNAME
The name of the MQTT user with subscribe and publish permissions.

##### MQTT_PASSWORD
The password for the MQTT user with subscribe and publish permissions.

## Changelog

  - 0.0.0 
    - Initial Commit
