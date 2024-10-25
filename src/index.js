#!/usr/bin/env node
'use strict'

// Imports
const logging = require('./logging')
const packmlModel = require('./packml-model')
const packmlTags = require('./packml-tags')
const packmlCommands = require('./packml-commands')
const simulation = require('./simulation')
const helper = require('./helper')
const mqtt = require('./clients/mqtt');
const sparkplug = require('./clients/sparkplug');
const os = require('os')

let seedRandom = require('seedrandom')

// Logger
const logger = logging.logger
logger.info('Initializing')

global.config = {
  site: process.env.SITE || 'Site',
  area: process.env.AREA || 'Area',
  line: process.env.LINE || os.hostname(),
  startOnLoad: process.env.START || false,
  MQTT_URL: process.env.MQTT_URL || 'mqtt://broker.hivemq.com',
  MQTT_PORT: process.env.MQTT_PORT || null,
  MQTT_USERNAME: process.env.MQTT_USERNAME || null,
  MQTT_PASSWORD: process.env.MQTT_PASSWORD || null,
  MQTT_CLIENT_ID: process.env.MQTT_CLIENT_ID || helper.getClientId(os.hostname()),
  CLIENT_TYPE: process.env.CLIENT_TYPE ? process.env.CLIENT_TYPE.toLowerCase() : 'mqtt',
  TICK: process.env.TICK || 1000
}
global.config = {
  ...global.config,
  topicPrefix: `${global.config.site}/${global.config.area}/${global.config.line}`,
  SPARKPLUG_GROUP_ID: process.env.SPARKPLUG_GROUP_ID || process.env.SITE || 'PackML Simulator',
  SPARKPLUG_EDGE_NODE: process.env.SPARKPLUG_EDGE_NODE || process.env.AREA || `${global.config.site}_${global.config.area}_${global.config.line}`,
}

// Simulation
global.sim = null

// Initialize _random_ with site, area and line to have consistent results with the same machine.
seedRandom(global.config.topicPrefix, { global: true })
const stateCommandTopic = new RegExp(String.raw`^${global.config.topicPrefix}\/Command\/(Start|Reset|Complete|Stop|Abort|Clear|Hold|Unhold|Suspend|Unsuspend)$`)
const modeCommandTopic = new RegExp(String.raw`^${global.config.topicPrefix}\/Command\/(UnitMode)$`)
const machineSpeedCommandTopic = new RegExp(String.raw`^${global.config.topicPrefix}\/Command\/MachSpeed$`)
const packmlParameters = new RegExp(String.raw`^${global.config.topicPrefix}\/Command\/Parameter\/(\d*)\/(ID|Name|Unit|Value)$`)
const packmlProducts = new RegExp(String.raw`^${global.config.topicPrefix}\/Command\/Product\/(\d*)\/(ProductID|ProcessParameter\/(\d*)\/(ID|Name|Unit|Value)|Ingredient\/(\d*)\/(IngredientID|Parameter\/(\d*)\/(ID|Name|Unit|Value)))$`)

// PackML State Model
let state = new packmlModel.StateMachine()
let mode = new packmlModel.UnitMode()

// Publish PackML Tags on Change
let changed = (a, b, c) => {
  if (a == null || b == null || c == null) {
    throw Error('Should change null')
  }
  // Special Overloads
  b = b === 'productId' ? 'ProductID' : b
  b = b === 'ingredientId' ? 'IngredientID' : b
  b = b === 'id' ? 'ID' : b
  b = helper.titleCase(b) // Normal Overload
  const topic = global.config.topicPrefix + '/' + a.replace('.', '/') + b
  logger.info(`${topic} : ${c}`)
  client.publish(topic, c, { retain: true })
}
// PackML Tags
let tags = new Proxy(new packmlTags.PackmlTags(changed), {
  set (target, prop, value) {
    changed('', prop, value)
    return Reflect.set(...arguments)
  }
})

