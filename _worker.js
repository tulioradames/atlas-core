// Configure estas URLs como variáveis de ambiente no Cloudflare.
const DOCUMENTACAO_APPS_SCRIPT_URL = '';
const EXPANSOES_APPS_SCRIPT_URL = '';
const CALLBACK_NAME = 'ATNX_PROXY';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, max-age=0',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

function parseAppsScriptResponse(text) {
  const raw = String(text || '').trim();
  if (!raw) throw new Error('Resposta vazia do Apps Script.');

  if (raw.startsWith('{') || raw.startsWith('[')) {
    return JSON.parse(raw);
  }

  const start = raw.indexOf('(');
  const end = raw.lastIndexOf(')');
  if (start >= 0 && end > start) {
    const jsonText = raw.slice(start + 1, end).trim().replace(/;\s*$/, '');
    return JSON.parse(jsonText);
  }

  const lower = raw.toLowerCase();
  if (lower.includes('accounts.google.com') || lower.includes('servicelogin') || lower.includes('sign in') || lower.includes('login')) {
    throw new Error('O Web App do Apps Script está pedindo login. Na implantação, ajuste: Executar como: Eu; Quem tem acesso: Qualquer pessoa. Depois publique uma nova versão e atualize a URL no Atlas.');
  }

  const preview = raw.replace(/\s+/g, ' ').slice(0, 180);
  throw new Error('Resposta do Apps Script não veio em JSON/JSONP. Prévia: ' + preview);
}

function cleanPayload(payload) {
  const clean = {};
  for (const [key, value] of Object.entries(payload || {})) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    clean[key] = value;
  }
  return clean;
}

function normalizarModuloDrive(payload) {
  return String(payload?.modulo || 'documentacao')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

function getAppsScriptUrl(payload, env) {
  const modulo = normalizarModuloDrive(payload);
  const override = String(payload?.appsScriptUrlOverride || payload?.appsScriptUrl || '').trim();
  const url = override || (modulo === 'expansoes'
    ? (env?.EXPANSOES_APPS_SCRIPT_URL || EXPANSOES_APPS_SCRIPT_URL)
    : (env?.DOCUMENTACAO_APPS_SCRIPT_URL || DOCUMENTACAO_APPS_SCRIPT_URL));

  if (!url || url.includes('COLE_AQUI')) {
    throw new Error(modulo === 'expansoes'
      ? 'Endpoint de Expansões não configurado no Cloudflare Worker. Configure EXPANSOES_APPS_SCRIPT_URL ou edite EXPANSOES_APPS_SCRIPT_URL no _worker.js.'
      : 'Endpoint de Documentação não configurado no Cloudflare Worker. Configure DOCUMENTACAO_APPS_SCRIPT_URL ou edite DOCUMENTACAO_APPS_SCRIPT_URL no _worker.js.');
  }

  return url;
}

function shouldUseGet(payload) {
  const action = String(payload?.action || '').toLowerCase().replace(/[^a-z]/g, '');
  return action.includes('scan') ||
    action.includes('sync') ||
    action.includes('importarexpansoesobras') ||
    action.includes('expansoesobras') ||
    action.includes('testarexpansoesdrive') ||
    action.includes('diagnosticoexpansoesdrive');
}

async function callAppsScript(payload, env) {
  const clean = cleanPayload(payload);
  const appsScriptUrl = getAppsScriptUrl(clean, env);

  if (shouldUseGet(clean)) {
    const target = new URL(appsScriptUrl);
    target.searchParams.set('callback', CALLBACK_NAME);
    for (const [key, value] of Object.entries(clean)) {
      if (Array.isArray(value) || typeof value === 'object') {
        target.searchParams.set(key, JSON.stringify(value));
      } else {
        target.searchParams.set(key, String(value));
      }
    }

    const response = await fetch(target.toString(), {
      method: 'GET',
      redirect: 'follow',
      headers: { 'Accept': 'application/javascript, application/json, text/plain, */*' }
    });

    const text = await response.text();
    const parsed = parseAppsScriptResponse(text);
    if (!response.ok || parsed?.success === false) {
      throw new Error(parsed?.error || parsed?.message || `Apps Script retornou HTTP ${response.status}.`);
    }
    return parsed;
  }

  const response = await fetch(appsScriptUrl, {
    method: 'POST',
    body: JSON.stringify(clean),
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8', 'Accept': 'application/json, text/plain, */*' }
  });

  const text = await response.text();
  const parsed = parseAppsScriptResponse(text);
  if (!response.ok || parsed?.success === false) {
    throw new Error(parsed?.error || parsed?.message || `Apps Script retornou HTTP ${response.status}.`);
  }
  return parsed;
}

async function readRequestPayload(request) {
  const url = new URL(request.url);

  if (request.method === 'GET') {
    return Object.fromEntries(url.searchParams.entries());
  }

  const text = await request.text();
  if (!text.trim()) return {};

  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error('Corpo da requisição para /api/drive não é JSON válido.');
  }
}

async function handleDrive(request, env) {
  if (request.method === 'OPTIONS') {
    return jsonResponse({ success: true });
  }

  if (!['GET', 'POST'].includes(request.method)) {
    return jsonResponse({ success: false, error: 'Método não permitido.' }, 405);
  }

  try {
    const payload = await readRequestPayload(request);
    const result = await callAppsScript(payload, env);
    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({
      success: false,
      error: err?.message || String(err || 'Erro desconhecido no proxy do Google Drive.')
    }, 502);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/drive' || url.pathname === '/api/drive/') {
      return handleDrive(request, env);
    }

    return env.ASSETS.fetch(request);
  }
};
