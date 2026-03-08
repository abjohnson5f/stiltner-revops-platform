import { getMCP, shutdownMCP } from './src/tools/mcp-bridge.js';
import { env } from './src/config/index.js';

async function main() {
  const customerId = env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID;
  const mcp = await getMCP();
  
  // Get a keyword to test with
  const query = `
    SELECT 
      ad_group_criterion.criterion_id,
      ad_group_criterion.keyword.text,
      ad_group_criterion.status,
      ad_group_criterion.cpc_bid_micros,
      ad_group.id
    FROM keyword_view
    WHERE campaign.id = 23421364286
      AND ad_group_criterion.keyword.text CONTAINS 'property maintenance'
      AND ad_group_criterion.status = ENABLED
    LIMIT 1
  `;
  
  const result = await mcp.query(query, customerId);
  console.log('Query result:', JSON.stringify(result, null, 2));
  
  if (result.data?.rows?.length > 0) {
    const keyword = result.data.rows[0];
    const agId = keyword['ad_group.id'];
    const criterionId = keyword['ad_group_criterion.criterion_id'];
    
    console.log(`\nTesting update structure for criterion ${criterionId} in ad group ${agId}`);
    
    // Try different update structures
    const testOps = [
      {
        entity: 'ad_group_criterion',
        operation: 'update',
        resource: {
          resource_name: `customers/${customerId}/adGroupCriteria/${agId}~${criterionId}`,
          status: 3, // PAUSED
        },
        update_mask: 'status',
      }
    ];
    
    console.log('\nTest operation:', JSON.stringify(testOps, null, 2));
    
    const dryRun = await mcp.mutate(testOps, {
      customerId,
      dryRun: true,
      partialFailure: false,
    });
    
    console.log('\nDry run result:', JSON.stringify(dryRun, null, 2));
  }
  
  await shutdownMCP();
}

main().catch(console.error);
