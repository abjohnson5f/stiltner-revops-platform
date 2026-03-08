/**
 * Test campaign + ad group + keyword + responsive search ad
 */
import { getMCP, shutdownMCP } from './tools/mcp-bridge.js';
import { env } from './config/index.js';

async function testWithAd() {
  console.log('🧪 Testing Full Campaign Structure (Budget + Campaign + Ad Group + Keyword + Ad)\n');
  const customerId = env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID;
  console.log(`Customer ID: ${customerId}`);
  
  const mcp = await getMCP();
  const timestamp = Date.now();
  
  // Negative temp IDs for atomic creation
  const budgetTempId = '-1';
  const campaignTempId = '-2';
  const adGroupTempId = '-3';
  const keywordTempId = '-4';
  const adTempId = '-5';

  const operations = [
    // 1. Budget
    {
      entity: 'campaign_budget',
      operation: 'create',
      resource: {
        resource_name: `customers/${customerId}/campaignBudgets/${budgetTempId}`,
        name: `Full Test Budget ${timestamp}`,
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
        name: `Full Test Campaign ${timestamp}`,
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
        name: `Full Test Ad Group ${timestamp}`,
        campaign: `customers/${customerId}/campaigns/${campaignTempId}`,
        status: 2,
        type: 2, // SEARCH_STANDARD
      },
    },
    // 4. Keyword
    {
      entity: 'ad_group_criterion',
      operation: 'create',
      resource: {
        resource_name: `customers/${customerId}/adGroupCriteria/${adGroupTempId}~${keywordTempId}`,
        ad_group: `customers/${customerId}/adGroups/${adGroupTempId}`,
        status: 2,
        keyword: {
          text: 'landscape design dublin ohio',
          match_type: 2, // EXACT
        },
      },
    },
    // 5. Responsive Search Ad
    {
      entity: 'ad_group_ad',
      operation: 'create',
      resource: {
        resource_name: `customers/${customerId}/adGroupAds/${adGroupTempId}~${adTempId}`,
        ad_group: `customers/${customerId}/adGroups/${adGroupTempId}`,
        status: 2, // ENABLED
        ad: {
          final_urls: ['https://stiltnerlandscapes.com'],
          responsive_search_ad: {
            headlines: [
              { text: 'Landscape Design Dublin' },      // Max 30 chars
              { text: 'Transform Your Yard' },          
              { text: 'Free Design Consultation' },     
            ],
            descriptions: [
              { text: 'Expert landscape design services in Dublin, Ohio. Call for a free consultation today!' }, // Max 90 chars
              { text: 'Create your dream outdoor space with our professional design team. Get started now.' },
            ],
            path1: 'dublin',
            path2: 'design',
          },
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
      console.log('\n✅ FULL CAMPAIGN STRUCTURE VALIDATED!');
      console.log('\n🎉 All components working:');
      console.log('   - Campaign Budget ✓');
      console.log('   - Campaign ✓');
      console.log('   - Ad Group ✓');
      console.log('   - Keyword ✓');
      console.log('   - Responsive Search Ad ✓');
    } else {
      console.log('\n❌ Validation FAILED:', result.error);
    }
  } catch (error: any) {
    console.log('\n❌ Error:', error.message);
  }

  await shutdownMCP();
}

testWithAd();
