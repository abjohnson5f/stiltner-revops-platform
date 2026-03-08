#!/usr/bin/env node
/**
 * Interactive Environment Setup Script
 * 
 * Guides you through configuring all credentials for the Marketing Intelligence Agent.
 * Run with: node setup-env.js
 */

import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

const c = (color, text) => `${colors[color]}${text}${colors.reset}`;

// Configuration sections
const CONFIG_SECTIONS = [
  {
    id: 'core',
    name: '🔑 Core APIs',
    description: 'Required for the agent to function',
    required: true,
    variables: [
      {
        key: 'ANTHROPIC_API_KEY',
        name: 'Anthropic API Key',
        description: 'Claude API key for the AI agent',
        hint: 'Get from: https://console.anthropic.com/settings/keys',
        required: true,
        validate: (v) => v.startsWith('sk-ant-') ? null : 'Should start with sk-ant-',
      },
    ],
  },
  {
    id: 'google_ads',
    name: '📊 Google Ads API',
    description: 'Required for PPC campaign management',
    required: true,
    variables: [
      {
        key: 'GOOGLE_ADS_DEVELOPER_TOKEN',
        name: 'Developer Token',
        description: 'Google Ads API developer token',
        hint: 'Get from: Google Ads > Tools > API Center',
        required: true,
      },
      {
        key: 'GOOGLE_ADS_CLIENT_ID',
        name: 'OAuth Client ID',
        description: 'Google OAuth client ID',
        hint: 'Ends with .apps.googleusercontent.com',
        required: true,
        validate: (v) => v.includes('.apps.googleusercontent.com') ? null : 'Should end with .apps.googleusercontent.com',
      },
      {
        key: 'GOOGLE_ADS_CLIENT_SECRET',
        name: 'OAuth Client Secret',
        description: 'Google OAuth client secret',
        hint: 'Starts with GOCSPX-',
        required: true,
      },
      {
        key: 'GOOGLE_ADS_REFRESH_TOKEN',
        name: 'OAuth Refresh Token',
        description: 'Google OAuth refresh token',
        hint: 'Starts with 1//',
        required: true,
      },
      {
        key: 'GOOGLE_ADS_LOGIN_CUSTOMER_ID',
        name: 'MCC Account ID',
        description: 'Manager account ID (no dashes)',
        hint: 'Example: 7877821972',
        required: true,
        validate: (v) => /^\d{10}$/.test(v) ? null : 'Should be 10 digits without dashes',
      },
      {
        key: 'GOOGLE_ADS_DEFAULT_CUSTOMER_ID',
        name: 'Client Account ID',
        description: 'Target client account ID (no dashes)',
        hint: 'Example: 17849223902',
        required: true,
        validate: (v) => /^\d{10,11}$/.test(v) ? null : 'Should be 10-11 digits without dashes',
      },
    ],
  },
  {
    id: 'neon',
    name: '🗄️ Neon Database',
    description: 'Required for Operations Agent (lead sync, outbox)',
    required: false,
    variables: [
      {
        key: 'NEON_DATABASE_URL',
        name: 'Connection String',
        description: 'Neon Postgres connection URL',
        hint: 'Format: postgresql://user:pass@host/db?sslmode=require',
        required: true,
        validate: (v) => v.startsWith('postgresql://') ? null : 'Should start with postgresql://',
      },
    ],
  },
  {
    id: 'pipedrive',
    name: '📇 Pipedrive CRM',
    description: 'Required for CRM sync (leads → deals)',
    required: false,
    variables: [
      {
        key: 'PIPEDRIVE_API_TOKEN',
        name: 'API Token',
        description: 'Pipedrive API token',
        hint: 'Get from: Pipedrive > Settings > Personal preferences > API',
        required: true,
      },
      {
        key: 'PIPEDRIVE_COMPANY_DOMAIN',
        name: 'Company Domain',
        description: 'Your Pipedrive subdomain',
        hint: 'Example: yourcompany (from yourcompany.pipedrive.com)',
        required: false,
        transform: (v) => v.replace('.pipedrive.com', ''),
      },
    ],
  },
  {
    id: 'gchat',
    name: '💬 Google Chat',
    description: 'For team notifications on new leads',
    required: false,
    variables: [
      {
        key: 'GOOGLE_CHAT_SPACE_ID',
        name: 'Space ID',
        description: 'Google Chat space ID',
        hint: 'Format: spaces/AAAAxxxxxxxxx (from Chat space URL)',
        required: true,
        validate: (v) => v.startsWith('spaces/') ? null : 'Should start with spaces/',
      },
      {
        key: 'GOOGLE_CHAT_SERVICE_ACCOUNT',
        name: 'Service Account JSON',
        description: 'Service account credentials (JSON or file path)',
        hint: 'Paste JSON or path to .json file',
        required: true,
        multiline: true,
        transform: (v) => {
          // If it looks like a file path, read the file
          if (v.endsWith('.json') && !v.startsWith('{')) {
            try {
              return fs.readFileSync(v, 'utf-8').trim();
            } catch {
              return v;
            }
          }
          return v;
        },
      },
    ],
  },
  {
    id: 'beehiiv',
    name: '📧 Beehiiv Newsletter',
    description: 'For automated newsletter creation',
    required: false,
    variables: [
      {
        key: 'BEEHIIV_API_KEY',
        name: 'API Key',
        description: 'Beehiiv API key',
        hint: 'Get from: Beehiiv > Settings > Integrations > API',
        required: true,
      },
      {
        key: 'BEEHIIV_PUBLICATION_ID',
        name: 'Publication ID',
        description: 'Beehiiv publication ID',
        hint: 'Format: pub_xxxxxxxx',
        required: true,
        validate: (v) => v.startsWith('pub_') ? null : 'Should start with pub_',
      },
    ],
  },
  {
    id: 'meta',
    name: '📱 Meta Marketing API',
    description: 'For Facebook/Instagram ad campaigns',
    required: false,
    variables: [
      {
        key: 'META_ACCESS_TOKEN',
        name: 'Access Token',
        description: 'Meta Marketing API access token',
        hint: 'Get from: Meta Business Suite > Settings > Business settings',
        required: true,
      },
      {
        key: 'META_AD_ACCOUNT_ID',
        name: 'Ad Account ID',
        description: 'Meta ad account ID',
        hint: 'Format: act_123456789',
        required: true,
        validate: (v) => v.startsWith('act_') ? null : 'Should start with act_',
      },
      {
        key: 'META_PAGE_ID',
        name: 'Facebook Page ID',
        description: 'Facebook page ID for ads',
        hint: 'Get from: Page Settings > Page Info',
        required: true,
        validate: (v) => /^\d+$/.test(v) ? null : 'Should be numeric',
      },
      {
        key: 'META_INSTAGRAM_ACCOUNT_ID',
        name: 'Instagram Account ID',
        description: 'Connected Instagram account ID',
        hint: 'Get from: Business Settings > Instagram accounts',
        required: false,
      },
      {
        key: 'META_APP_ID',
        name: 'App ID',
        description: 'Meta app ID',
        hint: 'Get from: developers.facebook.com',
        required: false,
      },
      {
        key: 'META_APP_SECRET',
        name: 'App Secret',
        description: 'Meta app secret',
        hint: 'Get from: App Dashboard > Settings > Basic',
        required: false,
        secret: true,
      },
    ],
  },
  {
    id: 'social',
    name: '📲 Social Media APIs',
    description: 'For posting to TikTok, YouTube, etc.',
    required: false,
    variables: [
      {
        key: 'TIKTOK_ACCESS_TOKEN',
        name: 'TikTok Access Token',
        description: 'TikTok API access token',
        hint: 'Get from: TikTok for Developers',
        required: false,
      },
      {
        key: 'TIKTOK_OPEN_ID',
        name: 'TikTok Open ID',
        description: 'Your TikTok open ID',
        hint: 'Returned during OAuth flow',
        required: false,
      },
      {
        key: 'YOUTUBE_API_KEY',
        name: 'YouTube API Key',
        description: 'YouTube Data API key',
        hint: 'Get from: Google Cloud Console',
        required: false,
      },
      {
        key: 'YOUTUBE_CHANNEL_ID',
        name: 'YouTube Channel ID',
        description: 'Your YouTube channel ID',
        hint: 'Starts with UC...',
        required: false,
      },
    ],
  },
  {
    id: 'dataforseo',
    name: '🔍 DataForSEO',
    description: 'For keyword research & competitor intelligence',
    required: false,
    variables: [
      {
        key: 'DATAFORSEO_LOGIN',
        name: 'Login',
        description: 'DataForSEO account email',
        hint: 'Your DataForSEO account email',
        required: true,
      },
      {
        key: 'DATAFORSEO_PASSWORD',
        name: 'Password',
        description: 'DataForSEO API password',
        hint: 'Get from: DataForSEO dashboard',
        required: true,
        secret: true,
      },
    ],
  },
  {
    id: 'agent',
    name: '⚙️ Agent Configuration',
    description: 'Optional agent settings',
    required: false,
    variables: [
      {
        key: 'AGENT_MODEL',
        name: 'Claude Model',
        description: 'Which Claude model to use',
        hint: 'Default: claude-sonnet-4-20250514',
        required: false,
        default: 'claude-sonnet-4-20250514',
      },
      {
        key: 'AGENT_MAX_TOKENS',
        name: 'Max Tokens',
        description: 'Maximum tokens for responses',
        hint: 'Default: 8192',
        required: false,
        default: '8192',
      },
      {
        key: 'AGENT_LOG_LEVEL',
        name: 'Log Level',
        description: 'Logging verbosity',
        hint: 'Options: debug, info, warn, error',
        required: false,
        default: 'info',
      },
    ],
  },
  {
    id: 'business',
    name: '🏢 Business Context',
    description: 'Used in AI prompts for personalization',
    required: false,
    variables: [
      {
        key: 'BUSINESS_NAME',
        name: 'Business Name',
        description: 'Your business name',
        hint: 'Example: Stiltner Landscapes',
        required: false,
        default: 'Stiltner Landscapes',
      },
      {
        key: 'BUSINESS_PHONE',
        name: 'Phone Number',
        description: 'Business phone number',
        hint: 'Example: (614) 555-0123',
        required: false,
      },
      {
        key: 'BUSINESS_WEBSITE',
        name: 'Website URL',
        description: 'Your website URL',
        hint: 'Example: https://stiltnerlandscapes.com',
        required: false,
      },
      {
        key: 'BUSINESS_LOCATIONS',
        name: 'Service Locations',
        description: 'Cities you serve (comma-separated)',
        hint: 'Example: Dublin,Powell,New Albany,Galena',
        required: false,
      },
      {
        key: 'BUSINESS_STATE',
        name: 'State',
        description: 'State you operate in',
        hint: 'Example: Ohio',
        required: false,
        default: 'Ohio',
      },
    ],
  },
];

