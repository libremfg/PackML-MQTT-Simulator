// Constants
const site = process.env.SITE || "Site";
const area = process.env.AREA || "Area";
const line = process.env.LINE || "Line";
const startOnLoad = process.env.START || true;
const MQTT_URL = process.env.MQTT_URL || "mqtt://broker.hivemq.com";
const MQTT_USERNAME = process.env.MQTT_USERNAME || "";
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || "";
const topicPrefix = `${site}/${area}/${line}`

// Imports
var StateMachine = require('javascript-state-machine');
var mqtt = require('mqtt');
var seedrandom = require('seedrandom');
var helper = require('./helper')
seedrandom(topicPrefix, {global: true});

// Variables
const setupTime = Math.round(helper.randomBoxMuller() * 30);
const rampTime = helper.randomBoxMuller() * 5;
var mqttClient  = mqtt.connect(MQTT_URL, {username: MQTT_USERNAME, password: MQTT_PASSWORD});
var UnitMode = null;
var State = null;
var startingTime = Math.round(helper.randomBoxMuller() * 10000);
var stoppingTime = Math.round(helper.randomBoxMuller() * 10000);

var packML = require("./config.json")

// Set Chances for this machine
const executeAvailabilityProbabilities = {"nothing": 0.9985, "suspend": 0.0015};
let good = 0.9 + helper.randomBoxMuller() * 0.1 ; 
const executeQualityProbabilities = {"good":good, "bad": 1.0 - good};
const executeUnspendProbabilities = {"nothing": 0.995, "unsuspend": 0.005};

const isCurMachSpeedFlicker = {"flick":0.2, "nothing":0.8};

var startedOnce = false;

function stateChangeTime() {
    return Math.round(Math.random() * 10000);
}

