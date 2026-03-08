/**
 * Test script to validate budget + campaign creation via MCP
 */
import { getMCP, shutdownMCP } from './tools/mcp-bridge';
import { env } from './config/index';

async function testCampaignCreation() {
  console.log('🧪 Testing Campaign Creation via MCP\n');
  console.log(`Customer ID: ${env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID}`);
  
  const mcp = await getMCP();
  const customerId = env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID;
  const timestamp = Date.now();
  
  // Budget operation (temp ID -1)
  // Using NUMERIC enum values as seen in query results
  const budgetOperation = {
    entity: 'campaign_budget',
    operation: 'create',
    resource: {
      resource_name: `customers/${customerId}/campaignBudgets/-1`,
      name: `Test Budget ${timestamp}`,
      amount_micros: 50000000, // $50/day
      delivery_method: 2, // STANDARD = 2
    },
  };

  // Campaign operation (references budget -1 via temp ID)
  // Using NUMERIC enum values as seen in query results
  const campaignOperation = {
    entity: 'campaign',
    operation: 'create',
    resource: {
      name: `Test Campaign ${timestamp}`,
      advertising_channel_type: 2, // SEARCH = 2
      status: 3, // PAUSED = 3
      manual_cpc: {
        enhanced_cpc_enabled: false,
      },
      campaign_budget: `customers/${customerId}/campaignBudgets/-1`,
      network_settings: {
        target_google_search: true,
        target_search_network: true,
      },
    },
  };

  const operations = [budgetOperation, campaignOperation];

  console.log('\n📤 Sending operations:');
  console.log(JSON.stringify(operations, null, 2));

  try {
    const result = await mcp.mutate(operations, {
      customerId,
      dryRun: true,
      partialFailure: false,
    });

    console.log('\n📥 Result:');
    console.log(JSON.stringify(result, null, 2));

    if (result.success || !result.error) {
      console.log('\n✅ Campaign validation PASSED!');
    } else {
      console.log('\n❌ Campaign validation FAILED:', result.error);
    }
  } catch (error: any) {
    console.log('\n❌ Error:', error.message);
  }

  await shutdownMCP();
}

testCampaignCreation().catch(console.error);
