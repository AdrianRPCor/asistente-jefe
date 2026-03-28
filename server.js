const http = require('http');
const https = require('https');
const url = require('url');
const { Pool } = require('pg');

const PORT = process.env.PORT || 3000;

if (!process.env.DATABASE_URL) {
  console.error('❌ Falta DATABASE_URL');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id SERIAL PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS memory (
      id SERIAL PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS profile (
      id SERIAL PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_session ON conversations(session_id);
    CREATE INDEX IF NOT EXISTS idx_memory_key ON memory(key);
  `);

  console.log('✅ DB lista');
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => {
      body += c;
      if (body.length > 10 * 1024 * 1024) {
        reject(new Error('Body demasiado grande'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(new Error('JSON inválido'));
      }
    });
    req.on('error', reject);
  });
}

function sendJSON(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

function sendHTML(res, html) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

function callClaude(apiKey, body) {
  return new Promise((resolve, reject) => {
    if (!apiKey) return reject(new Error('Falta Claude API key'));
    const data = JSON.stringify(body);
    const req = https.request(
      {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(data)
        }
      },
      res => {
        let b = '';
        res.on('data', c => (b += c));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(b);
            if (res.statusCode >= 400) return reject(new Error(parsed?.error?.message || `Claude error ${res.statusCode}`));
            resolve(parsed);
          } catch (e) {
            reject(new Error('Respuesta inválida de Claude'));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function callOpenAI(path, apiKey, body, isBuffer = false) {
  return new Promise((resolve, reject) => {
    if (!apiKey) return reject(new Error('Falta OpenAI API key'));
    const data = JSON.stringify(body);
    const req = https.request(
      {
        hostname: 'api.openai.com',
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(data)
        }
      },
      res => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          if (isBuffer) {
            if (res.statusCode >= 400) return reject(new Error(`OpenAI error ${res.statusCode}`));
            return resolve({ buffer: buf, contentType: res.headers['content-type'] });
          }
          try {
            const parsed = JSON.parse(buf.toString());
            if (res.statusCode >= 400) return reject(new Error(parsed?.error?.message || `OpenAI error ${res.statusCode}`));
            resolve(parsed);
          } catch (e) {
            reject(new Error('Respuesta inválida de OpenAI'));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function callWhisper(apiKey, audioBuffer, mimeType, filename) {
  return new Promise((resolve, reject) => {
    if (!apiKey) return reject(new Error('Falta OpenAI API key'));
    const boundary = '----FB' + Math.random().toString(36).slice(2);
    const ext = (filename || 'audio.webm').split('.').pop();
    const parts = [
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\nes\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.${ext}"\r\nContent-Type: ${mimeType}\r\n\r\n`),
      audioBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ];
    const body = Buffer.concat(parts);
    const req = https.request(
      {
        hostname: 'api.openai.com',
        path: '/v1/audio/transcriptions',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length
        }
      },
      res => {
        let d = '';
        res.on('data', c => (d += c));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(d);
            if (res.statusCode >= 400) return reject(new Error(parsed?.error?.message || `Whisper error ${res.statusCode}`));
            resolve(parsed);
          } catch (e) {
            reject(new Error('Respuesta inválida de Whisper'));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      try {
        const buf = Buffer.concat(chunks);
        const ct = req.headers['content-type'] || '';
        const bm = ct.match(/boundary=(.+)$/);
        if (!bm) return reject(new Error('No boundary'));
        const boundary = Buffer.from('--' + bm[1]);
        const parts = {};
        let pos = 0;
        while (pos < buf.length) {
          const bp = buf.indexOf(boundary, pos);
          if (bp === -1) break;
          pos = bp + boundary.length + 2;
          const he = buf.indexOf(Buffer.from('\r\n\r\n'), pos);
          if (he === -1) break;
          const headers = buf.slice(pos, he).toString();
          pos = he + 4;
          const nb = buf.indexOf(boundary, pos);
          const de = nb === -1 ? buf.length : nb - 2;
          const nm = headers.match(/name="([^"]+)"/);
          const fn = headers.match(/filename="([^"]+)"/);
          const cm = headers.match(/Content-Type: (.+)/);
          if (nm) {
            parts[nm[1]] = {
              data: buf.slice(pos, de),
              filename: fn ? fn[1] : null,
              contentType: cm ? cm[1].trim() : 'text/plain'
            };
          }
          pos = de + 2;
        }
        resolve(parts);
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

async function updateProfile(apiKey, newMessages, existingProfile) {
  if (!apiKey) return existingProfile || '{}';
  try {
    const result = await callClaude(apiKey, {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: 'Eres un sistema de memoria. Dado un perfil existente y mensajes nuevos, actualiza el perfil del usuario en formato JSON compacto. Incluye: nombre, profesión, proyectos, preferencias, contexto importante. Responde SOLO con JSON válido, sin explicaciones.',
      messages: [
        {
          role: 'user',
          content: `PERFIL ACTUAL: ${existingProfile || '{}'}\n\nMENSAJES NUEVOS:\n${(newMessages || []).map(m => `${m.role}: ${m.content}`).join('\n')}\n\nActualiza el perfil JSON con la información nueva relevante.`
        }
      ]
    });
    const text = result?.content?.[0]?.text?.trim();
    if (!text) return existingProfile || '{}';
    JSON.parse(text);
    return text;
  } catch (e) {
    console.log('Profile update error:', e.message);
    return existingProfile || '{}';
  }
}

async function summarizeOldConversations(apiKey, messages) {
  if (!apiKey || !Array.isArray(messages) || messages.length === 0) return '';
  try {
    const result = await callClaude(apiKey, {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: 'Resume esta conversación en 3-5 puntos clave, en español, de forma muy concisa. Enfócate en decisiones, tareas, información importante.',
      messages: [{ role: 'user', content: messages.map(m => `${m.role}: ${m.content}`).join('\n') }]
    });
    return result?.content?.[0]?.text || '';
  } catch (e) {
    console.log('Summary error:', e.message);
    return '';
  }
}

function callN8n(webhookUrl, data) {
  return new Promise((resolve, reject) => {
    if (!webhookUrl) return reject(new Error('Falta webhookUrl'));
    const body = JSON.stringify(data);
    const u = new URL(webhookUrl);
    const isHttps = u.protocol === 'https:';
    const lib = isHttps ? https : http;
    const options = {
      hostname: u.hostname,
      port: u.port || (isHttps ? 443 : 80),
      path: u.pathname + (u.search || ''),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const req = lib.request(options, res => {
      let b = '';
      res.on('data', c => (b += c));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(b);
          if (res.statusCode >= 400) return reject(new Error(parsed?.message || `n8n error ${res.statusCode}`));
          resolve(parsed);
        } catch (e) {
          if (res.statusCode >= 400) return reject(new Error(`n8n error ${res.statusCode}`));
          resolve({ result: b });
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Detección de intención de email ──────────────────────────────────────────
function detectEmailIntent(text = '') {
  const t = text.toLowerCase();

  // Detectar cuenta
  const isOng     = /\bong\b|proyecto arena|arena educaci[oó]n|asociaci[oó]n/.test(t);
  const isTrabajo = /\btrabajo\b|colegio|azaraque|instituto|docente|clase|alumn/.test(t);
  const account   = isOng ? 'ong' : isTrabajo ? 'trabajo' : 'personal';

  // ¿Habla de email en general?
  const esEmail = /email|correo|mail|bandeja|inbox|mensaje.*recib|recib.*mensaje/.test(t);

  // Acciones
  if (/lee|leer|revisar|revisa|mira|muestra|dame|dime|cu[aá]ntos|tengo.*email|tengo.*correo|correo.*nuevo|email.*nuevo|no le[íi]dos|[uú]ltimo.*correo|[uú]ltimo.*email|recientes|nuevos/.test(t)
      || (esEmail && /qu[eé]|cu[aá]l|hay|tengo|ver|revisa|dame|dime|mira|muestra/.test(t))) {
    return { action: 'leer', account };
  }
  if (/busca|buscar|encuentra|encontrar|email.*de|correo.*de|email.*sobre|correo.*sobre|de parte de/.test(t)) {
    return { action: 'buscar', query: text, account };
  }
  if (/prioriza|priorizar|importante|urgente|organiza.*correo|organizar.*email|orden.*importancia/.test(t)) {
    return { action: 'priorizar', account };
  }
  if (/env[íi]a|enviar|manda|mandar.*email|escribe.*email|redacta|componer|crear.*email|nuevo.*email/.test(t)) {
    return { action: 'redactar', content: text, account };
  }
  if (/responde|responder|contesta|contestar|reply/.test(t)) {
    return { action: 'responder', account };
  }
  if (/elimina|eliminar|borra|borrar|suprime|suprimir|purga|papelera/.test(t)) {
    return { action: 'eliminar', account };
  }
  if (/archiva|archivar/.test(t)) {
    return { action: 'archivar', account };
  }
  if (/marca.*le[íi]do|marcar.*le[íi]do|marca.*no le[íi]do/.test(t)) {
    return { action: 'marcar', markAs: /no le[íi]do/.test(t) ? 'noleido' : 'leido', account };
  }
  if (/en lote|todos los de|elimina.*de|archiva.*de|borra.*de/.test(t)) {
    return { action: 'lote', loteAction: /archiva/.test(t) ? 'archivar' : 'eliminar', criteria: text, account };
  }

  // Si menciona email/correo de cualquier forma → intención de email
  if (esEmail || isOng || isTrabajo) {
    return { action: 'leer', account };
  }

  // Frases naturales sin palabra clave explícita pero con contexto claro
  if (/personal|mi gmail|mi bandeja/.test(t)) {
    return { action: 'leer', account: 'personal' };
  }

  return null;
}

// ── Detección de intención de calendario ─────────────────────────────────────
function detectCalendarIntent(text = '') {
  const t = text.toLowerCase();
  if (/qu[eé] tengo|agenda|citas|reuniones|eventos|calendario|hoy|ma[nñ]ana|semana/.test(t)) {
    return { action: 'leer' };
  }
  if (/crea|crear|a[nñ]ade|a[nñ]adir|pon|poner.*reuni[oó]n|poner.*cita|nueva.*reuni[oó]n/.test(t)) {
    return { action: 'crear', content: text };
  }
  if (/cancela|cancelar|borra|borrar.*reuni[oó]n|elimina.*evento/.test(t)) {
    return { action: 'eliminar', content: text };
  }
  return null;
}

// ── Detección de intención de crear flujo ────────────────────────────────────
function detectCreatorIntent(text = '') {
  const t = text.toLowerCase();
  if (/crea un flujo|crear un flujo|crea una automatizaci[oó]n|automatiza|quiero que cuando|cada vez que.*haz|programa un flujo/.test(t)) {
    return { descripcion: text };
  }
  return null;
}

// ── HTML de la app ────────────────────────────────────────────────────────────
const APP_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Asistente">
<title>Mi Asistente</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
:root{--bg:#0a0a0f;--surface:#13131a;--surface2:#1c1c26;--border:#2a2a3a;--accent:#7c6af7;--accent2:#a78bfa;--text:#e8e8f0;--text2:#8888aa;--text3:#55556a;--record:#f43f5e;--success:#34d399;}
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
body{font-family:'DM Sans',sans-serif;background:var(--bg);color:var(--text);height:100dvh;display:flex;flex-direction:column;overflow:hidden;position:fixed;width:100%;}
.header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;padding-top:max(16px,env(safe-area-inset-top));border-bottom:1px solid var(--border);background:var(--bg);flex-shrink:0;}
.header-left{display:flex;align-items:center;gap:10px;}
.status-dot{width:8px;height:8px;border-radius:50%;background:var(--success);animation:pdot 2s ease-in-out infinite;flex-shrink:0;}
.status-dot.recording{background:var(--record);animation:pdot .6s ease-in-out infinite;}
.status-dot.thinking{background:var(--accent);}
@keyframes pdot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.8)}}
.header-title{font-size:15px;font-weight:500;}
.header-subtitle{font-size:11px;color:var(--text3);font-family:'DM Mono',monospace;}
.settings-btn{background:none;border:1px solid var(--border);color:var(--text2);width:34px;height:34px;border-radius:8px;cursor:pointer;font-size:15px;display:flex;align-items:center;justify-content:center;}
.settings-btn:active{background:var(--surface2);}
.chat{flex:1;overflow-y:auto;padding:20px 16px;display:flex;flex-direction:column;gap:16px;-webkit-overflow-scrolling:touch;}
.chat::-webkit-scrollbar{display:none;}
.msg{display:flex;flex-direction:column;max-width:88%;animation:min .3s cubic-bezier(.34,1.56,.64,1);}
@keyframes min{from{opacity:0;transform:translateY(10px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}
.msg.user{align-self:flex-end;align-items:flex-end;}
.msg.ai{align-self:flex-start;align-items:flex-start;}
.bubble{padding:12px 16px;border-radius:18px;font-size:15px;line-height:1.55;white-space:pre-wrap;word-break:break-word;}
.msg.user .bubble{background:#1e1b4b;border:1px solid #312e81;border-bottom-right-radius:4px;color:#c4b5fd;}
.msg.ai .bubble{background:var(--surface);border:1px solid var(--border);border-bottom-left-radius:4px;color:var(--text);}
.msg-time{font-size:10px;color:var(--text3);margin-top:4px;font-family:'DM Mono',monospace;padding:0 4px;}
.typing-indicator{display:flex;gap:4px;align-items:center;padding:14px 16px;}
.typing-indicator span{width:6px;height:6px;background:var(--text3);border-radius:50%;animation:typ 1.2s ease-in-out infinite;}
.typing-indicator span:nth-child(2){animation-delay:.2s}.typing-indicator span:nth-child(3){animation-delay:.4s}
@keyframes typ{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-5px);opacity:1}}
.welcome{display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;gap:12px;padding:40px 20px;text-align:center;}
.welcome-icon{width:64px;height:64px;background:linear-gradient(135deg,var(--accent),#4f46e5);border-radius:20px;display:flex;align-items:center;justify-content:center;font-size:28px;margin-bottom:8px;box-shadow:0 0 40px rgba(124,106,247,.3);}
.welcome h2{font-size:20px;font-weight:500;}
.welcome p{font-size:14px;color:var(--text2);max-width:280px;line-height:1.6;}
.welcome-tips{display:flex;flex-direction:column;gap:8px;margin-top:8px;width:100%;max-width:300px;}
.tip{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:10px 14px;font-size:13px;color:var(--text2);text-align:left;cursor:pointer;}
.tip:active{background:var(--surface2);color:var(--text);}
.input-area{padding:12px 16px;padding-bottom:max(16px,env(safe-area-inset-bottom));background:var(--bg);border-top:1px solid var(--border);flex-shrink:0;}
.recording-bar{display:none;align-items:center;justify-content:space-between;padding:12px 16px;background:rgba(244,63,94,.1);border:1px solid rgba(244,63,94,.3);border-radius:16px;margin-bottom:10px;}
.recording-bar.active{display:flex;}
.rec-left{display:flex;align-items:center;gap:10px;}
.rec-dot{width:10px;height:10px;background:var(--record);border-radius:50%;animation:pdot .7s ease-in-out infinite;flex-shrink:0;}
.rec-text{font-size:14px;color:var(--record);font-weight:500;}
.rec-time{font-size:13px;color:var(--record);font-family:'DM Mono',monospace;}
.btn-stop-rec{background:var(--record);color:white;border:none;border-radius:20px;padding:8px 16px;font-size:13px;font-weight:500;font-family:'DM Sans',sans-serif;cursor:pointer;}
.input-row{display:flex;align-items:flex-end;gap:10px;background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:8px 8px 8px 16px;transition:border-color .2s;}
.input-row:focus-within{border-color:var(--accent);}
textarea{flex:1;background:none;border:none;outline:none;color:var(--text);font-family:'DM Sans',sans-serif;font-size:15px;line-height:1.5;resize:none;max-height:120px;min-height:24px;padding:2px 0;-webkit-appearance:none;}
textarea::placeholder{color:var(--text3);}
.btn-voice{width:40px;height:40px;border-radius:50%;border:none;background:var(--surface2);color:var(--text2);font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .2s;}
.btn-voice.recording{background:var(--record);color:white;animation:prec 1s ease-in-out infinite;}
@keyframes prec{0%,100%{box-shadow:0 0 0 4px rgba(244,63,94,.25)}50%{box-shadow:0 0 0 10px rgba(244,63,94,0)}}
.btn-send{width:40px;height:40px;border-radius:50%;border:none;background:var(--accent);color:white;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .2s;}
.btn-send:disabled{background:var(--surface2);color:var(--text3);}
.btn-send:not(:disabled):active{transform:scale(.92);background:#6d5ce6;}
.modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:100;align-items:flex-end;justify-content:center;backdrop-filter:blur(4px);}
.modal-overlay.open{display:flex;}
.modal{background:var(--surface);border:1px solid var(--border);border-radius:24px 24px 0 0;padding:24px 20px;padding-bottom:max(24px,env(safe-area-inset-bottom));width:100%;max-width:480px;animation:sup .35s cubic-bezier(.34,1.56,.64,1);max-height:90dvh;overflow-y:auto;}
@keyframes sup{from{transform:translateY(100%)}to{transform:translateY(0)}}
.modal-handle{width:36px;height:4px;background:var(--border);border-radius:2px;margin:0 auto 20px;}
.modal h3{font-size:17px;font-weight:500;margin-bottom:20px;}
.field{margin-bottom:16px;}
.field label{display:block;font-size:12px;color:var(--text2);font-family:'DM Mono',monospace;margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;}
.field input,.field select,.field textarea{width:100%;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:12px 14px;color:var(--text);font-family:'DM Mono',monospace;font-size:13px;outline:none;-webkit-appearance:none;}
.field input:focus,.field select:focus,.field textarea:focus{border-color:var(--accent);}
.field select option{background:var(--surface);}
.btn-save{width:100%;background:var(--accent);color:white;border:none;border-radius:14px;padding:16px;font-family:'DM Sans',sans-serif;font-size:15px;font-weight:500;cursor:pointer;margin-top:8px;}
.btn-save:active{background:#6d5ce6;}
.btn-cancel{width:100%;background:none;color:var(--text2);border:1px solid var(--border);border-radius:14px;padding:14px;font-family:'DM Sans',sans-serif;font-size:15px;cursor:pointer;margin-top:10px;}
.toast{position:fixed;top:20px;left:50%;transform:translateX(-50%) translateY(-80px);background:var(--surface2);border:1px solid var(--border);color:var(--text);padding:10px 18px;border-radius:20px;font-size:13px;z-index:200;transition:transform .3s cubic-bezier(.34,1.56,.64,1);white-space:nowrap;max-width:90vw;text-align:center;}
.toast.show{transform:translateX(-50%) translateY(0);}
.session-info{font-size:11px;color:var(--text3);text-align:center;padding:8px;font-family:'DM Mono',monospace;}
.summary-bubble{background:rgba(124,106,247,.08);border:1px solid rgba(124,106,247,.2);border-radius:12px;padding:10px 14px;font-size:12px;color:var(--text2);margin:4px 0;line-height:1.5;}
</style>
</head>
<body>
<div class="header">
  <div class="header-left">
    <div class="status-dot" id="statusDot"></div>
    <div><div class="header-title">Mi Asistente</div><div class="header-subtitle" id="statusText">cargando...</div></div>
  </div>
  <button class="settings-btn" onclick="openSettings()">⚙️</button>
</div>
<div class="toast" id="toast"></div>
<div class="chat" id="chat">
  <div class="welcome" id="welcome">
    <div class="welcome-icon">🤖</div>
    <h2>Hola, soy tu asistente</h2>
    <p>Toca 🎙️ para hablar. Recuerdo todo lo que hablamos y aprendo de ti.</p>
    <div class="welcome-tips">
      <div class="tip" onclick="sendQuickMsg('¿Qué recuerdas de mí?')">🧠 ¿Qué recuerdas de mí?</div>
      <div class="tip" onclick="sendQuickMsg('Resume lo que hemos hablado')">📋 Resume lo que hemos hablado</div>
      <div class="tip" onclick="sendQuickMsg('Ayúdame a organizar mi día')">📅 Organizar mi día</div>
    </div>
  </div>
</div>
<div class="input-area">
  <div class="recording-bar" id="recordingBar">
    <div class="rec-left"><div class="rec-dot"></div><span class="rec-text">Grabando...</span></div>
    <span class="rec-time" id="recTimer">0:00</span>
    <button class="btn-stop-rec" onclick="stopRecording()">⏹ Enviar</button>
  </div>
  <div class="input-row">
    <textarea id="textInput" placeholder="Escribe un mensaje..." rows="1" oninput="autoResize(this);updateSendBtn()" onkeydown="handleKey(event)"></textarea>
    <button class="btn-voice" id="voiceBtn" onclick="toggleRecording()">🎙️</button>
    <button class="btn-send" id="sendBtn" onclick="sendMessage()" disabled>↑</button>
  </div>
</div>
<div class="modal-overlay" id="modalOverlay" onclick="handleOverlayClick(event)">
  <div class="modal">
    <div class="modal-handle"></div>
    <h3>⚙️ Configuración</h3>
    <div class="field"><label>API Key de Anthropic (Claude)</label><input type="password" id="claudeKey" placeholder="sk-ant-..." autocomplete="off" spellcheck="false"></div>
    <div class="field"><label>API Key de OpenAI (voz)</label><input type="password" id="openaiKey" placeholder="sk-..." autocomplete="off" spellcheck="false"></div>
    <div class="field"><label>Sobre ti (contexto base)</label><textarea id="systemPrompt" rows="4" style="resize:none">Eres mi asistente personal inteligente. Me llamo Adrián. Soy profesor, tengo una ONG y trabajo como SEO freelance. Eres directo, práctico, proactivo. Siempre en español. Cuando no puedas hacer algo, dime qué necesitarías.</textarea></div>
    <div class="field"><label>Velocidad de respuesta</label><select id="modelSelect"><option value="claude-haiku-4-5-20251001">Rápido (Haiku) — recomendado para voz</option><option value="claude-sonnet-4-6">Inteligente (Sonnet)</option></select></div>
    <div class="field"><label>Voz</label><select id="voiceSelect"><option value="nova">Nova — clara (recomendada)</option><option value="alloy">Alloy — neutra</option><option value="echo">Echo — masculina</option><option value="fable">Fable — expresiva</option><option value="onyx">Onyx — grave</option><option value="shimmer">Shimmer — suave</option></select></div>
    <div class="field"><label>Responder por voz</label><select id="alwaysSpeak"><option value="match">Solo si yo hablo</option><option value="voice">Siempre</option><option value="never">Nunca</option></select></div>
    <div class="field"><label>N8n — Gmail Personal</label><input type="text" id="n8nGmailPersonalUrl" placeholder="https://TU-N8N.up.railway.app/webhook/86651dd0-dec6-4828-afbe-561d76c3ea16-pro" autocomplete="off" spellcheck="false"></div>
    <div class="field"><label>N8n — Gmail ONG</label><input type="text" id="n8nGmailOngUrl" placeholder="https://n8n-production-893e.up.railway.app/webhook/gmail-ong" autocomplete="off" spellcheck="false"></div>
    <div class="field"><label>N8n — Google Calendar</label><input type="text" id="n8nCalendarUrl" placeholder="https://n8n-production-893e.up.railway.app/webhook/calendar" autocomplete="off" spellcheck="false"></div>
    <div class="field"><label>N8n — Gmail Trabajo</label><input type="text" id="n8nGmailTrabajoUrl" placeholder="https://n8n-production-893e.up.railway.app/webhook/2a25acc6-56d8-4cf5-ad21-7628b4e6360a" autocomplete="off" spellcheck="false"></div>
    <div class="field"><label>N8n API Key</label><input type="password" id="n8nApiKey" placeholder="tu-api-key-de-n8n" autocomplete="off" spellcheck="false"></div>
    <div class="field"><label>N8n Base URL</label><input type="text" id="n8nBaseUrl" placeholder="https://n8n-production-893e.up.railway.app" autocomplete="off" spellcheck="false"></div>
    <button class="btn-save" onclick="saveSettings()">✅ Guardar</button>
    <button class="btn-cancel" onclick="closeSettings()">Cancelar</button>
  </div>
</div>
<script>
const SESSION_ID='s_'+Date.now()+'_'+Math.random().toString(36).substr(2,9);
let config={
  claudeKey:'',openaiKey:'',
  systemPrompt:document.getElementById('systemPrompt').value,
  voice:'nova',alwaysSpeak:'match',model:'claude-haiku-4-5-20251001',
  n8nGmailPersonalUrl:'',n8nGmailOngUrl:'',n8nCalendarUrl:'',
  n8nCreatorUrl:'https://n8n-production-893e.up.railway.app/webhook/agente-creador',
  n8nGmailTrabajoUrl:'',n8nApiKey:'',
  n8nBaseUrl:'https://n8n-production-893e.up.railway.app'
};
let messages=[],mediaRecorder=null,audioChunks=[],isRecording=false,isProcessing=false,
    currentAudio=null,recInterval=null,recSeconds=0,lastInputWasVoice=false,
    audioCtx=null,userProfile='{}',pendingConfirmAction=null,pendingConfirmQuery=null;

function unlockAudio(){
  if(audioCtx)return;
  try{
    audioCtx=new(window.AudioContext||window.webkitAudioContext)();
    const buf=audioCtx.createBuffer(1,1,22050);
    const src=audioCtx.createBufferSource();
    src.buffer=buf;src.connect(audioCtx.destination);src.start(0);
  }catch(e){}
}

async function init(){
  loadConfig();
  await loadProfileAndHistory();
  setStatus('listo');
  if(!config.claudeKey)setTimeout(()=>{showToast('👆 Toca ⚙️ para añadir tus claves');openSettings();},800);
}

function loadConfig(){
  try{
    const s=JSON.parse(localStorage.getItem('asistente_config')||'{}');
    config={...config,...s};
    document.getElementById('claudeKey').value=config.claudeKey||'';
    document.getElementById('openaiKey').value=config.openaiKey||'';
    document.getElementById('systemPrompt').value=config.systemPrompt;
    document.getElementById('voiceSelect').value=config.voice||'nova';
    document.getElementById('alwaysSpeak').value=config.alwaysSpeak||'match';
    document.getElementById('modelSelect').value=config.model||'claude-haiku-4-5-20251001';
    document.getElementById('n8nGmailPersonalUrl').value=config.n8nGmailPersonalUrl||'';
    document.getElementById('n8nGmailOngUrl').value=config.n8nGmailOngUrl||'';
    document.getElementById('n8nCalendarUrl').value=config.n8nCalendarUrl||'';
    document.getElementById('n8nGmailTrabajoUrl').value=config.n8nGmailTrabajoUrl||'';
    document.getElementById('n8nApiKey').value=config.n8nApiKey||'';
    document.getElementById('n8nBaseUrl').value=config.n8nBaseUrl||'https://n8n-production-893e.up.railway.app';
  }catch(e){}
}

async function loadProfileAndHistory(){
  try{
    setStatus('cargando memoria...');
    const mkTimeout=()=>new Promise((_,reject)=>setTimeout(()=>reject(new Error('timeout')),5000));
    const pr=await Promise.race([fetch('/api/profile'),mkTimeout()]);
    const pd=await pr.json();
    if(pd.profile)userProfile=pd.profile;
    const hr=await Promise.race([fetch('/api/history?limit=50'),mkTimeout()]);
    const hd=await hr.json();
    if(hd.messages&&hd.messages.length>0){
      hideWelcome();
      if(hd.messages.length>20&&hd.summary){
        const sum=document.createElement('div');
        sum.className='session-info';
        sum.innerHTML='<div class="summary-bubble">📝 Resumen de conversaciones anteriores:<br>'+escapeHtml(hd.summary)+'</div>';
        document.getElementById('chat').appendChild(sum);
        hd.messages.slice(-20).forEach(m=>{addMessageToDOM(m.role,m.content,m.created_at,false);messages.push({role:m.role,content:m.content});});
      }else{
        hd.messages.forEach(m=>{addMessageToDOM(m.role,m.content,m.created_at,false);messages.push({role:m.role,content:m.content});});
      }
      const info=document.createElement('div');
      info.className='session-info';
      info.textContent='↑ '+hd.messages.length+' mensajes recuperados';
      document.getElementById('chat').insertBefore(info,document.getElementById('chat').firstChild);
      scrollToBottom();
    }
  }catch(e){console.log('Sin historial o timeout:',e.message);}
}

function saveSettings(){
  config.claudeKey=document.getElementById('claudeKey').value.trim();
  config.openaiKey=document.getElementById('openaiKey').value.trim();
  config.systemPrompt=document.getElementById('systemPrompt').value.trim();
  config.voice=document.getElementById('voiceSelect').value;
  config.alwaysSpeak=document.getElementById('alwaysSpeak').value;
  config.model=document.getElementById('modelSelect').value;
  config.n8nGmailPersonalUrl=document.getElementById('n8nGmailPersonalUrl').value.trim();
  config.n8nGmailOngUrl=document.getElementById('n8nGmailOngUrl').value.trim();
  config.n8nCalendarUrl=document.getElementById('n8nCalendarUrl').value.trim();
  config.n8nGmailTrabajoUrl=document.getElementById('n8nGmailTrabajoUrl').value.trim();
  config.n8nApiKey=document.getElementById('n8nApiKey').value.trim();
  config.n8nBaseUrl=document.getElementById('n8nBaseUrl').value.trim()||'https://n8n-production-893e.up.railway.app';
  localStorage.setItem('asistente_config',JSON.stringify(config));
  closeSettings();showToast('✅ Guardado');setStatus('listo');
}
function openSettings(){document.getElementById('modalOverlay').classList.add('open');}
function closeSettings(){document.getElementById('modalOverlay').classList.remove('open');}
function handleOverlayClick(e){if(e.target===document.getElementById('modalOverlay'))closeSettings();}
function setStatus(t,type){document.getElementById('statusText').textContent=t;document.getElementById('statusDot').className='status-dot'+(type?' '+type:'');}
function showToast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),3000);}
function autoResize(el){el.style.height='auto';el.style.height=Math.min(el.scrollHeight,120)+'px';}
function updateSendBtn(){document.getElementById('sendBtn').disabled=!document.getElementById('textInput').value.trim()||isProcessing;}
function handleKey(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();if(!document.getElementById('sendBtn').disabled)sendMessage();}}
function scrollToBottom(){const c=document.getElementById('chat');setTimeout(()=>c.scrollTo({top:c.scrollHeight,behavior:'smooth'}),50);}
function getTime(d){if(d)return new Date(d).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});return new Date().toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});}
function hideWelcome(){const w=document.getElementById('welcome');if(w)w.remove();}
function escapeHtml(t){return String(t).replace(/&/g,'&amp;').replace(/[<]/g,'&lt;').replace(/[>]/g,'&gt;').replace(/\\n/g,'<br>');}

