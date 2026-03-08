/**
 * Campaign Builder Runner
 * 
 * Example script showing how to create campaigns from natural language.
 */

import 'dotenv/config';
import { createCampaign, designCampaign } from './agents/campaign-builder-agent.js';
import { shutdownMCP } from './tools/mcp-bridge.js';

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || 'design';

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║              CAMPAIGN BUILDER AGENT                           ║');
  console.log('║       Create Google Ads campaigns from descriptions           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  try {
    // Example campaign descriptions
    const examples = {
      landscape_design: `
        Create a search campaign for landscape design services targeting 
        Dublin, Powell, and New Albany Ohio. Focus on high-end residential 
        landscape design with a $50/day budget. Target homeowners looking 
        for professional outdoor space transformation.
      `,
      
      lawn_care: `
        Create a campaign for lawn care and maintenance services in 
        Columbus and Westerville Ohio. Include keywords for lawn mowing, 
        fertilization, and weed control. Budget: $30/day. Target both 
        residential and commercial customers.
      `,
      
      hardscaping: `
        Build a campaign for hardscaping services - patios, retaining walls, 
        outdoor kitchens, fire pits. Target affluent neighborhoods in 
        Dublin and Powell. Higher budget of $75/day since these are 
        high-ticket services averaging $15,000+ per project.
      `,

      spring_promo: `
        Create a seasonal spring campaign promoting 20% off landscape 
        design consultations. Target all Central Ohio service areas.
        Emphasize "Book Now for Spring Installation" messaging.
        Budget: $40/day for 6 weeks.
      `,
    };

    const businessInfo = {
      name: 'Stiltner Landscapes',
      website: 'https://stiltnerlandscapes.com',
      // NOTE: Phone number intentionally omitted from business info
      // to prevent AI from putting it in ad headlines (policy violation)
      services: [
        'Landscape Design',
        'Hardscaping',
        'Outdoor Living',
        'Lawn Care',
        'Seasonal Maintenance',
      ],
    };

    if (mode === 'design') {
      // Just design, don't create
      console.log('Mode: DESIGN ONLY (no API calls)\n');
      
      const campaignType = args[1] || 'landscape_design';
      const description = examples[campaignType as keyof typeof examples] || args.slice(1).join(' ');

      console.log(`📝 Campaign Request:\n${description}\n`);
      
      const spec = await designCampaign(description, businessInfo);
      
      console.log('\n📋 GENERATED CAMPAIGN SPEC:\n');
      console.log(JSON.stringify(spec, null, 2));
      
    } else if (mode === 'validate') {
      // Design and dry-run validate
      console.log('Mode: VALIDATE (dry run)\n');
      
      const campaignType = args[1] || 'landscape_design';
      const description = examples[campaignType as keyof typeof examples] || args.slice(1).join(' ');

      const result = await createCampaign(description, businessInfo, {
        dryRun: true,
      });

      console.log('\n📊 RESULT:\n');
      console.log(result.summary);
      
      if (result.dryRunResult) {
        console.log('\nDry Run Response:');
        console.log(JSON.stringify(result.dryRunResult, null, 2));
      }

    } else if (mode === 'create') {
      // Actually create the campaign
      console.log('Mode: CREATE (LIVE - will create real campaign!)\n');
      console.log('⚠️  WARNING: This will create a real campaign in your Google Ads account!');
      console.log('   The campaign will be created in PAUSED state.\n');
      
      const campaignType = args[1] || 'landscape_design';
      const description = examples[campaignType as keyof typeof examples] || args.slice(1).join(' ');

      const result = await createCampaign(description, businessInfo, {
        dryRun: false,
      });

      console.log('\n📊 RESULT:\n');
      console.log(result.summary);

    } else if (mode === 'list') {
      // List available example campaigns
      console.log('Available example campaigns:\n');
      for (const [key, desc] of Object.entries(examples)) {
        console.log(`  ${key}:`);
        console.log(`    ${desc.trim().split('\n')[0].trim()}\n`);
      }
      console.log('\nUsage:');
      console.log('  npm run campaign design landscape_design');
      console.log('  npm run campaign validate lawn_care');
      console.log('  npm run campaign create hardscaping');

    } else {
      console.log('Usage: npm run campaign <mode> [campaign_type]');
      console.log('\nModes:');
      console.log('  design   - Design campaign structure (no API calls)');
      console.log('  validate - Design + dry run validation');
      console.log('  create   - Design + validate + create (LIVE!)');
      console.log('  list     - List example campaign types');
    }

  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
  } finally {
    await shutdownMCP();
  }
}

main();
