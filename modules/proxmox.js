// ============================================================
// Sahara Smart Assistant - Proxmox VE Integration Module
// وحدة التكامل مع Proxmox VE
// Sahara Smart Solutions | saharasolu.com
// ============================================================

const ProxmoxAPI = (function () {
  'use strict';

  let config = {
    host: '10.0.9.10',
    port: 8006,
    protocol: 'https',
    tokenId: '',    // user@pam!tokenName
    tokenSecret: '', // token secret UUID
    node: 'pve',
  };

  // ── Helpers ──

  function getBaseUrl() {
    return `${config.protocol}://${config.host}:${config.port}/api2/json`;
  }

  function headers() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `PVEAPIToken=${config.tokenId}=${config.tokenSecret}`,
    };
  }

  async function apiCall(method, endpoint, body = null) {
    const url = `${getBaseUrl()}${endpoint}`;
    const opts = { method, headers: headers() };
    if (body) opts.body = JSON.stringify(body);
    try {
      const res = await fetch(url, opts);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const data = await res.json();
      return data.data;
    } catch (err) {
      console.error(`[Proxmox] ${method} ${endpoint} failed:`, err);
      throw err;
    }
  }

  // ── Configuration ──

  function configure(opts) {
    Object.assign(config, opts);
    localStorage.setItem('sahara_proxmox_config', JSON.stringify(config));
  }

  function loadConfig() {
    const saved = localStorage.getItem('sahara_proxmox_config');
    if (saved) config = { ...config, ...JSON.parse(saved) };
    return config;
  }

  // ── Cluster & Node Info ──

  async function getClusterStatus() {
    return apiCall('GET', '/cluster/status');
  }

  async function getNodeStatus() {
    return apiCall('GET', `/nodes/${config.node}/status`);
  }

  async function getNodeNetworks() {
    return apiCall('GET', `/nodes/${config.node}/network`);
  }

  async function getNodeStorage() {
    return apiCall('GET', `/nodes/${config.node}/storage`);
  }

  async function getNodeDisks() {
    return apiCall('GET', `/nodes/${config.node}/disks/list`);
  }

  // ── Virtual Machines ──

  async function listVMs() {
    return apiCall('GET', `/nodes/${config.node}/qemu`);
  }

  async function getVMStatus(vmid) {
    return apiCall('GET', `/nodes/${config.node}/qemu/${vmid}/status/current`);
  }

  async function getVMConfig(vmid) {
    return apiCall('GET', `/nodes/${config.node}/qemu/${vmid}/config`);
  }

  async function startVM(vmid) {
    return apiCall('POST', `/nodes/${config.node}/qemu/${vmid}/status/start`);
  }

  async function stopVM(vmid) {
    return apiCall('POST', `/nodes/${config.node}/qemu/${vmid}/status/stop`);
  }

  async function shutdownVM(vmid) {
    return apiCall('POST', `/nodes/${config.node}/qemu/${vmid}/status/shutdown`);
  }

  async function rebootVM(vmid) {
    return apiCall('POST', `/nodes/${config.node}/qemu/${vmid}/status/reboot`);
  }

  async function suspendVM(vmid) {
    return apiCall('POST', `/nodes/${config.node}/qemu/${vmid}/status/suspend`);
  }

  async function resumeVM(vmid) {
    return apiCall('POST', `/nodes/${config.node}/qemu/${vmid}/status/resume`);
  }

  async function getVMRRDData(vmid, timeframe = 'hour') {
    return apiCall('GET', `/nodes/${config.node}/qemu/${vmid}/rrddata?timeframe=${timeframe}`);
  }

  async function snapshotVM(vmid, name, description = '') {
    return apiCall('POST', `/nodes/${config.node}/qemu/${vmid}/snapshot`, {
      snapname: name,
      description: description,
    });
  }

  async function listVMSnapshots(vmid) {
    return apiCall('GET', `/nodes/${config.node}/qemu/${vmid}/snapshot`);
  }

  async function cloneVM(vmid, newid, name) {
    return apiCall('POST', `/nodes/${config.node}/qemu/${vmid}/clone`, {
      newid: newid,
      name: name,
      full: 1,
    });
  }

  // ── LXC Containers ──

  async function listContainers() {
    return apiCall('GET', `/nodes/${config.node}/lxc`);
  }

  async function getContainerStatus(vmid) {
    return apiCall('GET', `/nodes/${config.node}/lxc/${vmid}/status/current`);
  }

  async function startContainer(vmid) {
    return apiCall('POST', `/nodes/${config.node}/lxc/${vmid}/status/start`);
  }

  async function stopContainer(vmid) {
    return apiCall('POST', `/nodes/${config.node}/lxc/${vmid}/status/stop`);
  }

  async function shutdownContainer(vmid) {
    return apiCall('POST', `/nodes/${config.node}/lxc/${vmid}/status/shutdown`);
  }

  async function rebootContainer(vmid) {
    return apiCall('POST', `/nodes/${config.node}/lxc/${vmid}/status/reboot`);
  }

  // ── Backups ──

  async function listBackups(storage = 'local') {
    return apiCall('GET', `/nodes/${config.node}/storage/${storage}/content?content=backup`);
  }

  async function backupVM(vmid, storage = 'local', mode = 'snapshot') {
    return apiCall('POST', `/nodes/${config.node}/vzdump`, {
      vmid: vmid,
      storage: storage,
      mode: mode,
      compress: 'zstd',
    });
  }

  // ── Tasks ──

  async function listTasks(limit = 20) {
    return apiCall('GET', `/nodes/${config.node}/tasks?limit=${limit}`);
  }

  async function getTaskStatus(upid) {
    return apiCall('GET', `/nodes/${config.node}/tasks/${encodeURIComponent(upid)}/status`);
  }

  async function getTaskLog(upid) {
    return apiCall('GET', `/nodes/${config.node}/tasks/${encodeURIComponent(upid)}/log`);
  }

  // ── Connection Test ──

  async function testConnection() {
    try {
      const result = await apiCall('GET', '/version');
      return {
        connected: true,
        version: result.version,
        release: result.release,
      };
    } catch (err) {
      return {
        connected: false,
        error: err.message,
      };
    }
  }

  // ── Summary Dashboard Data ──

  async function getDashboardData() {
    try {
      const [nodeStatus, vms, containers, storage] = await Promise.all([
        getNodeStatus(),
        listVMs(),
        listContainers(),
        getNodeStorage(),
      ]);

      const runningVMs = vms.filter(v => v.status === 'running').length;
      const runningCTs = containers.filter(c => c.status === 'running').length;

      return {
        node: {
          cpu: (nodeStatus.cpu * 100).toFixed(1),
          memUsed: (nodeStatus.memory.used / 1073741824).toFixed(1),
          memTotal: (nodeStatus.memory.total / 1073741824).toFixed(1),
          memPercent: ((nodeStatus.memory.used / nodeStatus.memory.total) * 100).toFixed(1),
          uptime: nodeStatus.uptime,
          loadAvg: nodeStatus.loadavg,
        },
        vms: { total: vms.length, running: runningVMs, list: vms },
        containers: { total: containers.length, running: runningCTs, list: containers },
        storage: storage.map(s => ({
          name: s.storage,
          type: s.type,
          used: (s.used / 1073741824).toFixed(1),
          total: (s.total / 1073741824).toFixed(1),
          percent: ((s.used / s.total) * 100).toFixed(1),
        })),
      };
    } catch (err) {
      console.error('[Proxmox] Dashboard data failed:', err);
      throw err;
    }
  }

  // ── Public API ──

  return {
    configure,
    loadConfig,
    testConnection,
    getDashboardData,
    getClusterStatus,
    getNodeStatus,
    getNodeNetworks,
    getNodeStorage,
    getNodeDisks,
    listVMs,
    getVMStatus,
    getVMConfig,
    startVM,
    stopVM,
    shutdownVM,
    rebootVM,
    suspendVM,
    resumeVM,
    getVMRRDData,
    snapshotVM,
    listVMSnapshots,
    cloneVM,
    listContainers,
    getContainerStatus,
    startContainer,
    stopContainer,
    shutdownContainer,
    rebootContainer,
    listBackups,
    backupVM,
    listTasks,
    getTaskStatus,
    getTaskLog,
  };
})();