function addMessageToDOM(role,text,dateStr,animate){
  hideWelcome();
  const chat=document.getElementById('chat');
  const div=document.createElement('div');
  div.className='msg '+role;
  if(animate===false)div.style.animation='none';
  div.innerHTML='<div class="bubble">'+escapeHtml(text)+'</div><div class="msg-time">'+getTime(dateStr)+'</div>';
  chat.appendChild(div);
  if(animate!==false)scrollToBottom();
  return div;
}

function addTyping(){
  hideWelcome();
  const div=document.createElement('div');
  div.className='msg ai';div.id='typing';
  div.innerHTML='<div class="bubble"><div class="typing-indicator"><span></span><span></span><span></span></div></div>';
  document.getElementById('chat').appendChild(div);
  scrollToBottom();
}
function removeTyping(){const t=document.getElementById('typing');if(t)t.remove();}

function addAIMessage(text,audioBlob){
  removeTyping();
  const div=document.createElement('div');
  div.className='msg ai';
  let btn='';
  if(audioBlob){
    const u=URL.createObjectURL(audioBlob);
    btn='<br><button data-audiobtn="1" style="display:block;width:100%;margin-top:12px;padding:18px 20px;background:#7c6af7;color:white;border:none;border-radius:16px;font-size:18px;font-weight:600;cursor:pointer;text-align:center;" onclick="playAudio(\\''+u+'\\',this)">▶ Escuchar respuesta</button>';
  }
  div.innerHTML='<div class="bubble">'+escapeHtml(text)+btn+'</div><div class="msg-time">'+getTime()+'</div>';
  document.getElementById('chat').appendChild(div);
  scrollToBottom();
  if(audioBlob)autoPlayAudio(audioBlob);
}

