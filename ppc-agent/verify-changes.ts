import { getMCP, shutdownMCP } from './src/tools/mcp-bridge.js';
import { env } from './src/config/index.js';

async function main() {
  const customerId = env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID;
  const campaignId = '23421364286';
  const mcp = await getMCP();
  
  console.log('🔍 Verifying Google Ads Optimization Changes...\n');
  console.log('═══════════════════════════════════════════════════════\n');
  
  try {
    // 1. Check negative keywords
    console.log('1️⃣  NEGATIVE KEYWORDS\n');
    const negativeQuery = `
      SELECT
        campaign_criterion.keyword.text,
        campaign_criterion.keyword.match_type,
        campaign_criterion.negative
      FROM campaign_criterion
      WHERE campaign.id = ${campaignId}
        AND campaign_criterion.type = KEYWORD
        AND campaign_criterion.negative = true
      ORDER BY campaign_criterion.keyword.text
    `;
    
    const negatives = await mcp.query(negativeQuery, customerId);
    const negativeKeywords = negatives.data?.rows || [];
    
    console.log(`✅ Found ${negativeKeywords.length} negative keywords:`);
    negativeKeywords.forEach((nk: any) => {
      const matchType = nk['campaign_criterion.keyword.match_type'];
      const matchMap: any = { 2: 'EXACT', 3: 'PHRASE', 4: 'BROAD' };
      console.log(`   - "${nk['campaign_criterion.keyword.text']}" (${matchMap[matchType]})`);
    });
    console.log();
    
    // 2. Check paused keywords
    console.log('2️⃣  PAUSED KEYWORDS\n');
    const pausedQuery = `
      SELECT
        ad_group_criterion.keyword.text,
        ad_group_criterion.keyword.match_type,
        ad_group_criterion.status
      FROM keyword_view
      WHERE campaign.id = ${campaignId}
        AND ad_group_criterion.status = PAUSED
      ORDER BY ad_group_criterion.keyword.text
    `;
    
    const paused = await mcp.query(pausedQuery, customerId);
    const pausedKeywords = paused.data?.rows || [];
    
    console.log(`✅ Found ${pausedKeywords.length} paused keywords:`);
    pausedKeywords.forEach((pk: any) => {
      const matchType = pk['ad_group_criterion.keyword.match_type'];
      const matchMap: any = { 2: 'EXACT', 3: 'PHRASE', 4: 'BROAD' };
      console.log(`   - "${pk['ad_group_criterion.keyword.text']}" (${matchMap[matchType]})`);
    });
    console.log();
    
    // 3. Check winning keywords bids
    console.log('3️⃣  WINNING KEYWORDS (Bid Increases)\n');
    const winningQuery = `
      SELECT
        ad_group_criterion.keyword.text,
        ad_group_criterion.keyword.match_type,
        ad_group_criterion.cpc_bid_micros,
        ad_group_criterion.status
      FROM keyword_view
      WHERE campaign.id = ${campaignId}
        AND ad_group_criterion.status = ENABLED
        AND ad_group_criterion.cpc_bid_micros > 1000000
      ORDER BY ad_group_criterion.keyword.text
    `;
    
    const winning = await mcp.query(winningQuery, customerId);
    const winningKeywords = winning.data?.rows || [];
    
    console.log(`✅ Found ${winningKeywords.length} winning keywords with updated bids:`);
    winningKeywords.forEach((wk: any) => {
      const matchType = wk['ad_group_criterion.keyword.match_type'];
      const matchMap: any = { 2: 'EXACT', 3: 'PHRASE', 4: 'BROAD' };
      const bidMicros = wk['ad_group_criterion.cpc_bid_micros'];
      const bidDollars = bidMicros ? (bidMicros / 1_000_000).toFixed(2) : 'N/A';
      console.log(`   - "${wk['ad_group_criterion.keyword.text']}" (${matchMap[matchType]}): $${bidDollars}`);
    });
    console.log();
    
    // Summary
    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ VERIFICATION COMPLETE\n');
    console.log(`Summary:`);
    console.log(`  - Negative keywords: ${negativeKeywords.length}/14 expected`);
    console.log(`  - Paused keywords: ${pausedKeywords.length}/7 expected`);
    console.log(`  - Winning keywords with bids: ${winningKeywords.length}/4 expected`);
    console.log();
    
    const allComplete = negativeKeywords.length >= 14 && 
                        pausedKeywords.length >= 7 && 
                        winningKeywords.length >= 4;
    
    if (allComplete) {
      console.log('🎉 All optimizations successfully applied!');
    } else {
      console.log('⚠️  Some optimizations may be incomplete. Review above.');
    }
    console.log('═══════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('❌ Error during verification:', error);
  } finally {
    await shutdownMCP();
  }
}

main().catch(console.error);
