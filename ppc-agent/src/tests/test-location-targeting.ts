/**
 * Test location targeting (campaign_criterion)
 */
import { getMCP, shutdownMCP } from './tools/mcp-bridge.js';
import { env } from './config/index.js';

async function testLocationTargeting() {
  console.log('🧪 Testing Location Targeting\n');
  const customerId = env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID;
  
  const mcp = await getMCP();
  const timestamp = Date.now();
  
  const budgetTempId = '-1';
  const campaignTempId = '-2';
  const locationTempId = '-3';

  // Dublin, Ohio geo target constant ID
  const dublinOhioGeoId = '1014895';

  const operations = [
    // 1. Budget
    {
      entity: 'campaign_budget',
      operation: 'create',
      resource: {
        resource_name: `customers/${customerId}/campaignBudgets/${budgetTempId}`,
        name: `Location Test Budget ${timestamp}`,
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
        name: `Location Test Campaign ${timestamp}`,
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
    // 3. Location targeting (campaign_criterion)
    {
      entity: 'campaign_criterion',
      operation: 'create',
      resource: {
        resource_name: `customers/${customerId}/campaignCriteria/${campaignTempId}~${locationTempId}`,
        campaign: `customers/${customerId}/campaigns/${campaignTempId}`,
        location: {
          geo_target_constant: `geoTargetConstants/${dublinOhioGeoId}`,
        },
        negative: false,
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
      console.log('\n✅ Location targeting PASSED!');
    } else {
      console.log('\n❌ Validation FAILED:', result.error);
    }
  } catch (error: any) {
    console.log('\n❌ Error:', error.message);
  }

  await shutdownMCP();
}

testLocationTargeting();
