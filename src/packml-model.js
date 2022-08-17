#!/usr/bin/env node
'use strict'

const JavascripStateMachine = require('javascript-state-machine')

// Define initial start state here
const INITIAL_START_STATE = process.env.PACKML_INITIAL_START_STATE || 'clearing'

const WAITING_STATES = ['stopped', 'idle', 'held', 'suspend', 'complete', 'aborted', 'execute', 'undefined']

const STATES = ['undefined', 'idle', 'stopped', 'starting', 'clearing', 'suspended', 'execute', 'stopping', 'aborting', 'aborted', 'holding', 'held', 'unholding', 'suspending', 'unsuspending', 'resetting', 'completing', 'complete']

const MODES = ['undefined', 'production', 'manual', 'maintenance']

exports.isUnitMode = (text) => {
  return MODES.indexOf(text) >= 0
}

exports.getStateIntByStateText = (state = 'undefined') => {
  const n = STATES.indexOf(state)
  return n < 0 ? 0 : n
}

exports.getStateTextByStateInt = (state = 0) => {
  state = state < 0 ? 0 : (state > 17 ? 0 : state)
  return STATES[state]
}

exports.getModeIntByModeText = (mode = 'undefined') => {
  const m = MODES.indexOf(mode)
  return m < 0 ? 0 : m;
}

exports.getModeTextByModeInt = (mode = 0) => {
  mode = mode < 0 ? 0 : (mode > (MODES.length - 1) ? 0 : mode)
  return MODES[mode]
}

exports.UnitMode = JavascripStateMachine.factory({
  init: 'undefined',
  transitions: [
    { name: 'production', from: 'manual', to: 'production' },
    { name: 'production', from: 'maintenance', to: 'production' },
    { name: 'manual', from: 'production', to: 'manual' },
    { name: 'manual', from: 'maintenance', to: 'manual' },
    { name: 'maintenance', from: 'production', to: 'maintenance' },
    { name: 'maintenance', from: 'manual', to: 'maintenance' },
    { name: 'production', from: 'undefined', to: 'production' },
    // additional UnitModes Here

    { name: 'goto', from: '*', to: (s) => { return s } }
  ]
})

exports.StateMachine = JavascripStateMachine.factory({
  init: 'undefined',
  transitions: [
    { name: 'reset', from: ['complete', 'stopped'], to: 'resetting' },
    {
      name: 'stop',
      from: [
        'resetting',
        'idle',
        'starting',
        'execute',
        'unholding',
        'held',
        'holding',
        'unsuspending',
        'suspending',
        'suspended',
        'completing',
        'complete'
      ],
      to: 'stopping'
    },
    { name: 'start', from: 'idle', to: 'starting' },
    { name: 'hold', from: 'execute', to: 'holding' },
    { name: 'unhold', from: 'held', to: 'unholding' },
    { name: 'suspend', from: 'execute', to: 'suspending' },
    { name: 'unsuspend', from: 'suspended', to: 'unsuspending' },
    {
      name: 'abort',
      from: [
        'resetting',
        'idle',
        'starting',
        'execute',
        'unholding',
        'held',
        'holding',
        'unsuspending',
        'suspending',
        'suspended',
        'completeing',
        'complete'
      ],
      to: 'aborting'
    },
    { name: 'clear', from: ['aborted', 'undefined'], to: 'clearing' },
    { name: 'complete', from: 'execute', to: 'completing' },
    { name: 'sc', from: 'stopping', to: 'stopped' },
    { name: 'sc', from: 'clearing', to: 'stopped' },
    { name: 'sc', from: 'aborting', to: 'aborted' },
    { name: 'sc', from: 'resetting', to: 'idle' },
    { name: 'sc', from: 'starting', to: 'execute' },
    { name: 'sc', from: 'holding', to: 'held' },
    { name: 'sc', from: 'unholding', to: 'execute' },
    { name: 'sc', from: 'suspending', to: 'suspended' },
    { name: 'sc', from: 'unsuspending', to: 'execute' },
    { name: 'sc', from: 'execute', to: 'completing' },
    { name: 'sc', from: 'completing', to: 'complete' },
    { name: 'goto', from: '*', to: (s) => { return s } }
  ],
  data: {
    transitioning: null, // Keep track if already transitioning
    stateChangeTime: () => { return Math.round(Math.random() * 9000) + 1000 } // State Changes take a random about of time between 1s - 10s.
  },
  methods: {
    onTransition: (lifecycle) => {
      if (WAITING_STATES.indexOf(lifecycle.to) < 0) {
        if (lifecycle.fsm.transitioning === null) {
          lifecycle.fsm.transitioning = setTimeout((fsm = lifecycle.fsm) => {
            fsm.sc()
            fsm.transitioning = null
          }, lifecycle.fsm.stateChangeTime())
        }
      } else {
        lifecycle.fsm.transitioning = null
      }
    },
    onEnterUndefined: (lifecycle) => {
      lifecycle.fsm.transitioning = setTimeout((fsm = lifecycle.fsm) => {
        fsm.transitioning = null
        fsm.goto(INITIAL_START_STATE)
      }, lifecycle.fsm.stateChangeTime())
    }
  }
})
