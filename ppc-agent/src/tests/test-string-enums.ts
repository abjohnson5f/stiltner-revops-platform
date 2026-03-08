/**
 * Test campaign creation with STRING enum values
 */
import { getMCP, shutdownMCP } from './tools/mcp-bridge';
import { env } from './config/index';

async function testStringEnums() {
  console.log('🧪 Testing Campaign with STRING enum values\n');
  console.log(`Customer ID: ${env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID}`);
  
  const mcp = await getMCP();
  const customerId = env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID;
  const timestamp = Date.now();

  // Create temp budget first
  const budgetResourceName = `customers/${customerId}/campaignBudgets/-1`;
  
  const operations = [
    // Budget - with resource_name (temp ID)
    {
      entity: 'campaign_budget',
      operation: 'create',
      resource: {
        resource_name: budgetResourceName,
        name: `Test Budget ${timestamp}`,
        delivery_method: 'STANDARD', // STRING instead of number
        amount_micros: 50_000_000,
      },
    },
    // Campaign - NO resource_name
    {
      entity: 'campaign',
      operation: 'create',
      resource: {
        name: `Test Campaign ${timestamp}`,
        advertising_channel_type: 'SEARCH', // STRING instead of number
        status: 'PAUSED', // STRING instead of number
        manual_cpc: {
          enhanced_cpc_enabled: false,
        },
        campaign_budget: budgetResourceName,
        network_settings: {
          target_google_search: true,
          target_search_network: true,
        },
      },
    },
  ];

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
      console.log('\n✅ STRING ENUM validation PASSED!');
    } else {
      console.log('\n❌ STRING ENUM validation FAILED:', result.error);
    }
  } catch (error: any) {
    console.log('\n❌ Error:', error.message);
  }

  await shutdownMCP();
}

testStringEnums().catch(console.error);
