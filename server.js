const http = require('http');
const https = require('https');
const url = require('url');
const { Pool } = require('pg');

const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;

// ── Base de datos ──────────────────────────────────────────
const pool = new Pool({
  connectionString: DATABASE_URL,
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
    CREATE INDEX IF NOT EXISTS idx_session ON conversations(session_id);
    CREATE INDEX IF NOT EXISTS idx_memory_key ON memory(key);
  `);
  console.log('✅ Base de datos lista');
}

// ── Helpers HTTP ───────────────────────────────────────────
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch(e) { resolve({}); }
    });
    req.on('error', reject);
  });
}

function sendJSON(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

function sendHTML(res, html) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

// ── Proxy a Claude API ─────────────────────────────────────
function callClaude(apiKey, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    const req = https.request(options, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ── Proxy a OpenAI ─────────────────────────────────────────
function callOpenAI(path, apiKey, body, isBuffer) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: 'api.openai.com',
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(data)
      }
    };
    const req = https.request(options, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (isBuffer) resolve({ buffer: buf, contentType: res.headers['content-type'] });
        else {
          try { resolve(JSON.parse(buf.toString())); }
          catch(e) { reject(e); }
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Proxy multipart para Whisper
function callWhisper(apiKey, audioBuffer, mimeType, filename) {
  return new Promise((resolve, reject) => {
    const boundary = '----FormBoundary' + Math.random().toString(36).substr(2);
    const ext = filename.split('.').pop() || 'webm';
    const parts = [];
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n`));
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\nes\r\n`));
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.${ext}"\r\nContent-Type: ${mimeType}\r\n\r\n`));
    parts.push(audioBuffer);
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
    const body = Buffer.concat(parts);

    const options = {
      hostname: 'api.openai.com',
      path: '/v1/audio/transcriptions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length
      }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Recibir audio multipart ────────────────────────────────
function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const buf = Buffer.concat(chunks);
      const contentType = req.headers['content-type'] || '';
      const boundaryMatch = contentType.match(/boundary=(.+)$/);
      if (!boundaryMatch) return reject(new Error('No boundary'));
      const boundary = Buffer.from('--' + boundaryMatch[1]);
      const parts = {};
      let pos = 0;
      while (pos < buf.length) {
        const boundaryPos = buf.indexOf(boundary, pos);
        if (boundaryPos === -1) break;
        pos = boundaryPos + boundary.length + 2;
        const headerEnd = buf.indexOf(Buffer.from('\r\n\r\n'), pos);
        if (headerEnd === -1) break;
        const headers = buf.slice(pos, headerEnd).toString();
        pos = headerEnd + 4;
        const nextBoundary = buf.indexOf(boundary, pos);
        const dataEnd = nextBoundary === -1 ? buf.length : nextBoundary - 2;
        const nameMatch = headers.match(/name="([^"]+)"/);
        const filenameMatch = headers.match(/filename="([^"]+)"/);
        const ctMatch = headers.match(/Content-Type: (.+)/);
        if (nameMatch) {
          parts[nameMatch[1]] = {
            data: buf.slice(pos, dataEnd),
            filename: filenameMatch ? filenameMatch[1] : null,
            contentType: ctMatch ? ctMatch[1].trim() : 'text/plain'
          };
        }
        pos = dataEnd + 2;
      }
      resolve(parts);
    });
    req.on('error', reject);
  });
}

// ── HTML de la app ─────────────────────────────────────────
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
.memory-badge{font-size:10px;color:var(--accent2);padding:0 4px;margin-top:2px;}
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
.audio-play-btn{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--accent2);cursor:pointer;margin-top:6px;padding:4px 10px;background:rgba(124,106,247,.1);border-radius:8px;border:none;font-family:'DM Sans',sans-serif;}
.session-info{font-size:11px;color:var(--text3);text-align:center;padding:8px;font-family:'DM Mono',monospace;}
</style>
</head>
<body>
<div class="header">
  <div class="header-left">
    <div class="status-dot" id="statusDot"></div>
    <div>
      <div class="header-title">Mi Asistente</div>
      <div class="header-subtitle" id="statusText">cargando...</div>
    </div>
  </div>
  <button class="settings-btn" onclick="openSettings()">⚙️</button>
