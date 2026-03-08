/**
 * Test campaign creation directly using Opteo library
 * to get actual Google Ads API error details
 */
import { GoogleAdsApi, enums, ResourceNames, MutateOperation, toMicros } from 'google-ads-api';
import { env } from './config/index';

async function testDirectOpteo() {
  console.log('🧪 Testing DIRECT Opteo library\n');
  console.log(`Customer ID: ${env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID}`);

  const client = new GoogleAdsApi({
    client_id: env.GOOGLE_ADS_CLIENT_ID,
    client_secret: env.GOOGLE_ADS_CLIENT_SECRET,
    developer_token: env.GOOGLE_ADS_DEVELOPER_TOKEN,
  });

  const customer = client.Customer({
    customer_id: env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID,
    login_customer_id: env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
    refresh_token: env.GOOGLE_ADS_REFRESH_TOKEN,
  });

  const timestamp = Date.now();

  // Exactly following the Opteo example
  const budgetResourceName = ResourceNames.campaignBudget(
    env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID,
    "-1"
  );

  console.log(`Budget resource name: ${budgetResourceName}`);

  const operations: MutateOperation<any>[] = [
    {
      entity: "campaign_budget",
      operation: "create",
      resource: {
        resource_name: budgetResourceName,
        name: `Direct Test Budget ${timestamp}`,
        delivery_method: enums.BudgetDeliveryMethod.STANDARD,
        amount_micros: toMicros(50),
      },
    },
    {
      entity: "campaign",
      operation: "create",
      resource: {
        name: `Direct Test Campaign ${timestamp}`,
        advertising_channel_type: enums.AdvertisingChannelType.SEARCH,
        status: enums.CampaignStatus.PAUSED,
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

  console.log('\n📤 Operations:');
  console.log(JSON.stringify(operations, null, 2));

  try {
    // validateOnly = true for dry run
    const result = await customer.mutateResources(operations, { validateOnly: true });
    console.log('\n📥 Result:');
    console.log(JSON.stringify(result, null, 2));
    console.log('\n✅ SUCCESS! Campaign creation validated.');
  } catch (error: any) {
    console.log('\n❌ Error details:');
    console.log('Message:', error.message);
    
    if (error.errors && Array.isArray(error.errors)) {
      console.log('\nGoogle Ads API Errors:');
      for (const e of error.errors) {
        console.log('---');
        console.log('Error code:', JSON.stringify(e.error_code, null, 2));
        console.log('Message:', e.message);
        console.log('Trigger:', e.trigger);
        console.log('Field path:', e.location?.field_path_elements?.map((f: any) => f.field_name).join('.'));
      }
    }
    
    // Print full error object
    console.log('\n\nFull error:');
    console.log(JSON.stringify(error, null, 2));
  }
}

testDirectOpteo().catch(console.error);
