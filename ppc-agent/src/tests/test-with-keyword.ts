/**
 * Test campaign + ad group + keyword
 */
import { getMCP, shutdownMCP } from './tools/mcp-bridge.js';
import { env } from './config/index.js';

async function testWithKeyword() {
  console.log('🧪 Testing Campaign + Ad Group + Keyword\n');
  const customerId = env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID;
  console.log(`Customer ID: ${customerId}`);
  
  const mcp = await getMCP();
  const timestamp = Date.now();
  
  // Negative temp IDs for atomic creation
  const budgetTempId = '-1';
  const campaignTempId = '-2';
  const adGroupTempId = '-3';
  const keywordTempId = '-4';

  const operations = [
    // 1. Budget
    {
      entity: 'campaign_budget',
      operation: 'create',
      resource: {
        resource_name: `customers/${customerId}/campaignBudgets/${budgetTempId}`,
        name: `Keyword Test Budget ${timestamp}`,
        delivery_method: 2,
        amount_micros: 50_000_000,
      },
    },
    // 2. Campaign
    {
      entity: 'campaign',
      operation: 'create',
      resource: {
        resource_name: `customers/${customerId}/campaigns/${campaignTempId}`,
        name: `Keyword Test Campaign ${timestamp}`,
        advertising_channel_type: 2,
        status: 3,
        manual_cpc: { enhanced_cpc_enabled: false },
        campaign_budget: `customers/${customerId}/campaignBudgets/${budgetTempId}`,
        network_settings: {
          target_google_search: true,
          target_search_network: true,
        },
        contains_eu_political_advertising: 3,
      },
    },
    // 3. Ad Group
    {
      entity: 'ad_group',
      operation: 'create',
      resource: {
        resource_name: `customers/${customerId}/adGroups/${adGroupTempId}`,
        name: `Keyword Test Ad Group ${timestamp}`,
        campaign: `customers/${customerId}/campaigns/${campaignTempId}`,
        status: 2,
        type: 2,
      },
    },
    // 4. Keyword (ad_group_criterion)
    {
      entity: 'ad_group_criterion',
      operation: 'create',
      resource: {
        // Format: customers/{customer_id}/adGroupCriteria/{ad_group_id}~{criterion_id}
        resource_name: `customers/${customerId}/adGroupCriteria/${adGroupTempId}~${keywordTempId}`,
        ad_group: `customers/${customerId}/adGroups/${adGroupTempId}`,
        status: 2, // ENABLED
        keyword: {
          text: 'landscape design dublin ohio',
          match_type: 2, // EXACT
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
      console.log('\n✅ Validation PASSED!');
    } else {
      console.log('\n❌ Validation FAILED:', result.error);
    }
  } catch (error: any) {
    console.log('\n❌ Error:', error.message);
  }

  await shutdownMCP();
}

testWithKeyword();
