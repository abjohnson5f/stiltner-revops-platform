/**
 * Test minimal campaign with just budget + campaign + 1 ad group
 * to isolate where the failures occur
 */
import { getMCP, shutdownMCP } from './tools/mcp-bridge.js';
import { env } from './config/index.js';

async function testMinimalCampaign() {
  console.log('🧪 Testing Minimal Campaign (Budget + Campaign + Ad Group)\n');
  const customerId = env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID;
  console.log(`Customer ID: ${customerId}`);
  
  const mcp = await getMCP();
  const timestamp = Date.now();
  
  // Negative temp IDs for atomic creation
  const budgetTempId = '-1';
  const campaignTempId = '-2';
  const adGroupTempId = '-3';

  const operations = [
    // 1. Budget
    {
      entity: 'campaign_budget',
      operation: 'create',
      resource: {
        resource_name: `customers/${customerId}/campaignBudgets/${budgetTempId}`,
        name: `Minimal Test Budget ${timestamp}`,
        delivery_method: 2, // STANDARD
        amount_micros: 50_000_000,
      },
    },
    // 2. Campaign
    {
      entity: 'campaign',
      operation: 'create',
      resource: {
        resource_name: `customers/${customerId}/campaigns/${campaignTempId}`,
        name: `Minimal Test Campaign ${timestamp}`,
        advertising_channel_type: 2, // SEARCH
        status: 3, // PAUSED
        manual_cpc: { enhanced_cpc_enabled: false },
        campaign_budget: `customers/${customerId}/campaignBudgets/${budgetTempId}`,
        network_settings: {
          target_google_search: true,
          target_search_network: true,
        },
        contains_eu_political_advertising: 3, // DOES_NOT_CONTAIN
      },
    },
    // 3. Ad Group
    {
      entity: 'ad_group',
      operation: 'create',
      resource: {
        resource_name: `customers/${customerId}/adGroups/${adGroupTempId}`,
        name: `Minimal Test Ad Group ${timestamp}`,
        campaign: `customers/${customerId}/campaigns/${campaignTempId}`,
        status: 2, // ENABLED
        type: 2, // SEARCH_STANDARD
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
      console.log('\n✅ Minimal campaign validation PASSED!');
    } else {
      console.log('\n❌ Validation FAILED:', result.error);
    }
  } catch (error: any) {
    console.log('\n❌ Error:', error.message);
  }

  await shutdownMCP();
}

testMinimalCampaign();
