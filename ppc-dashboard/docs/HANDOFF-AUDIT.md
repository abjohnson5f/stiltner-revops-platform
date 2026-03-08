# Stiltner RevOps Dashboard — Comprehensive Handoff Document

**Application:** Stiltner RevOps Dashboard (ppc-saas-ui)
**Location:** `/Users/alexjohnson/Stiltner Landscapes & Co./projects/ppc-dashboard/`
**Stack:** Next.js 16.1.1 | React 19.2.3 | Tailwind 4 | Recharts 3.7 | shadcn/ui | Neon Postgres
**Audit Date:** 03/05/2026
**Dev Server:** `npm run dev` → `http://localhost:3001`

---

## 1. EXECUTIVE SUMMARY

The RevOps dashboard is a 10-page, 14-API-route Next.js application serving as the marketing intelligence hub for Stiltner Landscapes & Co. It integrates with Google Ads, Neon Postgres, DataForSEO, Apify, and Claude AI.

The architecture uses a **graceful degradation pattern** — every integration has a mock/fallback path so the UI always renders. This is good for development but means **the app currently shows hardcoded or stale data in most views** because several integrations are disconnected.

### Overall Health Score

| Integration | Functional % | Blocking Issue |
|-------------|-------------|----------------|
| Google Ads | ~60% | Depends on separate ppc-agent server at localhost:3847 |
| Meta/Facebook Ads | ~5% | No API client, no credentials, no endpoints |
| Neon Database | ~90% | Working. Missing daily_stats sync + revenue tracking |
| GA4 Analytics | ~10% | Credentials missing from .env.local |
| AI/Claude | ~80% | ANTHROPIC_API_KEY is blank in .env.local |
| DataForSEO | ~90% | Credentials set. Works. |
| Apify | ~90% | Token set. Works. |

---

