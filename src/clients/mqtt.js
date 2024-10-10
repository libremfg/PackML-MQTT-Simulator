#!/usr/bin/env node
'use strict'

const mqtt = require('mqtt');
const events = require('events');
const logging = require('../logging')

const logger = logging.logger;

class Client extends events.EventEmitter {
    constructor(globalConfig, initialState) {
        super()

        this.globalConfig = globalConfig;

        this.client = mqtt.connect(
            globalConfig.MQTT_URL,
            {
              clientId: globalConfig.clientId,
              port: globalConfig.MQTT_PORT,
              username: globalConfig.MQTT_USERNAME,
              password: globalConfig.MQTT_PASSWORD
            }
        )

        let that = this;

        // On Connect subscribe to Command topics
        this.client.on('connect', (packet) => {
            if (!packet.sessionPresent) {
                const topic = `${that.globalConfig.topicPrefix}/Command/#`;
                logger.info(`Subscribing to ${topic}`)
                this.client.subscribe(topic)
            }
            this.emit('connect');
        })

        
        this.client.on('message', (topic, payload) => {
            that.emit('message', topic, payload);
        })

        // Emit Close
        this.client.on('close', () => {
            this.emit('close');
        })
        
        // emit errors
        this.client.on('error', (error) => {
            this.emit('error', error);
        })
    }

    publish(topic, message, opts) {
        const payload = message == null || Number.isNaN(message) ? '' : message + ''
        return this.client.publish(topic, payload, opts)
    }

    isConnected() {
        return this.client.connected;
    }

    end(force, opts, cb) {
        return this.client.end(force, opts, cb)
    }

    options() {
        return this.client.options;
    }

}

module.exports.Client = Client;