mqttClient.on('message', (topic, message, packet) => {
    let asInteger = parseInt(message);

    let parameterId = new RegExp(String.raw`${topicPrefix.replace("/","\/")}\/Command\/Parameter\/\d*\/ID`, 'g');
    let parameterName = new RegExp(String.raw`${topicPrefix.replace("/","\/")}\/Command\/Parameter\/\d*\/Name`, 'g');
    let parameterUnit = new RegExp(String.raw`${topicPrefix.replace("/","\/")}\/Command\/Parameter\/\d*\/Unit`, 'g');
    let parameterValue = new RegExp(String.raw`${topicPrefix.replace("/","\/")}\/Command\/Parameter\/\d*\/Value`, 'g');
    let productId = new RegExp(String.raw`${topicPrefix.replace("/","\/")}\/Command\/Product\/\d*\/ID`, 'g');
    let productProcessParameterId = new RegExp(String.raw`${topicPrefix.replace("/","\/")}\/Command\/Product\/\d*\/ProcessParameter\/\d*\/ID`, 'g');
    let productProcessParameterName = new RegExp(String.raw`${topicPrefix.replace("/","\/")}\/Command\/Product\/\d*\/ProcessParameter\/\d*\/Name`, 'g');
    let productProcessParameterUnit = new RegExp(String.raw`${topicPrefix.replace("/","\/")}\/Command\/Product\/\d*\/ProcessParameter\/\d*\/Unit`, 'g');
    let productProcessParameterValue = new RegExp(String.raw`${topicPrefix.replace("/","\/")}\/Command\/Product\/\d*\/ProcessParameter\/\d*\/Value`, 'g');
    let productIngredientId = new RegExp(String.raw`${topicPrefix.replace("/","\/")}\/Command\/Product\/\d*\/Ingredient\/\d*\/ID`, 'g');
    let productIngredientParameterID = new RegExp(String.raw`${topicPrefix.replace("/","\/")}\/Command\/Product\/\d*\/Ingredient\/\d*\/Parameter\/\d*\/ID`, 'g');

    if (topic === `${topicPrefix}/Command/Start`) {
        if (isNaN(asInteger) || asInteger === 0) return;
        if (State) {
            try {
                State.start();
            } catch (e) {
                return;
            }
        }
    } else if (topic === `${topicPrefix}/Command/Reset`){
        if (isNaN(asInteger) || asInteger === 0) return;
        if (State) {
            try {
                State.reset();
            } catch (e) {
                return;
            }
        }
    } else if (topic === `${topicPrefix}/Command/Complete`){
        if (isNaN(asInteger) || asInteger === 0) return;
        if (State) {
            try {
                State.sc();
            } catch (e) {
                return;
            }
        }
    } else if (topic ===  `${topicPrefix}/Command/Stop`) {
        if (isNaN(asInteger) || asInteger === 0) return;
        if (State) {
            try {
                State.stop();
            } catch (e) {
                return;
            }
        }
    } else if (topic === `${topicPrefix}/Command/Abort`){
        if (isNaN(asInteger) || asInteger === 0) return;
        if (State) {
            try {
                State.abort();
            } catch (e) {
                return;
            }
        }
    } else if (topic === `${topicPrefix}/Command/Clear`){
        if (isNaN(asInteger) || asInteger === 0) return;
        if (State) {
            try {
                State.clear();
            } catch (e) {
                return;
            }
        }
    } else if (topic === `${topicPrefix}/Command/Hold`) {
        if (isNaN(asInteger) || asInteger === 0) return;
        if (State) {
            try {
                State.hold();
            } catch (e) {
                return;
            }
        }
    } else if (topic === `${topicPrefix}/Command/Unhold`) {
        if (isNaN(asInteger) || asInteger === 0) return;
        if (State) {
            try {
                State.unhold();
            } catch (e) {
                return;
            }
        }
    } else if (topic === `${topicPrefix}/Command/UnitMode`) {
        mqttClient.publish(`${topicPrefix}/Status/UnitModeRequested`, true);
        switch (message) {
            case 'Production':
            case 1:
                try {
                    UnitMode.production();
                } catch (e) {
                    break;
                }
                break;
            case 'Maintenance':
            case 2:
                try {
                    UnitMode.maintenace();
                } catch (e) {
                    break;
                }
                break;
            case 'Manual':
            case 3:
                try {
                    UnitMode.manual();
                } catch (e) {
                    break;
                }
                break;
            default:
                console.log("Not sure how to handle UnitMode command: " + message);
        }
        mqttClient.publish(`${topicPrefix}/Status/UnitModeRequested`, false);
    } else if (topic === `${topicPrefix}/Command/MachSpeed`) {
        let value = parseFloat(message);
        if (!isNaN(value)) {
            packML.status.machSpeed = value;
            mqttClient.publish(`${topicPrefix}/Status/MachSpeed`, packML.status.machSpeed);
        }
    } else if (topic === `${topicPrefix}/Command/CntrlCmd`) {
        let integerActions = [
            [1, () => state.goto('clearing')],
            [2, () => state.goto('stopped')],
            [3, () => state.goto('starting')],
            [4, () => state.goto('idle')],
            [5, () => state.goto('suspended')],
            [6, () => state.goto('execute')],
            [7, () => state.goto('stopping')],
            [8, () => state.goto('aborting')],
            [9, () => state.goto('aborted')],
            [10, () => state.goto('holding')],
            [11, () => state.goto('held')],
            [12, () => state.goto('unholding')],
            [13, () => state.goto('suspending')],
            [14, () => state.goto('unsuspending')],
            [15, () => state.goto('resetting')],
            [16, () => state.goto('completing')],
            [17, () => state.goto('complete')],
        ];
        for (let i = 0; i < integerActions.length; i++){
            if (asInteger === integerActions[i][0]) {
                try {
                    integerActions[i][1]();
                } catch (e) {
                    return;
                }
            }
        }
    } else if (topic.match(parameterId)) {
        let index = topic.replace(`${topicPrefix}/Command/Parameter/`, '').replace('/ID', '');
        index = parseInt(index);
        let id = parseInt(message);
        if (!isNaN(index) && !isNaN(id)){
            while ((index + 1) > packML.status.parameter.length) {
                packML.status.parameter.push({});
            }
            packML.status.parameter[index].id = id;
            mqttClient.publish(`${topicPrefix}/Status/Parameter/${index}/ID`, packML.status.parameter[index].id.toString(), {retain: true});
        }   
    } else if (topic.match(parameterName)) {
        let index = topic.replace(`${topicPrefix}/Command/Parameter/`, '').replace('/Name', '');
        index = parseInt(index);
        let dec = new TextDecoder("utf-8");
        message = dec.decode(message);
        if (!isNaN(index)){
            while ((index + 1) > packML.status.parameter.length) {
                packML.status.parameter.push({});
            }
            packML.status.parameter[index].Name = message;
            mqttClient.publish(`${topicPrefix}/Status/Parameter/${index}/Name`, packML.status.parameter[index].Name, {retain: true});
        }
    } else if (topic.match(parameterUnit)) {
        let index = topic.replace(`${topicPrefix}/Command/Parameter/`, '').replace('/Unit', '');
        index = parseInt(index);
        let dec = new TextDecoder("utf-8");
        message = dec.decode(message);
        if (!isNaN(index)){
            while ((index + 1) > packML.status.parameter.length) {
                packML.status.parameter.push({});
            }
            packML.status.parameter[index].Unit = message;
            mqttClient.publish(`${topicPrefix}/Status/Parameter/${index}/Unit`, packML.status.parameter[index].Unit, {retain: true});
        }        
    } else if (topic.match(parameterValue)) {
        let index = topic.replace(`${topicPrefix}/Command/Parameter/`, '').replace('/ID', '');
        index = parseInt(index);
        let value = parseFloat(message);
        if (!isNaN(index) && !isNaN(value)){
            while ((index + 1) > packML.status.parameter.length) {
                packML.status.parameter.push({});
            }
            packML.status.parameter[index].Value = value;
            mqttClient.publish(`${topicPrefix}/Status/Parameter/${index}/Value`, packML.status.parameter[index].Value.toString(), {retain: true});
        }   
    } else if (topic.match(productId)) {
        let index = topic.replace(`${topicPrefix}/Command/Product/`, '').replace('/Value', '');
         index = parseInt(index);
        let id = parseInt(message);
        if (!isNaN(index) && !isNaN(id)){
            while ((index + 1) > packML.status.product.length) {
                packML.status.product.push({id:null, ingredient: [], processParameter: []});
            }
            packML.status.product[index].id = id;
            mqttClient.publish(`${topicPrefix}/Status/Product/${index}/ID`, packML.status.product[index].id.toString(), {retain: true});
        }
    } else if (topic.match(productProcessParameterId)) {
        let productIndex = topic.replace(`${topicPrefix}/Command/Product/`, '').replace(/\/ProcessParameter\/\d*\/ID/g, '');
        productIndex = parseInt(productIndex);
        let processVariableIndex = topic.replace(`${topicPrefix}/Command/Product/`, '').replace(/\d*\/ProcessParameter\//g, '').replace('/ID', '');
        processVariableIndex = parseInt(processVariableIndex);
        let id = parseInt(message);
        if (!isNaN(productIndex) && !isNaN(id) && !isNaN(processVariableIndex)){
            while ((productIndex + 1) > packML.status.product.length) {
                packML.status.product.push({id:null, ingredient: [], processParameter: []});
            }
            while ((processVariableIndex + 1) > packML.status.product[productIndex].processParameter.length) {
                packML.status.product[productIndex].processParameter.push({})
            }
            packML.status.product[productIndex].processParameter[processVariableIndex].id = id;
            mqttClient.publish(`${topicPrefix}/Status/Product/${productIndex}/ProcessParameter/${processVariableIndex}/ID`, packML.status.product[productIndex].processParameter[processVariableIndex].id.toString(), {retain: true});
        }
    } else if (topic.match(productProcessParameterName)) {
        let productIndex = topic.replace(`${topicPrefix}/Command/Product/`, '').replace(/\/ProcessParameter\/\d*\/Name/g, '');
        productIndex = parseInt(productIndex);
        let processVariableIndex = topic.replace(`${topicPrefix}/Command/Product/`, '').replace(/\d*\/ProcessParameter\//g, '').replace('/Name', '');
        processVariableIndex = parseInt(processVariableIndex);
        let dec = new TextDecoder("utf-8");
        message = dec.decode(message);
        if (!isNaN(productIndex) && !isNaN(processVariableIndex)){
            while ((productIndex + 1) > packML.status.product.length) {
                packML.status.product.push({id:null, ingredient: [], processParameter: []});
            }
            while ((processVariableIndex + 1) > packML.status.product[productIndex].processParameter.length) {
                packML.status.product[productIndex].processParameter.push({})
            }
            packML.status.product[productIndex].processParameter[processVariableIndex].Name = message;
            mqttClient.publish(`${topicPrefix}/Status/Product/${productIndex}/ProcessParameter/${processVariableIndex}/Name`, packML.status.product[productIndex].processParameter[processVariableIndex].Name, {retain: true});
        }
    } else if (topic.match(productProcessParameterUnit)) {
        let productIndex = topic.replace(`${topicPrefix}/Command/Product/`, '').replace(/\/ProcessParameter\/\d*\/Unit/g, '');
        productIndex = parseInt(productIndex);
        let processVariableIndex = topic.replace(`${topicPrefix}/Command/Product/`, '').replace(/\d*\/ProcessParameter\//g, '').replace('/Unit', '');
        processVariableIndex = parseInt(processVariableIndex);
        let dec = new TextDecoder("utf-8");
        message = dec.decode(message);
        if (!isNaN(productIndex) && !isNaN(processVariableIndex)){
            while ((productIndex + 1) > packML.status.product.length) {
                packML.status.product.push({id:null, ingredient: [], processParameter: []});
            }
            while ((processVariableIndex + 1) > packML.status.product[productIndex].processParameter.length) {
                packML.status.product[productIndex].processParameter.push({})
            }
            packML.status.product[productIndex].processParameter[processVariableIndex].Unit = message;
            mqttClient.publish(`${topicPrefix}/Status/Product/${productIndex}/ProcessParameter/${processVariableIndex}/Unit`, packML.status.product[productIndex].processParameter[processVariableIndex].Unit, {retain: true});
        }
    } else if (topic.match(productProcessParameterValue)) {
        let productIndex = topic.replace(`${topicPrefix}/Command/Product/`, '').replace(/\/ProcessParameter\/\d*\/Unit/g, '');
        productIndex = parseInt(productIndex);
        let processVariableIndex = topic.replace(`${topicPrefix}/Command/Product/`, '').replace(/\d*\/ProcessParameter\//g, '').replace('/Unit', '');
        processVariableIndex = parseInt(processVariableIndex);
        let value = parseFloat(message);
        if (!isNaN(productIndex) && !isNaN(processVariableIndex) && !isNaN(value)){
            while ((productIndex + 1) > packML.status.product.length) {
                packML.status.product.push({id:null, ingredient: [], processParameter: []});
            }
            while ((processVariableIndex + 1) > packML.status.product[productIndex].processParameter.length) {
                packML.status.product[productIndex].processParameter.push({})
            }
            packML.status.product[productIndex].processParameter[processVariableIndex].value = value;
            mqttClient.publish(`${topicPrefix}/Status/Product/${productIndex}/ProcessParameter/${processVariableIndex}/Value`, packML.status.product[productIndex].processParameter[processVariableIndex].value.toString(), {retain: true});
        }
    } else if (topic.match(productIngredientId)) {
        let productIndex = topic.replace(`${topicPrefix}/Command/Product/`, '').replace(/\/Ingredient\/\d*\/ID/g, '');
        productIndex = parseInt(productIndex);
        let ingredientIndex = topic.replace(`${topicPrefix}/Command/Product/`, '').replace(/\d*\/Ingredient\//g, '').replace('/ID', '');
        ingredientIndex = parseInt(ingredientIndex);
        let id = parseInt(message);
        if (!isNaN(productIndex) && !isNaN(ingredientIndex) && !isNaN(id) ){
            while ((productIndex + 1) > packML.status.product.length) {
                packML.status.product.push({id:null, ingredient: [], processParameter: []});
            }
            while ((ingredientIndex + 1) > packML.status.product[productIndex].ingredient.length) {
                packML.status.product[productIndex].ingredient.push({parameter: []})
            }
            packML.status.product[productIndex].ingredient[ingredientIndex].id = id;
            mqttClient.publish(`${topicPrefix}/Status/Product/${productIndex}/Ingredient/${ingredientIndex}/ID`, packML.status.product[productIndex].ingredient[ingredientIndex].id.toString());
        }
    } else if (topic.match(productIngredientParameterID)) {
        let productIndex = topic.replace(`${topicPrefix}/Command/Product/`, '').replace(/\/Ingredient\/\d*\/Parameter\/\d*\/ID/g, '');
        productIndex = parseInt(productIndex);
        let ingredientIndex = topic.replace(`${topicPrefix}/Command/Product/`, '').replace(/\d*\/Ingredient\//g, '').replace(/\/Parameter\/\d*\/ID/g, '');
        ingredientIndex = parseInt(ingredientIndex);
        let parameterIndex = topic.replace(`${topicPrefix}/Command/Product/`, '').replace(/\d*\/Ingredient\/\d*\/Parameter\//g, '').replace('/ID', '');
        parameterIndex = parseInt(parameterIndex);
        let id = parseInt(message);
        if (!isNaN(productIndex) && !isNaN(ingredientIndex) && !isNaN(id) && !isNaN(parameterIndex)){
            while ((productIndex + 1) > packML.status.product.length) {
                packML.status.product.push({id:null, ingredient: [], processParameter: []});
            }
            while ((ingredientIndex + 1) > packML.status.product[productIndex].ingredient.length) {
                packML.status.product[productIndex].ingredient.push({parameter: []})
            }
            while ((parameterIndex + 1) > packML.status.product[productIndex].ingredient[ingredientIndex].length) {
                packML.status.product[productIndex].ingredient[ingredientIndex].parameter.push({});
            }
            packML.status.product[productIndex].ingredient[ingredientIndex].parameter[parameterIndex].id = id;
            mqttClient.publish(`${topicPrefix}/Status/Product/${productIndex}/Ingredient/${ingredientIndex}/Parameter/${parameterIndex}/ID`, packML.status.product[productIndex].ingredient[ingredientIndex].parameter[parameterIndex].id.toString(), {retain: true});
        }
    } else if (topic.match(/`${topicPrefix}\/Command\/Product\/\d*\/Ingredient\/\d*\/Parameter\/\d*\/Name/g)) {
        let productIndex = topic.replace(`${topicPrefix}/Command/Product/`, '').replace(/\/Ingredient\/\d*\/Parameter\/\d*\/Name/g, '');
        productIndex = parseInt(productIndex);
        let ingredientIndex = topic.replace(`${topicPrefix}/Command/Product/`, '').replace(/\d*\/Ingredient\//g, '').replace(/\/Parameter\/\d*\/Name/g, '');
        ingredientIndex = parseInt(ingredientIndex);
        let parameterIndex = topic.replace(`${topicPrefix}/Command/Product/`, '').replace(/\d*\/Ingredient\/\d*\/Parameter\//g, '').replace('/Name', '');
        parameterIndex = parseInt(parameterIndex);
        let dec = new TextDecoder("utf-8");
        message = dec.decode(message);
        if (!isNaN(productIndex) && !isNaN(ingredientIndex) && !isNaN(parameterIndex)){
            while ((productIndex + 1) > packML.status.product.length) {
                packML.status.product.push({id:null, ingredient: [], processParameter: []});
            }
            while ((ingredientIndex + 1) > packML.status.product[productIndex].ingredient.length) {
                packML.status.product[productIndex].ingredient.push({parameter: []})
            }
            while ((parameterIndex + 1) > packML.status.product[productIndex].ingredient[ingredientIndex].length) {
                packML.status.product[productIndex].ingredient[ingredientIndex].parameter.push({});
            }
            packML.status.product[productIndex].ingredient[ingredientIndex].Parameter[parameterIndex].Name = message;
            mqttClient.publish(`${topicPrefix}/Status/Product/${productIndex}/Ingredient/${ingredientIndex}/Parameter/${parameterIndex}/Name`, packML.status.product[productIndex].ingredient[ingredientIndex].Parameter[parameterIndex].Name, {retain: true});
        }
    } else if (topic.match(/`${topicPrefix}\/Command\/Product\/\d*\/Ingredient\/\d*\/Parameter\/\d*\/Unit/g)) {
        let productIndex = topic.replace(`${topicPrefix}/Command/Product/`, '').replace(/\/Ingredient\/\d*\/Parameter\/\d*\/Unit/g, '');
        productIndex = parseInt(productIndex);
        let ingredientIndex = topic.replace(`${topicPrefix}/Command/Product/`, '').replace(/\d*\/Ingredient\//g, '').replace(/\/Parameter\/\d*\/Unit/g, '');
        ingredientIndex = parseInt(ingredientIndex);
        let parameterIndex = topic.replace(`${topicPrefix}/Command/Product/`, '').replace(/\d*\/Ingredient\/\d*\/Parameter\//g, '').replace('/Unit', '');
        parameterIndex = parseInt(parameterIndex);
        let dec = new TextDecoder("utf-8");
        message = dec.decode(message);
        if (!isNaN(productIndex) && !isNaN(ingredientIndex) && !isNaN(parameterIndex)){
            while ((productIndex + 1) > packML.status.product.length) {
                packML.status.product.push({id:null, ingredient: [], processParameter: []});
            }
            while ((ingredientIndex + 1) > packML.status.product[productIndex].ingredient.length) {
                packML.status.product[productIndex].ingredient.push({parameter: []})
            }
            while ((parameterIndex + 1) > packML.status.product[productIndex].ingredient[ingredientIndex].length) {
                packML.status.product[productIndex].ingredient[ingredientIndex].parameter.push({});
            }
            packML.status.product[productIndex].ingredient[ingredientIndex].Parameter[parameterIndex].Unit = message;
            mqttClient.publish(`${topicPrefix}/Status/Product/${productIndex}/Ingredient/${ingredientIndex}/Parameter/${parameterIndex}/Unit`, packML.status.product[productIndex].ingredient[ingredientIndex].Parameter[parameterIndex].Unit, {retain: true});
        }
    } else if (topic.match(/`${topicPrefix}\/Command\/Product\/\d*\/Ingredient\/\d*\/Parameter\/\d*\/Value/g)) {
        let productIndex = topic.replace(`${topicPrefix}/Command/Product/`, '').replace(/\/Ingredient\/\d*\/Parameter\/\d*\/Value/g, '');
        productIndex = parseInt(productIndex);
        let ingredientIndex = topic.replace(`${topicPrefix}/Command/Product/`, '').replace(/\d*\/Ingredient\//g, '').replace(/\/Parameter\/\d*\/Value/g, '');
        ingredientIndex = parseInt(ingredientIndex);
        let parameterIndex = topic.replace(`${topicPrefix}/Command/Product/`, '').replace(/\d*\/Ingredient\/\d*\/Parameter\//g, '').replace('/Value', '');
        parameterIndex = parseInt(parameterIndex);
        let value = parseFloat(message);
        if (!isNaN(productIndex) && !isNaN(ingredientIndex) && !isNaN(parameterIndex) && !isNaN(value)){
            while ((productIndex + 1) > packML.status.product.length) {
                packML.status.product.push({id:null, ingredient: [], processParameter: []});
            }
            while ((ingredientIndex + 1) > packML.status.product[productIndex].ingredient.length) {
                packML.status.product[productIndex].ingredient.push({parameter: []})
            }
            while ((parameterIndex + 1) > packML.status.product[productIndex].ingredient[ingredientIndex].length) {
                packML.status.product[productIndex].ingredient[ingredientIndex].parameter.push({});
            }
            packML.status.product[productIndex].ingredient[ingredientIndex].Parameter[parameterIndex].Value = value;
            mqttClient.publish(`${topicPrefix}/Status/Product/${productIndex}/Ingredient/${ingredientIndex}/Parameter/${parameterIndex}/Value`, packML.status.product[productIndex].ingredient[ingredientIndex].Parameter[parameterIndex].Value.toString(), {retain: true});
        }
    } else {
        console.log("No function associated with: " + topic);
    }
});

function updateUnitMode(){
    console.log("UnitMode: " + helper.titleCase(UnitMode.state))
    if (mqttClient.connected) {
        mqttClient.publish(`${topicPrefix}/Status/UnitMode`, helper.titleCase(UnitMode.state), {retain: true});
    }
}

function updateState(){
    console.log("StateCurrent: " + helper.titleCase(State.state))
    if (mqttClient.connected) {
        mqttClient.publish(`${topicPrefix}/Status/StateCurrent`, helper.titleCase(State.state), {retain: true});
    }
}

function sendValuesOnStart(){
    if (mqttClient.connected) {
        mqttClient.publish(`${topicPrefix}/Admin/MachDesignSpeed`, packML.admin.machDesignSpeed+'');
        mqttClient.publish(`${topicPrefix}/Status/MachSpeed`, packML.status.machSpeed+'');
        mqttClient.publish(`${topicPrefix}/Status/CurMachSpeed`, packML.status.curMachSpeed+'');
        mqttClient.publish(`${topicPrefix}/Admin/ProdDefectiveCount/0/ID`, packML.admin.prodDefectiveCount[0].id.toString(), {retain: true})
        mqttClient.publish(`${topicPrefix}/Admin/ProdDefectiveCount/0/Name`, packML.admin.prodDefectiveCount[0].name, {retain: true})
        mqttClient.publish(`${topicPrefix}/Admin/ProdDefectiveCount/0/Unit`, packML.admin.prodDefectiveCount[0].unit, {retain: true})

        mqttClient.publish(`${topicPrefix}/Admin/ProdProcessedCount/0/ID`, packML.admin.prodProcessedCount[0].id.toString(), {retain: true})
        mqttClient.publish(`${topicPrefix}/Admin/ProdProcessedCount/0/Name`, packML.admin.prodProcessedCount[0].name, {retain: true})
        mqttClient.publish(`${topicPrefix}/Admin/ProdProcessedCount/0/Unit`, packML.admin.prodProcessedCount[0].unit, {retain: true})
    }
}

mqttClient.on('connect', (connack) => {
    
    mqttClient.publish(`${topicPrefix}/PLC`, 'Simulated');

    UnitMode = new StateMachine({
        init: 'undefined',
        transitions: [
            { name: 'production', from: 'manual', to: 'production'},
            { name: 'production', from: 'maintenance', to: 'production'},
            { name: 'manual', from: 'production', to: 'manual'},
            { name: 'manual', from: 'maintenance', to: 'manual'},
            { name: 'maintenance', from: 'production', to: 'maintenance'},
            { name: 'maintenance', from: 'manual', to: 'maintenance'},
            { name: 'production', from: 'undefined', to: 'production'}
        ],
        methods: {
            onEnterProduction: function() { updateUnitMode() },
            onEnterManual: function() { updateUnitMode() },
            onEnterMaintenance: function() { updateUnitMode() },
        }
    });
    
    State = new StateMachine({
        init: 'undefined',
        transitions: [
            { name: 'reset', from: 'complete', to: 'resetting'},
            { name: 'reset', from: 'stopped', to: 'resetting'},
            { name: 'stop', from: 'resetting', to: 'stopping'},
            { name: 'stop', from: 'idle', to: 'stopping'},
            { name: 'stop', from: 'starting', to: 'stopping'},
            { name: 'stop', from: 'execute', to: 'stopping'},
            { name: 'stop', from: 'unholding', to: 'stopping'},
            { name: 'stop', from: 'held', to: 'stopping'},
            { name: 'stop', from: 'holding', to: 'stopping'},
            { name: 'stop', from: 'unsuspending', to: 'stopping'},
            { name: 'stop', from: 'suspending', to: 'stopping'},
            { name: 'stop', from: 'suspended', to: 'stopping'},
            { name: 'stop', from: 'completing', to: 'stopping'},
            { name: 'stop', from: 'complete', to: 'stopping'},
            { name: 'start', from: 'idle', to: 'starting'},
            { name: 'hold', from: 'execute', to: 'holding'},
            { name: 'unhold', from: 'held', to: 'unholding'},
            { name: 'suspend', from: 'execute', to: 'suspending'},
            { name: 'unsuspend', from: 'suspended', to: 'unsuspending'},
            { name: 'abort', from: 'resetting', to: 'aborting'},
            { name: 'abort', from: 'idle', to: 'aborting'},
            { name: 'abort', from: 'starting', to: 'aborting'},
            { name: 'abort', from: 'execute', to: 'aborting'},
            { name: 'abort', from: 'unholding', to: 'aborting'},
            { name: 'abort', from: 'held', to: 'aborting'},
            { name: 'abort', from: 'holding', to: 'aborting'},
            { name: 'abort', from: 'unsuspending', to: 'aborting'},
            { name: 'abort', from: 'suspending', to: 'aborting'},
            { name: 'abort', from: 'suspended', to: 'aborting'},
            { name: 'abort', from: 'completing', to: 'aborting'},
            { name: 'abort', from: 'complete', to: 'aborting'},
            { name: 'clear', from: 'aborted', to: 'clearing'},
            { name: 'clear', from: 'undefined', to: 'clearing'},
            { name: 'sc', from: 'stopping', to: 'stopped'},
            { name: 'sc', from: 'clearing', to: 'stopped'},
            { name: 'sc', from: 'aborting', to: 'aborted'},
            { name: 'sc', from: 'resetting', to: 'idle'},
            { name: 'sc', from: 'starting', to: 'execute'},
            { name: 'sc', from: 'holding', to: 'held'},
            { name: 'sc', from: 'unholding', to: 'execute'},
            { name: 'sc', from: 'suspending', to: 'suspended'},
            { name: 'sc', from: 'unsuspending', to: 'execute'},
            { name: 'sc', from: 'execute', to: 'completing'},
            { name: 'sc', from: 'completing', to: 'complete'},
            { name: 'goto', from: '*', to: function(s) { return s } }
            
        ],
        methods: {
            onEnterClearing: function(){
                updateState();
                setTimeout(()=>{State.sc()}, stateChangeTime());
            },
            onEnterStopping: function(){
                updateState();
                setTimeout(()=>{State.sc()}, stoppingTime)
            },
            onEnterStopped: function(){
                updateState();
                if (!startedOnce && startOnLoad) {
                    setTimeout(()=>{State.reset();},2000);
                }
            },
            onEnterResetting: function(){
                updateState();
                setTimeout(()=>{State.sc()}, stateChangeTime())
            },
            onEnterIdle: function(){
                updateState();
                packML.admin.prodConsumedCount.forEach((prodConsumedCount) => {
                    prodConsumedCount.count = 0.0;
                });
                packML.admin.prodProcessedCount.forEach((prodProcessedCount) => {
                    prodProcessedCount.count = 0.0;
                });
                packML.admin.prodDefectiveCount.forEach((prodDefectiveCount) => {
                    prodDefectiveCount.count = 0.0;
                });
                if (!startedOnce && startOnLoad) {
                    setTimeout(()=>{State.start();},2000);
                    startedOnce = true;
                }
            },
            onEnterStarting: function(){
                updateState();
                sendValuesOnStart();
                setTimeout(()=>{State.sc()}, startingTime)
            },
            onEnterExecute: function(){
                updateState();
            },
            onEnterHolding: function(){
                updateState();
                setTimeout(()=>{State.sc()}, stoppingTime)
            },
            onEnterHeld: function(){
                updateState();
            },
            onEnterUnholding: function(){
                updateState();
                setTimeout(()=>{State.sc()}, startingTime)
            },
            onEnterSuspending: function(){
                updateState();
                setTimeout(()=>{State.sc()}, stoppingTime)
            },
            onEnterSuspended: function(){
                updateState();
            },
            onEnterUnsuspending: function(){
                updateState();
                setTimeout(()=>{State.sc()}, startingTime)
            },
            onEnterCompleting: function(){
                updateState();
                setTimeout(()=>{State.sc()}, stoppingTime)
            },
            onEnterComplete: function(){
                updateState();
            },
            onEnterAborting: function(){
                updateState();
                setTimeout(()=>{State.sc()}, stoppingTime)
            },
            onEnterAborted: function(){
                updateState();
            },
        }
    });

    UnitMode.production();
    State.clear();

    mqttClient.subscribe([
        `${topicPrefix}/Command/#`
    ]);
});

setInterval(()=> {
        if (State !== undefined && State !== null) {
            // Produced
            if (State.state === 'execute') {

                // Rate Flicker
                let flicker = helper.weightedRandom(isCurMachSpeedFlicker);
                if (flicker === 'flick') {
                    if (packML.status.curMachSpeed > 0.0) {
                        packML.status.curMachSpeed = packML.status.curMachSpeed + (2.5 - 5 * helper.randomBoxMuller());
                        mqttClient.publish(`${topicPrefix}/Status/CurMachSpeed`, packML.status.curMachSpeed.toString(), {retain: true});
                    }
                }

                // Produce
                let diceRoll = helper.weightedRandom(executeQualityProbabilities)
                if (diceRoll === 'good') {
                    packML.admin.prodProcessedCount[0].count += packML.status.curMachSpeed / 60.0;
                    packML.admin.prodProcessedCount[0].accCount += packML.status.curMachSpeed / 60.0;
                    mqttClient.publish(`${topicPrefix}/Admin/ProdProcessedCount/0/Count`, Math.round(packML.admin.prodProcessedCount[0].count).toString(), {retain: true})
                    mqttClient.publish(`${topicPrefix}/Admin/ProdProcessedCount/0/AccCount`, Math.round(packML.admin.prodProcessedCount[0].accCount).toString(), {retain: true})    
                } else {
                    packML.admin.prodDefectiveCount[0].count += packML.status.curMachSpeed / 60.0;
                    packML.admin.prodDefectiveCount[0].accCount += packML.status.curMachSpeed / 60.0;
                    mqttClient.publish(`${topicPrefix}/Admin/ProdDefectiveCount/0/Count`, Math.round(packML.admin.prodDefectiveCount[0].count).toString(), {retain: true})
                    mqttClient.publish(`${topicPrefix}/Admin/ProdDefectiveCount/0/AccCount`, Math.round(packML.admin.prodDefectiveCount[0].accCount).toString(), {retain: true})
                }

                // Chance of Suspending
                diceRoll = helper.weightedRandom(executeAvailabilityProbabilities) 
                if (diceRoll === 'suspend') {
                    State.suspend();
                }

            } else if (State.state === 'suspended') {
                packML.status.curMachSpeed = 0.0;
                mqttClient.publish(`${topicPrefix}/Status/CurMachSpeed`, packML.status.curMachSpeed.toString(), {retain: true});
                // Unsuspend
                let diceRoll = helper.weightedRandom(executeUnspendProbabilities);
                if (diceRoll === 'unsuspend') {
                    State.unsuspend();
                }
            } else if (State.state === 'starting' || State.state === 'unsuspending' || State.state === 'unholding') {
                // Ramp Up Speed
                packML.status.curMachSpeed = packML.status.curMachSpeed + (packML.status.machSpeed * 1.0 / (startingTime/1000.0))
                if (packML.status.curMachSpeed > packML.status.machSpeed) {
                    packML.status.curMachSpeed = packML.status.machSpeed;
                }
                mqttClient.publish(`${topicPrefix}/Status/CurMachSpeed`, packML.status.curMachSpeed.toString(), {retain: true});
            } else if (State.state === 'completeing' || State.state === 'stopping' || State.state === 'aborting' || State.state === 'holding' || State.state === 'suspending') {
                // Ramp Down Speed
                packML.status.curMachSpeed = packML.status.curMachSpeed - (packML.status.machSpeed * 1.0 / (stoppingTime/1000.0))
                if (packML.status.curMachSpeed < 0.0) {
                    packML.status.curMachSpeed = 0.0;
                }
                mqttClient.publish(`${topicPrefix}/Status/CurMachSpeed`, packML.status.curMachSpeed.toString(), {retain: true});
            } else if (State.state === 'stopped' || State.state === 'aborted' || State.state === 'held' || State.state === 'complete' || State.state === 'idle') {
                packML.status.curMachSpeed = 0.0;
                mqttClient.publish(`${topicPrefix}/Status/CurMachSpeed`, packML.status.curMachSpeed.toString(), {retain: true});
            }
        }
}, 1000);