## 2. APPLICATION ARCHITECTURE

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js)                     │
│                                                           │
│  /              Dashboard (metrics cards, charts, leads)  │
│  /leads         Lead Pipeline (Kanban board)              │
│  /attribution   Attribution & ROAS (channel table)        │
│  /campaigns     Campaign Builder (5-step wizard)          │
│  /health        Google Ads Health Check (AI analysis)     │
│  /research      Market Research (keywords + competitors)  │
│  /agent         Agent Chat (conversational UI)            │
│  /content       Content Studio (placeholder)              │
│  /content/ads/meta  Meta Ads Creative Generator           │
│  /copywriter    AI Copywriter (page exists)               │
│  /login         Password authentication                   │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│                    API ROUTES                             │
│                                                           │
│  /api/metrics          → Neon + Google Ads → dashboard    │
│  /api/leads            → Neon DB (CRUD)                   │
│  /api/attribution      → Neon + Google Ads → attribution  │
│  /api/google-ads       → ppc-agent webhook proxy          │
│  /api/ga4              → Google Analytics Data API         │
│  /api/meta/health      → Meta Graph API health check      │
│  /api/campaigns/create → Google Ads (ppc-agent) / Meta    │
│  /api/agent            → PPC agent actions (7 actions)     │
│  /api/research/keywords    → DataForSEO API               │
│  /api/research/competitors → Apify Google Maps Scraper    │
│  /api/auth/login       → Password auth + cookie           │
│  /api/cron/daily-social    → Placeholder (TODO)           │
│  /api/cron/weekly-newsletter → Claude + Beehiiv (partial) │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│                 LIBRARY / INTEGRATION LAYER               │
│                                                           │
│  src/lib/google-ads.ts    → Proxy to ppc-agent webhook    │
│  src/lib/db.ts            → Neon serverless Postgres      │
│  src/lib/dataforseo.ts    → DataForSEO keyword research   │
│  src/lib/apify.ts         → Google Maps competitor intel   │
│  src/lib/ad-generator.ts  → Claude AI ad copy generation  │
│  src/lib/agent.ts         → Frontend agent API client     │
│  src/lib/ppc-agent/       → Embedded agent SDK (5 files)  │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│                 EXTERNAL SERVICES                         │
│                                                           │
│  Neon Postgres ──── ep-twilight-lake (neondb)             │
│  Google Ads ─────── Account 178-492-23902                 │
│  ppc-agent ──────── localhost:3847 (webhook server)       │
│  DataForSEO ─────── api.dataforseo.com/v3                 │
│  Apify ──────────── apify/google-maps-scraper             │
│  Anthropic ──────── Claude Sonnet (ad gen + health check) │
│  Meta Graph API ─── Not connected                         │
│  GA4 Data API ───── Not connected                         │
└─────────────────────────────────────────────────────────┘
```

---

## 3. FILE STRUCTURE

```
src/
├── app/
│   ├── layout.tsx                    Root layout (sidebar + header + RoleToggle)
│   ├── page.tsx                      Dashboard (main metrics page)
│   ├── globals.css                   Global styles
│   ├── agent/page.tsx                Agent Chat page
│   ├── attribution/page.tsx          Attribution & ROAS page
│   ├── campaigns/page.tsx            Campaign Builder (5-step wizard)
│   ├── content/
│   │   ├── page.tsx                  Content Studio hub (placeholder)
│   │   ├── ads/meta/page.tsx         Meta Ads Creative Generator
│   │   ├── email/page.tsx            Email campaigns (not implemented)
│   │   ├── newsletter/page.tsx       Newsletter (not implemented)
│   │   └── social/page.tsx           Social media (not implemented)
│   ├── copywriter/page.tsx           AI Copywriter
│   ├── health/page.tsx               Google Ads Health Check
│   ├── leads/page.tsx                Lead Pipeline (Kanban)
│   ├── login/page.tsx                Login page
│   ├── research/page.tsx             Market Research tools
│   └── api/
│       ├── agent/route.ts            PPC Agent actions (7 actions)
│       ├── attribution/route.ts      Attribution data endpoint
│       ├── auth/login/route.ts       Password auth
│       ├── campaigns/create/route.ts Campaign creation (Google + Meta)
│       ├── cron/
│       │   ├── daily-social/route.ts Placeholder cron
│       │   └── weekly-newsletter/route.ts Newsletter generation cron
│       ├── ga4/route.ts              GA4 Analytics endpoint
│       ├── google-ads/route.ts       Google Ads data endpoint
│       ├── leads/route.ts            Leads CRUD
│       ├── meta/health/route.ts      Meta API health check
│       ├── metrics/route.ts          Dashboard metrics endpoint
│       └── research/
│           ├── keywords/route.ts     DataForSEO keyword research
│           └── competitors/route.ts  Apify competitor intelligence
├── components/
│   ├── app-sidebar.tsx               Navigation sidebar
│   ├── markdown-renderer.tsx         Markdown display component
│   ├── campaign/
│   │   ├── ExportInstructions.tsx    Campaign export dialog
│   │   └── MarketResearch.tsx        Market research display
│   ├── dashboard/
│   │   ├── ChannelBreakdown.tsx      Channel pie/bar chart
│   │   ├── MetricCard.tsx            KPI metric card
│   │   ├── RecentLeads.tsx           Recent leads table
│   │   └── TrendChart.tsx            Line chart for trends
│   ├── layout/
│   │   └── RoleToggle.tsx            Owner/Tech view toggle
│   ├── leads/
│   │   ├── LeadCard.tsx              Individual lead card
│   │   ├── LeadDetailModal.tsx       Lead detail dialog
│   │   └── LeadKanban.tsx            Kanban board
│   └── ui/                           shadcn/ui components (20+ files)
├── hooks/
│   └── use-mobile.ts                 Mobile detection hook
├── lib/
│   ├── ad-generator.ts               Claude AI ad copy generation
│   ├── agent.ts                       Frontend API client for agent
│   ├── apify.ts                       Apify Google Maps scraper
│   ├── dataforseo.ts                  DataForSEO keyword research
│   ├── db.ts                          Neon Postgres connection + types
│   ├── google-ads.ts                  Google Ads data via ppc-agent
│   ├── utils.ts                       Utility functions (cn, etc.)
│   └── ppc-agent/
│       ├── index.ts                   Agent module exports
│       ├── types.ts                   Agent type definitions
│       ├── health-check.ts            Health check with Claude analysis
│       ├── campaign-builder.ts        Campaign creation logic
│       ├── content.ts                 Newsletter/email/social generation
│       └── insights.ts               AI insights generation
└── middleware.ts                      Auth middleware (cookie-based)
```

---

## 4. PAGE-BY-PAGE AUDIT

### 4.1 Dashboard (`/`) — WORKING

**File:** `src/app/page.tsx`
**Data:** Fetches from `/api/metrics?range={range}&from={date}&to={date}`
**Features:**
- 4 metric cards: Leads, Spend, CPL, Conversion Rate
- Lead velocity trend chart (Recharts line chart)
- Channel breakdown chart
- Recent leads table with click-to-detail modal
- Date range picker (today, 7d, 30d, quarter, all, custom)
- Auto-refresh every 2 minutes
- Owner/Tech view toggle (changes labels)

**Data flow:**
1. Frontend calls `/api/metrics`
2. API tries `getAccountMetrics()` from ppc-agent webhook (localhost:3847)
3. If ppc-agent available → real Google Ads data
4. If DB configured → queries `leads` + `daily_stats` tables from Neon
5. If neither → hardcoded Jan 2026 export data

**Current state:** Shows real data if ppc-agent running, otherwise stale Jan 2026 numbers.

---

### 4.2 Leads Pipeline (`/leads`) — WORKING

**File:** `src/app/leads/page.tsx`
**Data:** Fetches from `/api/leads?status={}&source={}&limit=200`
**Features:**
- Kanban board with columns: New, Contacted, Qualified, Quoted, Won, Lost
- Search by name/email/phone/service
- Filter by status and source
- Lead count stats bar
- Auto-refresh every 30 seconds
- PATCH endpoint for status updates

**Data flow:**
1. Frontend calls `/api/leads`
2. If DB configured → queries `leads` table with filters
3. If not → returns 6 hardcoded mock leads

**Current state:** Works with real Neon data. Lead status updates persist.

---

### 4.3 Attribution (`/attribution`) — WORKING

**File:** `src/app/attribution/page.tsx`
**Data:** Fetches from `/api/attribution`
**Features:**
- 4 summary cards: Total Spend, Total Leads, Blended CPL, ROAS
- Channel comparison table (Google Ads, Meta Ads, Bing, Website, Direct, Organic)
- CPL trend chart + Daily spend chart
- AI-generated insights section
- CSV export button
- Owner/Tech view toggle

**Data flow:** Same pattern as Dashboard — ppc-agent → Neon → hardcoded fallback.

**Current state:** Google Ads channel shows real data. Meta Ads channel has no data source. ROAS always 0 (no revenue tracking).

---

### 4.4 Campaign Builder (`/campaigns`) — WORKING

**File:** `src/app/campaigns/page.tsx` (837 lines — the largest page)
**Features — 5-step wizard:**
1. **Service & Goals** — Select service (7 options) + target locations (multi-select of Ohio cities) + campaign goals
2. **Market Research** — Calls `/api/research/keywords` (DataForSEO) + `/api/research/competitors` (Apify). Displays keywords, competitors, pain points, praise points, customer language. User selects items to include.
3. **Targeting** — Daily budget input, review selected keywords/locations/pain points
4. **Ad Generation** — Calls `/api/agent` action `generate-campaign-ads`. Uses Claude AI (or fallback templates). Shows Google Ads tab + Meta Ads tab with headlines, descriptions, keywords, targeting suggestions, image prompts.
5. **Launch** — Three buttons: "Launch Google Ads", "Launch Meta Ads", "Launch Both"
   - Google: calls `/api/campaigns/create` with `platform: 'google'` → ppc-agent creates real campaign
   - Meta: returns `manual: true` — generates export instructions

**Current state:** Full workflow works. Google launch works if ppc-agent running. Meta is manual-only.

---

### 4.5 Meta Ads Creative (`/content/ads/meta`) — WORKING (manual mode)

**File:** `src/app/content/ads/meta/page.tsx` (755 lines)
**Features:**
- Left panel: Service, locations, objective, budget, campaign notes
- "Research Market" button → calls `/api/research/competitors`
- Market intelligence tabs: Pain Points, Value Props, Customer Language (with checkboxes)
- "Generate Ads" button → calls `/api/agent` → Claude AI generates Meta ad variations
- Output: 3 ad variations (headline + body + CTA), targeting suggestions, image prompts
- Copy-to-clipboard on each element
- Download markdown instructions
- Meta API status badge (checks `/api/meta/health`)

**Current state:** Ad generation works. API badge shows "Manual Mode". No actual Meta API integration.

---

### 4.6 Health Check (`/health`) — WORKING

**File:** `src/app/health/page.tsx`
**Data:** Calls `/api/agent` action `health-check`
**Features:**
- Animated progress stepper (5 steps) during analysis
- AI-generated markdown report (via Claude if API key set)
- Account summary table (spend, clicks, impressions, conversions, CTR, CPC, CPL)
- Campaign performance table
- Issues found (color-coded severity)
- Recommendations list
- "Data Sources" accordion showing raw tool call results

**Data flow:**
1. Frontend calls `/api/agent` → `runHealthCheck()`
2. `health-check.ts` fetches from ppc-agent webhook
3. If data available + ANTHROPIC_API_KEY set → Claude generates detailed analysis
4. If data available but no API key → basic template report
5. If no ppc-agent → warning about connection

**Current state:** Works if ppc-agent running. AI analysis requires ANTHROPIC_API_KEY.

---

### 4.7 Agent Chat (`/agent`) — PARTIALLY WORKING

**File:** `src/app/agent/page.tsx`
**Features:** Chat interface with message history, markdown rendering, auto-scroll
**Issue:** The "custom" action in `/api/agent/route.ts` just echoes back the query:
```typescript
case 'custom': {
  return { response: `I received your query: "${params?.query}". Use specific actions...` }
}
```
No actual conversational AI. Would need Claude SDK integration for real chat.

---

### 4.8 Research Tools (`/research`) — PARTIALLY WORKING

**File:** `src/app/research/page.tsx`
**Features:** Keyword Research tab + Competitor Intel tab
**Issue:** Uses `agentApi.keywordResearch()` and `agentApi.competitorAnalysis()` which route through `/api/agent` — but those actions aren't handled in the switch statement and fall through to "custom" (echo). The research endpoints that DO work (`/api/research/keywords` and `/api/research/competitors`) are used by the Campaign Builder but NOT by this page.

**Fix:** Wire the Research page to use `/api/research/keywords` and `/api/research/competitors` directly instead of going through the agent API.

---

### 4.9 Content Studio (`/content`) — PLACEHOLDER

**File:** `src/app/content/page.tsx`
**Status:** Shows 4 cards all marked "Coming Soon":
- Newsletter Generator → `/content/newsletter`
- Email Campaigns → `/content/email`
- Social Media → `/content/social`
- Ad Creatives → `/content/ads/meta` (this one actually works)

Sub-pages `/content/newsletter`, `/content/email`, `/content/social` are not implemented.

---

### 4.10 Login (`/login`) — WORKING (but auth disabled)

**Files:** `src/app/login/page.tsx`, `src/middleware.ts`, `src/app/api/auth/login/route.ts`
**Auth flow:**
1. Middleware checks for `dashboard-auth` cookie on all routes
2. If `DASHBOARD_PASSWORD` not set in env → all routes accessible (current state)
3. If set → redirects unauthenticated users to `/login`
4. Login POST compares password, sets httpOnly cookie for 7 days

**Security note:** Cookie stores the raw password value (not hashed). Fine for a simple internal tool but not production-grade.

---

## 5. HARDCODED DATA INVENTORY

Every mock/fallback data source in the application:

| # | Location | File | Lines | Data Description | Trigger |
|---|----------|------|-------|-----------------|---------|
| 1 | Metrics API | `src/app/api/metrics/route.ts` | 7-109 | Jan 5-22 2026 Google Ads daily breakdown ($2,111.82 spend, 299 clicks, 11 conversions) | ppc-agent down + no DB |
| 2 | Attribution API | `src/app/api/attribution/route.ts` | 41-129 | Same Jan 2026 export data | ppc-agent down + no DB |
| 3 | Google Ads lib | `src/lib/google-ads.ts` | 158-211 | Campaign ID 23421364286 "Leads-Search-Phone Calls 01" with Jan 2026 numbers | ppc-agent timeout/error |
| 4 | Leads API | `src/app/api/leads/route.ts` | 5-12 | 6 fake leads (Sarah Johnson, Mike Thompson, Jennifer Lee, David Wilson, Amanda Brown, Robert Garcia) | DB not configured |
| 5 | GA4 API | `src/app/api/ga4/route.ts` | 132-188 | Random numbers generated per request | Always (no GA4 credentials) |
| 6 | DataForSEO | `src/lib/dataforseo.ts` | 307-364 | Template keywords with random volumes/CPCs by service type | API failure |
| 7 | Apify | `src/lib/apify.ts` | 383-436 | 5 fake competitors + generic pain/praise points | API failure |
| 8 | Ad Generator | `src/lib/ad-generator.ts` | 146-233 | Template ad copy with pain-point → headline mapping | No ANTHROPIC_API_KEY |
| 9 | Campaign Builder | `src/app/campaigns/page.tsx` | 208-273 | Client-side fallback ad generation (mirrors #8) | AI generation fails |
| 10 | Meta Ads page | `src/app/content/ads/meta/page.tsx` | 210-255 | Client-side fallback Meta ad creative | AI generation fails |

---

## 6. ENVIRONMENT VARIABLES

### Currently in `.env.local`

| Variable | Status | Used By |
|----------|--------|---------|
| `NEON_DATABASE_URL` | **Set** | `src/lib/db.ts` — Neon Postgres connection |
| `DASHBOARD_PASSWORD` | **Empty** | `src/middleware.ts` — Auth disabled when empty |
| `ANTHROPIC_API_KEY` | **Empty** | `src/lib/ad-generator.ts`, `src/lib/ppc-agent/health-check.ts` |
| `DATAFORSEO_LOGIN` | **Set** | `src/lib/dataforseo.ts` |
| `DATAFORSEO_PASSWORD` | **Set** | `src/lib/dataforseo.ts` |
| `APIFY_API_TOKEN` | **Set** | `src/lib/apify.ts` |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | **Set** | Not used directly (ppc-agent uses these) |
| `GOOGLE_ADS_CLIENT_ID` | **Set** | Not used directly |
| `GOOGLE_ADS_CLIENT_SECRET` | **Set** | Not used directly |
| `GOOGLE_ADS_REFRESH_TOKEN` | **Set** | Not used directly |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | **Set** | Not used directly |
| `GOOGLE_ADS_DEFAULT_CUSTOMER_ID` | **Set** | Not used directly |
| `PPC_AGENT_URL` | **Set** (`http://localhost:3847`) | `src/lib/google-ads.ts`, `src/lib/ppc-agent/health-check.ts` |

