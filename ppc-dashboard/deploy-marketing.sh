#!/bin/bash
# =============================================================================
# RevOps Dashboard Deployment Script
# Deploys to Hostinger VPS at marketing.stiltnerlandscapes.com
# =============================================================================

set -e

# Configuration
REMOTE_HOST="root@72.62.164.236"
REMOTE_PATH="/var/www/marketing.stiltnerlandscapes.com/production"
APP_NAME="stiltner-dashboard"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Deploying RevOps Dashboard to Hostinger VPS...${NC}"
echo ""

# Step 1: Build locally
echo -e "${YELLOW}📦 Step 1: Building Next.js app...${NC}"
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed. Aborting deployment.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Build complete${NC}"
echo ""

# Step 2: Sync files to server
echo -e "${YELLOW}📤 Step 2: Syncing files to server...${NC}"
rsync -avz --delete \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude '.env.local' \
    --exclude '.env' \
    --exclude '.next/cache' \
    .next/ \
    package.json \
    package-lock.json \
    public/ \
    next.config.ts \
    "$REMOTE_HOST:$REMOTE_PATH/"

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ File sync failed. Aborting deployment.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Files synced${NC}"
echo ""

# Step 3: Install dependencies and restart on server
echo -e "${YELLOW}🔄 Step 3: Installing dependencies and restarting PM2...${NC}"
ssh "$REMOTE_HOST" << 'ENDSSH'
    cd /var/www/marketing.stiltnerlandscapes.com/production
    
    # Install production dependencies
    echo "Installing dependencies..."
    npm install --production --legacy-peer-deps 2>/dev/null || npm install --production
    
    # Check if PM2 process exists
    if pm2 describe stiltner-dashboard > /dev/null 2>&1; then
        echo "Restarting existing PM2 process..."
        pm2 restart stiltner-dashboard
    else
        echo "Starting new PM2 process..."
        pm2 start npm --name "stiltner-dashboard" -- start -- --port 3000
    fi
    
    # Save PM2 state
    pm2 save
    
    # Show status
    pm2 status stiltner-dashboard
ENDSSH

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Server restart failed. Check server logs.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Server restarted${NC}"
echo ""

# Done
echo "=============================================="
echo -e "${GREEN}✅ DEPLOYMENT COMPLETE!${NC}"
echo "=============================================="
echo ""
echo -e "🌐 Dashboard URL: ${GREEN}https://marketing.stiltnerlandscapes.com${NC}"
echo ""
echo "📋 Post-deployment checklist:"
echo "  1. Verify login works"
echo "  2. Check all pages load correctly"
echo "  3. Test API endpoints"
echo "  4. Monitor PM2 logs: ssh $REMOTE_HOST 'pm2 logs stiltner-dashboard'"
echo ""