function playAudio(u,btn){
  if(currentAudio&&currentAudio.pause)currentAudio.pause();
  document.querySelectorAll('[data-audiobtn]').forEach(b=>{b.style.background='#7c6af7';b.textContent='▶ Escuchar respuesta';});
  currentAudio=new Audio(u);currentAudio.playsInline=true;
  btn.style.background='#1d9e75';btn.textContent='⏸ Reproduciendo...';
  currentAudio.play().catch(()=>{btn.textContent='▶ Escuchar respuesta';});
  currentAudio.onended=()=>{btn.style.background='#7c6af7';btn.textContent='▶ Escuchar respuesta';};
}

async function autoPlayAudio(blob){
  if(currentAudio&&currentAudio.pause)currentAudio.pause();
  if(audioCtx&&audioCtx.state!=='suspended'){
    try{
      const ab=await blob.arrayBuffer();
      const audioBuf=await audioCtx.decodeAudioData(ab);
      const src=audioCtx.createBufferSource();
      src.buffer=audioBuf;src.connect(audioCtx.destination);src.start(0);
      currentAudio={pause:()=>{try{src.stop();}catch(e){}}};
      return;
    }catch(e){console.log('AudioCtx err:',e);}
  }
  const audio=new Audio(URL.createObjectURL(blob));
  audio.playsInline=true;currentAudio=audio;
  audio.play().catch(()=>showToast('Toca ▶ para escuchar la respuesta'));
}

