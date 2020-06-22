#!/usr/bin/env node
'use strict'

const winston = require('winston')

// Logger
const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(log => { return `${log.timestamp} | ${log.level}: ${log.message}` })
  ),
  transports: [
    new winston.transports.Console({
      timestamp: true
    })
  ]
})

exports.logger = logger