### Missing — Required for Full Functionality

| Variable | Needed For | How to Get |
|----------|-----------|------------|
| `GA4_PROPERTY_ID` | GA4 Analytics data | Google Analytics Admin → Property Settings → Property ID |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | GA4 API authentication | Google Cloud Console → Service Accounts → Create key → JSON |
| `META_ACCESS_TOKEN` | Meta Ads API | Meta Business Settings → System Users → Generate Token |
| `META_AD_ACCOUNT_ID` | Meta Ads campaigns/metrics | Meta Business Settings → Ad Accounts (format: `act_XXXXXXXXX`) |
| `META_PAGE_ID` | Meta Ads page context | Facebook Page Settings → About → Page ID |
| `CRON_SECRET` | Cron endpoint security | Generate any secure random string |

---

## 7. GOOGLE ADS — CURRENT STATE & GAPS

### How It Works Now

All Google Ads data flows through a **proxy pattern**:

```
Dashboard → /api/metrics → getAccountMetrics() → POST localhost:3847/webhook
                                                         ↓
                                                   ppc-agent server
                                                   (separate process)
                                                         ↓
                                                   Google Ads API
```

The `google-ads-api` npm package (v22) is installed but **never imported** — all calls go through the ppc-agent webhook server.

### What Works
- **Metrics retrieval** — Account-level spend, clicks, impressions, conversions, CTR, CPC
- **Campaign list** — Campaign names, statuses, individual metrics
- **Campaign creation** — Creates search campaigns in PAUSED state via ppc-agent
- **Health check** — Pulls metrics + Claude AI analysis
- **Date range support** — LAST_7_DAYS, LAST_30_DAYS, TODAY, custom ranges

