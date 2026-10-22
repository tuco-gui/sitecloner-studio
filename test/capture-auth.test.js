'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {isAuthorized}=require('../lib/capture-auth');
test('deny when key unconfigured',()=>assert.equal(isAuthorized({headers:{'x-sitecloner-key':'x'}},''),false));
test('deny when key missing',()=>assert.equal(isAuthorized({headers:{}},'correct'),false));
test('deny wrong credential',()=>assert.equal(isAuthorized({headers:{'x-sitecloner-key':'wrong'}},'correct'),false));
test('accept correct credential',()=>assert.equal(isAuthorized({headers:{'x-sitecloner-key':'correct'}},'correct'),true));
