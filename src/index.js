#!/usr/bin/env node
'use strict'

// Imports
const logging = require('./logging')
const packmlModel = require('./packml-model')
const packmlTags = require('./packml-tags')
const simulation = require('./simulation')
const helper = require('./helper')

var mqtt = require('mqtt')
var seedRandom = require('seedrandom')

// Logger
const logger = logging.logger
logger.info('Initializing')

global.config = {
  site: process.env.SITE || 'Site',
  area: process.env.AREA || 'Area',
  line: process.env.LINE || 'Line',
  startOnLoad: process.env.START || false,
  MQTT_URL: process.env.MQTT_URL || 'mqtt://broker.hivemq.com',
  MQTT_PORT: process.env.MQTT_PORT || null,
  MQTT_USERNAME: process.env.MQTT_USERNAME || '',
  MQTT_PASSWORD: process.env.MQTT_PASSWORD || ''
}

// Simulation
global.sim = null

// Initialize _random_ with site, area and line to have consistent results with the same machine.
const topicPrefix = `${global.config.site}/${global.config.area}/${global.config.line}`
seedRandom(topicPrefix, { global: true })
const stateCommandTopic = new RegExp(String.raw`^${topicPrefix}\/Command\/(Start|Reset|Complete|Stop|Abort|Clear|Hold|Unhold|Suspend|Unsuspend)$`)
const modeCommandTopic = new RegExp(String.raw`^${topicPrefix}\/Command\/(UnitMode)$`)
const machineSpeedCommandTopic = new RegExp(String.raw`^${topicPrefix}\/Command\/MachSpeed$`)
const packMLparameters = new RegExp(String.raw`^${topicPrefix}\/Command\/Parameter\/(\d*)\/(ID|Name|Unit|Value)$`)
const packMLproducts = new RegExp(String.raw`^${topicPrefix}\/Command\/Product\/(\d*)\/(ProductID|ProcessParameter\/(\d*)\/(ID|Name|Unit|Value)|Ingredient\/(\d*)\/(IngredientID|Parameter\/(\d*)\/(ID|Name|Unit|Value)))$`)

// Connect via mqtt
var mqttClient = mqtt.connect(
  global.config.MQTT_URL,
  {
    port: global.config.MQTT_PORT,
    username: global.config.MQTT_USERNAME,
    password: global.config.MQTT_PASSWORD
  }
)

// PackML State Model
var state = new packmlModel.StateMachine()
var mode = new packmlModel.UnitMode()

