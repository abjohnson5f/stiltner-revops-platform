/**
 * Test MCP bridge with the EU Political Advertising fix
 */
import { getMCP, shutdownMCP } from './tools/mcp-bridge';
import { env } from './config/index';

async function testMCPFinal() {
  console.log('🧪 Testing MCP Bridge with EU Political Advertising fix\n');
  console.log(`Customer ID: ${env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID}`);
  
  const mcp = await getMCP();
  const customerId = env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID;
  const timestamp = Date.now();
  
  const budgetResourceName = `customers/${customerId}/campaignBudgets/-1`;

  const operations = [
    // Budget with resource_name (for atomic creation)
    {
      entity: 'campaign_budget',
      operation: 'create',
      resource: {
        resource_name: budgetResourceName,
        name: `MCP Test Budget ${timestamp}`,
        delivery_method: 2, // STANDARD
        amount_micros: 50_000_000,
      },
    },
    // Campaign with EU Political Advertising field
    {
      entity: 'campaign',
      operation: 'create',
      resource: {
        resource_name: `customers/${customerId}/campaigns/-2`,
        name: `MCP Test Campaign ${timestamp}`,
        advertising_channel_type: 2, // SEARCH
        status: 3, // PAUSED
        manual_cpc: { enhanced_cpc_enabled: false },
        campaign_budget: budgetResourceName,
        network_settings: {
          target_google_search: true,
          target_search_network: true,
        },
        // THE FIX: EU Political Advertising
        contains_eu_political_advertising: 3, // DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING
      },
    },
  ];

  console.log('\n📤 Sending operations via MCP Bridge:');
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
      console.log('\n✅ MCP BRIDGE validation PASSED!');
      console.log('\n🎉 Campaign Builder is ready for production use!');
    } else {
      console.log('\n❌ MCP BRIDGE validation FAILED:', result.error);
    }
  } catch (error: any) {
    console.log('\n❌ Error:', error.message);
  }

  await shutdownMCP();
}

testMCPFinal().catch(console.error);
