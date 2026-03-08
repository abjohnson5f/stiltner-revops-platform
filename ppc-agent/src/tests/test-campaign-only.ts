/**
 * Test campaign creation ONLY (using existing budget)
 */
import { getMCP, shutdownMCP } from './tools/mcp-bridge';
import { env } from './config/index';

async function testCampaignOnly() {
  console.log('🧪 Testing Campaign Creation ONLY (using existing budget)\n');
  console.log(`Customer ID: ${env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID}`);
  
  const mcp = await getMCP();
  const customerId = env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID;
  const timestamp = Date.now();
  
  // Use the EXISTING budget from the query results
  const existingBudget = `customers/${customerId}/campaignBudgets/15269990626`;

  // Campaign operation only
  const campaignOperation = {
    entity: 'campaign',
    operation: 'create',
    resource: {
      name: `Isolated Test Campaign ${timestamp}`,
      advertising_channel_type: 2, // SEARCH
      status: 3, // PAUSED
      manual_cpc: {
        enhanced_cpc_enabled: false,
      },
      campaign_budget: existingBudget,
      network_settings: {
        target_google_search: true,
        target_search_network: true,
      },
    },
  };

  console.log('\n📤 Sending operation:');
  console.log(JSON.stringify(campaignOperation, null, 2));

  try {
    const result = await mcp.mutate([campaignOperation], {
      customerId,
      dryRun: true,
      partialFailure: false,
    });

    console.log('\n📥 Result:');
    console.log(JSON.stringify(result, null, 2));

    if (result.success || !result.error) {
      console.log('\n✅ Campaign-only validation PASSED!');
    } else {
      console.log('\n❌ Campaign-only validation FAILED:', result.error);
    }
  } catch (error: any) {
    console.log('\n❌ Error:', error.message);
  }

  await shutdownMCP();
}

testCampaignOnly().catch(console.error);
