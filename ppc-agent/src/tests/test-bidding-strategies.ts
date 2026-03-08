/**
 * Test different bidding strategies directly with Opteo
 */
import googleAdsApi from 'google-ads-api';
const { GoogleAdsApi, ResourceNames, enums } = googleAdsApi;
import { env } from './config/index.js';

async function testBiddingStrategies() {
  console.log('🧪 Testing Bidding Strategies\n');
  const customerId = env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID;
  
  const client = new GoogleAdsApi({
    developer_token: env.GOOGLE_ADS_DEVELOPER_TOKEN,
    client_id: env.GOOGLE_ADS_CLIENT_ID,
    client_secret: env.GOOGLE_ADS_CLIENT_SECRET,
    refresh_token: env.GOOGLE_ADS_REFRESH_TOKEN,
  });
  
  const customer = client.Customer({
    customer_id: customerId,
    login_customer_id: env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
  });

  const budgetResourceName = ResourceNames.campaignBudget(customerId, "-1");
  const timestamp = Date.now();

  // Test MAXIMIZE_CLICKS
  const operationsMaxClicks = [
    {
      entity: "campaign_budget",
      operation: "create",
      resource: {
        resource_name: budgetResourceName,
        name: `Max Clicks Budget ${timestamp}`,
        delivery_method: 2,
        amount_micros: 50_000_000,
      },
    },
    {
      entity: "campaign",
      operation: "create",
      resource: {
        name: `Max Clicks Campaign ${timestamp}`,
        advertising_channel_type: 2,
        status: 3,
        // Try with maximize_clicks as just an empty object but with the proper typing
        maximize_clicks: {
          // cpc_bid_ceiling_micros is optional, let's try without it
        },
        campaign_budget: budgetResourceName,
        network_settings: {
          target_google_search: true,
          target_search_network: true,
        },
        contains_eu_political_advertising: 3,
      },
    },
  ];
  
  console.log('Testing MAXIMIZE_CLICKS with empty object:');
  console.log(JSON.stringify(operationsMaxClicks[1].resource.maximize_clicks, null, 2));
  
  try {
    const result = await customer.mutateResources(operationsMaxClicks, { validateOnly: true });
    console.log('✅ MAXIMIZE_CLICKS with empty object WORKS!');
  } catch (error: any) {
    console.log('❌ Failed:', error.errors?.[0]?.message || error.message);
    console.log('Field:', error.errors?.[0]?.location?.field_path_elements?.map((e: any) => e.field_name).join('.'));
  }

  // Now test with an explicit false/null value
  console.log('\n\nTesting MAXIMIZE_CLICKS without the field (default bidding):');
  const operationsDefault = [
    {
      entity: "campaign_budget",
      operation: "create",
      resource: {
        resource_name: ResourceNames.campaignBudget(customerId, "-2"),
        name: `Default Budget ${timestamp}`,
        delivery_method: 2,
        amount_micros: 50_000_000,
      },
    },
    {
      entity: "campaign",
      operation: "create",
      resource: {
        name: `Default Campaign ${timestamp}`,
        advertising_channel_type: 2,
        status: 3,
        // No bidding strategy specified
        campaign_budget: ResourceNames.campaignBudget(customerId, "-2"),
        network_settings: {
          target_google_search: true,
          target_search_network: true,
        },
        contains_eu_political_advertising: 3,
      },
    },
  ];
  
  try {
    const result = await customer.mutateResources(operationsDefault, { validateOnly: true });
    console.log('✅ No bidding strategy WORKS!');
  } catch (error: any) {
    console.log('❌ Failed:', error.errors?.[0]?.message || error.message);
  }

  // Test MANUAL_CPC (this worked before)
  console.log('\n\nTesting MANUAL_CPC (should work):');
  const operationsManual = [
    {
      entity: "campaign_budget",
      operation: "create",
      resource: {
        resource_name: ResourceNames.campaignBudget(customerId, "-3"),
        name: `Manual CPC Budget ${timestamp}`,
        delivery_method: 2,
        amount_micros: 50_000_000,
      },
    },
    {
      entity: "campaign",
      operation: "create",
      resource: {
        name: `Manual CPC Campaign ${timestamp}`,
        advertising_channel_type: 2,
        status: 3,
        manual_cpc: {
          enhanced_cpc_enabled: false,
        },
        campaign_budget: ResourceNames.campaignBudget(customerId, "-3"),
        network_settings: {
          target_google_search: true,
          target_search_network: true,
        },
        contains_eu_political_advertising: 3,
      },
    },
  ];
  
  try {
    const result = await customer.mutateResources(operationsManual, { validateOnly: true });
    console.log('✅ MANUAL_CPC WORKS!');
  } catch (error: any) {
    console.log('❌ Failed:', error.errors?.[0]?.message || error.message);
  }
}

testBiddingStrategies().catch(console.error);