class SetupWizard {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    this.config = {};
    this.envPath = path.join(__dirname, '.env');
    this.existingEnv = this.loadExistingEnv();
  }

  loadExistingEnv() {
    try {
      if (fs.existsSync(this.envPath)) {
        const content = fs.readFileSync(this.envPath, 'utf-8');
        const env = {};
        for (const line of content.split('\n')) {
          const match = line.match(/^([A-Z_]+)=(.*)$/);
          if (match) {
            env[match[1]] = match[2];
          }
        }
        return env;
      }
    } catch {
      // Ignore errors
    }
    return {};
  }

  async prompt(question, options = {}) {
    const { secret = false, defaultValue, validate, transform } = options;
    
    return new Promise((resolve) => {
      const defaultHint = defaultValue ? c('dim', ` [${defaultValue}]`) : '';
      const existingValue = this.existingEnv[options.key];
      const existingHint = existingValue ? c('dim', ` (current: ${secret ? '***' : existingValue.slice(0, 20)}${existingValue.length > 20 ? '...' : ''})`) : '';
      
      this.rl.question(`${question}${defaultHint}${existingHint}: `, (answer) => {
        let value = answer.trim() || defaultValue || '';
        
        if (!value && existingValue) {
          console.log(c('dim', '  → Keeping existing value'));
          resolve(existingValue);
          return;
        }
        
        if (transform) {
          value = transform(value);
        }
        
        if (validate && value) {
          const error = validate(value);
          if (error) {
            console.log(c('yellow', `  ⚠️  ${error}`));
          }
        }
        
        resolve(value);
      });
    });
  }

  async confirm(question) {
    return new Promise((resolve) => {
      this.rl.question(`${question} ${c('dim', '(y/n)')}: `, (answer) => {
        resolve(answer.toLowerCase().startsWith('y'));
      });
    });
  }

  printHeader() {
    console.log('\n' + '═'.repeat(70));
    console.log(c('bright', '           MARKETING INTELLIGENCE AGENT - Setup Wizard'));
    console.log('═'.repeat(70));
    console.log(`
This wizard will guide you through configuring all the credentials
needed for the Marketing Intelligence Agent.

${c('green', '✓')} Required sections are marked
${c('yellow', '○')} Optional sections can be skipped
${c('dim', '→')} Press Enter to keep existing values

Let's get started!
`);
  }

  async runSection(section) {
    console.log('\n' + '─'.repeat(70));
    console.log(`\n${section.name}`);
    console.log(c('dim', section.description));
    
    if (!section.required) {
      const configure = await this.confirm(`\nConfigure ${section.name}?`);
      if (!configure) {
        console.log(c('dim', '  → Skipping this section'));
        return;
      }
    }
    
    console.log('');
    
    for (const variable of section.variables) {
      console.log(c('cyan', `  ${variable.name}`));
      if (variable.hint) {
        console.log(c('dim', `  ${variable.hint}`));
      }
      
      const value = await this.prompt(`  ${variable.key}`, {
        key: variable.key,
        secret: variable.secret,
        defaultValue: variable.default,
        validate: variable.validate,
        transform: variable.transform,
      });
      
      if (value) {
        this.config[variable.key] = value;
      }
      console.log('');
    }
  }

  generateEnvFile() {
    let content = `# ============================================================
# MARKETING INTELLIGENCE AGENT - Environment Configuration
# Generated: ${new Date().toISOString()}
# ============================================================

`;

    for (const section of CONFIG_SECTIONS) {
      const sectionVars = section.variables.filter(v => this.config[v.key]);
      
      if (sectionVars.length > 0) {
        content += `# ${section.name.replace(/[^\w\s]/g, '').trim()}\n`;
        
        for (const variable of sectionVars) {
          const value = this.config[variable.key];
          // Handle multiline values (like JSON)
          if (value.includes('\n') || value.includes('"')) {
            content += `${variable.key}='${value}'\n`;
          } else {
            content += `${variable.key}=${value}\n`;
          }
        }
        content += '\n';
      }
    }

    return content;
  }

  async run() {
    this.printHeader();
    
    // Check for existing .env
    if (fs.existsSync(this.envPath)) {
      console.log(c('yellow', '⚠️  Existing .env file found'));
      const overwrite = await this.confirm('Update existing configuration?');
      if (!overwrite) {
        console.log('\n' + c('dim', 'Setup cancelled. Existing .env preserved.'));
        this.rl.close();
        return;
      }
      console.log(c('dim', '  → Will update/merge with existing values\n'));
    }
    
    // Run through each section
    for (const section of CONFIG_SECTIONS) {
      await this.runSection(section);
    }
    
    // Summary
    console.log('\n' + '═'.repeat(70));
    console.log(c('bright', '                         Configuration Summary'));
    console.log('═'.repeat(70) + '\n');
    
    const configuredCount = Object.keys(this.config).length;
    console.log(`${c('green', '✓')} ${configuredCount} variables configured\n`);
    
    // Group by section
    for (const section of CONFIG_SECTIONS) {
      const sectionVars = section.variables.filter(v => this.config[v.key]);
      if (sectionVars.length > 0) {
        console.log(`${section.name}`);
        for (const v of sectionVars) {
          const displayValue = v.secret ? '***' : 
            this.config[v.key].length > 30 ? 
              this.config[v.key].slice(0, 30) + '...' : 
              this.config[v.key];
          console.log(c('dim', `  ${v.key}: ${displayValue}`));
        }
        console.log('');
      }
    }
    
    // Write file
    const save = await this.confirm('Save configuration to .env?');
    
    if (save) {
      const envContent = this.generateEnvFile();
      
      // Backup existing if present
      if (fs.existsSync(this.envPath)) {
        const backupPath = `${this.envPath}.backup.${Date.now()}`;
        fs.copyFileSync(this.envPath, backupPath);
        console.log(c('dim', `  → Backed up existing .env to ${path.basename(backupPath)}`));
      }
      
      fs.writeFileSync(this.envPath, envContent);
      console.log(c('green', '\n✅ Configuration saved to .env\n'));
      
      // Next steps
      console.log('─'.repeat(70));
      console.log(c('bright', '\n📋 Next Steps:\n'));
      console.log('1. Review your .env file:');
      console.log(c('cyan', '   cat .env\n'));
      console.log('2. Build the project:');
      console.log(c('cyan', '   npm run build\n'));
      console.log('3. Test the agent:');
      console.log(c('cyan', '   npm start "What\'s wasting money in my account?"\n'));
      console.log('4. Run the operations daemon (if configured):');
      console.log(c('cyan', '   npm run ops:daemon\n'));
      
    } else {
      console.log(c('yellow', '\n⚠️  Configuration not saved.\n'));
    }
    
    this.rl.close();
  }
}

// Run the wizard
const wizard = new SetupWizard();
wizard.run().catch(console.error);