</div>
<div class="toast" id="toast"></div>
<div class="chat" id="chat">
  <div class="welcome" id="welcome">
    <div class="welcome-icon">🤖</div>
    <h2>Hola, soy tu asistente</h2>
    <p>Toca 🎙️ para hablar o escribe. Recuerdo todo lo que hablamos.</p>
    <div class="welcome-tips">
      <div class="tip" onclick="sendQuickMsg('¿Qué recuerdas de mí?')">🧠 ¿Qué recuerdas de mí?</div>
      <div class="tip" onclick="sendQuickMsg('Hoy tengo que...')">📋 Hoy tengo que...</div>
      <div class="tip" onclick="sendQuickMsg('Ayúdame a organizar mi semana')">📅 Organizar mi semana</div>
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
    <div class="field"><label>Sobre ti</label><textarea id="systemPrompt" rows="4" style="resize:none">Eres mi asistente personal. Me llamo Adrián. Soy profesor, tengo una ONG y trabajo como SEO freelance. Eres directo, práctico y hablas siempre en español.</textarea></div>
    <div class="field"><label>Voz</label><select id="voiceSelect"><option value="nova">Nova — clara (recomendada)</option><option value="alloy">Alloy — neutra</option><option value="echo">Echo — masculina</option><option value="fable">Fable — expresiva</option><option value="onyx">Onyx — grave</option><option value="shimmer">Shimmer — suave</option></select></div>
    <div class="field"><label>Responder por voz</label><select id="alwaysSpeak"><option value="match">Solo si yo hablo</option><option value="voice">Siempre</option><option value="never">Nunca</option></select></div>
    <button class="btn-save" onclick="saveSettings()">✅ Guardar</button>
    <button class="btn-cancel" onclick="closeSettings()">Cancelar</button>
  </div>
</div>
<script>
const SESSION_ID = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2,9);
let config={claudeKey:'',openaiKey:'',systemPrompt:document.getElementById('systemPrompt').value,voice:'nova',alwaysSpeak:'match'};
let messages=[],mediaRecorder=null,audioChunks=[],isRecording=false,isProcessing=false,currentAudio=null,recInterval=null,recSeconds=0,lastInputWasVoice=false;
// Safari requiere desbloquear AudioContext con gesto del usuario
let audioCtx=null;
function unlockAudio(){
  if(audioCtx)return;
  try{
    audioCtx=new(window.AudioContext||window.webkitAudioContext)();
    // Reproducir silencio para desbloquear
    const buf=audioCtx.createBuffer(1,1,22050);
    const src=audioCtx.createBufferSource();
    src.buffer=buf;src.connect(audioCtx.destination);src.start(0);
    console.log('🔊 Audio desbloqueado');
  }catch(e){}
}

async function init(){
  loadConfig();
  await loadHistory();
  setStatus('listo');
  if(!config.claudeKey) setTimeout(()=>{showToast('👆 Toca ⚙️ para añadir tus claves');openSettings();},800);
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
  }catch(e){}
}

async function loadHistory(){
  try{
    setStatus('cargando memoria...');
    const res=await fetch('/api/history?limit=30');
    const data=await res.json();
    if(data.messages&&data.messages.length>0){
      hideWelcome();
      data.messages.forEach(m=>{
        addMessageToDOM(m.role,m.content,m.created_at,false);
        messages.push({role:m.role,content:m.content});
      });
      const info=document.createElement('div');
      info.className='session-info';
      info.textContent='↑ Historial recuperado ('+data.messages.length+' mensajes)';
      document.getElementById('chat').insertBefore(info,document.getElementById('chat').firstChild);
      scrollToBottom();
    }
  }catch(e){console.log('Sin historial previo');}
}

