/**
 * Pause ALL enabled Google Ads campaigns for Stiltner.
 * Budget limit hit for the month.
 */
import { getMCP, shutdownMCP } from './src/tools/mcp-bridge.js';
import { env } from './src/config/index.js';

async function main() {
  const customerId = env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID;
  const mcp = await getMCP();

  try {
    // Step 1: Find all ENABLED campaigns
    console.log('🔍 Finding enabled campaigns in account:', customerId);
    const query = `
      SELECT campaign.id, campaign.name, campaign.status
      FROM campaign
      WHERE campaign.status = 'ENABLED'
    `;
    const result = await mcp.query(query, customerId);
    const rows = result?.data?.rows || result?.rows || (Array.isArray(result) ? result : []);
    console.log('Found campaigns:', JSON.stringify(rows, null, 2));

    if (!rows || rows.length === 0) {
      console.log('✅ No enabled campaigns found — nothing to pause.');
      return;
    }

    // Step 2: Pause each campaign
    for (const row of rows) {
      const campaignId = row['campaign.id'] || row.campaign?.id;
      const campaignName = row['campaign.name'] || row.campaign?.name;
      const resourceName = `customers/${customerId}/campaigns/${campaignId}`;

      console.log(`\n⏸️  Pausing: "${campaignName}" (ID: ${campaignId})`);

      const operations = [{
        entity: 'campaign',
        operation: 'update',
        resource: {
          resource_name: resourceName,
          status: 'PAUSED',
        },
        update_mask: 'status',
      }];

      const result = await mcp.mutate(operations, {
        customerId,
        dryRun: false,  // LIVE — actually pause
        partialFailure: false,
      });

      console.log(`   Result:`, JSON.stringify(result, null, 2));
    }

    console.log('\n✅ All campaigns paused successfully.');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await shutdownMCP();
  }
}

main().catch(console.error);
