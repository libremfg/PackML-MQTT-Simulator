#!/usr/bin/env node
'use strict'

// Imports
const packmlModel = require('./packml-model')
const packmlTags = require('./packml-tags')
const helper = require('./helper')

// handle state commands
exports.stateCommand = (logger, topic, message, state, stateCommandTopic) => {
  // State Commands
  const command = topic.match(stateCommandTopic)[1]
  try {
    const value = parseInt(message)
    if (value === 1 || message === true) {
      state[command.toLowerCase()]()
    } else {
      logger.debug(`Unknown Command payload: ${message}`)
    }
  } catch (e) {
      logger.error(`Cannot ${e.transition} from ${e.from}`)
  }
}

// handle mode commands
exports.modeCommand = (logger, message, mode) => {
  if (isNaN(message)) {
    message = message.toString().toLowerCase()
  } else {
    message = packmlModel.getModeTextByModeInt(message).toLowerCase()
  }
  if (packmlModel.isUnitMode(message)) {
    mode.goto(message)
  } else {
    logger.error(`Cannot change to unknown UnitMode: ${message}`)
  }
}

// handle machine speed commands
exports.machineSpeedCommand = (logger, topic, message, tags) => {
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
}

// handle parameter commands
exports.parameterCommand = (logger, topic, message, tags, packmlParameters, changed) => {
  // Parameters
  const bits = topic.match(packmlParameters)
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
}

// handle product commands
exports.productCommand = (logger, topic, message, tags, packmlProducts, changed) => {
  // Products
  const bits = topic.match(packmlProducts).filter(match => match !== undefined)
  const index = parseInt(bits[1])

  // Add in empty product if it doesn't exist
  while (tags.status.product.length <= index) {
    tags.status.product.push(new Proxy(new packmlTags.Product(tags.status.product.length), {
      set (target, prop, value) {
        target[prop] = value
        changed('Status/Product/' + target._index + '/', prop, value)
        return true
      }
    }))
  }
  if (bits.length === 3) {
    productCommandForProduct(logger, index, topic, message, tags)
  } else if (bits.length === 5) {
    const nextIndex = bits[3]
    const isIngredient = bits[0].indexOf('Ingredient') !== -1
    if (isIngredient) {
      productCommandForIngredient(index, nextIndex, bits, message, tags, changed)
    } else {
      productCommandForProductParameter(logger, index, nextIndex, bits, topic, message, tags, changed)
    }
  } else if (bits.length === 7) {
    productCommandForIngredientParameter(logger, index, bits, topic, message, tags, changed)
  }
}

function productCommandForProduct(logger, index, topic, message, tags) {
  message = parseInt(message)
  if (isNaN(message)) {
    logger.error(`Bad request: ${topic} Must be an number`)
    return
  }
  tags.status.product[index].id = message
}

function productCommandForIngredient(index, nextIndex, bits, message, tags, changed) {
  while (tags.status.product[index].ingredient.length <= nextIndex) {
    tags.status.product[index].ingredient.push(new Proxy(
      new packmlTags.Ingredient(tags.status.product[index].ingredient.length), 
      {
        set (target, prop, value) {
          changed('Status/Product/' + index + '/Ingredient/' + target._index + '/', prop, value)
          return Reflect.set(...arguments)
        }
      }
    ))
  }
  tags.status.product[index].ingredient[nextIndex][helper.camelCase(bits[4])] = parseInt(message)
}

function productCommandForProductParameter(logger, index, nextIndex, bits, topic, message, tags, changed) {
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
  while (tags.status.product[index].processParameter.length <= nextIndex) {
    tags.status.product[index].processParameter.push(new Proxy(
      new packmlTags.Parameter(tags.status.product[index].processParameter.length, index), {
      set (target, prop, value) {
        changed('Status/Product/' + index + '/ProcessParameter/' + target._index + '/', prop, value)
        return Reflect.set(...arguments)
      }
    }))
  }
  tags.status.product[index].processParameter[nextIndex][helper.camelCase(bits[4])] = message
}

function productCommandForIngredientParameter(logger, index, bits, topic, message, tags, changed) {
  const ingredientIndex = parseInt(bits[3])
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
  while (tags.status.product[index].ingredient.length <= ingredientIndex) {
    tags.status.product[index].ingredient.push(new Proxy(
      new packmlTags.Ingredient(tags.status.product[index].ingredient.length), {
        set (target, prop, value) {
          changed('Status/Product/' + index + '/Ingredient/' + target._index + '/', prop, value)
          return Reflect.set(...arguments)
        }
      }
    ))
  }

  while (tags.status.product[index].ingredient[ingredientIndex].parameter.length <= parameterIndex) {
    tags.status.product[index].ingredient[ingredientIndex].parameter.push(new Proxy(
      new packmlTags.Parameter(tags.status.product[index].ingredient[ingredientIndex].parameter.length, index, ingredientIndex), {
        set(target, prop, value) {
          changed('Status/Product/' + index + '/Ingredient/' + ingredientIndex + '/Parameter/' + target._index + '/', prop, value)
          return Reflect.set(...arguments)
        }
      }
    ))
  }
  tags.status.product[index].ingredient[ingredientIndex].parameter[parameterIndex][helper.camelCase(bits[6])] = message
}