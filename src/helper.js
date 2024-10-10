#!/usr/bin/env node
'use strict'

exports.titleCase = (str) => {
  str = str.split(' ')
  for (let i = 0; i < str.length; i++) {
    str[i] = str[i].charAt(0).toUpperCase() + str[i].slice(1)
  }
  return str.join(' ')
}

exports.camelCase = (str) => {
  return str.replace(/(?:^\w|[A-Z]|\b\w)/g, function (word, index) {
    return index === 0 ? word.toLowerCase() : word.toUpperCase()
  }).replace(/\s+/g, '')
}

exports.getClientId = (hostname) => {
  // Confirm to MQTT v3.1.1
  const regex = /[^a-zA-Z0-9]/g
  return hostname.replace(regex, "").substring(0, 23)
}

exports.flattenObject = (ob) => {
  let toReturn = {};

    for (let i in ob) {
        if (!ob.hasOwnProperty(i)) continue;

        if ((typeof ob[i]) == 'object' && ob[i] !== null) {
          let flatObject = this.flattenObject(ob[i]);
            for (let x in flatObject) {
                if (!flatObject.hasOwnProperty(x)) continue;
                const index = i.replace(/^./, i[0].toUpperCase())
                toReturn[index + '/' + x] = flatObject[x];
            }
        } else {
            const index = i.replace(/^./, i[0].toUpperCase())
            toReturn[index] = ob[i];
        }
    }
    return toReturn;
}