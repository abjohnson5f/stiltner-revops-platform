/**
 * Test script to validate budget creation via MCP
 */
import { getMCP, shutdownMCP } from './tools/mcp-bridge';
import { env } from './config/index';

async function testBudgetCreation() {
  console.log('🧪 Testing Budget Creation via MCP\n');
  console.log(`Customer ID: ${env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID}`);
  
  const mcp = await getMCP();
  
  // Minimal budget operation in Opteo format (with numeric enum)
  const budgetOperation = {
    entity: 'campaign_budget',
    operation: 'create',
    resource: {
      resource_name: `customers/${env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID}/campaignBudgets/-1`,
      name: `Test Budget ${Date.now()}`,
      amount_micros: 50000000, // $50/day - NUMBER not string
      delivery_method: 2, // STANDARD = 2
    },
  };

  console.log('\n📤 Sending operation:');
  console.log(JSON.stringify(budgetOperation, null, 2));

  try {
    const result = await mcp.mutate([budgetOperation], {
      customerId: env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID,
      dryRun: true,
      partialFailure: false,
    });

    console.log('\n📥 Result:');
    console.log(JSON.stringify(result, null, 2));

    if (result.success || !result.error) {
      console.log('\n✅ Budget validation PASSED!');
    } else {
      console.log('\n❌ Budget validation FAILED:', result.error);
    }
  } catch (error: any) {
    console.log('\n❌ Error:', error.message);
  }

  await shutdownMCP();
}

testBudgetCreation().catch(console.error);
