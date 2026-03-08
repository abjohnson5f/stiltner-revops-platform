/**
 * Test campaign creation WITH the contains_eu_political_advertising field
 */
import { GoogleAdsApi, enums, ResourceNames, MutateOperation, toMicros } from 'google-ads-api';
import { env } from './config/index';

async function testWithEUField() {
  console.log('🧪 Testing WITH contains_eu_political_advertising field\n');

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
  const budgetResourceName = ResourceNames.campaignBudget(
    env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID,
    "-1"
  );

  const operations: MutateOperation<any>[] = [
    {
      entity: "campaign_budget",
      operation: "create",
      resource: {
        resource_name: budgetResourceName,
        name: `EU Fix Budget ${timestamp}`,
        delivery_method: enums.BudgetDeliveryMethod.STANDARD,
        amount_micros: toMicros(50),
      },
    },
    {
      entity: "campaign",
      operation: "create",
      resource: {
        name: `EU Fix Campaign ${timestamp}`,
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
        // THE MISSING REQUIRED FIELD!
        contains_eu_political_advertising: false,
      },
    },
  ];

  console.log('📤 Operations:');
  console.log(JSON.stringify(operations, null, 2));

  try {
    const result = await customer.mutateResources(operations, { validateOnly: true });
    console.log('\n✅ SUCCESS! Campaign creation VALIDATED!');
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (error: any) {
    console.log('\n❌ Error:', error.message);
    if (error.errors) {
      for (const e of error.errors) {
        console.log('Error code:', JSON.stringify(e.error_code));
        console.log('Field path:', e.location?.field_path_elements?.map((f: any) => f.field_name).join('.'));
      }
    }
  }
}

testWithEUField().catch(console.error);