function saveSettings(){
  config.claudeKey=document.getElementById('claudeKey').value.trim();
  config.openaiKey=document.getElementById('openaiKey').value.trim();
  config.systemPrompt=document.getElementById('systemPrompt').value.trim();
  config.voice=document.getElementById('voiceSelect').value;
  config.alwaysSpeak=document.getElementById('alwaysSpeak').value;
  localStorage.setItem('asistente_config',JSON.stringify(config));
  closeSettings();showToast('✅ Configuración guardada');setStatus('listo');
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
function getTime(dateStr){if(dateStr)return new Date(dateStr).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});return new Date().toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});}
function hideWelcome(){const w=document.getElementById('welcome');if(w)w.remove();}
function escapeHtml(t){return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\\n/g,'<br>');}

function addMessageToDOM(role,text,dateStr,animate){
  hideWelcome();
  const chat=document.getElementById('chat');
  const div=document.createElement('div');
  div.className='msg '+role+(animate===false?' style="animation:none"':'');
  div.innerHTML='<div class="bubble">'+escapeHtml(text)+'</div><div class="msg-time">'+getTime(dateStr)+'</div>';
  chat.appendChild(div);
  if(animate!==false)scrollToBottom();
  return div;
}

function addTyping(){
  hideWelcome();
  const chat=document.getElementById('chat');
  const div=document.createElement('div');
  div.className='msg ai';div.id='typing';
  div.innerHTML='<div class="bubble"><div class="typing-indicator"><span></span><span></span><span></span></div></div>';
  chat.appendChild(div);scrollToBottom();
}
function removeTyping(){const t=document.getElementById('typing');if(t)t.remove();}

function addAIMessage(text,audioBlob){
  removeTyping();
  const chat=document.getElementById('chat');
  const div=document.createElement('div');
  div.className='msg ai';
  let btn='';
  if(audioBlob){const u=URL.createObjectURL(audioBlob);btn='<br><button class="audio-play-btn" onclick="playAudio(\\''+u+'\\',this)">▶ Escuchar de nuevo</button>';}
  div.innerHTML='<div class="bubble">'+escapeHtml(text)+btn+'</div><div class="msg-time">'+getTime()+'</div>';
  chat.appendChild(div);scrollToBottom();
  if(audioBlob)autoPlayAudio(audioBlob);
}

function playAudio(u,btn){if(currentAudio){currentAudio.pause();currentAudio=null;}currentAudio=new Audio(u);currentAudio.playsInline=true;btn.textContent='⏸ Reproduciendo...';currentAudio.play().catch(e=>console.log('play error:',e));currentAudio.onended=()=>{btn.textContent='▶ Escuchar de nuevo';};}

async function autoPlayAudio(blob){
  if(currentAudio){currentAudio.pause();currentAudio=null;}
  const url=URL.createObjectURL(blob);
  // Método 1: AudioContext (funciona en Safari si fue desbloqueado)
  if(audioCtx){
    try{
      const arrayBuf=await blob.arrayBuffer();
      const audioBuf=await audioCtx.decodeAudioData(arrayBuf);
      const src=audioCtx.createBufferSource();
      src.buffer=audioBuf;src.connect(audioCtx.destination);
      src.start(0);
      // Guardar referencia para poder parar
      currentAudio={pause:()=>src.stop(),url};
      return;
    }catch(e){console.log('AudioContext fallback:',e);}
  }
  // Método 2: Audio element normal
  const audio=new Audio(url);
  audio.playsInline=true;
  currentAudio=audio;
  audio.play().catch(e=>{
    console.log('Autoplay bloqueado, mostrando botón');
    // Si falla, el botón "Escuchar de nuevo" ya está visible
  });
}