// Initialize some Consumed / Processed / Defective Counts
tags.admin.prodConsumedCount.push(
  new Proxy(
    new packmlTags.Count(0, packmlTags.COUNT_TYPE.CONSUMED), {
      set (target, prop, value) {
        changed(`Admin/Prod${target.type}Count/${target.index}/`, prop, value)
        return Reflect.set(...arguments)
      }
    }
  )
)
tags.admin.prodProcessedCount.push(
  new Proxy(
    new packmlTags.Count(0, packmlTags.COUNT_TYPE.PROCESSED), {
      set (target, prop, value) {
        changed(`Admin/Prod${target.type}Count/${target.index}/`, prop, value)
        return Reflect.set(...arguments)
      }
    }
  )
)
tags.admin.prodDefectiveCount.push(
  new Proxy(
    new packmlTags.Count(0, packmlTags.COUNT_TYPE.DEFECTIVE), {
      set (target, prop, value) {
        changed(`Admin/Prod${target.type}Count/${target.index}/`, prop, value)
        return Reflect.set(...arguments)
      }
    }
  )
)

// Connect to Client
let client = null;
switch (global.config.CLIENT_TYPE) {
  case 'sparkplugb':
    client = new sparkplug.Client(global.config, tags);
    break;
  case 'mqtt':
    client = new mqtt.Client(global.config, tags);
    break;
  default:
    logger.info(`No client set, defaulting to 'mqtt'`)
    client = new mqtt.Client(global.config);    
}

client.on('connect', (packet) => {
  logger.info(`Connected to ${client.options().href || client.options().host || global.config.MQTT_URL}:${client.options().port}`)
  state.observe('onEnterState', (lifecycle) => {
    const stateCurrent = helper.titleCase(lifecycle.to)
    logger.debug(`Entering State ${stateCurrent}`)
    tags.status.stateCurrentStr = stateCurrent
    tags.status.stateCurrent = packmlModel.getStateIntByStateText(lifecycle.to);
  })
  mode.observe('onEnterState', (lifecycle) => {
    const unitMode = helper.titleCase(lifecycle.to)
    logger.debug(`Entering UnitMode ${unitMode}`)
    tags.status.unitModeCurrentStr = unitMode
    tags.status.unitModeCurrent = packmlModel.getModeIntByModeText(lifecycle.to);
  })
  // Simulate
  global.sim = simulation.simulate(mode, state, tags, global.config.TICK)
})

client.on('close', () => { 
  logger.info(`Disconnected from ${client.options().href || client.globalConfig.MQTT_URL}:${client.options().port}`) 
})

// Handle PackML Commands
client.on('message', (topic, message) => {
  if (topic.match(stateCommandTopic)) {
    packmlCommands.stateCommand(logger, topic, message, state, stateCommandTopic)
  } else if (topic.match(modeCommandTopic)) {
    packmlCommands.modeCommand(logger, message, mode)
  } else if (topic.match(machineSpeedCommandTopic)) {
    packmlCommands.machineSpeedCommand(logger, topic, message, tags)
  } else if (topic.match(packmlParameters)) {
    packmlCommands.parameterCommand(logger, topic, message, tags, packmlParameters, changed)
  } else if (topic.match(packmlProducts)) {
    packmlCommands.productCommand(logger, topic, message, tags, packmlProducts, changed)
  } else {
    logger.debug(`No handle defined for ${topic}`)
  }
})

// Display Client Errors
client.on('error', (error) => {
  logger.error(`MQTT Client error: ${error.message}`)
  cleanExit()
})

// Graceful Exit
let cleanExit = () => {
  if (global.sim) {
    clearInterval(global.sim)
  }
  if (client.isConnected()) {
    client.end(false, { reasonCode: 1, properties: { reasonString: 'Shutdown' } }, () => {
      logger.info('Graceful shutdown')
      return process.exit(0)
    })
  } else {
    logger.info('Graceful shutdown')
    return process.exit(0)
  }
}
process.on('SIGINT', cleanExit)
process.on('SIGTERM', cleanExit)
