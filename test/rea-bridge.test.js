'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {validateCapture, runReaAnalysis} = require('../lib/rea-bridge');

const capture = {cdp_endpoint:'http://127.0.0.1:9222',target_id:'abc_1234',allowed_origins:['https://example.com']};

test('validates loopback CDP capture', () => {
  const result = validateCapture(capture);
  assert.equal(result.target_id, 'abc_1234');
  assert.equal(result.observation_ms, 500);
});
test('rejects CDP exposed over a remote address', () => {
  assert.throws(() => validateCapture({...capture,cdp_endpoint:'http://remote.example:9222'}), /loopback/);
});
test('rejects malformed target IDs', () => {
  assert.throws(() => validateCapture({...capture,target_id:'x'}), /target_id/);
});
test('rejects non-origin allowlist values', () => {
  assert.throws(() => validateCapture({...capture,allowed_origins:['https://example.com/private']}), /Origem/);
});
test('reports not configured without network calls', async () => {
  const prior=process.env.REA_MCP_URL;
  delete process.env.REA_MCP_URL;
  try { assert.equal((await runReaAnalysis(capture)).status,'not_configured'); }
  finally { if(prior!==undefined)process.env.REA_MCP_URL=prior; }
});
