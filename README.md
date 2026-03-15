# 🏜️ Sahara Smart Assistant v2.0

**مساعد ذكي محلي متكامل للبرمجة والشبكات وإدارة الأنظمة**
**Local AI assistant with Proxmox & n8n integration**

## Features | المميزات

- 🤖 **Local AI via Ollama** | ذكاء اصطناعي محلي
- 🖧 **Proxmox VE Integration** | تحكم كامل بالأجهزة الافتراضية والحاويات
- ⚡ **n8n Workflow Automation** | أتمتة سير العمل
- 📱 **PWA** - Works on iPhone & Desktop
- 💬 **Telegram Bot** | بوت تلجرام
- 📊 **Device Monitor** | مراقبة الأجهزة
- 📁 **RAG System** - Learn from your files
- 🔄 **Smart Sync & Auto Backup**
- 🔒 **100% Local** - No data leaves your network

## Network | الشبكة

| Device | IP | Role |
|--------|-----|------|
| Desktop | 10.0.9.11 | Learning Node (i7-4770K, RTX 3060, 16GB) |
| Server | 10.0.9.10 | Proxmox Master (i5, 12GB, 720GB SSD) |

## Quick Start | بداية سريعة

### 1. Clone & Install
```bash
git clone https://github.com/NetwEgYAS/sahara-smart-assistant.git
cd sahara-smart-assistant
npm install
```

### 2. Setup Ollama
```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh
ollama pull mistral
ollama serve
```

### 3. Run
```bash
npm start
# Open http://localhost:3000
```

### 4. Setup Proxmox API Token
```bash
# On Proxmox server (10.0.9.10)
pveum user token add root@pam sahara --privsep=0
# Copy token to Settings → Proxmox in the web UI
```

### 5. Setup n8n
```bash
docker volume create n8n_data
docker run -d --name n8n --restart=always \
  -p 5678:5678 \
  -e GENERIC_TIMEZONE="Asia/Riyadh" \
  -e TZ="Asia/Riyadh" \
  -v n8n_data:/home/node/.n8n \
  docker.n8n.io/n8nio/n8n
# Create API Key: Settings → API in n8n UI
```

## Project Structure

```
sahara-smart-assistant/
├── index.html              # Web interface (PWA)
├── app.js                  # Main application logic
├── config.json             # System configuration
├── modules/
│   ├── proxmox.js          # Proxmox VE API integration
│   ├── n8n.js              # n8n Workflow API integration
│   └── integration.js      # UI integration layer
├── bot/
│   └── index.js            # Telegram bot (grammy)
├── scripts/
│   ├── sync.ps1            # Smart sync between devices
│   ├── backup.ps1          # Auto backup system
│   └── monitor.ps1         # System monitor
├── public/
│   ├── manifest.json       # PWA manifest
│   └── sw.js               # Service Worker
└── data/                   # Local data storage
```

## Proxmox Features | مميزات Proxmox

- Real-time node monitoring (CPU, RAM, Storage)
- Start/Stop/Reboot VMs and LXC containers
- Snapshot management
- Backup management
- Task monitoring

## n8n Features | مميزات n8n

- Workflow management (create, activate, deactivate)
- Execution monitoring
- Webhook triggers
- 6 pre-built workflow templates

## Contact

- **Sahara Smart Solutions**
- **Website**: [saharasolu.com](https://saharasolu.com)
- **Email**: support@saharasolu.com