### What's Missing
1. **Direct API client** — Should use `google-ads-api` package directly instead of proxy
2. **Daily stats sync** — No mechanism to populate `daily_stats` Neon table
3. **Search terms report** — Not queried or displayed
4. **Keyword performance** — Not queried individually
5. **Ad group management** — No CRUD for ad groups
6. **Revenue tracking** — ROAS always returns 0
7. **Conversion tracking verification** — Health check mentions it but doesn't verify

### Recommended Fix
Build `src/lib/google-ads-direct.ts` using the `google-ads-api` package with credentials already in `.env.local`. This eliminates the ppc-agent dependency for reads.

---

## 8. META/FACEBOOK ADS — CURRENT STATE & GAPS

### What Exists
1. **Health check** (`/api/meta/health`) — Makes a real Graph API call to verify credentials:
   ```
   GET https://graph.facebook.com/v18.0/{adAccountId}?fields=name,account_status
   ```
2. **Ad copy generation** — Campaign Builder + Meta Ads page generate ad copy (headlines, body, targeting, image prompts) via Claude AI or fallback templates
3. **Manual export** — Generates step-by-step markdown instructions for creating campaigns in Meta Ads Manager
4. **UI scaffolding** — Attribution page has `meta_ads` channel label. Campaign Builder has "Launch Meta Ads" button.

