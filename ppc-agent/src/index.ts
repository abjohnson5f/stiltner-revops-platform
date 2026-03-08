/**
 * Marketing Intelligence Agent
 * 
 * Main entry point for the autonomous marketing management agent.
 * Handles PPC, Content, CRM Operations, and Attribution.
 * 
 * Usage:
 *   npm start                              # Interactive chat mode
 *   npm start "your request here"          # Single request mode
 * 
 * Commands:
 *   npm run ops:process                    # Process outbox queue
 *   npm run ops:daemon                     # Run outbox processor continuously
 *   npm run content:newsletter             # Generate weekly newsletter
 *   npm run content:plan                   # Generate weekly content plan
 *   npm run meta:create "description"      # Create Meta campaign
 *   npm run meta:report                    # Meta Ads performance report
 *   npm run report:daily                   # Daily marketing report
 *   npm run report:weekly                  # Weekly CMO summary
 *   npm run report:attribution             # Full attribution analysis
 * 
 * Examples:
 *   npm start "Create a lawn care campaign for Dublin with $50/day budget"
 *   npm start "What keywords are wasting money?"
 *   npm start "Generate this week's newsletter about spring cleanup"
 *   npm start "What's our CPL and ROAS this month?"
 */

import 'dotenv/config';
import * as readline from 'readline';
import { runAgent, workflows } from './agents/orchestrator.js';
import { processOutboxOnce, runOperationsDaemon, operationsAgentTool } from './agents/operations-agent.js';
import { runContentWorkflow } from './agents/content-agent.js';
import { runMetaAdsWorkflow } from './agents/meta-ads-agent.js';
import { runAttributionWorkflow, runDailyAttributionTasks } from './agents/attribution-agent.js';

export { runAgent, workflows };

const BANNER = `
╔═══════════════════════════════════════════════════════════════════════════╗
║                   MARKETING INTELLIGENCE AGENT v1.0.0                     ║
║        Autonomous Marketing Management powered by Claude                  ║
╠═══════════════════════════════════════════════════════════════════════════╣
║                                                                           ║
║  Just tell me what you need in plain English:                             ║
║                                                                           ║
║  PPC:                                                                     ║
║  • "Create a landscape design campaign for Dublin and Powell"             ║
║  • "What's wasting money in my account?"                                  ║
║  • "Find competitors bidding on lawn care"                                ║
║                                                                           ║
║  Content:                                                                 ║
║  • "Generate this week's newsletter about spring cleanup"                 ║
║  • "Create a weekly content plan"                                         ║
║  • "Generate social posts about hardscaping"                              ║
║                                                                           ║
║  Meta Ads:                                                                ║
║  • "Create a Facebook campaign for lawn care leads"                       ║
║  • "How are our Meta ads performing?"                                     ║
║                                                                           ║
║  Attribution:                                                             ║
║  • "What's our CPL and ROAS this month?"                                  ║
║  • "Generate the weekly CMO report"                                       ║
║  • "Which channel is most efficient?"                                     ║
║                                                                           ║
║  Type 'help' for more commands, 'exit' to quit.                           ║
╚═══════════════════════════════════════════════════════════════════════════╝
`;

const PROMPT = '\n💬 You: ';

const HELP_TEXT = `
📖 HELP - What I can do:

  🏥 ACCOUNT HEALTH
     "Run a health check" / "What's wasting money?" / "Show my metrics"

  🚀 CAMPAIGN CREATION (Google Ads)
     "Create a [service] campaign for [cities] with $X/day budget"
     "Build a campaign for spring cleanup services"

  📱 META ADS (Facebook/Instagram)
     "Create a Meta campaign for [service] leads"
     "How are our Facebook ads performing?"
     "Generate ad copy for [service]"

  📝 CONTENT AUTOMATION
     "Generate this week's newsletter"
     "Create a weekly content plan"
     "Generate social posts about [topic]"

  📊 ATTRIBUTION & REPORTING
     "What's our CPL and ROAS this month?"
     "Generate the daily report"
     "Generate the weekly CMO summary"
     "Which channel is most efficient?"

  🔍 COMPETITOR RESEARCH
     "Find competitors bidding on [keywords]"
     "Who's competing with us for landscape design?"

  🔑 KEYWORD RESEARCH
     "Research keywords for [service]"
     "Find new keyword opportunities"

  ➖ NEGATIVE KEYWORDS
     "Suggest negative keywords" / "What searches should I block?"

  💰 BUDGET OPTIMIZATION
     "How should I reallocate my budgets?"
     "Which campaigns deserve more spend?"

  ⚙️ OPERATIONS
     "Process the outbox queue"
     "Check for pending leads"

Just describe what you need - I'll figure out the rest!
`;

/**
 * Interactive chat mode - the primary interface
 */
async function interactiveMode() {
  console.log(BANNER);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const askQuestion = () => {
    rl.question(PROMPT, async (input) => {
      const trimmed = input.trim();
      
      if (!trimmed) {
        askQuestion();
        return;
      }

      if (trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit') {
        console.log('\n👋 Goodbye!\n');
        rl.close();
        process.exit(0);
      }

      if (trimmed.toLowerCase() === 'help') {
        console.log(HELP_TEXT);
        askQuestion();
        return;
      }

      try {
        console.log('\n🤖 Agent: Thinking...\n');
        const result = await runAgent(trimmed);
        console.log('━'.repeat(70));
        console.log('\n🤖 Agent:\n');
        console.log(result.response);
        console.log('\n' + '━'.repeat(70));
        
        if (result.toolCalls.length > 0) {
          console.log(`\n📊 Used ${result.toolCalls.length} tool(s): ${result.toolCalls.map(t => t.tool).join(', ')}`);
        }
        console.log(`💰 Tokens: ${result.usage.inputTokens} in / ${result.usage.outputTokens} out`);
      } catch (error) {
        console.error('\n❌ Error:', error instanceof Error ? error.message : error);
      }

      askQuestion();
    });
  };

  askQuestion();
}

