/**
 * Webhook Server for n8n Integration
 * 
 * This server exposes HTTP endpoints that can be called from n8n workflows
 * to trigger PPC agent tasks.
 * 
 * Usage: npm run webhook-server
 * Default port: 3847 (configurable via PORT env var)
 */

import 'dotenv/config';
import http from 'http';
import { workflows, runAgent } from './agents/orchestrator.js';
import { createCampaign } from './agents/campaign-builder-agent.js';
import { sendSlackMessage } from './tools/notifications.js';
import { googleAdsTools } from './tools/google-ads.js';

const PORT = process.env.PORT || 3847;

interface WebhookRequest {
  action: string;
  params?: Record<string, any>;
}

interface WebhookResponse {
  success: boolean;
  data?: any;
  error?: string;
  timestamp: string;
}

/**
 * Route handler for different actions
 */
async function handleAction(action: string, params: Record<string, any> = {}): Promise<any> {
  switch (action) {
    // ============================================================
    // METRICS (Direct Google Ads queries)
    // ============================================================
    case 'get-metrics':
    case 'get-account-metrics': {
      const dateRange = params.date_range || 'LAST_7_DAYS';
      const campaigns = await googleAdsTools.get_campaign_performance.handler({
        date_range: dateRange,
        campaign_status: 'ALL',
      });
      
      // Calculate totals
      let totalSpend = 0;
      let totalClicks = 0;
      let totalImpressions = 0;
      let totalConversions = 0;
      
      for (const c of campaigns) {
        totalSpend += c.cost || 0;
        totalClicks += c.clicks || 0;
        totalImpressions += c.impressions || 0;
        totalConversions += c.conversions || 0;
      }
      
      return {
        summary: {
          totalSpend,
          totalClicks,
          totalImpressions,
          totalConversions,
          ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
          cpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
          conversionRate: totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0,
        },
        campaigns,
        dateRange,
      };
    }

    case 'get-campaigns':
      return googleAdsTools.get_campaign_performance.handler({
        date_range: params.date_range || 'LAST_7_DAYS',
        campaign_status: params.status || 'ALL',
      });

    case 'get-keywords':
      return googleAdsTools.get_keyword_performance.handler({
        date_range: params.date_range || 'LAST_7_DAYS',
        min_impressions: params.min_impressions || 0,
        limit: params.limit || 50,
      });

    // ============================================================
    // HEALTH & AUDIT
    // ============================================================
    case 'health-check':
      return workflows.quickHealthCheck(params.customer_id);

    case 'full-audit':
      return workflows.fullAudit(params.customer_id);

    // ============================================================
    // CAMPAIGNS
    // ============================================================
    case 'create-campaign':
      if (!params.description) {
        throw new Error('Missing required param: description');
      }
      return createCampaign(
        params.description,
        {
          name: params.business_name || 'Stiltner Landscapes',
          website: params.website || 'https://stiltnerlandscapes.com',
          phone: params.phone,
          services: params.services,
        },
        { dryRun: params.dry_run !== false }
      );

    // ============================================================
    // RESEARCH
    // ============================================================
    case 'keyword-research':
      if (!params.keywords || !Array.isArray(params.keywords)) {
        throw new Error('Missing required param: keywords (array)');
      }
      return workflows.keywordResearch(
        params.keywords,
        params.location || 'Columbus,Ohio,United States'
      );

    case 'competitor-analysis':
      if (!params.competitors || !Array.isArray(params.competitors)) {
        throw new Error('Missing required param: competitors (array of domains)');
      }
      return workflows.competitorAnalysis(params.competitors);

    // ============================================================
    // CUSTOM QUERY
    // ============================================================
    case 'custom':
      if (!params.query) {
        throw new Error('Missing required param: query');
      }
      return runAgent(params.query, { verbose: false });

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

/**
 * Parse JSON body from request
 */
async function parseBody(req: http.IncomingMessage): Promise<WebhookRequest> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch (e) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Create HTTP server
 */
const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check endpoint
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    return;
  }

  // API info endpoint
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      name: 'PPC Intelligence Agent Webhook Server',
      version: '0.2.0',
      endpoints: {
        'POST /webhook': 'Execute agent action',
        'GET /health': 'Health check',
      },
      actions: [
        'get-metrics',
        'get-campaigns',
        'get-keywords',
        'health-check',
        'full-audit',
        'create-campaign',
        'keyword-research',
        'competitor-analysis',
        'custom',
      ],
    }));
    return;
  }

  // Main webhook endpoint
  if (req.method === 'POST' && req.url === '/webhook') {
    const startTime = Date.now();
    let response: WebhookResponse;

    try {
      const { action, params } = await parseBody(req);

      if (!action) {
        throw new Error('Missing required field: action');
      }

      console.log(`📥 Webhook received: ${action}`);
      const result = await handleAction(action, params || {});

      response = {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      };

      console.log(`✅ Webhook completed in ${Date.now() - startTime}ms`);

    } catch (error) {
      console.error('❌ Webhook error:', error);

      response = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };

      // Send Slack alert for errors (if configured)
      await sendSlackMessage({
        text: `🚨 *PPC Agent Webhook Error*\\n\\n${response.error}`,
      }).catch(() => {}); // Don't fail if Slack fails
    }

    res.writeHead(response.success ? 200 : 400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response, null, 2));
    return;
  }

  // 404 for unknown routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// Start server
server.listen(PORT, () => {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           PPC INTELLIGENCE WEBHOOK SERVER                     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`\\n🚀 Server running at http://localhost:${PORT}`);
  console.log('\\n📡 Available endpoints:');
  console.log(`   POST http://localhost:${PORT}/webhook`);
  console.log(`   GET  http://localhost:${PORT}/health`);
  console.log('\\n📝 Example usage:');
  console.log('   { "action": "get-metrics" }');
  console.log('   { "action": "get-campaigns", "params": { "date_range": "LAST_30_DAYS" } }');
  console.log('\\n⌨️  Press Ctrl+C to stop\\n');
});