### What's Completely Missing
1. **Credentials** — `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID`, `META_PAGE_ID`
2. **API client library** — No `src/lib/meta-ads.ts`
3. **Campaign CRUD** — Cannot create/read/update/delete campaigns
4. **Ad set management** — No targeting API (audiences, locations, interests)
5. **Ad creative management** — No image/video upload, no ad creation
6. **Metrics retrieval** — No spend/clicks/impressions/conversions from Meta
7. **Dashboard integration** — No Meta data flows into metrics or attribution
8. **Lead form integration** — No Meta Lead Ads webhook handler
9. **Pixel tracking** — No Meta pixel on the website
10. **Conversion API** — No server-side event tracking

### What's Needed to Build It

**API routes to create:**
- `POST /api/meta/campaigns` — Create campaign
- `GET /api/meta/campaigns` — List campaigns with metrics
- `POST /api/meta/adsets` — Create ad set with targeting
- `POST /api/meta/ads` — Create ad with creative
- `GET /api/meta/metrics` — Aggregate metrics for dashboard
- `POST /api/meta/webhook` — Lead form webhook handler

**Library to build:**
- `src/lib/meta-ads.ts` — Meta Marketing API client using `fetch` against `https://graph.facebook.com/v18.0/`

**Dashboard changes:**
- Wire Meta metrics into `/api/metrics` and `/api/attribution`
- Enable `platform: 'meta'` in `/api/campaigns/create`
- Show Meta Ads channel data in Attribution table