async function saveMessage(role,content){
  try{await fetch('/api/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role,content,session_id:SESSION_ID})});}catch(e){}
}

async function sendMessage(){
  const input=document.getElementById('textInput');
  const text=input.value.trim();
  if(!text||isProcessing)return;
  if(!config.claudeKey){showToast('⚠️ Añade tu API Key en ⚙️');openSettings();return;}
  input.value='';input.style.height='auto';updateSendBtn();
  lastInputWasVoice=false;
  addMessageToDOM('user',text,null,true);
  await saveMessage('user',text);
  await processMessage(text);
}

function sendQuickMsg(text){document.getElementById('textInput').value=text;updateSendBtn();sendMessage();}

async function toggleRecording(){
  if(isProcessing)return;
  if(isRecording){stopRecording();return;}
  if(!config.openaiKey){showToast('⚠️ Añade tu API Key de OpenAI en ⚙️');openSettings();return;}
  unlockAudio(); // Desbloquear audio en el gesto del usuario
  try{
    const stream=await navigator.mediaDevices.getUserMedia({audio:true});
    audioChunks=[];
    mediaRecorder=new MediaRecorder(stream,{mimeType:getSupportedMimeType()});
    mediaRecorder.ondataavailable=e=>{if(e.data.size>0)audioChunks.push(e.data);};
    mediaRecorder.start(100);isRecording=true;
    document.getElementById('voiceBtn').classList.add('recording');
    document.getElementById('recordingBar').classList.add('active');
    setStatus('grabando...','recording');
    recSeconds=0;document.getElementById('recTimer').textContent='0:00';
    recInterval=setInterval(()=>{recSeconds++;const m=Math.floor(recSeconds/60),s=recSeconds%60;document.getElementById('recTimer').textContent=m+':'+(s<10?'0':'')+s;},1000);
  }catch(err){showToast('❌ Sin acceso al micrófono. Permite en Safari → Ajustes.');}
}

async function stopRecording(){
  if(!isRecording||!mediaRecorder)return;
  isRecording=false;clearInterval(recInterval);
  document.getElementById('voiceBtn').classList.remove('recording');
  document.getElementById('recordingBar').classList.remove('active');
  setStatus('procesando voz...');
  mediaRecorder.stop();mediaRecorder.stream.getTracks().forEach(t=>t.stop());
  mediaRecorder.onstop=async()=>{
    const blob=new Blob(audioChunks,{type:getSupportedMimeType()});
    if(blob.size<500||recSeconds<1){showToast('Grabación muy corta');setStatus('listo');return;}
    setStatus('transcribiendo...');
    const transcript=await transcribeAudio(blob);
    if(transcript){lastInputWasVoice=true;addMessageToDOM('user',transcript,null,true);await saveMessage('user',transcript);await processMessage(transcript);}
    else setStatus('listo');
  };
}

function getSupportedMimeType(){for(const t of['audio/webm','audio/mp4','audio/ogg','audio/wav'])if(MediaRecorder.isTypeSupported(t))return t;return 'audio/webm';}

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

async function processMessage(userText){
  isProcessing=true;document.getElementById('sendBtn').disabled=true;
  setStatus('pensando...','thinking');addTyping();
  messages.push({role:'user',content:userText});
  try{
    const res=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({claudeKey:config.claudeKey,systemPrompt:config.systemPrompt,messages:messages.slice(-20)})});
    const data=await res.json();
    if(data.content?.[0]){
      const reply=data.content[0].text;
      messages.push({role:'assistant',content:reply});
      await saveMessage('assistant',reply);
      const shouldSpeak=config.alwaysSpeak==='voice'||(config.alwaysSpeak==='match'&&lastInputWasVoice);
      if(shouldSpeak&&config.openaiKey){setStatus('generando voz...');const ab=await getTTS(reply);addAIMessage(reply,ab);}
      else addAIMessage(reply,null);
      setStatus('listo');
    }else{
      removeTyping();showToast('❌ '+(data.error?.message||'Error. Revisa tu API Key.'));setStatus('error');
    }
  }catch(e){removeTyping();showToast('❌ Error de conexión');setStatus('error');}
  isProcessing=false;updateSendBtn();
}