async function saveMessage(role,content){
  try{
    await fetch('/api/messages',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({role,content,session_id:SESSION_ID,claudeKey:config.claudeKey})});
  }catch(e){}
}

async function sendMessage(){
  const input=document.getElementById('textInput');
  const text=input.value.trim();
  if(!text||isProcessing)return;
  if(!config.claudeKey){showToast('⚠️ Añade tu API Key en ⚙️');openSettings();return;}
  input.value='';input.style.height='auto';updateSendBtn();lastInputWasVoice=false;
  addMessageToDOM('user',text,null,true);
  await saveMessage('user',text);
  await processMessage(text);
}

function sendQuickMsg(text){document.getElementById('textInput').value=text;updateSendBtn();sendMessage();}

async function toggleRecording(){
  if(isProcessing)return;
  if(isRecording){stopRecording();return;}
  if(!config.openaiKey){showToast('⚠️ Añade tu API Key de OpenAI en ⚙️');openSettings();return;}
  unlockAudio();
  try{
    const stream=await navigator.mediaDevices.getUserMedia({audio:true});
    audioChunks=[];
    mediaRecorder=new MediaRecorder(stream,{mimeType:getSupportedMimeType()});
    mediaRecorder.ondataavailable=e=>{if(e.data.size>0)audioChunks.push(e.data);};
    mediaRecorder.start(100);isRecording=true;
    document.getElementById('voiceBtn').classList.add('recording');
    document.getElementById('recordingBar').classList.add('active');
    setStatus('grabando...','recording');recSeconds=0;
    document.getElementById('recTimer').textContent='0:00';
    recInterval=setInterval(()=>{recSeconds++;const m=Math.floor(recSeconds/60),s=recSeconds%60;document.getElementById('recTimer').textContent=m+':'+(s<10?'0':'')+s;},1000);
  }catch(err){showToast('❌ Sin acceso al micrófono');setStatus('listo');}
}

