#!/bin/bash
# PPC Agent Environment Setup Script
# Run this to create your .env file with placeholder values

echo "Creating .env file for PPC Intelligence Agent..."

cat > .env << 'EOF'
# ============================================================
# PPC INTELLIGENCE AGENT - Environment Configuration
# ============================================================
# Copy your credentials from your working MCP config at:
# ~/.cursor/mcp.json (look for the "google-ads" section)
# ============================================================

# Claude API (Required)
# Get your key from: https://console.anthropic.com/settings/keys
ANTHROPIC_API_KEY=YOUR_ANTHROPIC_API_KEY_HERE

# Google Ads API (Copy from your MCP config)
GOOGLE_ADS_DEVELOPER_TOKEN=YOUR_DEVELOPER_TOKEN_HERE
GOOGLE_ADS_CLIENT_ID=YOUR_CLIENT_ID_HERE
GOOGLE_ADS_CLIENT_SECRET=YOUR_CLIENT_SECRET_HERE
GOOGLE_ADS_REFRESH_TOKEN=YOUR_REFRESH_TOKEN_HERE
GOOGLE_ADS_LOGIN_CUSTOMER_ID=YOUR_MCC_CUSTOMER_ID_HERE
GOOGLE_ADS_DEFAULT_CUSTOMER_ID=YOUR_CLIENT_CUSTOMER_ID_HERE

# DataForSEO API (Optional - for competitor intel)
# Get credentials from: https://dataforseo.com/
DATAFORSEO_LOGIN=YOUR_DATAFORSEO_LOGIN_HERE
DATAFORSEO_PASSWORD=YOUR_DATAFORSEO_PASSWORD_HERE

# Agent Configuration (Defaults work well)
AGENT_MODEL=claude-sonnet-4-5-20250929
AGENT_MAX_TOKENS=8192
AGENT_LOG_LEVEL=info

# Notifications (Optional)
# SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
EOF

echo "✅ .env file created!"
echo ""
echo "⚠️  IMPORTANT: Edit .env and replace ALL placeholder values with your actual credentials"
echo ""
echo "Where to find credentials:"
echo "  - Anthropic API Key: https://console.anthropic.com/settings/keys"
echo "  - Google Ads creds:  ~/.cursor/mcp.json (google-ads section)"
echo "  - DataForSEO creds:  https://dataforseo.com/ (optional)"
echo ""
echo "Then run: npm run campaign list"
