import { getMCP, shutdownMCP } from './src/tools/mcp-bridge.js';
import { env } from './src/config/index.js';

async function main() {
  const customerId = env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID;
  const mcp = await getMCP();
  
  console.log('Testing status filtering...\n');
  
  try {
    // Test with no filter
    console.log('1. Query WITHOUT filter:');
    const query1 = `
      SELECT 
        campaign.id,
        campaign.name,
        campaign.status
      FROM campaign
      ORDER BY campaign.id
      LIMIT 5
    `;
    const result1 = await mcp.query(query1, customerId);
    console.log(JSON.stringify(result1, null, 2));
    
    // Test with ENABLED filter
    console.log('\n2. Query WITH ENABLED filter:');
    const query2 = `
      SELECT 
        campaign.id,
        campaign.name,
        campaign.status
      FROM campaign
      WHERE campaign.status = ENABLED
      ORDER BY campaign.id
    `;
    const result2 = await mcp.query(query2, customerId);
    console.log(JSON.stringify(result2, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await shutdownMCP();
  }
}

main().catch(console.error);
