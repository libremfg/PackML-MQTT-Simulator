#!/usr/bin/env node
'use strict'

module.exports.weightedRandom = (prob) => {
  let i = 0
  let sum = 0
  const r = Math.random()
  for (i in prob) {
    sum += prob[i]
    if (r <= sum) return i
  }
}

module.exports.randomBoxMuller = () => {
  let u = 0
  let v = 0
  while (u === 0) u = Math.random() // Converting [0,1) to (0,1)
  while (v === 0) v = Math.random()
  let num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
  num = num / 10.0 + 0.5 // Translate to 0 -> 1
  if (num > 1 || num < 0) return module.exports.randomBoxMuller() // resample between 0 and 1
  return num
}

// Set Simulation Chances
const good = 0.9 + module.exports.randomBoxMuller() * 0.1
const executeAvailabilityProbabilities = { nothing: 0.9985, suspend: 0.0015 }
const executeQualityProbabilities = { good: good, bad: 1.0 - good }
const executeUnspendProbabilities = { nothing: 0.995, unsuspend: 0.005 }
const isCurMachSpeedFlicker = { flick: 0.2, nothing: 0.8 }

module.exports.simulate = (mode, state, tags, millis = 1000) => {
  // Go to Production
  mode.goto('production')

  // Setup Speed Rates
  tags.admin.machDesignSpeed = 100.0
  tags.status.machSpeed = 100.0
  tags.status.curMachSpeed = 0.0

  // Setup Counter Details
  if (tags.admin.prodConsumedCount && tags.admin.prodConsumedCount.length > 0) {
    tags.admin.prodConsumedCount[0].id = 1
    tags.admin.prodConsumedCount[0].name = 'Raw Material'
    tags.admin.prodConsumedCount[0].unit = 'Each'
    tags.admin.prodConsumedCount[0].count = 0
    tags.admin.prodConsumedCount[0].accCount = 0
  }
  if (tags.admin.prodDefectiveCount && tags.admin.prodDefectiveCount.length > 0) {
    tags.admin.prodDefectiveCount[0].id = 2
    tags.admin.prodDefectiveCount[0].name = 'Scrap'
    tags.admin.prodDefectiveCount[0].unit = 'Each'
    tags.admin.prodDefectiveCount[0].count = 0
    tags.admin.prodDefectiveCount[0].accCount = 0
  }
  if (tags.admin.prodProcessedCount && tags.admin.prodProcessedCount.length > 0) {
    tags.admin.prodProcessedCount[0].id = 3
    tags.admin.prodProcessedCount[0].name = 'Finished Goods'
    tags.admin.prodProcessedCount[0].unit = 'Each'
    tags.admin.prodProcessedCount[0].count = 0
    tags.admin.prodProcessedCount[0].accCount = 0
  }

  return setInterval(() => {
  // Simulation is periodically evaluated
    if (state) {
      if (state.state === 'execute') {
        // Rate Flicker
        const flicker = exports.weightedRandom(isCurMachSpeedFlicker)
        if (flicker === 'flick') {
          if (tags.status.curMachSpeed > 0.0) {
            tags.status.curMachSpeed = tags.status.curMachSpeed + (2.5 - 5 * exports.randomBoxMuller())
          }
        }

        // Check if wildly different from speed setpoint
        if (Math.abs(tags.status.curMachSpeed - tags.status.machSpeed) > 0.05 * tags.admin.machDesignSpeed) {
          // Slowly make up different
          let extraSpeed = (tags.status.machSpeed - tags.status.curMachSpeed) * 0.1
          extraSpeed = Math.abs(extraSpeed) > 0.05 * tags.admin.machDesignSpeed ? extraSpeed : 0.05 * tags.admin.machDesignSpeed * (extraSpeed > 0 ? 1 : -1)
          // Check if new difference within range
          if (Math.abs(tags.status.curMachSpeed + extraSpeed - tags.status.machSpeed) < 0.05 * tags.admin.machDesignSpeed) {
            // Clamp to new Speed
            tags.status.curMachSpeed = tags.status.machSpeed
          } else {
            // Ramp
            tags.status.curMachSpeed = tags.status.curMachSpeed + extraSpeed
          }
        }

        // Chance of Suspending
        const diceRoll = exports.weightedRandom(executeAvailabilityProbabilities)
        if (diceRoll === 'suspend') {
          state.suspend()
        }
      } else if (state.state === 'suspended') {
        if (tags.status.curMachSpeed !== 0.0) {
          tags.status.curMachSpeed = 0.0
        }

        // Chance of Unsuspend
        const diceRoll = exports.weightedRandom(executeUnspendProbabilities)
        if (diceRoll === 'unsuspend') {
          state.unsuspend()
        }
      } else if (state.state === 'starting' || state.state === 'unsuspending' || state.state === 'unholding') {
        // Ramp Up Speed
        const s = tags.status.curMachSpeed + (tags.status.machSpeed * 1.0 / (state.transitioning._idleTimeout / 1000.0))
        tags.status.curMachSpeed = s > tags.status.machSpeed ? tags.status.machSpeed : s
      } else if (state.state === 'completing' || state.state === 'stopping' || state.state === 'aborting' || state.state === 'holding' || state.state === 'suspending') {
        // Ramp Down Speed
        const s = tags.status.curMachSpeed - (tags.status.machSpeed * 1.0 / (state.transitioning._idleTimeout / 1000.0))
        tags.status.curMachSpeed = s < 0.0 ? 0.0 : s
      } else if (state.state === 'stopped' || state.state === 'aborted' || state.state === 'held' || state.state === 'complete' || state.state === 'idle') {
        // Reset Speed
        if (tags.status.curMachSpeed !== 0.0) {
          tags.status.curMachSpeed = 0.0
        }
      } else if (state.state === 'resetting') {
        // Reset Admin Counts
        tags.admin.prodConsumedCount.forEach((counter) => {
          if (counter.count !== 0) {
            counter.count = 0
          }
        })
        tags.admin.prodDefectiveCount.forEach((counter) => {
          if (counter.count !== 0) {
            counter.count = 0
          }
        })
        tags.admin.prodProcessedCount.forEach((counter) => {
          if (counter.count !== 0) {
            counter.count = 0
          }
        })
      }

      if (tags.status.curMachSpeed > 0) {
        // Consume
        tags.admin.prodConsumedCount[0].count += tags.status.curMachSpeed / 60.0
        tags.admin.prodConsumedCount[0].accCount += tags.status.curMachSpeed / 60.0

        // Produce
        const diceRoll = exports.weightedRandom(executeQualityProbabilities)
        if (diceRoll === 'good') {
          tags.admin.prodProcessedCount[0].count += tags.status.curMachSpeed / 60.0
          tags.admin.prodProcessedCount[0].accCount += tags.status.curMachSpeed / 60.0
        } else {
          tags.admin.prodDefectiveCount[0].count += tags.status.curMachSpeed / 60.0
          tags.admin.prodDefectiveCount[0].accCount += tags.status.curMachSpeed / 60.0
        }
      }
    }
  }, millis)
}
