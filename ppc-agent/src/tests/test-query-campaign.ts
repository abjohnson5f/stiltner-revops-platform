/**
 * Query an existing campaign to see its structure
 */
import { getMCP, shutdownMCP } from './tools/mcp-bridge';
import { env } from './config/index';

async function queryCampaign() {
  console.log('🔍 Querying existing campaigns...\n');
  
  const mcp = await getMCP();
  
  try {
    // Get campaign with ALL fields
    const result = await mcp.query(`
      SELECT
        campaign.resource_name,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type,
        campaign.campaign_budget,
        campaign.bidding_strategy_type,
        campaign.manual_cpc.enhanced_cpc_enabled,
        campaign.network_settings.target_google_search,
        campaign.network_settings.target_search_network,
        campaign.network_settings.target_content_network
      FROM campaign
      WHERE campaign.status IN ('PAUSED', 'ENABLED')
      LIMIT 3
    `, env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID);

    console.log('📥 Result:');
    console.log(JSON.stringify(result, null, 2));
  } catch (error: any) {
    console.log('❌ Error:', error.message);
  }

  await shutdownMCP();
}

queryCampaign().catch(console.error);
