#!/bin/bash
echo "🏜️ Sahara v2.0 Server Setup"
echo "============================"
echo ""
echo "Step 1: Proxmox API Token"
pveum user token add root@pam sahara --privsep=0 2>/dev/null
echo ""
echo "Step 2: Install Docker & n8n"
if ! command -v docker &>/dev/null; then apt-get update && apt-get install -y docker.io; systemctl enable docker; systemctl start docker; fi
docker volume create n8n_data 2>/dev/null
docker stop n8n 2>/dev/null; docker rm n8n 2>/dev/null
docker run -d --name n8n --restart=always -p 5678:5678 -e GENERIC_TIMEZONE="Asia/Riyadh" -e TZ="Asia/Riyadh" -e N8N_RUNNERS_ENABLED=true -v n8n_data:/home/node/.n8n docker.n8n.io/n8nio/n8n
echo ""
echo "✅ Done! n8n: http://10.0.9.10:5678"
echo "📋 Create n8n API Key: Settings → API"
