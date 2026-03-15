// Sahara Smart Assistant - Main Application Logic
// Version 2.0.0 | Sahara Smart Solutions | saharasolu.com

(function () {
  'use strict';

  const DEFAULT_CONFIG = {
    ollamaHost: 'localhost',
    ollamaPort: 11434,
    ollamaProtocol: 'http',
    defaultModel: 'mistral',
    timeoutMs: 30000,
    syncIntervalMin: 10,
    autoSync: true,
    autoBackup: true,
    retentionDays: 30,
    fontSize: 14,
    notifications: true,
  };

  const SYSTEM_PROMPT = `أنت مساعد Sahara الذكي، متخصص في البرمجة وهندسة الشبكات وإدارة الأنظمة.
أنت تعمل محلياً على جهاز المستخدم عبر Ollama.
أجب بالعربية إلا إذا طُلب منك غير ذلك.
عند كتابة كود، استخدم code blocks مع تحديد اللغة.
كن مختصراً ودقيقاً في إجاباتك.`;

  const DEVICES = {
    desktop: { name: 'الكمبيوتر المكتبي', ip: '10.0.9.11', icon: '🎮', os: 'Windows 11', role: 'learning_node', specs: 'Intel i7-4770K | RTX 3060 12GB | 16GB RAM' },
    server: { name: 'السيرفر المحلي', ip: '10.0.9.10', icon: '🖧', os: 'Proxmox VE', role: 'master_server', specs: 'Intel i5 | 12GB RAM | 720GB SSD' },
  };

  let state = {
    currentPanel: 'monitor',
    currentModel: 'mistral',
    isDarkMode: true,
    sidebarOpen: false,
    isGenerating: false,
    conversations: [],
    currentConversation: [],
    uploadedFiles: [],
    ragDocuments: [],
    devices: {
      desktop: { status: 'idle', task: 'جاهز', progress: 0, storage: '0 MB', lastUpdate: null },
      server: { status: 'online', task: 'جاهز', progress: 0, storage: '0 MB', lastUpdate: null },
    },
    backups: [],
    settings: { ...DEFAULT_CONFIG },
  };

  function init() {
    loadSettings(); loadConversations(); loadBackups(); loadUploadedFiles();
    setupEventListeners(); renderDevices(); renderModels(); renderBackups(); renderUploadedFiles();
    applyTheme(); applyFontSize(); checkOllamaStatus();
    setInterval(checkOllamaStatus, 15000);
  }

  // Storage
  function loadSettings() { const s = localStorage.getItem('sahara_settings'); if (s) state.settings = { ...DEFAULT_CONFIG, ...JSON.parse(s) }; state.isDarkMode = localStorage.getItem('sahara_theme') !== 'light'; state.currentModel = state.settings.defaultModel || 'mistral'; applySettingsToUI(); }
  function saveSettings() { localStorage.setItem('sahara_settings', JSON.stringify(state.settings)); showToast('✅ تم حفظ الإعدادات'); }
  function loadConversations() { const s = localStorage.getItem('sahara_conversations'); if (s) state.conversations = JSON.parse(s); const c = localStorage.getItem('sahara_current_chat'); if (c) state.currentConversation = JSON.parse(c); }
  function saveConversations() { localStorage.setItem('sahara_current_chat', JSON.stringify(state.currentConversation)); localStorage.setItem('sahara_conversations', JSON.stringify(state.conversations)); }
  function loadBackups() { const s = localStorage.getItem('sahara_backups'); if (s) state.backups = JSON.parse(s); }
  function saveBackups() { localStorage.setItem('sahara_backups', JSON.stringify(state.backups)); }
  function loadUploadedFiles() { const s = localStorage.getItem('sahara_files'); if (s) state.uploadedFiles = JSON.parse(s); const d = localStorage.getItem('sahara_rag_docs'); if (d) state.ragDocuments = JSON.parse(d); }
  function saveUploadedFiles() { localStorage.setItem('sahara_files', JSON.stringify(state.uploadedFiles)); localStorage.setItem('sahara_rag_docs', JSON.stringify(state.ragDocuments)); }

  // Theme
  function applyTheme() { document.body.classList.toggle('light-mode', !state.isDarkMode); document.getElementById('themeToggle').textContent = state.isDarkMode ? '🌙' : '☀️'; document.querySelector('meta[name="theme-color"]').content = state.isDarkMode ? '#0a0a0a' : '#f5f5f5'; localStorage.setItem('sahara_theme', state.isDarkMode ? 'dark' : 'light'); }
  function toggleTheme() { state.isDarkMode = !state.isDarkMode; applyTheme(); }
  function applyFontSize() { document.body.style.fontSize = state.settings.fontSize + 'px'; }

  // Navigation
  function navigateTo(panelId) { document.querySelectorAll('.panel').forEach(p => p.classList.remove('active')); document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active')); const panel = document.getElementById('panel-' + panelId); const btn = document.querySelector(`.nav-btn[data-panel="${panelId}"]`); if (panel) panel.classList.add('active'); if (btn) btn.classList.add('active'); state.currentPanel = panelId; closeSidebar(); }
  function toggleSidebar() { state.sidebarOpen = !state.sidebarOpen; document.getElementById('sidebar').classList.toggle('open', state.sidebarOpen); document.getElementById('sidebarOverlay').classList.toggle('show', state.sidebarOpen); }
  function closeSidebar() { state.sidebarOpen = false; document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebarOverlay').classList.remove('show'); }

  // Devices
  function renderDevices() {
    const grid = document.getElementById('deviceGrid'); grid.innerHTML = '';
    for (const [key, device] of Object.entries(DEVICES)) {
      const ds = state.devices[key];
      const statusClass = ds.status === 'online' || ds.status === 'idle' ? 'online' : ds.status === 'learning' ? 'learning' : ds.status === 'syncing' ? 'syncing' : 'offline';
      const statusText = { online: 'متصل', idle: 'متوقف', learning: 'تحت التعلم', syncing: 'جاري المزامنة', offline: 'غير متصل' }[ds.status] || ds.status;
      const card = document.createElement('div'); card.className = 'device-card';
      card.innerHTML = `<div class="device-header"><div class="device-name"><span class="icon">${device.icon}</span><span>${device.name}</span></div><span class="device-status ${statusClass}">${statusText}</span></div><div class="device-info"><div class="info-row"><span class="info-label">IP</span><span class="info-value" style="direction:ltr">${device.ip}</span></div><div class="info-row"><span class="info-label">نظام التشغيل</span><span class="info-value">${device.os}</span></div><div class="info-row"><span class="info-label">المواصفات</span><span class="info-value" style="font-size:11px">${device.specs}</span></div><div class="info-row"><span class="info-label">المهمة</span><span class="info-value">${ds.task}</span></div>${ds.progress > 0 ? `<div><div class="info-row"><span class="info-label">التقدم</span><span class="info-value">${ds.progress}%</span></div><div class="progress-bar"><div class="progress-fill" style="width:${ds.progress}%"></div></div></div>` : ''}<div class="info-row"><span class="info-label">آخر تحديث</span><span class="info-value">${ds.lastUpdate || 'لم يحدث'}</span></div></div><div class="device-actions"><button class="btn" onclick="app.refreshDevice('${key}')">🔄 تحديث</button>${key === 'desktop' ? '<button class="btn primary" onclick="app.pullData()">📥 سحب</button>' : ''}</div>`;
      grid.appendChild(card);
    }
  }

  function refreshDevice(key) { state.devices[key].lastUpdate = new Date().toLocaleString('ar-SA'); renderDevices(); showToast('🔄 تم التحديث'); }

  // Sync
  function pullData() {
    if (state.devices.desktop.status === 'syncing') return showToast('⚠️ جاري المزامنة');
    state.devices.desktop.status = 'syncing'; state.devices.desktop.task = 'جاري السحب...'; state.devices.desktop.progress = 0; renderDevices();
    let p = 0; const iv = setInterval(() => { p += Math.random() * 15; if (p >= 100) { clearInterval(iv); state.devices.desktop.progress = 100; state.devices.desktop.task = 'اكتمل'; state.devices.desktop.storage = (Math.random() * 500 + 100).toFixed(1) + ' MB'; state.devices.desktop.lastUpdate = new Date().toLocaleString('ar-SA'); renderDevices(); showToast('✅ اكتمل السحب'); startLearning(); return; } state.devices.desktop.progress = Math.round(p); renderDevices(); }, 800);
  }

  function startLearning() {
    state.devices.desktop.status = 'learning'; state.devices.desktop.task = 'جاري التعلم...'; state.devices.desktop.progress = 0; renderDevices();
    let p = 0; const iv = setInterval(() => { p += Math.random() * 8; if (p >= 100) { clearInterval(iv); state.devices.desktop.status = 'idle'; state.devices.desktop.task = 'جاهز'; state.devices.desktop.progress = 0; state.devices.desktop.lastUpdate = new Date().toLocaleString('ar-SA'); renderDevices(); showToast('🧠 اكتمل التعلم'); createBackup(); return; } state.devices.desktop.progress = Math.round(p); renderDevices(); }, 1200);
  }

  // Chat
  function getOllamaUrl() { return `${state.settings.ollamaProtocol || 'http'}://${state.settings.ollamaHost}:${state.settings.ollamaPort}`; }

  function addMessage(role, content) {
    const md = document.getElementById('chatMessages'); const el = document.createElement('div'); el.className = `message ${role}`; el.innerHTML = formatMessage(content); md.appendChild(el); md.scrollTop = md.scrollHeight;
    el.querySelectorAll('pre').forEach(pre => { const btn = document.createElement('button'); btn.className = 'copy-btn'; btn.textContent = 'نسخ'; btn.addEventListener('click', () => { const code = pre.querySelector('code') ? pre.querySelector('code').textContent : pre.textContent; navigator.clipboard.writeText(code).then(() => { btn.textContent = '✓'; setTimeout(() => btn.textContent = 'نسخ', 2000); }); }); pre.style.position = 'relative'; pre.appendChild(btn); });
  }

  function formatMessage(t) { t = t.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, l, c) => `<pre><code class="language-${l}">${escapeHtml(c.trim())}</code></pre>`); t = t.replace(/`([^`]+)`/g, '<code>$1</code>'); t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'); t = t.replace(/\*(.+?)\*/g, '<em>$1</em>'); t = t.replace(/\n/g, '<br>'); return t; }
  function escapeHtml(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

  async function sendMessage() {
    const input = document.getElementById('chatInput'); const text = input.value.trim(); if (!text || state.isGenerating) return;
    input.value = ''; input.style.height = 'auto'; addMessage('user', text);
    state.currentConversation.push({ role: 'user', content: text }); state.isGenerating = true; document.getElementById('sendBtn').disabled = true;
    document.getElementById('typingIndicator').classList.add('active');
    try {
      let ctx = SYSTEM_PROMPT; const rag = searchRAG(text); if (rag) ctx += `\n\nمعلومات مرجعية:\n${rag}`;
      const res = await fetch(`${getOllamaUrl()}/api/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: state.currentModel, prompt: text, system: ctx, stream: false, options: { temperature: 0.7, top_k: 40, top_p: 0.9 } }) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json(); const reply = data.response || 'لم أتمكن من الإجابة.';
      addMessage('ai', reply); state.currentConversation.push({ role: 'assistant', content: reply }); saveConversations();
    } catch (err) {
      let msg = '❌ خطأ في الاتصال بأوليما.';
      if (err.message.includes('fetch') || err.message.includes('Network')) msg = '❌ أوليما غير متصلة. شغّلها:\n```\nollama serve\n```';
      else if (err.message.includes('404')) msg = `❌ النموذج "${state.currentModel}" غير مثبت:\n\`\`\`\nollama pull ${state.currentModel}\n\`\`\``;
      addMessage('ai', msg);
    }
    state.isGenerating = false; document.getElementById('sendBtn').disabled = false; document.getElementById('typingIndicator').classList.remove('active');
  }

  function startNewChat() {
    if (state.isGenerating) return showToast('⚠️ انتظر');
    if (state.currentConversation.length > 0) { state.conversations.unshift({ id: Date.now(), date: new Date().toLocaleString('ar-SA'), messages: [...state.currentConversation], preview: state.currentConversation[0]?.content?.substring(0, 60) || '' }); if (state.conversations.length > 20) state.conversations = state.conversations.slice(0, 20); }
    state.currentConversation = []; saveConversations();
    document.getElementById('chatMessages').innerHTML = '<div class="message ai">مرحباً! أنا مساعد Sahara الذكي 🏜️<br>اكتب سؤالك وسأجيبك فوراً.</div>';
    showToast('✏️ محادثة جديدة');
  }

  // RAG
  function processFileForRAG(file, content) { const chunks = []; const lines = content.split('\n'); let cur = ''; for (const l of lines) { if (cur.length + l.length > 500 && cur.length > 0) { chunks.push({ text: cur.trim(), file: file.name, type: file.name.split('.').pop() }); cur = ''; } cur += l + '\n'; } if (cur.trim()) chunks.push({ text: cur.trim(), file: file.name, type: file.name.split('.').pop() }); return chunks; }

  function searchRAG(query) { if (!state.ragDocuments.length) return null; const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2); if (!words.length) return null; const scored = state.ragDocuments.map(d => { let s = 0; const dl = d.text.toLowerCase(); for (const w of words) if (dl.includes(w)) s++; return { ...d, score: s }; }).filter(d => d.score > 0).sort((a, b) => b.score - a.score); if (!scored.length) return null; return scored.slice(0, 3).map(d => `[${d.file}]:\n${d.text}`).join('\n---\n'); }

  function handleFileUpload(files) { for (const f of files) { const r = new FileReader(); r.onload = (e) => { const chunks = processFileForRAG(f, e.target.result); state.ragDocuments.push(...chunks); state.uploadedFiles.push({ name: f.name, size: f.size, type: f.type || f.name.split('.').pop(), chunks: chunks.length, uploadedAt: new Date().toLocaleString('ar-SA') }); saveUploadedFiles(); renderUploadedFiles(); showToast(`✅ تم رفع ${f.name}`); }; r.readAsText(f); } }
  function removeFile(i) { const n = state.uploadedFiles[i].name; state.ragDocuments = state.ragDocuments.filter(d => d.file !== n); state.uploadedFiles.splice(i, 1); saveUploadedFiles(); renderUploadedFiles(); showToast('🗑️ تم الحذف'); }
  function renderUploadedFiles() { const c = document.getElementById('uploadedFiles'); c.innerHTML = ''; state.uploadedFiles.forEach((f, i) => { const el = document.createElement('div'); el.className = 'file-item'; const sz = f.size > 1048576 ? (f.size / 1048576).toFixed(1) + ' MB' : (f.size / 1024).toFixed(1) + ' KB'; el.innerHTML = `<div><span>📄 ${f.name}</span><span style="color:var(--text-secondary);font-size:11px;margin-right:12px;">${sz} | ${f.chunks} جزء</span></div><button class="btn" onclick="app.removeFile(${i})" style="padding:4px 8px;font-size:12px;">🗑️</button>`; c.appendChild(el); }); }

  // Models
  async function renderModels() {
    const grid = document.getElementById('modelsGrid');
    const defaults = [{ name: 'mistral', fullName: 'mistral:7b', size: '3.5GB', type: 'عام', desc: 'البرمجة والأسئلة العامة' }, { name: 'neural-chat', fullName: 'neural-chat:7b', size: '4.3GB', type: 'حوارات', desc: 'اللغة العربية والحوارات' }, { name: 'codeup', fullName: 'codeup', size: '2.7GB', type: 'برمجة', desc: 'كتابة وتصحيح الأكواد' }];
    try { const res = await fetch(`${getOllamaUrl()}/api/tags`); if (res.ok) { const data = await res.json(); if (data.models?.length) { grid.innerHTML = ''; data.models.forEach(m => grid.appendChild(createModelCard(m.name, m.name, (m.size / 1e9).toFixed(1) + 'GB', 'مثبت', ''))); return; } } } catch (_) {}
    grid.innerHTML = ''; defaults.forEach(m => grid.appendChild(createModelCard(m.name, m.fullName, m.size, m.type, m.desc)));
  }

  function createModelCard(name, fullName, size, type, desc) { const c = document.createElement('div'); c.className = 'model-card' + (state.currentModel === name ? ' selected' : ''); c.innerHTML = `<div class="model-name">${fullName}</div><span class="model-tag">${type} | ${size}</span><div class="model-desc">${desc}</div>`; c.addEventListener('click', () => { state.currentModel = name; document.querySelectorAll('.model-card').forEach(x => x.classList.remove('selected')); c.classList.add('selected'); showToast(`🧠 ${name}`); }); return c; }

  // Backups
  function createBackup() { state.backups.unshift({ id: Date.now(), date: new Date().toLocaleString('ar-SA'), size: (Math.random() * 200 + 50).toFixed(1) + ' MB', type: 'full', status: 'success' }); if (state.backups.length > 10) state.backups = state.backups.slice(0, 10); saveBackups(); renderBackups(); showToast('💾 تم النسخ الاحتياطي'); }
  function renderBackups() { const l = document.getElementById('backupList'); l.innerHTML = ''; if (!state.backups.length) { l.innerHTML = '<div style="text-align:center;color:var(--text-secondary);padding:40px;">لا توجد نسخ</div>'; return; } state.backups.forEach((b, i) => { const el = document.createElement('div'); el.className = 'backup-item'; el.innerHTML = `<div class="backup-info"><span class="backup-date">💾 #${state.backups.length - i}</span><span class="backup-size">${b.date} | ${b.size}</span></div><div style="display:flex;gap:8px;"><button class="btn" onclick="app.restoreBackup(${i})" style="padding:6px 10px;font-size:12px;">📥</button><button class="btn" onclick="app.deleteBackup(${i})" style="padding:6px 10px;font-size:12px;">🗑️</button></div>`; l.appendChild(el); }); }
  function deleteBackup(i) { state.backups.splice(i, 1); saveBackups(); renderBackups(); showToast('🗑️ تم الحذف'); }
  function restoreBackup(i) { const b = state.backups[i]; if (!b || !confirm(`استعادة نسخة ${b.date}؟`)) return; showToast('⏳ جاري الاستعادة...'); setTimeout(() => { state.devices.desktop.lastUpdate = new Date().toLocaleString('ar-SA'); renderDevices(); showToast(`✅ تمت الاستعادة`); }, 2000); }
  function pushData() { if (state.devices.server.status === 'syncing') return showToast('⚠️ جاري الرفع'); state.devices.server.status = 'syncing'; state.devices.server.task = 'جاري الرفع...'; state.devices.server.progress = 0; renderDevices(); let p = 0; const iv = setInterval(() => { p += Math.random() * 12; if (p >= 100) { clearInterval(iv); state.devices.server.status = 'online'; state.devices.server.progress = 0; state.devices.server.task = 'اكتمل'; state.devices.server.storage = (Math.random() * 400 + 200).toFixed(1) + ' MB'; state.devices.server.lastUpdate = new Date().toLocaleString('ar-SA'); renderDevices(); showToast('✅ اكتمل الرفع'); return; } state.devices.server.progress = Math.round(p); renderDevices(); }, 700); }

  // Ollama Status
  async function checkOllamaStatus() { const dot = document.getElementById('ollamaStatus'); const txt = document.getElementById('ollamaStatusText'); try { const res = await fetch(`${getOllamaUrl()}/api/tags`, { signal: AbortSignal.timeout(5000) }); if (res.ok) { dot.classList.remove('offline'); const d = await res.json(); txt.textContent = `أوليما متصلة (${d.models?.length || 0} نموذج)`; } else { dot.classList.add('offline'); txt.textContent = 'غير متصلة'; } } catch (_) { dot.classList.add('offline'); txt.textContent = 'غير متصلة'; } }

  // Settings UI
  function applySettingsToUI() { const s = state.settings; const sv = (id, v) => { const el = document.getElementById(id); if (el) { if (el.type === 'checkbox') el.checked = v; else el.value = v; } }; sv('ollamaHost', s.ollamaHost); sv('ollamaPort', s.ollamaPort); sv('defaultModel', s.defaultModel); sv('ollamaTimeout', Math.round(s.timeoutMs / 1000)); sv('autoSync', s.autoSync); sv('syncInterval', s.syncIntervalMin); sv('autoBackup', s.autoBackup); sv('retentionDays', s.retentionDays); sv('fontSize', s.fontSize); sv('notifications', s.notifications); }
  function readSettingsFromUI() { const g = (id) => { const el = document.getElementById(id); if (!el) return null; if (el.type === 'checkbox') return el.checked; if (el.type === 'number') return parseInt(el.value); return el.value; }; state.settings.ollamaHost = g('ollamaHost') || 'localhost'; state.settings.ollamaPort = g('ollamaPort') || 11434; state.settings.defaultModel = g('defaultModel') || 'mistral'; state.settings.timeoutMs = (g('ollamaTimeout') || 30) * 1000; state.settings.autoSync = g('autoSync'); state.settings.syncIntervalMin = g('syncInterval') || 10; state.settings.autoBackup = g('autoBackup'); state.settings.retentionDays = g('retentionDays') || 30; state.settings.fontSize = g('fontSize') || 14; state.settings.notifications = g('notifications'); state.currentModel = state.settings.defaultModel; applyFontSize(); }

  // Toast
  function showToast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); }

  // Events
  function setupEventListeners() {
    document.querySelectorAll('.nav-btn').forEach(b => b.addEventListener('click', () => navigateTo(b.dataset.panel)));
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
    document.getElementById('menuToggle').addEventListener('click', toggleSidebar);
    document.getElementById('sidebarOverlay').addEventListener('click', closeSidebar);
    document.getElementById('sendBtn').addEventListener('click', sendMessage);
    const ci = document.getElementById('chatInput');
    ci.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
    ci.addEventListener('input', () => { ci.style.height = 'auto'; ci.style.height = Math.min(ci.scrollHeight, 120) + 'px'; });
    document.getElementById('newChatBtn').addEventListener('click', startNewChat);
    document.getElementById('refreshModels').addEventListener('click', () => { showToast('🔄 تحديث...'); renderModels(); });
    document.getElementById('pullDataBtn').addEventListener('click', pullData);
    document.getElementById('createBackupBtn').addEventListener('click', createBackup);
    document.getElementById('pushDataBtn').addEventListener('click', pushData);
    const fua = document.getElementById('fileUploadArea'); const fi = document.getElementById('fileInput');
    fua.addEventListener('click', () => fi.click());
    fua.addEventListener('dragover', (e) => { e.preventDefault(); fua.style.borderColor = 'var(--accent)'; });
    fua.addEventListener('dragleave', () => { fua.style.borderColor = ''; });
    fua.addEventListener('drop', (e) => { e.preventDefault(); fua.style.borderColor = ''; if (e.dataTransfer.files.length > 0) handleFileUpload(e.dataTransfer.files); });
    fi.addEventListener('change', () => { if (fi.files.length > 0) { handleFileUpload(fi.files); fi.value = ''; } });
    document.getElementById('saveSettings').addEventListener('click', () => { readSettingsFromUI(); saveSettings(); checkOllamaStatus(); });
    if (state.currentConversation.length > 0) state.currentConversation.forEach(m => addMessage(m.role === 'assistant' ? 'ai' : 'user', m.content));
  }

  window.app = { refreshDevice, pullData, pushData, removeFile, deleteBackup, restoreBackup, showToast };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
