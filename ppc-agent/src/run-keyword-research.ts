/**
 * Keyword Research Runner
 * 
 * CLI entry point for running keyword research.
 * Usage: npm run keyword-research "landscape design" "lawn care"
 */

import 'dotenv/config';
import { workflows } from './agents/orchestrator.js';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: npm run keyword-research "keyword1" "keyword2" ...');
    console.log('\nExample:');
    console.log('  npm run keyword-research "landscape design" "lawn care dublin ohio"');
    process.exit(1);
  }

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           KEYWORD RESEARCH AGENT                              ║');
  console.log('║     Finding high-value PPC keywords                           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  console.log(`🔑 Seed Keywords: ${args.join(', ')}`);
  console.log(`📍 Location: Columbus, Ohio, United States\n`);

  const startTime = Date.now();

  try {
    const result = await workflows.keywordResearch(args, 'Columbus,Ohio,United States');
    
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('                 KEYWORD RESEARCH RESULTS                       ');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    console.log(result.response);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n⏱️  Completed in ${duration}s`);
    console.log(`💰 Tokens: ${result.usage.inputTokens.toLocaleString()} in / ${result.usage.outputTokens.toLocaleString()} out`);

  } catch (error) {
    console.error('❌ Keyword research failed:', error);
    process.exit(1);
  }
}

main().catch(console.error);
