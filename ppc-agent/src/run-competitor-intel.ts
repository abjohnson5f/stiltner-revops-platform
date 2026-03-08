/**
 * Competitor Intelligence Runner
 * 
 * CLI entry point for running competitor analysis.
 * Usage: npm run competitor-intel [domain1] [domain2] ...
 */

import 'dotenv/config';
import { runCompetitorIntel } from './agents/competitor-intel-agent.js';

const DEFAULT_SEED_KEYWORDS = [
  'landscape design Columbus Ohio',
  'lawn care Dublin Ohio',
  'hardscaping Powell Ohio',
  'landscaping near me',
  'landscape contractor Central Ohio',
];

async function main() {
  const args = process.argv.slice(2);
  const targetDomain = args[0] || 'stiltnerlandscapes.com';
  const seedKeywords = args.length > 1 ? args.slice(1) : DEFAULT_SEED_KEYWORDS;

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           COMPETITOR INTELLIGENCE AGENT                       ║');
  console.log('║     Analyzing competitive landscape for PPC                   ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  console.log(`📎 Target Domain: ${targetDomain}`);
  console.log(`🔑 Seed Keywords: ${seedKeywords.join(', ')}\n`);

  const startTime = Date.now();

  try {
    const result = await runCompetitorIntel(targetDomain, seedKeywords, 'United States');
    
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('                 COMPETITOR ANALYSIS RESULTS                    ');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    console.log(result.summary);

    if (result.competitors.length > 0) {
      console.log('\n🏢 TOP COMPETITORS:');
      for (const comp of result.competitors) {
        const threatIcon = {
          high: '🔴',
          medium: '🟠',
          low: '🟢'
        }[comp.threatLevel];
        console.log(`   ${threatIcon} ${comp.domain}`);
        console.log(`      Est. Monthly Spend: $${comp.estimatedSpend.toLocaleString()}`);
        console.log(`      Keywords: ${comp.keywordsCount}`);
        console.log(`      Avg Position: ${comp.avgPosition.toFixed(1)}\n`);
      }
    }

    if (result.gapKeywords.length > 0) {
      console.log('\n🎯 GAP KEYWORDS (Competitors have, you don\'t):');
      for (const kw of result.gapKeywords.slice(0, 10)) {
        console.log(`   • "${kw.keyword}"`);
        console.log(`     Volume: ${kw.volume} | CPC: $${kw.cpc.toFixed(2)} | Competitor: ${kw.competitorRanking}`);
      }
    }

    if (result.attackOpportunities.length > 0) {
      console.log('\n⚔️  ATTACK OPPORTUNITIES (Weak competitor positions):');
      for (const opp of result.attackOpportunities.slice(0, 10)) {
        console.log(`   • "${opp.keyword}"`);
        console.log(`     Volume: ${opp.volume} | Competitor Pos: ${opp.competitorPosition}`);
        console.log(`     ${opp.recommendation}`);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n⏱️  Completed in ${duration}s`);

  } catch (error) {
    console.error('❌ Competitor analysis failed:', error);
    process.exit(1);
  }
}

main().catch(console.error);
