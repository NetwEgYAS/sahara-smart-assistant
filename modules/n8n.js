// ============================================================
// Sahara Smart Assistant - n8n Workflow Integration Module
// وحدة التكامل مع n8n
// Sahara Smart Solutions | saharasolu.com
// ============================================================

const N8NAPI = (function () {
  'use strict';

  let config = {
    host: '10.0.9.10',
    port: 5678,
    protocol: 'http',
    apiKey: '',
  };

  // ── Helpers ──

  function getBaseUrl() {
    return `${config.protocol}://${config.host}:${config.port}/api/v1`;
  }

  function headers() {
    const h = { 'Content-Type': 'application/json' };
    if (config.apiKey) h['X-N8N-API-KEY'] = config.apiKey;
    return h;
  }

  async function apiCall(method, endpoint, body = null) {
    const url = `${getBaseUrl()}${endpoint}`;
    const opts = { method, headers: headers() };
    if (body) opts.body = JSON.stringify(body);
    try {
      const res = await fetch(url, opts);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return res.json();
    } catch (err) {
      console.error(`[n8n] ${method} ${endpoint} failed:`, err);
      throw err;
    }
  }

  // ── Configuration ──

  function configure(opts) {
    Object.assign(config, opts);
    localStorage.setItem('sahara_n8n_config', JSON.stringify(config));
  }

  function loadConfig() {
    const saved = localStorage.getItem('sahara_n8n_config');
    if (saved) config = { ...config, ...JSON.parse(saved) };
    return config;
  }

  // ── Workflows ──

  async function listWorkflows(limit = 50, cursor = '') {
    let url = `/workflows?limit=${limit}`;
    if (cursor) url += `&cursor=${cursor}`;
    return apiCall('GET', url);
  }

  async function getWorkflow(id) {
    return apiCall('GET', `/workflows/${id}`);
  }

  async function createWorkflow(data) {
    return apiCall('POST', '/workflows', data);
  }

  async function updateWorkflow(id, data) {
    return apiCall('PATCH', `/workflows/${id}`, data);
  }

  async function deleteWorkflow(id) {
    return apiCall('DELETE', `/workflows/${id}`);
  }

  async function activateWorkflow(id) {
    return apiCall('PATCH', `/workflows/${id}`, { active: true });
  }

  async function deactivateWorkflow(id) {
    return apiCall('PATCH', `/workflows/${id}`, { active: false });
  }

  // ── Executions ──

  async function listExecutions(limit = 20, workflowId = null, status = null) {
    let url = `/executions?limit=${limit}`;
    if (workflowId) url += `&workflowId=${workflowId}`;
    if (status) url += `&status=${status}`;
    return apiCall('GET', url);
  }

  async function getExecution(id) {
    return apiCall('GET', `/executions/${id}`);
  }

  async function deleteExecution(id) {
    return apiCall('DELETE', `/executions/${id}`);
  }

  // ── Credentials ──

  async function listCredentials() {
    return apiCall('GET', '/credentials');
  }

  // ── Tags ──

  async function listTags() {
    return apiCall('GET', '/tags');
  }

  async function createTag(name) {
    return apiCall('POST', '/tags', { name });
  }

  // ── Webhook Trigger ──

  async function triggerWebhook(webhookPath, data = {}, method = 'POST') {
    const url = `${config.protocol}://${config.host}:${config.port}/webhook/${webhookPath}`;
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (method !== 'GET') opts.body = JSON.stringify(data);
    const res = await fetch(url, opts);
    return res.json();
  }

  async function triggerTestWebhook(webhookPath, data = {}) {
    const url = `${config.protocol}://${config.host}:${config.port}/webhook-test/${webhookPath}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  }

  // ── Connection Test ──

  async function testConnection() {
    try {
      const result = await apiCall('GET', '/workflows?limit=1');
      return {
        connected: true,
        workflowCount: result.data ? result.data.length : 0,
      };
    } catch (err) {
      return {
        connected: false,
        error: err.message,
      };
    }
  }

  // ── Dashboard Data ──

  async function getDashboardData() {
    try {
      const [workflows, executions] = await Promise.all([
        listWorkflows(100),
        listExecutions(50),
      ]);

      const wfList = workflows.data || [];
      const exList = executions.data || [];

      const activeWFs = wfList.filter(w => w.active).length;
      const successExec = exList.filter(e => e.finished && !e.stoppedAt).length;
      const failedExec = exList.filter(e => e.stoppedAt).length;
      const runningExec = exList.filter(e => !e.finished && !e.stoppedAt).length;

      return {
        workflows: {
          total: wfList.length,
          active: activeWFs,
          inactive: wfList.length - activeWFs,
          list: wfList.map(w => ({
            id: w.id,
            name: w.name,
            active: w.active,
            createdAt: w.createdAt,
            updatedAt: w.updatedAt,
            tags: w.tags || [],
          })),
        },
        executions: {
          total: exList.length,
          success: successExec,
          failed: failedExec,
          running: runningExec,
          recent: exList.slice(0, 10).map(e => ({
            id: e.id,
            workflowId: e.workflowId,
            finished: e.finished,
            startedAt: e.startedAt,
            stoppedAt: e.stoppedAt,
            mode: e.mode,
          })),
        },
      };
    } catch (err) {
      console.error('[n8n] Dashboard data failed:', err);
      throw err;
    }
  }

  // ── Workflow Templates ──

  function getWorkflowTemplates() {
    return [
      {
        name: 'مراقبة الخادم',
        nameEn: 'Server Monitor',
        desc: 'يراقب حالة السيرفر ويرسل تنبيه عند المشاكل',
        trigger: 'Cron',
        nodes: ['HTTP Request', 'IF', 'Telegram'],
        category: 'monitoring',
      },
      {
        name: 'نسخ احتياطي تلقائي',
        nameEn: 'Auto Backup',
        desc: 'يأخذ نسخة احتياطية من Proxmox يومياً',
        trigger: 'Cron',
        nodes: ['HTTP Request', 'Proxmox', 'Email'],
        category: 'backup',
      },
      {
        name: 'تنبيهات البريد',
        nameEn: 'Email Alerts',
        desc: 'يراقب البريد ويرسل ملخص للرسائل المهمة',
        trigger: 'Email Trigger',
        nodes: ['Email', 'IF', 'Telegram'],
        category: 'notification',
      },
      {
        name: 'تحديث DNS تلقائي',
        nameEn: 'DNS Auto Update',
        desc: 'يحدث سجل DNS تلقائياً عند تغير IP',
        trigger: 'Cron',
        nodes: ['HTTP Request', 'Cloudflare', 'IF'],
        category: 'network',
      },
      {
        name: 'مراقبة مواقع الويب',
        nameEn: 'Website Uptime Monitor',
        desc: 'يفحص حالة المواقع ويرسل تنبيه عند السقوط',
        trigger: 'Cron (5 min)',
        nodes: ['HTTP Request', 'IF', 'Telegram', 'Google Sheets'],
        category: 'monitoring',
      },
      {
        name: 'جمع بيانات API',
        nameEn: 'API Data Collector',
        desc: 'يجمع بيانات من عدة APIs ويحفظها',
        trigger: 'Cron',
        nodes: ['HTTP Request', 'Set', 'Spreadsheet File'],
        category: 'data',
      },
    ];
  }

  // ── Public API ──

  return {
    configure,
    loadConfig,
    testConnection,
    getDashboardData,
    listWorkflows,
    getWorkflow,
    createWorkflow,
    updateWorkflow,
    deleteWorkflow,
    activateWorkflow,
    deactivateWorkflow,
    listExecutions,
    getExecution,
    deleteExecution,
    listCredentials,
    listTags,
    createTag,
    triggerWebhook,
    triggerTestWebhook,
    getWorkflowTemplates,
  };
})();
