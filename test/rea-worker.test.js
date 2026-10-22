'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {publicIp,authorized}=require('../worker/server');
test('rejects private and reserved IPs',()=>{
  for(const ip of ['127.0.0.1','10.0.1.2','172.16.10.1','192.168.0.20','169.254.1.2','::1','fc00::1'])assert.equal(publicIp(ip),false,ip);
});
test('recognizes public IPs',()=>{
  assert.equal(publicIp('8.8.8.8'),true);
  assert.equal(publicIp('1.1.1.1'),true);
});
test('denies unauthenticated requests',()=>assert.equal(authorized(),false));