/**
 * Single request mode - run one query and exit
 */
async function singleRequestMode(query: string) {
  console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
  console.log('║                   MARKETING INTELLIGENCE AGENT v1.0.0                     ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════╝\n');
  
  console.log(`📝 Request: ${query}\n`);
  console.log('🤖 Agent: Working on it...\n');

  try {
    const result = await runAgent(query);
    console.log('━'.repeat(70));
    console.log('\n🤖 Response:\n');
    console.log(result.response);
    console.log('\n' + '━'.repeat(70));
    
    if (result.toolCalls.length > 0) {
      console.log(`\n📊 Tools used: ${result.toolCalls.map(t => t.tool).join(', ')}`);
    }
    console.log(`💰 Tokens: ${result.usage.inputTokens} in / ${result.usage.outputTokens} out\n`);
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

/**
 * Direct workflow commands (bypasses orchestrator)
 */
async function runDirectCommand(command: string, args: string[]) {
  console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
  console.log('║                   MARKETING INTELLIGENCE AGENT v1.0.0                     ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════╝\n');

  try {
    switch (command) {
      // Operations commands
      case 'ops:process':
        console.log('📤 Processing outbox queue...\n');
        const processResult = await processOutboxOnce();
        console.log('✅ Result:', JSON.stringify(processResult, null, 2));
        break;

      case 'ops:daemon':
        console.log('🔄 Starting outbox daemon (Ctrl+C to stop)...\n');
        await runOperationsDaemon();
        break;

      // Content commands
      case 'content:newsletter':
        console.log('📧 Generating newsletter...\n');
        const newsletterResult = await runContentWorkflow('newsletter', {
          topics: args.length > 0 ? args : undefined,
          notify: true,
        });
        console.log('✅ Result:', JSON.stringify(newsletterResult, null, 2));
        break;

      case 'content:plan':
        console.log('📅 Generating weekly content plan...\n');
        const planResult = await runContentWorkflow('weekly-plan', { notify: true });
        console.log('✅ Result:', JSON.stringify(planResult, null, 2));
        break;

      case 'content:social':
        console.log('📱 Generating social posts...\n');
        const socialResult = await runContentWorkflow('social', { notify: true });
        console.log('✅ Result:', JSON.stringify(socialResult, null, 2));
        break;

      // Meta Ads commands
      case 'meta:create':
        if (args.length === 0) {
          console.error('❌ Please provide a campaign description');
          console.log('Usage: npm run meta:create "Your campaign description"');
          process.exit(1);
        }
        console.log('📱 Creating Meta campaign (dry run)...\n');
        const metaCreateResult = await runMetaAdsWorkflow('create', {
          description: args.join(' '),
          dryRun: true,
          notify: true,
        });
        console.log('✅ Result:', JSON.stringify(metaCreateResult, null, 2));
        break;

      case 'meta:report':
        console.log('📊 Generating Meta Ads report...\n');
        const metaReportResult = await runMetaAdsWorkflow('analyze', { notify: true });
        console.log('✅ Result:', JSON.stringify(metaReportResult, null, 2));
        break;

      // Attribution commands
      case 'report:daily':
        console.log('📊 Generating daily report...\n');
        const dailyResult = await runAttributionWorkflow('daily-report');
        console.log('✅ Result:', JSON.stringify(dailyResult, null, 2));
        break;

      case 'report:weekly':
        console.log('📊 Generating weekly CMO report...\n');
        const weeklyResult = await runAttributionWorkflow('weekly-report');
        console.log('✅ Result:', JSON.stringify(weeklyResult, null, 2));
        break;

      case 'report:attribution':
        console.log('📊 Running full attribution analysis...\n');
        const attrResult = await runAttributionWorkflow('full');
        console.log('✅ Result:', JSON.stringify(attrResult, null, 2));
        break;

      case 'report:sync':
        console.log('🔄 Syncing metrics from ad platforms...\n');
        const syncResult = await runAttributionWorkflow('sync');
        console.log('✅ Result:', JSON.stringify(syncResult, null, 2));
        break;

      case 'report:alerts':
        console.log('🚨 Checking alert thresholds...\n');
        const alertResult = await runAttributionWorkflow('alerts');
        console.log('✅ Result:', JSON.stringify(alertResult, null, 2));
        break;

      case 'daily-tasks':
        console.log('⏰ Running all daily marketing tasks...\n');
        await runDailyAttributionTasks();
        console.log('✅ Daily tasks complete');
        break;

      default:
        console.error(`❌ Unknown command: ${command}`);
        console.log(`
Available commands:
  ops:process          - Process the outbox queue once
  ops:daemon           - Run outbox processor continuously
  content:newsletter   - Generate weekly newsletter
  content:plan         - Generate weekly content plan
  content:social       - Generate social media posts
  meta:create "desc"   - Create Meta campaign (dry run)
  meta:report          - Meta Ads performance report
  report:daily         - Daily marketing report
  report:weekly        - Weekly CMO summary
  report:attribution   - Full attribution analysis
  report:sync          - Sync metrics from ad platforms
  report:alerts        - Check alert thresholds
  daily-tasks          - Run all daily marketing tasks
        `);
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Main entry point
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    // No arguments = interactive mode
    await interactiveMode();
  } else if (args[0].includes(':') || args[0] === 'daily-tasks') {
    // Command mode (e.g., ops:process, content:newsletter)
    await runDirectCommand(args[0], args.slice(1));
  } else {
    // Arguments = treat as a single request to orchestrator
    const query = args.join(' ');
    await singleRequestMode(query);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
