/**
 * Debug different MAXIMIZE_CLICKS formats via MCP Bridge
 */
import { getMCP } from './tools/mcp-bridge.js';
import { env } from './config/index.js';

async function testBiddingDebug() {
  console.log('🧪 Testing Different MAXIMIZE_CLICKS Formats via MCP\n');
  const customerId = env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID;
  console.log(`Customer ID: ${customerId}\n`);

  const mcp = await getMCP();
  const timestamp = Date.now();

  // Test 1: Empty object for maximize_clicks
  console.log('=== Test 1: Empty maximize_clicks object ===');
  const ops1 = [
    {
      entity: 'campaign_budget',
      operation: 'create',
      resource: {
        resource_name: `customers/${customerId}/campaignBudgets/-1`,
        name: `Bidding Test 1 Budget ${timestamp}`,
        delivery_method: 2,
        amount_micros: 50_000_000,
      },
    },
    {
      entity: 'campaign',
      operation: 'create',
      resource: {
        resource_name: `customers/${customerId}/campaigns/-2`,
        name: `Bidding Test 1 Campaign ${timestamp}`,
        advertising_channel_type: 2,
        status: 3,
        campaign_budget: `customers/${customerId}/campaignBudgets/-1`,
        network_settings: {
          target_google_search: true,
          target_search_network: true,
        },
        contains_eu_political_advertising: 3,
        maximize_clicks: {}, // Empty object
      },
    },
  ];

  try {
    const result1 = await mcp.mutate(ops1, { customerId, dryRun: true });
    if (result1.success && (!result1.metadata?.errors || result1.metadata.errors.length === 0)) {
      console.log('✅ Test 1 PASSED!\n');
    } else {
      console.log('❌ Test 1 FAILED:', result1.metadata?.errors?.[0]?.message || 'Unknown error');
      console.log('Field:', result1.metadata?.errors?.[0]?.field_path, '\n');
    }
  } catch (error: any) {
    console.log('❌ Test 1 Error:', error.message, '\n');
  }

  // Test 2: No bidding strategy field at all (let Google default)
  console.log('=== Test 2: No bidding strategy field ===');
  const ops2 = [
    {
      entity: 'campaign_budget',
      operation: 'create',
      resource: {
        resource_name: `customers/${customerId}/campaignBudgets/-3`,
        name: `Bidding Test 2 Budget ${timestamp}`,
        delivery_method: 2,
        amount_micros: 50_000_000,
      },
    },
    {
      entity: 'campaign',
      operation: 'create',
      resource: {
        resource_name: `customers/${customerId}/campaigns/-4`,
        name: `Bidding Test 2 Campaign ${timestamp}`,
        advertising_channel_type: 2,
        status: 3,
        campaign_budget: `customers/${customerId}/campaignBudgets/-3`,
        network_settings: {
          target_google_search: true,
          target_search_network: true,
        },
        contains_eu_political_advertising: 3,
        // No bidding strategy specified
      },
    },
  ];

  try {
    const result2 = await mcp.mutate(ops2, { customerId, dryRun: true });
    if (result2.success && (!result2.metadata?.errors || result2.metadata.errors.length === 0)) {
      console.log('✅ Test 2 PASSED!\n');
    } else {
      console.log('❌ Test 2 FAILED:', result2.metadata?.errors?.[0]?.message || 'Unknown error');
      console.log('Field:', result2.metadata?.errors?.[0]?.field_path, '\n');
    }
  } catch (error: any) {
    console.log('❌ Test 2 Error:', error.message, '\n');
  }

  // Test 3: Manual CPC (known to work)
  console.log('=== Test 3: Manual CPC (known to work) ===');
  const ops3 = [
    {
      entity: 'campaign_budget',
      operation: 'create',
      resource: {
        resource_name: `customers/${customerId}/campaignBudgets/-5`,
        name: `Bidding Test 3 Budget ${timestamp}`,
        delivery_method: 2,
        amount_micros: 50_000_000,
      },
    },
    {
      entity: 'campaign',
      operation: 'create',
      resource: {
        resource_name: `customers/${customerId}/campaigns/-6`,
        name: `Bidding Test 3 Campaign ${timestamp}`,
        advertising_channel_type: 2,
        status: 3,
        campaign_budget: `customers/${customerId}/campaignBudgets/-5`,
        network_settings: {
          target_google_search: true,
          target_search_network: true,
        },
        contains_eu_political_advertising: 3,
        manual_cpc: { enhanced_cpc_enabled: false },
      },
    },
  ];

  try {
    const result3 = await mcp.mutate(ops3, { customerId, dryRun: true });
    if (result3.success && (!result3.metadata?.errors || result3.metadata.errors.length === 0)) {
      console.log('✅ Test 3 PASSED!\n');
    } else {
      console.log('❌ Test 3 FAILED:', result3.metadata?.errors?.[0]?.message || 'Unknown error');
      console.log('Field:', result3.metadata?.errors?.[0]?.field_path, '\n');
    }
  } catch (error: any) {
    console.log('❌ Test 3 Error:', error.message, '\n');
  }

  // Test 4: maximize_conversions (another standard strategy)
  console.log('=== Test 4: Maximize Conversions ===');
  const ops4 = [
    {
      entity: 'campaign_budget',
      operation: 'create',
      resource: {
        resource_name: `customers/${customerId}/campaignBudgets/-7`,
        name: `Bidding Test 4 Budget ${timestamp}`,
        delivery_method: 2,
        amount_micros: 50_000_000,
      },
    },
    {
      entity: 'campaign',
      operation: 'create',
      resource: {
        resource_name: `customers/${customerId}/campaigns/-8`,
        name: `Bidding Test 4 Campaign ${timestamp}`,
        advertising_channel_type: 2,
        status: 3,
        campaign_budget: `customers/${customerId}/campaignBudgets/-7`,
        network_settings: {
          target_google_search: true,
          target_search_network: true,
        },
        contains_eu_political_advertising: 3,
        maximize_conversions: {},
      },
    },
  ];

  try {
    const result4 = await mcp.mutate(ops4, { customerId, dryRun: true });
    if (result4.success && (!result4.metadata?.errors || result4.metadata.errors.length === 0)) {
      console.log('✅ Test 4 PASSED!\n');
    } else {
      console.log('❌ Test 4 FAILED:', result4.metadata?.errors?.[0]?.message || 'Unknown error');
      console.log('Field:', result4.metadata?.errors?.[0]?.field_path, '\n');
    }
  } catch (error: any) {
    console.log('❌ Test 4 Error:', error.message, '\n');
  }

  // Test 5: target_spend (another approach for maximize clicks)
  console.log('=== Test 5: Target Spend (alternative to maximize_clicks) ===');
  const ops5 = [
    {
      entity: 'campaign_budget',
      operation: 'create',
      resource: {
        resource_name: `customers/${customerId}/campaignBudgets/-9`,
        name: `Bidding Test 5 Budget ${timestamp}`,
        delivery_method: 2,
        amount_micros: 50_000_000,
      },
    },
    {
      entity: 'campaign',
      operation: 'create',
      resource: {
        resource_name: `customers/${customerId}/campaigns/-10`,
        name: `Bidding Test 5 Campaign ${timestamp}`,
        advertising_channel_type: 2,
        status: 3,
        campaign_budget: `customers/${customerId}/campaignBudgets/-9`,
        network_settings: {
          target_google_search: true,
          target_search_network: true,
        },
        contains_eu_political_advertising: 3,
        target_spend: {},
      },
    },
  ];

  try {
    const result5 = await mcp.mutate(ops5, { customerId, dryRun: true });
    if (result5.success && (!result5.metadata?.errors || result5.metadata.errors.length === 0)) {
      console.log('✅ Test 5 PASSED!\n');
    } else {
      console.log('❌ Test 5 FAILED:', result5.metadata?.errors?.[0]?.message || 'Unknown error');
      console.log('Field:', result5.metadata?.errors?.[0]?.field_path, '\n');
    }
  } catch (error: any) {
    console.log('❌ Test 5 Error:', error.message, '\n');
  }

  console.log('=== Summary ===');
  console.log('We need to find a bidding strategy that works via MCP Bridge.\n');

  await mcp.stop();
}

testBiddingDebug().catch(console.error);
