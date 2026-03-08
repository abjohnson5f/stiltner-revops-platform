/**
 * Test the full Campaign Builder workflow
 */
import { createCampaign } from './agents/campaign-builder-agent.js';
import { shutdownMCP } from './tools/mcp-bridge.js';

async function testCampaignBuilder() {
  console.log('🧪 Testing Full Campaign Builder Workflow\n');
  
  try {
    const result = await createCampaign(
      'Create a landscape design campaign targeting Dublin and Powell Ohio with a $50/day budget. Focus on high-end residential landscape design services.',
      {
        name: 'Stiltner Landscapes',
        website: 'https://stiltnerlandscapes.com',
        phone: '(614) 555-1234',
        services: ['Landscape Design', 'Hardscaping', 'Lawn Care', 'Outdoor Living'],
      },
      {
        dryRun: true, // IMPORTANT: Don't actually create
      }
    );

    console.log('\n' + '━'.repeat(50));
    console.log('\n📊 RESULT SUMMARY\n');
    console.log(result.summary);
    
    if (result.dryRunResult?.success) {
      console.log('\n✅ Campaign Builder is fully operational!');
      console.log('\n📝 Next steps:');
      console.log('   1. Review the generated campaign spec');
      console.log('   2. Run with dryRun: false to create the campaign');
      console.log('   3. Campaign will be created in PAUSED state');
    }
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error('\nStack:', error.stack);
    }
  }
  
  await shutdownMCP();
}

testCampaignBuilder();
