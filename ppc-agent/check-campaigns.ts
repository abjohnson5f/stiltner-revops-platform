import { getMCP, shutdownMCP } from './src/tools/mcp-bridge.js';
import { env } from './src/config/index.js';

async function main() {
  const customerId = env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID;
  const mcp = await getMCP();
  
  console.log('Checking all campaigns in account:', customerId);
  
  try {
    // Get ALL campaigns (any status)
    const query = `
      SELECT 
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type
      FROM campaign
      ORDER BY campaign.id
    `;
    
    const result = await mcp.query(query, customerId);
    console.log('\nResult:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await shutdownMCP();
  }
}

main().catch(console.error);
