/**
 * Test location targeting with correct Google Ads API format
 * 
 * Based on Google Ads API docs, campaign_criterion uses a flat structure
 * with location.geo_target_constant directly (not wrapped in criterion)
 */
import { getMCP, shutdownMCP } from './tools/mcp-bridge.js';
import { env } from './config/index.js';

async function testLocationV3() {
  console.log('🧪 Testing Location Targeting (V3 - Flat format)\n');
  const customerId = env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID;
  
  const mcp = await getMCP();
  const timestamp = Date.now();
  
  const budgetTempId = '-1';
  const campaignTempId = '-2';

  // Dublin, Ohio geo target constant ID
  const dublinOhioGeoId = '1014895';

  const operations = [
    // 1. Budget
    {
      entity: 'campaign_budget',
      operation: 'create',
      resource: {
        resource_name: `customers/${customerId}/campaignBudgets/${budgetTempId}`,
        name: `Location V3 Test Budget ${timestamp}`,
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
        name: `Location V3 Test Campaign ${timestamp}`,
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
    // 3. Location targeting - flat format with type
    {
      entity: 'campaign_criterion',
      operation: 'create',
      resource: {
        campaign: `customers/${customerId}/campaigns/${campaignTempId}`,
        type: 6, // LOCATION
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
      console.log('\n✅ Location targeting V3 PASSED!');
    } else {
      console.log('\n❌ Validation FAILED:', result.error);
    }
  } catch (error: any) {
    console.log('\n❌ Error:', error.message);
  }

  await shutdownMCP();
}

testLocationV3();