async function stopRecording(){
  if(!isRecording||!mediaRecorder)return;
  isRecording=false;clearInterval(recInterval);
  document.getElementById('voiceBtn').classList.remove('recording');
  document.getElementById('recordingBar').classList.remove('active');
  setStatus('procesando...');
  try{
    if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();
    if(audioCtx.state==='suspended')audioCtx.resume();
    const s=audioCtx.createBuffer(1,audioCtx.sampleRate*0.1,audioCtx.sampleRate);
    const n=audioCtx.createBufferSource();n.buffer=s;n.connect(audioCtx.destination);n.start(0);
  }catch(e){}
  mediaRecorder.stop();mediaRecorder.stream.getTracks().forEach(t=>t.stop());
  mediaRecorder.onstop=async()=>{
    const blob=new Blob(audioChunks,{type:getSupportedMimeType()});
    if(blob.size<500||recSeconds<1){showToast('Grabación muy corta');setStatus('listo');return;}
    setStatus('transcribiendo...');
    const transcript=await transcribeAudio(blob);
    if(transcript){lastInputWasVoice=true;addMessageToDOM('user',transcript,null,true);await saveMessage('user',transcript);await processMessage(transcript);}
    else{setStatus('listo');}
  };
}

function getSupportedMimeType(){
  for(const t of['audio/webm','audio/mp4','audio/ogg','audio/wav']){if(MediaRecorder.isTypeSupported(t))return t;}
  return 'audio/webm';
}

