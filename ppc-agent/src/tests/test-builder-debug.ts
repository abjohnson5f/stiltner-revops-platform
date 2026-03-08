/**
 * Debug the Campaign Builder operations
 */
import { buildCampaignOperations, CampaignSpec } from './agents/campaign-builder-agent.js';
import { getMCP, shutdownMCP } from './tools/mcp-bridge.js';
import { env } from './config/index.js';

async function testBuilderDebug() {
  console.log('🔍 Debugging Campaign Builder Operations\n');
  
  const customerId = env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID;
  console.log(`Customer ID: ${customerId}`);
  
  const timestamp = Date.now();
  
  // Simple test spec with unique name
  const spec: CampaignSpec = {
    name: `Debug Test Campaign ${timestamp}`,
    dailyBudget: 50,
    biddingStrategy: 'MAXIMIZE_CLICKS', // Testing target_spend fix
    networks: 'SEARCH_ONLY',
    locations: ['Dublin, Ohio'],
    adGroups: [
      {
        name: 'Landscape Design',
        keywords: [
          { text: 'landscape design dublin ohio', matchType: 'EXACT' },
        ],
        ads: [
          {
            headlines: [
              'Landscape Design Dublin',
              'Transform Your Yard',
              'Free Consultation',
            ],
            descriptions: [
              'Expert landscape design in Dublin, Ohio. Call today!',
              'Create your dream outdoor space. Get started now.',
            ],
            finalUrl: 'https://stiltnerlandscapes.com',
            path1: 'dublin',
            path2: 'design',
          },
        ],
      },
    ],
  };
  
  console.log('\n📋 Building operations...');
  const operations = buildCampaignOperations(customerId, spec);
  
  console.log(`\n📊 Generated ${operations.length} operations:\n`);
  operations.forEach((op, i) => {
    console.log(`\n=== Operation ${i + 1}: ${op.entity} ===`);
    console.log(JSON.stringify(op, null, 2));
  });
  
  // Now test via MCP
  console.log('\n\n📤 Sending to MCP...');
  const mcp = await getMCP();
  
  try {
    const result = await mcp.mutate(operations, {
      customerId,
      dryRun: true,
      partialFailure: true, // Use partial failure to see which specific operations fail
    });

    console.log('\n📥 Result:');
    console.log(JSON.stringify(result, null, 2));
  } catch (error: any) {
    console.log('\n❌ Error:', error.message);
  }
  
  await shutdownMCP();
}

testBuilderDebug();
