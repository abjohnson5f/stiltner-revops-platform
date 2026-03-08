/**
 * Full Audit Runner
 * 
 * CLI entry point for running comprehensive PPC audits.
 * Combines health check + competitor intel + keyword research.
 * Usage: npm run full-audit
 */

import 'dotenv/config';
import { workflows } from './agents/orchestrator.js';

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           PPC FULL AUDIT AGENT                                ║');
  console.log('║     Comprehensive Google Ads Analysis                         ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  console.log('This audit will:');
  console.log('  1. Run account health check');
  console.log('  2. Analyze competitor landscape');
  console.log('  3. Identify wasted spend');
  console.log('  4. Find new keyword opportunities');
  console.log('  5. Generate action plan\n');

  const startTime = Date.now();

  try {
    const result = await workflows.fullAudit();
    
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('                    FULL AUDIT RESULTS                          ');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    console.log(result.response);

    console.log('\n───────────────────────────────────────────────────────────────');
    console.log('                       AUDIT METADATA                           ');
    console.log('───────────────────────────────────────────────────────────────');
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`⏱️  Duration: ${duration}s`);
    console.log(`📊 Tool Calls: ${result.toolCalls.length}`);
    console.log(`💰 Tokens: ${result.usage.inputTokens.toLocaleString()} in / ${result.usage.outputTokens.toLocaleString()} out`);
    
    // Estimate cost (Claude 3.5 Sonnet pricing)
    const inputCost = (result.usage.inputTokens / 1_000_000) * 3;
    const outputCost = (result.usage.outputTokens / 1_000_000) * 15;
    console.log(`💵 Est. Cost: $${(inputCost + outputCost).toFixed(4)}`);

    if (result.toolCalls.length > 0) {
      console.log('\n🔧 Tools Used:');
      const toolCounts = result.toolCalls.reduce((acc, tc) => {
        acc[tc.tool] = (acc[tc.tool] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      for (const [tool, count] of Object.entries(toolCounts)) {
        console.log(`   • ${tool}: ${count}x`);
      }
    }

  } catch (error) {
    console.error('❌ Full audit failed:', error);
    process.exit(1);
  }
}

main().catch(console.error);