async function transcribeAudio(blob){
  const ext=blob.type.includes('mp4')?'mp4':blob.type.includes('ogg')?'ogg':blob.type.includes('wav')?'wav':'webm';
  const fd=new FormData();fd.append('file',blob,'audio.'+ext);fd.append('openaiKey',config.openaiKey);
  try{
    const res=await fetch('/api/transcribe',{method:'POST',body:fd});
    const data=await res.json();
    if(data.text)return data.text.trim();
    showToast('❌ Error al transcribir');return null;
  }catch(e){showToast('❌ Error de conexión');return null;}
}

function buildSystemPrompt(){
  let sys=config.systemPrompt;
  if(userProfile&&userProfile!=='{}'){
    try{const p=JSON.parse(userProfile);sys+='\\n\\nLO QUE SÉ DE TI:\\n'+Object.entries(p).map(([k,v])=>k+': '+v).join('\\n');}catch(e){}
  }
  return sys;
}

async function processMessage(userText){
  isProcessing=true;document.getElementById('sendBtn').disabled=true;
  setStatus('pensando...','thinking');addTyping();
  messages.push({role:'user',content:userText});
  try{
    const res=await fetch('/api/chat',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        claudeKey:config.claudeKey,systemPrompt:buildSystemPrompt(),
        messages:messages.slice(-20),model:config.model||'claude-haiku-4-5-20251001',
        n8nGmailPersonalUrl:config.n8nGmailPersonalUrl||'',
        n8nGmailOngUrl:config.n8nGmailOngUrl||'',
        n8nCalendarUrl:config.n8nCalendarUrl||'',
        n8nGmailTrabajoUrl:config.n8nGmailTrabajoUrl||'',
        n8nCreatorUrl:config.n8nCreatorUrl||'',
        n8nApiKey:config.n8nApiKey||'',
        n8nBaseUrl:config.n8nBaseUrl||'',
        pendingAction:pendingConfirmAction||null,
        pendingQuery:pendingConfirmQuery||null
      })
    });
    const data=await res.json();
    if(data.content?.[0]){
      const reply=data.content[0].text;
      messages.push({role:'assistant',content:reply});
      await saveMessage('assistant',reply);
      pendingConfirmAction=data._pendingAction||null;
      pendingConfirmQuery=data._pendingQuery||null;
      if(messages.length%5===0)updateProfileBackground();
      const shouldSpeak=config.alwaysSpeak==='voice'||(config.alwaysSpeak==='match'&&lastInputWasVoice);
      if(shouldSpeak&&config.openaiKey){setStatus('generando voz...');const ab=await getTTS(reply);addAIMessage(reply,ab);}
      else{addAIMessage(reply,null);}
      setStatus('listo');
    }else{
      removeTyping();showToast('❌ '+(data.error?.message||'Error. Revisa tu API Key.'));setStatus('error');
    }
  }catch(e){removeTyping();showToast('❌ Error de conexión');setStatus('error');}
  isProcessing=false;updateSendBtn();
}