// Publish PackML Tags on Change
var changed = (a, b, c) => {
  if (a == null || b == null || c == null) {
    throw Error('Should change null')
  }
  // Special Overloads
  b = b === 'productId' ? 'ProductID' : b
  b = b === 'ingredientId' ? 'IngredientID' : b
  b = b === 'id' ? 'ID' : b
  b = helper.titleCase(b) // Normal Overload
  const topic = topicPrefix + '/' + a.replace('.', '/') + b
  logger.info(`${topic} : ${c}`)
  mqttClient.publish(topic, c == null || Number.isNaN(c) ? '' : c + '', { retain: true })
}
// PackML Tags
var tags = new Proxy(new packmlTags.PackmlTags(changed), {
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

mqttClient.on('connect', (packet) => {
  logger.info('Connected to ' + global.config.MQTT_URL)
  if (!packet.sessionPresent) {
    mqttClient.subscribe(`${topicPrefix}/Command/#`)
  }
  state.observe('onEnterState', (lifecycle) => {
    const stateCurrent = helper.titleCase(lifecycle.to)
    logger.debug(`Entering State ${stateCurrent}`)
    tags.status.stateCurrent = stateCurrent
  })
  mode.observe('onEnterState', (lifecycle) => {
    const unitMode = helper.titleCase(lifecycle.to)
    logger.debug(`Entering UnitMode ${unitMode}`)
    tags.status.unitModeCurrent = unitMode
  })
  // Simulate
  global.sim = simulation.simulate(mode, state, tags)
})

mqttClient.on('close', () => { logger.info(`Disconnected from ${mqttClient.options.href || global.config.MQTT_URL}:${mqttClient.options.port}`) })

// Handle PackML Commands
mqttClient.on('message', (topic, message) => {
  if (topic.match(stateCommandTopic)) {
    // State Commands
    const command = topic.match(stateCommandTopic)[1]
    try {
      const value = parseInt(message)
      if (value === 1) {
        state[command.toLowerCase()]()
      } else {
        logger.debug(`Unknown Command payload: ${message}`)
      }
    } catch (e) {
      logger.error(`Cannot ${e.transition} from ${e.from}`)
    }
  } else if (topic.match(modeCommandTopic)) {
    message = message.toLowerCase()
    if (packmlModel.isUnitMode(message)) {
      mode.goto(message)
    } else {
      logger.error('Cannot change to unknown UnitMode')
    }
  } else if (topic.match(machineSpeedCommandTopic)) {
    if (Number.isNaN(message)) {
      logger.error(`Bad request: ${topic} Must be an number`)
      return
    }
    const newMachSpeed = parseFloat(message)
    if (newMachSpeed < 0 || newMachSpeed > tags.admin.machDesignSpeed) {
      logger.error(`Bad request: ${topic} Must be >= 0 and <= Admin/MachDesignSpeed (${tags.admin.machDesignSpeed})`)
      return
    }
    tags.status.machSpeed = newMachSpeed
  } else if (topic.match(packMLparameters)) {
    // Parameters
    const bits = topic.match(packMLparameters)
    const index = parseInt(bits[1])
    if (bits[2] === 'ID') {
      message = parseInt(message)
      if (isNaN(message)) {
        logger.error(`Bad request: ${topic} Must be an number`)
        return
      }
    } else if (bits[2] === 'Value') {
      message = parseFloat(message)
      if (isNaN(message)) {
        logger.error(`Bad request: ${topic} Must be an number`)
        return
      }
    }
    while (tags.status.parameter.length <= index) {
      tags.status.parameter.push(
        new Proxy(
          new packmlTags.Parameter(tags.status.parameter.length), {
            set (target, prop, value) {
              target[prop] = value
              changed('Status/Parameter/' + target._index + '/', prop, value)
              return true
            }
          }
        )
      )
    }
    const camelCaseProperty = helper.camelCase(bits[2])
    tags.status.parameter[index][camelCaseProperty] = message
  } else if (topic.match(packMLproducts)) {
    // Products
    const bits = topic.match(packMLproducts).filter(match => match !== undefined)
    const index = parseInt(bits[1])
    if (bits.length === 3) {
      while (tags.status.product.length <= index) {
        tags.status.product.push(new Proxy(new packmlTags.Product(tags.status.product.length), {
          set (target, prop, value) {
            target[prop] = value
            changed('Status/Product/' + target._productIndex + '/' + prop, value)
            return true
          }
        }))
      }
      message = parseInt(message)
      if (isNaN(message)) {
        logger.error(`Bad request: ${topic} Must be an number`)
        return
      }
      tags.status.product[index].productId = message
    } else if (bits.length === 5) {
      const nextIndex = bits[3]
      if (bits[0].indexOf('Ingredient')) {
        while (tags.status.product.length <= index) {
          tags.status.product.push(new packmlTags.Product())
        }
        while (tags.status.product[index].ingredient.length <= nextIndex) {
          tags.status.product[index].ingredient.push(new packmlTags.Ingredient())
        }
        tags.status.product[index].ingredient[nextIndex][helper.camelCase(bits[4])] = parseInt(message)
      } else {
        if (bits[4] === 'ID') {
          message = parseInt(message)
          if (isNaN(message)) {
            logger.error(`Bad request: ${topic} Must be an number`)
            return
          }
        } else if (bits[4] === 'Value') {
          message = parseFloat(message)
          if (isNaN(message)) {
            logger.error(`Bad request: ${topic} Must be an number`)
            return
          }
        }
        while (tags.status.product.length <= index) {
          tags.status.product.push(new packmlTags.Product())
        }
        while (tags.status.product[index].processParameter.length <= nextIndex) {
          tags.status.product[index].processParameter.push(new packmlTags.Parameter(tags.status.product[index].processParameter.length), {
            set (target, prop, value) {
              changed('Status/Product/' + index + '/ProcessParameter/' + tags.status.product[index].processParameter.length + '/', prop, value)
              return Reflect.set(...arguments)
            }
          })
        }
        tags.status.product[index].processParameter[nextIndex][helper.camelCase(bits[4])] = message
      }
    } else if (bits.length === 7) {
      const ingredientIndex = parseInt(bits[2])
      const parameterIndex = parseInt(bits[5])
      if (bits[6] === 'ID') {
        message = parseInt(message)
        if (isNaN(message)) {
          logger.error(`Bad request: ${topic} Must be an number`)
          return
        }
      } else if (bits[6] === 'Value') {
        message = parseFloat(message)
        if (isNaN(message)) {
          logger.error(`Bad request: ${topic} Must be an number`)
          return
        }
      }
      while (tags.status.product.length <= index) {
        tags.status.product.push(new packmlTags.Product())
      }
      while (tags.status.product[index].ingredient.length <= ingredientIndex) {
        tags.status.product[index].ingredient.push(new packmlTags.Parameter(), {
          set (target, prop, value) {
            changed('Status/Product/' + index + '/Ingredient/' + tags.status.product[index].ingredient.length - 1 + '/', prop, value)
            return Reflect.set(...arguments)
          }
        })
      }
      while (tags.status.product[index].ingredient[ingredientIndex].parameter <= parameterIndex) {
        tags.status.product[index].ingredient[ingredientIndex].parameter.push(new packmlTags.Parameter())
      }
      tags.status.product[index].ingredient[ingredientIndex].parameter[parameterIndex][helper.camelCase(bits[6])] = message
    }
  } else {
    logger.debug(`No handle defined for ${topic}`)
  }
})

// Graceful Exit
var cleanExit = () => {
  if (global.sim) {
    clearInterval(global.sim)
  }
  if (mqttClient.connected) {
    mqttClient.end(false, { reasonCode: 1, properties: { reasonString: 'Shutdown' } }, () => {
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
