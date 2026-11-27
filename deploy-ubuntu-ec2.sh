#!/bin/bash
# ==============================================================================
# CampaignFlow — Automated Ubuntu EC2 Deployment Script
# Installs & Configures: MySQL 8, Node.js 20 LTS, PM2, Nginx & Certbot
# ==============================================================================

set -e

echo "🚀 =================================================="
echo "   Starting CampaignFlow Full Stack Setup on EC2    "
echo "===================================================="

# 1. Update OS packages
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git unzip ufw nginx mysql-server software-properties-common

# 2. Install Node.js 20 LTS & PM2
echo "🟢 Installing Node.js 20 LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2

echo "Node version: $(node -v)"
echo "NPM version: $(npm -v)"

# 3. Configure MySQL 8 Database
echo "🐬 Configuring MySQL 8..."
sudo systemctl start mysql
sudo systemctl enable mysql

DB_NAME="campaignflow"
DB_USER="cf_user"
DB_PASS="CampaignFlow2026!Secure"

sudo mysql -e "CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
sudo mysql -e "CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';"
sudo mysql -e "ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';"
sudo mysql -e "GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';"
sudo mysql -e "FLUSH PRIVILEGES;"

echo "✅ MySQL Database '${DB_NAME}' and user '${DB_USER}' created successfully."

# 4. Configure Application Paths
APP_DIR="/var/www/campaignflow"
echo "📂 Setting up application directory at ${APP_DIR}..."

sudo mkdir -p ${APP_DIR}/backend/uploads/imports ${APP_DIR}/backend/uploads/templates ${APP_DIR}/backend/uploads/chunks/raw
sudo chown -R $USER:$USER ${APP_DIR}

# 5. Reminder to clone or copy codebase
echo "===================================================="
echo "✅ Prerequisites Installed Successfully!"
echo "   Next Steps in your server terminal:"
echo "   1. Clone/copy project code to: ${APP_DIR}"
echo "   2. Configure backend/.env (DATABASE_PASSWORD=${DB_PASS}, SINGLE_COMPANY_MODE=true, JWT_SECRET, META_*)"
echo "   3. Run 'npm install' in both backend and frontend"
echo "   4. Run 'npm run migrate' in backend (do NOT run seed for clean single-owner setup)"
echo "   5. Build frontend with 'npm run build'"
echo "   6. Start services with 'pm2 start ecosystem.config.cjs && pm2 save'"
echo "===================================================="