async function updateProfileBackground(){
  try{
    const recent=messages.slice(-10);
    const res=await fetch('/api/profile/update',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({claudeKey:config.claudeKey,messages:recent,currentProfile:userProfile})});
    const data=await res.json();if(data.profile)userProfile=data.profile;
  }catch(e){}
}

async function getTTS(text){
  try{
    const res=await fetch('/api/tts',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({openaiKey:config.openaiKey,text:text.substring(0,4000),voice:config.voice||'nova'})});
    if(res.ok)return await res.blob();return null;
  }catch(e){return null;}
}

init();
</script>
</body>
</html>`;

// ── Servidor HTTP ─────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const path = parsed.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  try {
    if (req.method === 'GET' && path === '/') return sendHTML(res, APP_HTML);

    if (req.method === 'GET' && path === '/api/history') {
      const limit = parseInt(parsed.query.limit, 10) || 50;
      const result = await pool.query(
        'SELECT role, content, created_at FROM conversations ORDER BY created_at DESC LIMIT $1',
        [limit]
      );
      const msgs = result.rows.reverse();
      let summary = null;
      if (msgs.length > 20) {
        const summaryRow = await pool.query("SELECT value FROM memory WHERE key='conversation_summary'");
        summary = summaryRow.rows[0]?.value || null;
      }
      return sendJSON(res, 200, { messages: msgs, summary });
    }

    if (req.method === 'POST' && path === '/api/messages') {
      const body = await parseBody(req);
      if (!body.role || !body.content) return sendJSON(res, 400, { error: 'role y content son obligatorios' });
      await pool.query(
        'INSERT INTO conversations (session_id, role, content) VALUES ($1, $2, $3)',
        [body.session_id || 'default', body.role, body.content]
      );
      const count = await pool.query('SELECT COUNT(*) FROM conversations');
      if (parseInt(count.rows[0].count, 10) % 20 === 0 && body.claudeKey) {
        pool.query('SELECT role, content FROM conversations ORDER BY created_at DESC LIMIT 40 OFFSET 20')
          .then(async r => {
            if (r.rows.length > 0) {
              const sum = await summarizeOldConversations(body.claudeKey, r.rows);
              if (sum) {
                await pool.query(
                  `INSERT INTO memory (key, value, updated_at) VALUES ('conversation_summary', $1, NOW())
                   ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
                  [sum]
                );
              }
            }
          })
          .catch(err => console.log('Summary background error:', err.message));
      }
      return sendJSON(res, 200, { ok: true });
    }

    if (req.method === 'GET' && path === '/api/profile') {
      const result = await pool.query('SELECT data FROM profile ORDER BY updated_at DESC LIMIT 1');
      return sendJSON(res, 200, { profile: result.rows[0]?.data || null });
    }

    if (req.method === 'POST' && path === '/api/profile/update') {
      const body = await parseBody(req);
      const newProfile = await updateProfile(body.claudeKey, body.messages || [], body.currentProfile);
      await pool.query('DELETE FROM profile');
      await pool.query('INSERT INTO profile (data) VALUES ($1)', [newProfile || '{}']);
      return sendJSON(res, 200, { profile: newProfile || '{}' });
    }

    if (req.method === 'POST' && path === '/api/chat') {
      const body = await parseBody(req);
      if (!body.claudeKey) return sendJSON(res, 400, { error: 'Falta claudeKey' });
      if (!Array.isArray(body.messages) || body.messages.length === 0) return sendJSON(res, 400, { error: 'messages es obligatorio' });

      const lastMsg = body.messages[body.messages.length - 1]?.content || '';

      // ── Gmail / N8N ───────────────────────────────────────────────────────
      // Sanitizar cualquier string antes de mandarlo a n8n
      const sanitize = (s) => String(s || '').replace(/[\uD800-\uDFFF]/g, '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').substring(0, 2000);

      const emailIntent = detectEmailIntent(lastMsg);
      const isConfirmation = /^(s[ií],?\s*(confirma|procede|ejecuta|hazlo|dale|adelante)|confirma\s+\w+_lote|s[ií]\s*$)/i.test(lastMsg.trim());
      const pendingAction = body.pendingAction || null;
      const pendingQuery  = body.pendingQuery  || null;
      const hasGmailUrls  = body.n8nGmailPersonalUrl || body.n8nGmailTrabajoUrl || body.n8nGmailOngUrl;

      if (hasGmailUrls && (emailIntent || (isConfirmation && pendingAction))) {
        const account = emailIntent?.account || 'personal';
        // Sanitizar historial completo por si hay surrogates en mensajes guardados
        const safeMessages = (body.messages || []).map(m => ({
          role: m.role,
          content: sanitize(m.content)
        }));
        const safeLastMsg = safeMessages.length ? safeMessages[safeMessages.length - 1].content : '';
        let webhookUrl;
        if (account === 'ong' && body.n8nGmailOngUrl)           webhookUrl = body.n8nGmailOngUrl;
        else if (account === 'trabajo' && body.n8nGmailTrabajoUrl) webhookUrl = body.n8nGmailTrabajoUrl;
        else webhookUrl = body.n8nGmailPersonalUrl || body.n8nGmailTrabajoUrl || body.n8nGmailOngUrl;

        let n8nPayload;
        if (isConfirmation && pendingAction) {
          n8nPayload = { text: sanitize(`confirma ${pendingAction}`), confirmed: true, query: sanitize(pendingQuery || ''), autoSend: false };
        } else {
          n8nPayload = { text: safeLastMsg || sanitize(lastMsg), autoSend: false, account };
        }

        try {
          const n8nResult = await callN8n(webhookUrl, n8nPayload);
          if (n8nResult) {
            const safeSystem = sanitize(body.systemPrompt || '');
            const formatted = await callClaude(body.claudeKey, {
              model: body.model || 'claude-haiku-4-5-20251001',
              max_tokens: 1200,
              system: safeSystem + `

Eres un asistente que presenta resultados de acciones sobre el email.
Reglas:
- Si hay emails → preséntalo limpio, legible, en español. Muestra remitente, asunto y fecha de cada uno.
- Si hay una previsualización (preview) con needsConfirmation:true → muéstrala tal cual y pide confirmación
- Si se ejecutó una acción → confirma qué se hizo y cuántos emails se afectaron
- Si hay un borrador → muéstralo y pregunta si quiere que lo envíe
- Sé directo y conciso. Sin florituras.`,
              messages: [{
                role: 'user',
                content: 'Petición del usuario: ' + safeLastMsg + '\n\nResultado de n8n:\n' + JSON.stringify(n8nResult).substring(0, 4000)
              }]
            });
            const finalResponse = JSON.parse(JSON.stringify(formatted));
            if (n8nResult.needsConfirmation) {
              finalResponse._pendingAction = n8nResult.pendingAction || null;
              finalResponse._pendingQuery  = n8nResult.pendingQuery  || null;
            }
            return sendJSON(res, 200, finalResponse);
          }
        } catch (e) {
          console.log('N8N Gmail error:', e.message);
        }
      }

      // ── Calendar ──────────────────────────────────────────────────────────
      const calendarIntent = detectCalendarIntent(lastMsg);
      if (calendarIntent && body.n8nCalendarUrl) {
        try {
          const n8nResult = await callN8n(body.n8nCalendarUrl, calendarIntent);
          if (n8nResult.result) {
            const formattedResult = await callClaude(body.claudeKey, {
              model: body.model || 'claude-haiku-4-5-20251001',
              max_tokens: 1024,
              system: (body.systemPrompt || '') + '\n\nSe te proporciona información de Google Calendar. Preséntala de forma natural y útil en español.',
              messages: [...body.messages.slice(-10), { role: 'user', content: 'Datos de Calendar: ' + JSON.stringify(n8nResult.result).substring(0, 3000) }]
            });
            return sendJSON(res, 200, formattedResult);
          }
        } catch (e) {
          console.log('Calendar N8n error:', e.message);
        }
      }

      // ── Creator ───────────────────────────────────────────────────────────
      const creatorIntent = detectCreatorIntent(lastMsg);
      if (creatorIntent && body.n8nCreatorUrl) {
        try {
          const creatorPayload = {
            descripcion: creatorIntent.descripcion,
            claudeKey: body.claudeKey,
            n8nApiKey: body.n8nApiKey,
            n8nBaseUrl: body.n8nBaseUrl,
            gmailPersonalId: 'rbWXlxnCksIz0CGT',
            gmailOngId: '6mzgNDRrVjdcFxeW',
            calendarId: 'HvELZK69w31VzDgn',
            anthropicId: 'MRjeQ5orOy0YoqbT'
          };
          const n8nResult = await callN8n(body.n8nCreatorUrl, creatorPayload);
          if (n8nResult.result) {
            const formattedResult = await callClaude(body.claudeKey, {
              model: body.model || 'claude-haiku-4-5-20251001',
              max_tokens: 512,
              system: body.systemPrompt || '',
              messages: [...body.messages.slice(-5), { role: 'user', content: 'Resultado de crear flujo: ' + JSON.stringify(n8nResult.result).substring(0, 3000) }]
            });
            return sendJSON(res, 200, formattedResult);
          }
        } catch (e) {
          console.log('Creator N8n error:', e.message);
        }
      }

      // ── Claude directo ────────────────────────────────────────────────────
      const result = await callClaude(body.claudeKey, {
        model: body.model || 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: body.systemPrompt || '',
        messages: body.messages
      });
      return sendJSON(res, 200, result);
    }

    if (req.method === 'POST' && path === '/api/transcribe') {
      const parts = await parseMultipart(req);
      const apiKey = parts.openaiKey?.data?.toString().trim();
      const audio = parts.file;
      if (!audio || !apiKey) return sendJSON(res, 400, { error: 'Missing data' });
      const result = await callWhisper(apiKey, audio.data, audio.contentType, audio.filename || 'audio.webm');
      return sendJSON(res, 200, result);
    }

    if (req.method === 'POST' && path === '/api/tts') {
      const body = await parseBody(req);
      if (!body.openaiKey || !body.text) return sendJSON(res, 400, { error: 'Faltan datos para TTS' });
      const result = await callOpenAI('/v1/audio/speech', body.openaiKey, { model: 'tts-1', input: body.text, voice: body.voice || 'nova' }, true);
      res.writeHead(200, { 'Content-Type': result.contentType || 'audio/mpeg', 'Access-Control-Allow-Origin': '*' });
      return res.end(result.buffer);
    }

    if (req.method === 'POST' && path === '/api/summarize') {
      const body = await parseBody(req);
      const summary = await summarizeOldConversations(body.claudeKey, body.messages || []);
      return sendJSON(res, 200, { summary });
    }

    return sendJSON(res, 404, { error: 'Not found' });

  } catch (err) {
    console.error('Error:', err);
    return sendJSON(res, 500, { error: err.message });
  }
});

initDB()
  .then(() => server.listen(PORT, () => console.log('🚀 Puerto', PORT)))
  .catch(err => { console.error('❌ DB error:', err); process.exit(1); });
