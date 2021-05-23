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

class Warning {
  constructor () {
    this.trigger = false
    this.id = 0
    this.value = 0
  }
}

class StopReason {
  constructor () {
    this.id = 0
    this.value = 0
  }
}

class EquipmentInterlock {
  contructor () {
    this.blocked = false
    this.starved = false
  }
}

class Parameter {
  constructor (index, productIndex) {
    if (index === undefined || index === null) {
      throw TypeError('Must construct a Parameter with an index')
    }
    this._index = index
    if (productIndex !== undefined && productIndex !== null) {
      this._productIndex = productIndex
    } else {
      this._productIndex = null
    }
    this.id = 0
    this.name = ''
    this.unit = ''
    this.value = 0.0
  }
}

class Ingredient {
  constructor (index, productIndex) {
    if (index === undefined || index === null) {
      throw TypeError('Must construct a Parameter with an index')
    }
    this._index = index
    if (productIndex !== undefined && productIndex !== null) {
      this._productIndex = productIndex
    } else {
      this._productIndex = null
    }
    this.ingredientId = 0
    this.parameter = []
  }
}

class Product {
  constructor (index) {
    if (index === undefined || index === null) {
      throw TypeError('Must construct a Prodct with an index')
    }
    this._index = index
    this.productId = 0
    this.parameter = []
    this.ingredient = []
  }
}

class Count {
  constructor (index, type) {
    if (Number.isNaN(index) && index >= 0) {
      throw TypeError('Must construct a Count with an Index')
    }
    if (COUNT_TYPES.indexOf(type) < 0) {
      throw TypeError('Unknown counter type')
    }
    this.index = index
    this.type = type
    this.id = 0
    this.name = ''
    this.unit = ''
    this.count = 0
    this.accCount = 0
  }
}

class Status {
  constructor (changed) {
    this.equipmentInterlock = new Proxy(new EquipmentInterlock(), {
      set (target, prop, value) {
        changed('Status/EquipmentInterlock/', prop, value)
        return Reflect.set(...arguments)
      }
    })
    this.stateCurrent = 0
    this.stateCurrentStr = ''
    this.unitModeCurrent = 0
    this.unitModeCurrentStr = ''
    this.machSpeed = 0.0
    this.curMachSpeed = 0.0
    this.parameter = []
    this.remoteInterface = []
    this.product = []
    this.equipmentInterlock = new EquipmentInterlock()
  }
}

class Admin {
  constructor (changed) {
    this.warning = new Proxy([], {
      set (target, prop, value) {
        changed('Admin/Warning/', prop, value)
        return Reflect.set(...arguments)
      }
    })
    this.prodDefectiveCount = new Proxy([], {
      set (target, prop, value) {
        changed('Admin/ProdDefectiveCount/', prop, value)
        return Reflect.set(...arguments)
      }
    })
    this.prodProcessedCount = new Proxy([], {
      set (target, prop, value) {
        changed('Admin/ProdProcessedCount/', prop, value)
        return Reflect.set(...arguments)
      }
    })
    this.prodConsumedCount = new Proxy([], {
      set (target, prop, value) {
        changed('Admin/ProdConsumedCount/', prop, value)
        return Reflect.set(...arguments)
      }
    })
    this.stopReason = new Proxy(new StopReason(), {
      set (target, prop, value) {
        changed('Admin/StopReason/', prop, value)
        return Reflect.set(...arguments)
      }
    })
    this.warning = []
    this.machDesignSpeed = 0.0
    this.prodDefectiveCount = []
    this.prodProcessedCount = []
    this.prodConsumedCount = []
    this.stopReason = new StopReason()
  }
}

class Command {
  constructor () {
    this.cntrlCmd = 0
    this.parameter = []
    this.product = []
    this.remoteInterface = []
    this.unitMode = 0
    this.unitModeChangeRequest = false
    this.machSpeed = 0.0
    this.cmdChangeRequest = false
    this.start = 0
    this.reset = 0
    this.complete = 0
    this.stop = 0
    this.abort = 0
    this.clear = 0
    this.hold = 0
    this.unhold = 0
    this.suspend = 0
    this.unsuspend = 0
  }
}

class PackmlTags {
  constructor (changed) {
    this.admin = new Proxy(new Admin(changed), {
      set (target, prop, value) {
        changed('Admin/', prop, value)
        return Reflect.set(...arguments)
      }
    })

    this.status = new Proxy(new Status(changed), {
      set (target, prop, value) {
        changed('Status/', prop, value)
        return Reflect.set(...arguments)
      }
    })

    this.command = new Command()
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
