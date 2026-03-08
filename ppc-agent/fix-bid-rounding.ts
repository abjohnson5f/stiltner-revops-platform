/**
 * Fix the bid rounding issue for property maintenance keywords
 */

import { getMCP, shutdownMCP } from './src/tools/mcp-bridge.js';
import { env } from './src/config/index.js';

async function main() {
  const customerId = env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID;
  const campaignId = '23421364286';
  const mcp = await getMCP();
  
  console.log('🔧 Fixing bid rounding for property maintenance keywords...\n');
  
  try {
    // Get the property maintenance keywords
    const query = `
      SELECT 
        ad_group_criterion.criterion_id,
        ad_group_criterion.keyword.text,
        ad_group_criterion.cpc_bid_micros,
        ad_group.id
      FROM keyword_view
      WHERE campaign.id = ${campaignId}
        AND ad_group_criterion.keyword.text IN ('property maintenance', 'property maintenance companies')
        AND ad_group_criterion.status = ENABLED
    `;
    
    const result = await mcp.query(query, customerId);
    const keywords = result.data?.rows || [];
    
    console.log(`Found ${keywords.length} keywords to update:`);
    keywords.forEach((k: any) => {
      const currentBid = (k['ad_group_criterion.cpc_bid_micros'] || 1000000) / 1_000_000;
      console.log(`  - "${k['ad_group_criterion.keyword.text']}": $${currentBid.toFixed(2)}`);
    });
    console.log();
    
    // Calculate new bids with proper rounding
    const updates = keywords.map((k: any) => {
      const currentBidMicros = k['ad_group_criterion.cpc_bid_micros'] || 1000000;
      const targetBidMicros = Math.round(currentBidMicros * 1.15); // +15%
      // Round to nearest 10,000 micros (0.01 dollar increment)
      const roundedBidMicros = Math.round(targetBidMicros / 10000) * 10000;
      
      console.log(`${k['ad_group_criterion.keyword.text']}:`);
      console.log(`  Current: $${(currentBidMicros / 1_000_000).toFixed(2)} (${currentBidMicros} micros)`);
      console.log(`  Target (+15%): $${(targetBidMicros / 1_000_000).toFixed(2)} (${targetBidMicros} micros)`);
      console.log(`  Rounded: $${(roundedBidMicros / 1_000_000).toFixed(2)} (${roundedBidMicros} micros)\n`);
      
      return {
        keyword: k,
        newBidMicros: roundedBidMicros,
      };
    });
    
    if (updates.length > 0) {
      const bidOps = updates.map((u) => ({
        entity: 'ad_group_criterion',
        operation: 'update',
        resource: {
          resource_name: `customers/${customerId}/adGroupCriteria/${u.keyword['ad_group.id']}~${u.keyword['ad_group_criterion.criterion_id']}`,
          cpc_bid_micros: u.newBidMicros,
        },
        update_mask: 'cpc_bid_micros',
      }));
      
      // Dry run
      console.log('🧪 DRY RUN: Validating bid updates...');
      const dryRun = await mcp.mutate(bidOps, {
        customerId,
        dryRun: true,
        partialFailure: true,
      });
      
      console.log('Dry run result:', JSON.stringify(dryRun, null, 2));
      
      if (dryRun.success) {
        console.log('\n✅ Dry run successful! Applying bid updates...');
        const live = await mcp.mutate(bidOps, {
          customerId,
          dryRun: false,
          partialFailure: true,
        });
        
        console.log('\n✅ Bids updated successfully!');
        console.log('Result:', JSON.stringify(live, null, 2));
      } else {
        console.error('\n❌ Dry run failed');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await shutdownMCP();
  }
}

main().catch(console.error);