async function getTTS(text){
  try{
    const res=await fetch('/api/tts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({openaiKey:config.openaiKey,text:text.substring(0,4000),voice:config.voice||'nova'})});
    if(res.ok)return await res.blob();
    return null;
  }catch(e){return null;}
}

init();
</script>
</body>
</html>`;

// ── Router ─────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const path = parsed.pathname;

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
    return res.end();
  }

  try {
    // GET / — sirve la app
    if (req.method === 'GET' && path === '/') {
      return sendHTML(res, APP_HTML);
    }

    // GET /api/history — últimos N mensajes
    if (req.method === 'GET' && path === '/api/history') {
      const limit = parseInt(parsed.query.limit) || 50;
      const result = await pool.query(
        'SELECT role, content, created_at FROM conversations ORDER BY created_at DESC LIMIT $1',
        [limit]
      );
      return sendJSON(res, 200, { messages: result.rows.reverse() });
    }

    // POST /api/messages — guardar mensaje
    if (req.method === 'POST' && path === '/api/messages') {
      const body = await parseBody(req);
      await pool.query(
        'INSERT INTO conversations (session_id, role, content) VALUES ($1, $2, $3)',
        [body.session_id || 'default', body.role, body.content]
      );
      return sendJSON(res, 200, { ok: true });
    }

    // POST /api/chat — proxy a Claude
    if (req.method === 'POST' && path === '/api/chat') {
      const body = await parseBody(req);
      const result = await callClaude(body.claudeKey, {
        model: 'claude-sonnet-4-5',
        max_tokens: 1024,
        system: body.systemPrompt,
        messages: body.messages
      });
      return sendJSON(res, 200, result);
    }

    // POST /api/transcribe — proxy a Whisper
    if (req.method === 'POST' && path === '/api/transcribe') {
      const parts = await parseMultipart(req);
      const apiKey = parts.openaiKey?.data.toString().trim();
      const audio = parts.file;
      if (!audio || !apiKey) return sendJSON(res, 400, { error: 'Missing data' });
      const result = await callWhisper(apiKey, audio.data, audio.contentType, audio.filename || 'audio.webm');
      return sendJSON(res, 200, result);
    }

    // POST /api/tts — proxy a OpenAI TTS
    if (req.method === 'POST' && path === '/api/tts') {
      const body = await parseBody(req);
      const result = await callOpenAI('/v1/audio/speech', body.openaiKey, {
        model: 'tts-1', input: body.text, voice: body.voice || 'nova'
      }, true);
      res.writeHead(200, {
        'Content-Type': result.contentType || 'audio/mpeg',
        'Access-Control-Allow-Origin': '*'
      });
      return res.end(result.buffer);
    }

    // POST /api/memory — guardar dato de memoria
    if (req.method === 'POST' && path === '/api/memory') {
      const body = await parseBody(req);
      await pool.query(
        'INSERT INTO memory (key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()',
        [body.key, body.value]
      );
      return sendJSON(res, 200, { ok: true });
    }

    // GET /api/memory — leer memoria
    if (req.method === 'GET' && path === '/api/memory') {
      const result = await pool.query('SELECT key, value FROM memory ORDER BY updated_at DESC');
      return sendJSON(res, 200, { memory: result.rows });
    }

    sendJSON(res, 404, { error: 'Not found' });

  } catch(err) {
    console.error('Error:', err);
    sendJSON(res, 500, { error: err.message });
  }
});

// ── Start ──────────────────────────────────────────────────
initDB().then(() => {
  server.listen(PORT, () => console.log('🚀 Servidor en puerto', PORT));
}).catch(err => {
  console.error('Error conectando a la base de datos:', err);
  // Arrancar igualmente sin DB
  server.listen(PORT, () => console.log('⚠️ Servidor sin DB en puerto', PORT));
});