---

## 9. DATABASE SCHEMA (Neon Postgres)

Based on the queries in the codebase, the database has these tables:

### `leads` table
```sql
id              UUID PRIMARY KEY
email           TEXT
first_name      TEXT
last_name       TEXT
phone           TEXT
lead_type       TEXT
status          TEXT  -- new, contacted, qualified, quoted, won, lost
property_address TEXT
property_city   TEXT
service_interest TEXT
message         TEXT
utm_source      TEXT
utm_medium      TEXT
utm_campaign    TEXT
gclid           TEXT
created_at      TIMESTAMPTZ
contacted_at    TIMESTAMPTZ
qualified_at    TIMESTAMPTZ
converted_at    TIMESTAMPTZ
updated_at      TIMESTAMPTZ
deleted_at      TIMESTAMPTZ  -- soft delete
```

### `daily_stats` table
```sql
id              UUID PRIMARY KEY
stat_date       DATE
source_type     TEXT  -- google_ads, meta_ads, organic, etc.
campaign_id     TEXT
spend           DECIMAL
revenue         DECIMAL
conversions     INTEGER
impressions     INTEGER
clicks          INTEGER
ctr             DECIMAL
cpa             DECIMAL
roas            DECIMAL
sessions        INTEGER
users           INTEGER
bounce_rate     DECIMAL
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

### `crm_links` table (defined in types but may not be populated)
```sql
id              UUID PRIMARY KEY
lead_id         UUID REFERENCES leads(id)
system_name     TEXT  -- pipedrive, hubspot, etc.
external_id     TEXT
external_url    TEXT
created_at      TIMESTAMPTZ
```

---

## 10. AUTHENTICATION & SECURITY

### Current Auth System
- **Middleware:** `src/middleware.ts` — Checks `dashboard-auth` cookie against `DASHBOARD_PASSWORD` env var
- **Login:** `src/app/api/auth/login/route.ts` — POST with password, sets httpOnly cookie
- **Bypass:** When `DASHBOARD_PASSWORD` is empty (current state), all routes are accessible
- **Excluded routes:** `/login`, `/api/auth/*`, `/api/cron/*`, static files

### Security Notes
- Cookie stores raw password (not hashed) — adequate for internal tool
- Cron endpoints (`/api/cron/*`) expect `Authorization: Bearer {CRON_SECRET}` header
- `CRON_SECRET` is not set — cron endpoints return 401 for any request
- No rate limiting on login attempts
- No CSRF protection (Next.js handles some automatically)

---

## 11. SIDEBAR NAVIGATION

Defined in `src/components/app-sidebar.tsx`:

**RevOps section:**
- Dashboard → `/`
- Leads Pipeline → `/leads`
- Attribution → `/attribution`

**Tools section:**
- Campaign Builder → `/campaigns`
- Health Check → `/health`
- Research Tools → `/research`
- AI Copywriter → `/copywriter`
- Content Studio → `/content`
- Agent Chat → `/agent`

---

## 12. SPECIAL FEATURES

### Owner/Tech View Toggle
`src/components/layout/RoleToggle.tsx` provides a toggle that changes terminology:
- **Tech view:** CPL, ROAS, Conversion Rate, Attribution
- **Owner view:** Cost per Lead, Return on Ad Spend, Success Rate, Marketing Performance

### Date Range Picker
`src/components/ui/date-range-picker.tsx` — Preset ranges (today, 7d, 30d, quarter, all) plus custom date range with calendar.

### Markdown Rendering
`src/components/markdown-renderer.tsx` — Uses `react-markdown` + `remark-gfm` for rendering AI-generated analysis reports.

---

## 13. RECOMMENDED PRIORITY PATH

### Phase 1: Quick Wins (< 1 day)
1. Set `ANTHROPIC_API_KEY` in `.env.local` → Unlocks AI ad generation + health check analysis
2. Set `DASHBOARD_PASSWORD` → Enables authentication
3. Fix Research page → Wire to `/api/research/*` endpoints instead of agent echo
4. Fix Agent Chat → Add Claude SDK for real conversational responses

### Phase 2: Google Ads Independence (2-3 days)
1. Build `src/lib/google-ads-direct.ts` using `google-ads-api` package
2. Update API routes to use direct client (eliminate ppc-agent dependency)
3. Add daily stats sync cron → Google Ads metrics → `daily_stats` table
4. Configure GA4 credentials → Real analytics data

### Phase 3: Meta Ads Integration (1-2 weeks)
1. Obtain Meta Business credentials (access token, ad account ID, page ID)
2. Build `src/lib/meta-ads.ts` client
3. Build API routes: campaigns, ad sets, ads, metrics
4. Wire Meta data into dashboard and attribution pages
5. Enable campaign creation for Meta platform
6. Add Meta metrics to daily stats sync

### Phase 4: Full Automation (ongoing)
1. Revenue tracking from Pipedrive won deals → ROAS calculations
2. Content Studio implementation (newsletter, email, social)
3. Meta Lead Ads webhook → Neon → Pipedrive pipeline
4. Automated daily/weekly reporting

---

## 14. RUNNING THE APPLICATION

### Development
```bash
cd "/Users/alexjohnson/Stiltner Landscapes & Co./projects/ppc-dashboard"
npm run dev -- -p 3001
```

### With PPC Agent (for live Google Ads data)
```bash
# Terminal 1: Dashboard
cd projects/ppc-dashboard && npm run dev -- -p 3001

# Terminal 2: PPC Agent webhook server
cd ppc-agent && npm run webhook-server
```

### Build
```bash
npm run build
npm run start
```

### Key URLs
- Dashboard: `http://localhost:3001`
- Health Check: `http://localhost:3001/health`
- Campaign Builder: `http://localhost:3001/campaigns`
- Agent API health: `http://localhost:3001/api/agent` (GET)
- Meta API health: `http://localhost:3001/api/meta/health` (GET)

---

## 15. KNOWN ISSUES

1. **~~Polling 404s~~** — RESOLVED. The `GET /api/messages/pending?since_id=0 404` errors were caused by a stale `.next` build cache. The polling code does not exist in any source file. Fix: deleted `.next` directory; rebuild with `npm run build` or `npm run dev`.
2. **Next.js middleware deprecation** — Warning: "The middleware file convention is deprecated. Please use proxy instead."
3. **Workspace root warning** — Next.js detects multiple lockfiles and infers wrong workspace root.
4. **Model version** — `ad-generator.ts` references `claude-sonnet-4-20250514`. Verify this is the intended model.
5. **getDailyStats()** returns empty array — `src/lib/google-ads.ts:139-150` is a stub that always returns `[]`.

---

*Document generated 03/05/2026 via comprehensive codebase audit.*
