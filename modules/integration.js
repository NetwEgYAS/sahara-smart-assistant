// ============================================================
// Sahara v2 - App Integration Layer
// طبقة التكامل مع Proxmox و n8n
// يُحمّل بعد app.js, modules/proxmox.js, modules/n8n.js
// ============================================================

(function () {
  'use strict';

  // ══════════ PROXMOX PANEL LOGIC ══════════

  let proxmoxState = {
    connected: false,
    dashboard: null,
    refreshTimer: null,
  };

  async function initProxmox() {
    ProxmoxAPI.loadConfig();
    applyProxmoxConfigToUI();
    await refreshProxmox();
  }

  function applyProxmoxConfigToUI() {
    const cfg = ProxmoxAPI.loadConfig();
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    set('pveHost', cfg.host);
    set('pvePort', cfg.port);
    set('pveNode', cfg.node);
    set('pveTokenId', cfg.tokenId);
    set('pveTokenSecret', cfg.tokenSecret);
  }

  function saveProxmoxConfig() {
    const get = (id) => document.getElementById(id)?.value || '';
    ProxmoxAPI.configure({
      host: get('pveHost'),
      port: parseInt(get('pvePort')) || 8006,
      node: get('pveNode') || 'pve',
      tokenId: get('pveTokenId'),
      tokenSecret: get('pveTokenSecret'),
    });
    window.app?.showToast?.('✅ تم حفظ إعدادات Proxmox');
    refreshProxmox();
  }

  async function refreshProxmox() {
    const statusEl = document.getElementById('pveStatus');
    const contentEl = document.getElementById('pveContent');

    try {
      const test = await ProxmoxAPI.testConnection();
      if (test.connected) {
        proxmoxState.connected = true;
        if (statusEl) {
          statusEl.innerHTML = `<span class="device-status online">متصل (v${test.version})</span>`;
        }

        const data = await ProxmoxAPI.getDashboardData();
        proxmoxState.dashboard = data;
        renderProxmoxDashboard(data);
      } else {
        throw new Error(test.error);
      }
    } catch (err) {
      proxmoxState.connected = false;
      if (statusEl) {
        statusEl.innerHTML = '<span class="device-status offline">غير متصل</span>';
      }
      if (contentEl) {
        contentEl.innerHTML = `
          <div style="text-align:center;padding:40px;color:var(--text-secondary);">
            <div style="font-size:48px;margin-bottom:16px;">🖧</div>
            <h3 style="margin-bottom:8px;">Proxmox غير متصل</h3>
            <p style="font-size:13px;margin-bottom:16px;">تأكد من إعدادات الاتصال وأن API Token مضاف بشكل صحيح</p>
            <p style="font-size:12px;direction:ltr;background:var(--bg-tertiary);padding:12px;border-radius:8px;display:inline-block;">
              pveum user token add root@pam sahara --privsep=0<br>
              Copy the token value to settings
            </p>
          </div>`;
      }
    }
  }

  function renderProxmoxDashboard(data) {
    const el = document.getElementById('pveContent');
    if (!el) return;

    const uptimeStr = formatUptime(data.node.uptime);

    el.innerHTML = `
      <!-- Node Stats -->
      <div class="pve-stats-grid">
        <div class="pve-stat-card">
          <div class="pve-stat-icon">⚡</div>
          <div class="pve-stat-value">${data.node.cpu}%</div>
          <div class="pve-stat-label">CPU</div>
          <div class="progress-bar"><div class="progress-fill" style="width:${data.node.cpu}%;background:${parseFloat(data.node.cpu) > 80 ? 'var(--danger)' : 'var(--accent)'}"></div></div>
        </div>
        <div class="pve-stat-card">
          <div class="pve-stat-icon">🧠</div>
          <div class="pve-stat-value">${data.node.memUsed}/${data.node.memTotal} GB</div>
          <div class="pve-stat-label">RAM (${data.node.memPercent}%)</div>
          <div class="progress-bar"><div class="progress-fill" style="width:${data.node.memPercent}%"></div></div>
        </div>
        <div class="pve-stat-card">
          <div class="pve-stat-icon">🖥️</div>
          <div class="pve-stat-value">${data.vms.running}/${data.vms.total}</div>
          <div class="pve-stat-label">VMs تعمل</div>
        </div>
        <div class="pve-stat-card">
          <div class="pve-stat-icon">📦</div>
          <div class="pve-stat-value">${data.containers.running}/${data.containers.total}</div>
          <div class="pve-stat-label">حاويات تعمل</div>
        </div>
      </div>

      <div style="font-size:12px;color:var(--text-secondary);margin:12px 0;">⏱️ وقت التشغيل: ${uptimeStr}</div>

      <!-- VMs -->
      <h3 style="margin:16px 0 10px;font-size:14px;">🖥️ الأجهزة الافتراضية (VMs)</h3>
      <div class="pve-resource-list">
        ${data.vms.list.map(vm => renderResourceCard(vm, 'vm')).join('')}
        ${data.vms.list.length === 0 ? '<div class="pve-empty">لا توجد أجهزة افتراضية</div>' : ''}
      </div>

      <!-- Containers -->
      <h3 style="margin:16px 0 10px;font-size:14px;">📦 الحاويات (LXC)</h3>
      <div class="pve-resource-list">
        ${data.containers.list.map(ct => renderResourceCard(ct, 'ct')).join('')}
        ${data.containers.list.length === 0 ? '<div class="pve-empty">لا توجد حاويات</div>' : ''}
      </div>

      <!-- Storage -->
      <h3 style="margin:16px 0 10px;font-size:14px;">💾 التخزين</h3>
      <div class="pve-resource-list">
        ${data.storage.map(s => `
          <div class="pve-resource-item">
            <div class="pve-resource-info">
              <span class="pve-resource-name">📀 ${s.name}</span>
              <span class="pve-resource-meta">${s.type} | ${s.used}/${s.total} GB</span>
            </div>
            <div class="progress-bar" style="width:100px"><div class="progress-fill" style="width:${s.percent}%"></div></div>
            <span style="font-size:11px;min-width:40px;text-align:left">${s.percent}%</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderResourceCard(resource, type) {
    const isRunning = resource.status === 'running';
    const statusClass = isRunning ? 'online' : 'offline';
    const statusText = isRunning ? 'يعمل' : 'متوقف';
    const cpuPercent = resource.cpu ? (resource.cpu * 100).toFixed(1) : '0';
    const memUsed = resource.mem ? (resource.mem / 1073741824).toFixed(1) : '0';
    const memMax = resource.maxmem ? (resource.maxmem / 1073741824).toFixed(1) : '0';
    const prefix = type === 'vm' ? 'VM' : 'CT';

    return `
      <div class="pve-resource-item">
        <div class="pve-resource-info">
          <span class="pve-resource-name">${resource.name || `${prefix} ${resource.vmid}`}</span>
          <span class="pve-resource-meta">ID: ${resource.vmid} | ${statusText}</span>
        </div>
        <div class="pve-resource-actions">
          ${isRunning
            ? `<button class="btn" onclick="saharaV2.stopResource('${type}',${resource.vmid})" style="padding:4px 8px;font-size:11px;">⏹ إيقاف</button>
               <button class="btn" onclick="saharaV2.rebootResource('${type}',${resource.vmid})" style="padding:4px 8px;font-size:11px;">🔄 إعادة</button>`
            : `<button class="btn primary" onclick="saharaV2.startResource('${type}',${resource.vmid})" style="padding:4px 8px;font-size:11px;">▶ تشغيل</button>`
          }
        </div>
        <span class="device-status ${statusClass}" style="font-size:10px;">${statusText}</span>
      </div>
    `;
  }

  async function startResource(type, vmid) {
    try {
      if (type === 'vm') await ProxmoxAPI.startVM(vmid);
      else await ProxmoxAPI.startContainer(vmid);
      window.app?.showToast?.(`▶ جاري تشغيل ${type.toUpperCase()} ${vmid}...`);
      setTimeout(refreshProxmox, 3000);
    } catch (e) {
      window.app?.showToast?.(`❌ فشل التشغيل: ${e.message}`);
    }
  }

  async function stopResource(type, vmid) {
    try {
      if (type === 'vm') await ProxmoxAPI.shutdownVM(vmid);
      else await ProxmoxAPI.shutdownContainer(vmid);
      window.app?.showToast?.(`⏹ جاري إيقاف ${type.toUpperCase()} ${vmid}...`);
      setTimeout(refreshProxmox, 3000);
    } catch (e) {
      window.app?.showToast?.(`❌ فشل الإيقاف: ${e.message}`);
    }
  }

  async function rebootResource(type, vmid) {
    try {
      if (type === 'vm') await ProxmoxAPI.rebootVM(vmid);
      else await ProxmoxAPI.rebootContainer(vmid);
      window.app?.showToast?.(`🔄 جاري إعادة تشغيل ${type.toUpperCase()} ${vmid}...`);
      setTimeout(refreshProxmox, 5000);
    } catch (e) {
      window.app?.showToast?.(`❌ فشل إعادة التشغيل: ${e.message}`);
    }
  }

  // ══════════ N8N PANEL LOGIC ══════════

  let n8nState = {
    connected: false,
    dashboard: null,
  };

  async function initN8N() {
    N8NAPI.loadConfig();
    applyN8NConfigToUI();
    await refreshN8N();
  }

  function applyN8NConfigToUI() {
    const cfg = N8NAPI.loadConfig();
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    set('n8nHost', cfg.host);
    set('n8nPort', cfg.port);
    set('n8nApiKey', cfg.apiKey);
  }

  function saveN8NConfig() {
    const get = (id) => document.getElementById(id)?.value || '';
    N8NAPI.configure({
      host: get('n8nHost'),
      port: parseInt(get('n8nPort')) || 5678,
      apiKey: get('n8nApiKey'),
    });
    window.app?.showToast?.('✅ تم حفظ إعدادات n8n');
    refreshN8N();
  }

  async function refreshN8N() {
    const statusEl = document.getElementById('n8nStatus');
    const contentEl = document.getElementById('n8nContent');

    try {
      const test = await N8NAPI.testConnection();
      if (test.connected) {
        n8nState.connected = true;
        if (statusEl) {
          statusEl.innerHTML = '<span class="device-status online">متصل</span>';
        }

        const data = await N8NAPI.getDashboardData();
        n8nState.dashboard = data;
        renderN8NDashboard(data);
      } else {
        throw new Error(test.error);
      }
    } catch (err) {
      n8nState.connected = false;
      if (statusEl) {
        statusEl.innerHTML = '<span class="device-status offline">غير متصل</span>';
      }
      if (contentEl) {
        contentEl.innerHTML = `
          <div style="text-align:center;padding:40px;color:var(--text-secondary);">
            <div style="font-size:48px;margin-bottom:16px;">⚡</div>
            <h3 style="margin-bottom:8px;">n8n غير متصل</h3>
            <p style="font-size:13px;margin-bottom:16px;">تأكد من تشغيل n8n وإضافة API Key</p>
            <p style="font-size:12px;direction:ltr;background:var(--bg-tertiary);padding:12px;border-radius:8px;display:inline-block;">
              docker run -d --name n8n -p 5678:5678 \\<br>
              -e N8N_RUNNERS_ENABLED=true \\<br>
              -e GENERIC_TIMEZONE=Asia/Riyadh \\<br>
              docker.n8n.io/n8nio/n8n
            </p>
          </div>`;
      }
      renderN8NTemplates();
    }
  }

  function renderN8NDashboard(data) {
    const el = document.getElementById('n8nContent');
    if (!el) return;

    el.innerHTML = `
      <!-- Stats -->
      <div class="pve-stats-grid">
        <div class="pve-stat-card">
          <div class="pve-stat-icon">🔄</div>
          <div class="pve-stat-value">${data.workflows.total}</div>
          <div class="pve-stat-label">Workflows</div>
        </div>
        <div class="pve-stat-card">
          <div class="pve-stat-icon">✅</div>
          <div class="pve-stat-value">${data.workflows.active}</div>
          <div class="pve-stat-label">نشطة</div>
        </div>
        <div class="pve-stat-card">
          <div class="pve-stat-icon">📊</div>
          <div class="pve-stat-value">${data.executions.success}</div>
          <div class="pve-stat-label">ناجحة</div>
        </div>
        <div class="pve-stat-card">
          <div class="pve-stat-icon">❌</div>
          <div class="pve-stat-value">${data.executions.failed}</div>
          <div class="pve-stat-label">فاشلة</div>
        </div>
      </div>

      <!-- Workflows List -->
      <h3 style="margin:16px 0 10px;font-size:14px;">🔄 Workflows</h3>
      <div class="pve-resource-list">
        ${data.workflows.list.map(wf => `
          <div class="pve-resource-item">
            <div class="pve-resource-info">
              <span class="pve-resource-name">${wf.name}</span>
              <span class="pve-resource-meta">ID: ${wf.id} | ${wf.active ? 'نشط' : 'متوقف'}</span>
            </div>
            <div class="pve-resource-actions">
              ${wf.active
                ? `<button class="btn" onclick="saharaV2.deactivateWorkflow('${wf.id}')" style="padding:4px 8px;font-size:11px;">⏸ إيقاف</button>`
                : `<button class="btn primary" onclick="saharaV2.activateWorkflow('${wf.id}')" style="padding:4px 8px;font-size:11px;">▶ تفعيل</button>`
              }
            </div>
            <span class="device-status ${wf.active ? 'online' : 'offline'}" style="font-size:10px;">${wf.active ? 'نشط' : 'متوقف'}</span>
          </div>
        `).join('')}
        ${data.workflows.list.length === 0 ? '<div class="pve-empty">لا توجد Workflows</div>' : ''}
      </div>

      <!-- Recent Executions -->
      <h3 style="margin:16px 0 10px;font-size:14px;">📋 آخر التنفيذات</h3>
      <div class="pve-resource-list">
        ${data.executions.recent.map(ex => {
          const status = ex.stoppedAt ? 'فشل' : (ex.finished ? 'نجاح' : 'جاري');
          const statusClass = ex.stoppedAt ? 'offline' : (ex.finished ? 'online' : 'syncing');
          const time = ex.startedAt ? new Date(ex.startedAt).toLocaleString('ar-SA') : '-';
          return `
            <div class="pve-resource-item">
              <div class="pve-resource-info">
                <span class="pve-resource-name">#${ex.id}</span>
                <span class="pve-resource-meta">${time} | ${ex.mode}</span>
              </div>
              <span class="device-status ${statusClass}" style="font-size:10px;">${status}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;

    renderN8NTemplates();
  }

  function renderN8NTemplates() {
    const el = document.getElementById('n8nTemplates');
    if (!el) return;

    const templates = N8NAPI.getWorkflowTemplates();
    el.innerHTML = `
      <h3 style="margin:16px 0 10px;font-size:14px;">📋 قوالب جاهزة</h3>
      <div class="n8n-templates-grid">
        ${templates.map(t => `
          <div class="n8n-template-card">
            <div class="n8n-template-name">${t.name}</div>
            <div class="n8n-template-desc">${t.desc}</div>
            <div class="n8n-template-meta">
              <span>🔌 ${t.trigger}</span>
              <span>🧩 ${t.nodes.length} nodes</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  async function activateWorkflow(id) {
    try {
      await N8NAPI.activateWorkflow(id);
      window.app?.showToast?.('▶ تم تفعيل Workflow');
      setTimeout(refreshN8N, 1000);
    } catch (e) {
      window.app?.showToast?.(`❌ فشل: ${e.message}`);
    }
  }

  async function deactivateWorkflow(id) {
    try {
      await N8NAPI.deactivateWorkflow(id);
      window.app?.showToast?.('⏸ تم إيقاف Workflow');
      setTimeout(refreshN8N, 1000);
    } catch (e) {
      window.app?.showToast?.(`❌ فشل: ${e.message}`);
    }
  }

  // ══════════ HELPERS ══════════

  function formatUptime(seconds) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    let str = '';
    if (d > 0) str += `${d} يوم `;
    if (h > 0) str += `${h} ساعة `;
    str += `${m} دقيقة`;
    return str;
  }

  // ══════════ INIT ══════════

  function init() {
    // Wait for DOM and main app to load
    setTimeout(() => {
      initProxmox();
      initN8N();
    }, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ══════════ PUBLIC API ══════════

  window.saharaV2 = {
    refreshProxmox,
    saveProxmoxConfig,
    startResource,
    stopResource,
    rebootResource,
    refreshN8N,
    saveN8NConfig,
    activateWorkflow,
    deactivateWorkflow,
  };

})();
