# 🏜️ Sahara Smart Assistant v2.0 - Upgrade Guide
# دليل الترقية إلى الإصدار 2.0

## الملفات الجديدة | New Files

```
sahara/
├── modules/
│   ├── proxmox.js          # 🆕 Proxmox VE API module
│   ├── n8n.js              # 🆕 n8n Workflow API module
│   └── integration.js      # 🆕 UI integration layer
├── config.json             # 📝 Updated with Proxmox & n8n settings
└── UPGRADE.md              # 📝 This file
```

## خطوات الترقية | Upgrade Steps

### 1. انسخ الملفات الجديدة | Copy New Files
```bash
cp modules/proxmox.js /path/to/sahara/modules/
cp modules/n8n.js /path/to/sahara/modules/
cp modules/integration.js /path/to/sahara/modules/
cp config.json /path/to/sahara/config.json
```

### 2. أضف السكربتات إلى index.html | Add Scripts
أضف قبل `</body>` مباشرة:

```html
<script src="modules/proxmox.js"></script>
<script src="modules/n8n.js"></script>
<script src="modules/integration.js"></script>
```

### 3. أضف أزرار التنقل | Add Nav Buttons
أضف في `<nav class="sidebar-nav">` بعد زر الملفات:

```html
<button class="nav-btn" data-panel="proxmox">
    <span class="icon">🖧</span> Proxmox
</button>
<button class="nav-btn" data-panel="n8n">
    <span class="icon">⚡</span> n8n
</button>
```

### 4. أضف الـ Panels الجديدة | Add New Panels
أضف داخل `<main class="main-content">` بعد panel-files:

(See panels-html.txt for the full HTML code)

### 5. أضف CSS الجديد | Add New CSS
أضف في نهاية `<style>` قبل responsive:

(See panels-css.txt for the full CSS code)

---

## إعداد Proxmox API Token | Proxmox API Setup

```bash
# على سيرفر Proxmox | On Proxmox server
pveum user token add root@pam sahara --privsep=0

# سيعطيك التوكن | It will give you the token:
# Token ID: root@pam!sahara
# Token Secret: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# أضفهم في الإعدادات | Add them in settings
```

## إعداد n8n API Key | n8n API Setup

```bash
# في واجهة n8n | In n8n UI:
# Settings → API → Create API Key
# أو | Or:
# Settings → Personal → API Keys → Create
```
