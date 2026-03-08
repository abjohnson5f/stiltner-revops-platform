/**
 * Health Check Runner
 * 
 * CLI entry point for running account health checks.
 * Usage: npm run health-check
 */

import 'dotenv/config';
import { runHealthCheck } from './agents/health-check-agent.js';

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           PPC HEALTH CHECK AGENT                              ║');
  console.log('║     Analyzing Google Ads account for issues                   ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const startTime = Date.now();

  try {
    const result = await runHealthCheck();
    
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('                    HEALTH CHECK RESULTS                        ');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    console.log(result.summary);
    
    if (result.metrics.totalSpend > 0) {
      console.log('\n📊 KEY METRICS:');
      console.log(`   Total Spend: $${result.metrics.totalSpend.toFixed(2)}`);
      console.log(`   Total Clicks: ${result.metrics.totalClicks}`);
      console.log(`   Total Conversions: ${result.metrics.totalConversions}`);
      console.log(`   CTR: ${(result.metrics.ctr * 100).toFixed(2)}%`);
      console.log(`   Avg CPC: $${result.metrics.avgCpc.toFixed(2)}`);
      console.log(`   CPA: $${result.metrics.cpa.toFixed(2)}`);
    }

    if (result.wastedSpend.total > 0) {
      console.log('\n💸 WASTED SPEND:');
      console.log(`   Total: $${result.wastedSpend.total.toFixed(2)}`);
      console.log('\n   Top wasting keywords:');
      for (const kw of result.wastedSpend.keywords.slice(0, 5)) {
        console.log(`   - "${kw.keyword}": $${kw.spend.toFixed(2)} (${kw.clicks} clicks, 0 conversions)`);
      }
    }

    if (result.issues.length > 0) {
      console.log('\n⚠️  ISSUES FOUND:');
      for (const issue of result.issues) {
        const severityIcon = {
          critical: '🔴',
          high: '🟠',
          medium: '🟡',
          low: '🟢'
        }[issue.severity];
        console.log(`   ${severityIcon} ${issue.title}`);
        console.log(`      ${issue.description}`);
        console.log(`      Impact: ${issue.impact}`);
        console.log(`      Recommendation: ${issue.recommendation}\n`);
      }
    }

    if (result.quickWins.length > 0) {
      console.log('\n⚡ QUICK WINS:');
      for (const win of result.quickWins) {
        console.log(`   ✓ ${win}`);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n⏱️  Completed in ${duration}s`);

  } catch (error) {
    console.error('❌ Health check failed:', error);
    process.exit(1);
  }
}

main().catch(console.error);
