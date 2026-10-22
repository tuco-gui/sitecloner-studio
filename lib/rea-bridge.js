'use strict';

/**
 * REA bridge for a browser session co-located with the REA MCP server.
 *
 * REA's analyze_web_bundle and inspect_web_page accept only loopback CDP
 * endpoints and an exact target_id. The current Vercel-hosted Playwright
 * browser cannot be sent to the VPS as a remote CDP endpoint.
 *
 * Deliberately no browser credentials, scripts or arbitrary MCP tool calls
 * are exposed to HTTP clients. This module is server-side only.
 */
const ALLOWED = new Set(['inspect_web_page', 'analyze_web_bundle']);

function validateCapture(capture) {
  if (!capture || typeof capture !== 'object') throw new Error('Captura CDP ausente');
  const endpoint = new URL(capture.cdp_endpoint);
  if (endpoint.hostname !== '127.0.0.1' ||
      !['http:', 'ws:'].includes(endpoint.protocol)) {
    throw new Error('REA exige CDP loopback no host do próprio REA');
  }
  if (!/^[a-zA-Z0-9_-]{4,256}$/.test(capture.target_id || '')) {
    throw new Error('target_id CDP inválido');
  }
  const origins = capture.allowed_origins || [];
  if (!Array.isArray(origins) || origins.length < 1 || origins.length > 5 ||
      origins.some(value => {
        try { const u = new URL(value); return !['https:', 'http:'].includes(u.protocol) || u.origin !== value; }
        catch { return true; }
      })) throw new Error('Origem da captura inválida');
  return {cdp_endpoint: endpoint.href, target_id: capture.target_id,
    allowed_origins: origins, observation_ms: 500};
}

async function runReaAnalysis(capture, options = {}) {
  const input = validateCapture(capture);
  const url = process.env.REA_MCP_URL;
  if (!url) return {status:'not_configured', reason:'REA_MCP_URL não configurada no servidor'};
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' &&
      ['127.0.0.1','localhost'].includes(parsed.hostname))) {
    throw new Error('REA_MCP_URL deve usar HTTPS ou HTTP loopback');
  }
  const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
  const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
  const token = process.env.REA_MCP_TOKEN;
  const headers = token ? {Authorization:'Bearer ' + token} : {};
  const client = new Client({name:'sitecloner-rea-bridge',version:'1.0.0'});
  try {
    await client.connect(new StreamableHTTPClientTransport(parsed, {
      requestInit: {headers}
    }));
    const available = (await client.listTools()).tools || [];
    const names = new Set(available.map(x => x.name));
    const requested = options.tool || 'analyze_web_bundle';
    if (!ALLOWED.has(requested)) throw new Error('Ferramenta REA não permitida');
    // Gateway may expose namespaced tools; select only the configured REA provider.
    const toolName = names.has('rea__' + requested) ? 'rea__' + requested : requested;
    if (!names.has(toolName)) throw new Error('Ferramenta REA indisponível: ' + requested);
    const result = await client.callTool({name:toolName,arguments:{
      ...input, include_script_sources:requested==='analyze_web_bundle',
      ...(requested==='analyze_web_bundle'?{fetch_source_maps:false}: {})
    }});
    return {status: result.isError ? 'error':'ok', tool:requested, result};
  } finally {
    await client.close().catch(() => {});
  }
}

module.exports = {validateCapture,runReaAnalysis};
