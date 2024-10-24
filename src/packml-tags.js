#!/usr/bin/env node
'use strict'

module.exports.COUNT_TYPE = {
  CONSUMED: 'Consumed',
  DEFECTIVE: 'Defective',
  PROCESSED: 'Processed'
}

const COUNT_TYPES = [
  module.exports.COUNT_TYPE.CONSUMED,
  module.exports.COUNT_TYPE.DEFECTIVE,
  module.exports.COUNT_TYPE.PROCESSED
]

function Warning() {
  return {
    trigger: false,
    id: 0,
    value: 0
  }
}

function StopReason() {
  return {
    id: 0,
    value: 0 
  }
}

function EquipmentInterlock() {
  return {
    blocked: false,
    starved: false
  }
}

function Parameter(index ,productIndex) {
  if (index === undefined || index === null) {
    throw TypeError('Must construct a Parameter with an index')
  }
  return {
    _index: index,
    _productIndex: productIndex !== undefined && productIndex !== null ? productIndex : null,
    id: 0,
    name: '',
    unit: '',
    value: 0.0
  }
}

function Ingredient(index, productIndex) {
  if (index === undefined || index === null) {
    throw TypeError('Must construct a Parameter with an index')
  }
  return {
    _index: index,
    _productIndex: productIndex !== undefined && productIndex !== null ? productIndex : null,
    ingredientId: 0,
    parameter: []
  }
}

function Product(index) {
    if (index === undefined || index === null) {
      throw TypeError('Must construct a Product with an index')
    }
    return {
      _index: index,
      productId: 0,
      parameter: [],
      ingredient: []
    }
}

function Count(index, type) {
  if (Number.isNaN(index) && index >= 0) {
    throw TypeError('Must construct a Count with an Index')
  }
  if (COUNT_TYPES.indexOf(type) < 0) {
    throw TypeError('Unknown counter type')
  }
  return {
    index: index,
    type: type,
    id: 0,
    name: '',
    unit: '',
    count: 0,
    accCount: 0
  }
}

function Status(changed) {
  return {
    stateCurrent: 0,
    stateCurrentStr: '',
    unitModeCurrent: 0,
    unitModeCurrentStr: '',
    machSpeed: 0.0,
    curMachSpeed: 0.0,
    parameter: [],
    remoteInterface: [],
    product: [],
    equipmentInterlock: new Proxy(EquipmentInterlock(), {
      set (target, prop, value) {
        changed('Status/EquipmentInterlock/', prop, value)
        return Reflect.set(...arguments)
      }
    })
  }
}

function Admin(changed) {
  return {
    machDesignSpeed: 0.0,
    warning: [],
    prodDefectiveCount: [],
    prodProcessedCount: [],
    prodConsumedCount:  [],
    stopReason: StopReason(),
  }
}

function Command() {
  return {
    cntrlCmd: 0,
    parameter: [],
    product: [],
    remoteInterface: [],
    unitMode: 0,
    unitModeChangeRequest: false,
    machSpeed: 0.0,
    cmdChangeRequest: false,
    start: false,
    reset: false,
    complete: false,
    stop: false,
    abort: false,
    clear: false,
    hold: false,
    unhold: false,
    suspend: false,
    unsuspend: false,
  }
}

function PackmlTags(changed){
  return {
    admin: new Proxy(Admin(changed), {
      set (target, prop, value) {
        changed('Admin/', prop, value)
        return Reflect.set(...arguments)
      }
    }),
    status: new Proxy(Status(changed), {
      set (target, prop, value) {
        changed('Status/', prop, value)
        return Reflect.set(...arguments)
      }
    }),
    command: Command()
  }
}

module.exports.Warning = Warning
module.exports.StopReason = StopReason
module.exports.EquipmentInterlock = EquipmentInterlock
module.exports.Parameter = Parameter
module.exports.Ingredient = Ingredient
module.exports.Product = Product
module.exports.Count = Count
module.exports.Status = Status
module.exports.Command = Command
module.exports.Admin = Admin
module.exports.PackmlTags = PackmlTags
