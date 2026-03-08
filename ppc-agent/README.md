# Marketing Intelligence Agent 🚀

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Claude Agent SDK](https://img.shields.io/badge/Claude-Agent%20SDK-orange.svg)](https://docs.anthropic.com/claude/docs/agents)

**Autonomous marketing management powered by Claude AI. PPC, CRM, Content, Social, and Attribution in one system.**

> "Create a lawn care campaign for Dublin and Powell with $50/day budget"  
> → Complete Google Ads & Meta campaigns with AI-generated creative in seconds.

---

## ✨ What's New (v1.0)

This release transforms the PPC Agent into a **full Marketing Operations system**:

| Module | Capabilities |
|--------|-------------|
| **🚀 PPC Agent** | Google Ads campaign creation, health checks, competitor intel |
| **📱 Meta Ads Agent** | Facebook/Instagram campaign creation with AI creative |
| **📝 Content Agent** | Newsletter generation, social media automation |
| **⚙️ Operations Agent** | Neon → Pipedrive sync, G-Chat notifications, outbox processing |
| **📊 Attribution Agent** | Daily metrics sync, CPL/ROAS calculation, CMO reports |

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                      MARKETING INTELLIGENCE AGENT                               │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                         ORCHESTRATOR AGENT                               │   │
│  │                      (Claude claude-sonnet-4-20250514)                            │   │
│  └────────────────────────────────┬────────────────────────────────────────┘   │
│                                   │                                             │
│     ┌─────────────┬───────────────┼───────────────┬─────────────┐              │
│     ▼             ▼               ▼               ▼             ▼              │
│ ┌─────────┐ ┌──────────┐  ┌────────────┐  ┌───────────┐ ┌────────────┐        │
│ │   PPC   │ │   Meta   │  │  Content   │  │Operations │ │Attribution │        │
│ │  Agent  │ │ Ads Agent│  │   Agent    │  │   Agent   │ │   Agent    │        │
│ │(Google) │ │(FB + IG) │  │(Newsletter │  │(Neon/CRM) │ │(KPIs/      │        │
│ └────┬────┘ └────┬─────┘  │+Social)    │  └─────┬─────┘ │ Reports)   │        │
│      │           │        └──────┬─────┘        │       └─────┬──────┘        │
│      └───────────┴───────────────┼──────────────┴─────────────┘               │
│                                  ▼                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │                            TOOLS LAYER                                   │  │
│  │ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        │  │
│  │ │Google Ads│ │ Meta API │ │ Beehiiv  │ │  Neon    │ │Pipedrive │        │  │
│  │ │ MCP      │ │          │ │          │ │ Postgres │ │ CRM      │        │  │
│  │ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘        │  │
│  │ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        │  │
│  │ │DataForSEO│ │  Social  │ │   Glif   │ │  G-Chat  │ │ YouTube  │        │  │
│  │ │          │ │ (IG/FB/  │ │ (AI Art) │ │Notifier  │ │  /TikTok │        │  │
│  │ └──────────┘ │  TikTok) │ └──────────┘ └──────────┘ └──────────┘        │  │
│  │              └──────────┘                                                │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd ppc-agent
npm install
```

### 2. Configure Environment (Interactive Setup)

```bash
# Run the interactive setup wizard
npm run setup
```

This will guide you through:
- ✅ Core APIs (Anthropic, Google Ads)
- ✅ Database & CRM (Neon, Pipedrive)
- ✅ Notifications (Google Chat)
- ✅ Content (Beehiiv, Social Media)
- ✅ Meta Ads (Facebook/Instagram)
- ✅ Research (DataForSEO)

**Or manually create .env:**
```bash
cp env.example.txt .env
nano .env
```

**Minimum required credentials:**
- `ANTHROPIC_API_KEY` - Claude API key
- `GOOGLE_ADS_*` - Google Ads API credentials
- `NEON_DATABASE_URL` - Neon Postgres connection string (for Operations)

### 3. Build & Run

```bash
# Build TypeScript
npm run build

# Start interactive chat mode
npm start

# Or run a single command
npm start "Create a lawn care campaign for Dublin"
```

---

## 📖 Usage

### Interactive Mode

```bash
npm start
```

Opens an interactive chat where you can ask anything:

```
💬 You: Create a landscape design campaign for Dublin and Powell with $50/day

🤖 Agent: I'll create a complete campaign structure...
```

### Direct Commands

| Command | Description |
|---------|-------------|
| **PPC Commands** | |
| `npm run campaign list` | Show example campaigns |
| `npm run campaign validate <type>` | Design + dry run |
| `npm run campaign create <type>` | Create campaign (PAUSED) |
| **Operations Commands** | |
| `npm run ops:process` | Process outbox queue once |
| `npm run ops:daemon` | Run outbox processor continuously |
| **Content Commands** | |
| `npm run content:newsletter` | Generate weekly newsletter |
| `npm run content:plan` | Generate weekly content plan |
| `npm run content:social` | Generate social media posts |
| **Meta Ads Commands** | |
| `npm run meta:create "desc"` | Create Meta campaign (dry run) |
| `npm run meta:report` | Meta Ads performance report |
| **Attribution Commands** | |
| `npm run report:daily` | Generate daily metrics report |
| `npm run report:weekly` | Generate CMO weekly summary |
| `npm run report:sync` | Sync metrics from ad platforms |
| `npm run report:attribution` | Full attribution analysis |
| `npm run daily-tasks` | Run all daily marketing tasks |

---

## 🚀 PPC Agent (Google Ads)

### Campaign Builder

Create complete Google Ads campaigns from natural language:

```bash
npm run campaign validate "Landscape design for Central Ohio"
```

**Creates:**
- Campaign with budget & bidding strategy
- Multiple themed ad groups
- Keywords (EXACT, PHRASE, BROAD match)
- Responsive search ads (15 headlines, 4 descriptions)
- Location targeting

### Health Check

```bash
npm start "What's wasting money in my account?"
```

- Identifies keywords with clicks but zero conversions
- Calculates CTR, CPC, CPA vs benchmarks
- Prioritizes by dollar impact

### Competitor Intelligence

```bash
npm start "Find competitors bidding on lawn care"
```

- Uses DataForSEO for market intelligence
- Identifies gap opportunities

---

## 📱 Meta Ads Agent (Facebook/Instagram)

### Campaign Creation

```bash
npm run meta:create "Lead gen campaign for lawn care services"
```

**Features:**
- AI-generated campaign structure
- Multiple ad set targeting variations
- Ad copy using direct response framework
- Image prompts for AI creative generation
- Policy-compliant ad creation

### Performance Analysis

```bash
npm run meta:report
```

- Campaign-level metrics
- CPL, CTR, CPC analysis
- Optimization recommendations

---

## 📝 Content Agent

### Newsletter Generation

```bash
npm run content:newsletter
```

- Uses brand voice and seasonal themes
- Creates Beehiiv draft with subject line & preview
- HTML-formatted content with CTAs

### Weekly Content Plan

```bash
npm run content:plan
```

- Newsletter + social posts for the week
- Themed around seasonal topics
- Ready-to-publish content

### Social Media

```bash
npm run content:social
```

- Platform-specific posts (IG, FB, TikTok, LinkedIn)
- Appropriate hashtags
- AI image prompts included

---

## ⚙️ Operations Agent

### Outbox Processor

The Operations Agent processes the Neon outbox queue to:

1. **Sync leads to Pipedrive** - Creates Person + Deal
2. **Send G-Chat notifications** - Team alerts for new leads
3. **Update CRM links** - Tracks Pipedrive IDs in Neon

```bash
# Process once
npm run ops:process

# Run continuously (cron replacement)
npm run ops:daemon
```

### Outbox Message Types

| Type | Action |
|------|--------|
| `lead.sync_pipedrive` | Create/update Person & Deal in Pipedrive |
| `lead.notify_gchat` | Send team notification |
| `lead.sync_beehiiv` | Add subscriber to newsletter |

---

## 📊 Attribution Agent

### Daily Sync

```bash
npm run report:sync
```

Pulls metrics from:
- Google Ads (spend, clicks, conversions)
- Meta Ads (spend, leads, ROAS)
- Stores in `daily_stats` table

### KPI Calculation

```bash
npm run report:attribution
```

Calculates:
- **CPL** - Cost Per Lead by channel
- **ROAS** - Return on Ad Spend
- **CAC** - Customer Acquisition Cost
- **LTV** - Customer Lifetime Value

### CMO Weekly Report

```bash
npm run report:weekly
```

- Week-over-week comparisons
- Channel performance breakdown
- Highlights and recommendations

---

## 🔐 Configuration

### Environment Variables

#### Core (Required)

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Claude API key |
| `GOOGLE_ADS_*` | Google Ads API credentials (7 variables) |

#### Operations (Required for CRM sync)

| Variable | Description |
|----------|-------------|
| `NEON_DATABASE_URL` | Postgres connection string |
| `PIPEDRIVE_API_TOKEN` | Pipedrive API token |
| `GOOGLE_CHAT_SERVICE_ACCOUNT` | Service account JSON |
| `GOOGLE_CHAT_SPACE_ID` | G-Chat space ID |

#### Content (Optional)

| Variable | Description |
|----------|-------------|
| `BEEHIIV_API_KEY` | Newsletter API key |
| `BEEHIIV_PUBLICATION_ID` | Publication ID |
| `TIKTOK_ACCESS_TOKEN` | TikTok posting |
| `YOUTUBE_*` | YouTube API credentials |

#### Meta Ads (Optional)

| Variable | Description |
|----------|-------------|
| `META_ACCESS_TOKEN` | Meta Marketing API token |
| `META_AD_ACCOUNT_ID` | Ad account ID |
| `META_PAGE_ID` | Facebook page ID |
| `META_INSTAGRAM_ACCOUNT_ID` | Instagram account ID |

---

## 📁 Project Structure

```
ppc-agent/
├── src/
│   ├── index.ts                      # CLI entry point
│   ├── config/
│   │   ├── index.ts                  # Zod-validated env config
│   │   └── content-calendar.ts       # Scheduling patterns
│   ├── agents/
│   │   ├── orchestrator.ts           # Master coordinator
│   │   ├── campaign-builder-agent.ts # Google Ads campaigns
│   │   ├── health-check-agent.ts     # Account analysis
│   │   ├── competitor-intel-agent.ts # Competitor research
│   │   ├── operations-agent.ts       # Outbox processor
│   │   ├── content-agent.ts          # Newsletter & social
│   │   ├── meta-ads-agent.ts         # FB/IG campaigns
│   │   └── attribution-agent.ts      # KPIs & reporting
│   ├── tools/
│   │   ├── mcp-bridge.ts             # Google Ads MCP
│   │   ├── google-ads.ts             # Direct API queries
│   │   ├── meta-ads.ts               # Meta Marketing API
│   │   ├── neon.ts                   # Database operations
│   │   ├── pipedrive.ts              # CRM operations
│   │   ├── google-chat.ts            # Notifications
│   │   ├── beehiiv.ts                # Newsletter API
│   │   ├── social.ts                 # Social media posting
│   │   ├── attribution.ts            # KPI calculations
│   │   └── dataforseo.ts             # Keyword research
│   └── skills/                       # Marketing skills library
│       ├── index.ts                  # Skill loader
│       └── *.md                      # 16 marketing skills
├── package.json
├── tsconfig.json
├── env.example.txt
└── README.md
```

---

## 🛡️ Safety Features

1. **Dry Run by Default** - All campaigns validate before creation
2. **PAUSED State** - New campaigns start paused for review
3. **Content Sanitization** - Auto-truncates to meet character limits
4. **Policy Validation** - Checks for ad policy violations
5. **Idempotency** - Outbox uses keys to prevent duplicates
6. **Retry Logic** - Exponential backoff for failed operations

---

## 📈 Roadmap

### Completed ✅
- [x] Google Ads Campaign Builder
- [x] Health Check Agent
- [x] Competitor Intelligence Agent
- [x] Operations Agent (Neon → Pipedrive sync)
- [x] Content Agent (Newsletter + Social)
- [x] Meta Ads Agent (Campaign creation)
- [x] Attribution Agent (KPIs + Reports)
- [x] CLI Commands for all workflows

### Upcoming
- [ ] Glif MCP integration for AI images
- [ ] YouTube Shorts auto-upload
- [ ] A/B test management
- [ ] Automated bid adjustments
- [ ] Landing page analyzer
- [ ] Multi-account support

---

## 🤝 Contributing

Contributions welcome! Please read our contributing guidelines.

---

## 📜 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- [@channel47/google-ads-mcp](https://github.com/channel47/google-ads-mcp-server) for the Google Ads MCP server
- [Anthropic](https://anthropic.com) for Claude and the Agent SDK
- [DataForSEO](https://dataforseo.com) for competitive intelligence APIs
