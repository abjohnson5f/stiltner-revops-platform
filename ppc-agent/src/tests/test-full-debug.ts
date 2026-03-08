/**
 * Debug full campaign builder with AI-generated spec
 */
import { designCampaign, buildCampaignOperations } from './agents/campaign-builder-agent.js';
import { getMCP, shutdownMCP } from './tools/mcp-bridge.js';
import { env } from './config/index.js';

async function testFullDebug() {
  console.log('🔍 Debugging Full Campaign Builder with AI\n');
  
  const customerId = env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID;
  
  // Step 1: Design the campaign using AI
  console.log('📐 Designing campaign with AI...');
  const spec = await designCampaign(
    'Create a landscape design campaign targeting Dublin and Powell Ohio with a $50/day budget. Focus on high-end residential landscape design services.',
    {
      name: 'Stiltner Landscapes',
      website: 'https://stiltnerlandscapes.com',
      phone: '(614) 555-1234',
      services: ['Landscape Design', 'Hardscaping', 'Lawn Care'],
    }
  );
  
  console.log('\n📋 AI-Generated Campaign Spec:');
  console.log(JSON.stringify(spec, null, 2));
  
  // Step 2: Build operations
  console.log('\n🔧 Building operations...');
  const operations = buildCampaignOperations(customerId, spec);
  
  console.log(`\n📊 First 10 operations (of ${operations.length}):`);
  operations.slice(0, 10).forEach((op, i) => {
    console.log(`\n--- Operation ${i + 1}: ${op.entity} ---`);
    console.log(JSON.stringify(op, null, 2));
  });
  
  // Step 3: Try with partial_failure to see which specific operations fail
  console.log('\n\n📤 Sending to MCP with partial_failure=true...');
  const mcp = await getMCP();
  
  try {
    const result = await mcp.mutate(operations, {
      customerId,
      dryRun: true,
      partialFailure: true, // This should show us which specific operations fail
    });

    console.log('\n📥 Result:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.metadata?.failure_count > 0) {
      console.log('\n⚠️  Some operations failed - check partial_failure_errors');
    }
  } catch (error: any) {
    console.log('\n❌ Error:', error.message);
  }
  
  await shutdownMCP();
}

testFullDebug();
