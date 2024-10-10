#!/usr/bin/env node
'use strict'

const sparkplug = require('sparkplug-client')
const helper = require('../helper');
const { logger } = require('../logging');
const events = require('events');

class Client extends events.EventEmitter {
    constructor(globalConfig, initialState) {
        super()
        this._config = {
            serverUrl: globalConfig.MQTT_URL,
            username: globalConfig.MQTT_USERNAME,
            password: globalConfig.MQTT_PASSWORD,
            groupId: globalConfig.SPARKPLUG_GROUP_ID,
            edgeNode: globalConfig.SPARKPLUG_EDGE_NODE,
            clientId: globalConfig.MQTT_CLIENT_ID,
            version: 'spBv1.0',
        };
        this._globalConfig = globalConfig
        this._defaultPublishOptions = {
            compress: false
        }
        this.deviceId = `${globalConfig.line}`
        this.client = sparkplug.newClient(this._config);

        this.client.on('connect', () => {
            this.emit('connect');
        })

        let that = this;

        this.client.on('dcmd', function (deviceId, payload) {
            logger.info("received 'dcmd' event");
            logger.debug("device: " + deviceId);
            logger.debug("payload: " + JSON.stringify(payload));
            
            if (payload.metrics) {
                payload.metrics.forEach((metric) => {
                    logger.info(`\t${metric.name} (${metric.type}) = ${metric.value}`)
                    const topic = `${that._globalConfig.topicPrefix}/${metric.name.replace(/^./, metric.name[0].toUpperCase())}`;
                    const value = metric.value
                    that.emit('message', topic, value)
                })
            }            
        });

        this.client.on('ncmd', function(payload) {
            logger.info("Received 'ncmd' event");
            logger.debug("Payload: " + JSON.stringify(payload));

            for (const metric of payload.metrics) {
                logger.info(`\t${metric.name} (${metric.type}) = ${metric.value}`)
                if (metric.name === 'Node Control/Rebirth') {
                    if (metric.value) {
                        that.birthNode()
                        that.birthDevice()
                    }
                }
            }
        });

        // Emit Close
        this.client.on('close', () => {
            this.emit('close');
        })
        
        // emit errors
        this.client.on('error', (error) => {
            this.emit('error', error);
        })

        this._deviceData = helper.flattenObject(initialState);
        this.birthNode()
        this.birthDevice()
    }

    getType(value) {
        if (typeof value === 'number') {
            if (value % 1 === 0) return 'Int32'
            return 'Float'
        }
        return typeof value
    }

    birthDevice() {
        const payload = {
            timestamp: new Date().valueOf(),
            metrics: Object.keys(this._deviceData).map((key) => {
                return {
                    name: key,
                    value: this._deviceData[key],
                    type: this.getType(this._deviceData[key])
                }
            })
        }
        this.client.publishDeviceBirth(this.deviceId, payload, this._defaultPublishOptions)
    }
    
    birthNode() {
        const timestamp = new Date().valueOf();
        const payload = {
            timestamp: timestamp,
            metrics: [
                {
                    name: 'Node Control/Scan Rate',
                    timestamp: timestamp,
                    value: this._globalConfig.TICK,
                    type: 'Int32'
                },
                {
                    name: 'Node Control/Rebirth',
                    timestamp: timestamp,
                    value: false,
                    type: 'Boolean'
                },
                {
                    name: "Properties/OS Version", 
                    timestamp: timestamp,
                    value: "2.0.5",
                    type: "String"
                },
                {
                    name: "Properties/OS",
                    timestamp: timestamp,
                    value: "PackML Simulator",
                    type: "String"
                }
            ]
        }
        this.client.publishNodeBirth(payload, this._defaultPublishOptions)
    }

    publish(topic, message, opts) {
        let messageType = typeof message;
        if (!isNaN(message)) {
            if (message % 1 === 0) {
                messageType = 'Int32'
            } else {
                messageType = 'Float'
            }
        }
        
        let convertTopic = topic.replace(this._globalConfig.topicPrefix+'/', '')
        const payload = {
            timestamp: new Date().valueOf(),
            metrics: [
                {
                    name: convertTopic,
                    value: message,
                    type: messageType
                }
            ]
        }
        this._deviceData[convertTopic] = message;

        return this.client.publishDeviceData(this.deviceId, payload, this._defaultPublishOptions)
    }

    isConnected() {
        return this.client.connected;
    }

    end(force, opts, cb) {
        const payload = {
            "timestamp" : 1465456711580
        };
        // Publish device death
        this.client.publishDeviceDeath(this.deviceId, payload);
        this.client.stop()
        cb();
    }

    options() {
        return {
            href: this._config.serverUrl,
            port: this._config.port ? this._config.port : 1883
        };
    }
}

module.exports.Client = Client;