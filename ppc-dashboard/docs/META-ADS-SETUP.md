# Meta Ads API Setup Guide

Complete guide for connecting the Stiltner Dashboard to Meta (Facebook/Instagram) Ads.

## Overview

This guide walks you through setting up Meta Business Suite credentials to enable:
- Automated campaign creation
- Ad performance tracking
- Audience insights
- Budget management

**Estimated time:** 30-45 minutes

---

## Prerequisites

Before starting, ensure you have:
- [ ] Facebook account with admin access to the business page
- [ ] Meta Business Suite access (business.facebook.com)
- [ ] An existing Facebook Page for Stiltner Landscapes
- [ ] A payment method set up in Meta Business Suite

---

## Step 1: Access Meta Business Suite

1. Go to [business.facebook.com](https://business.facebook.com)
2. Log in with your Facebook credentials
3. If you don't have a Business account, click **"Create Account"** and follow the prompts

---

## Step 2: Create a System User

System users are special accounts for API access that don't require a personal Facebook login.

1. In Business Suite, click **⚙️ Settings** (gear icon, bottom left)
2. Navigate to **Users** → **System users**
3. Click **"Add"** to create a new system user
4. Fill in the details:
   - **Name:** `Stiltner Dashboard`
   - **Role:** `Admin`
5. Click **"Create system user"**

---

## Step 3: Assign Permissions

After creating the system user, assign it to your assets:

1. Click on the system user you just created
2. Click **"Add Assets"**
3. Select each asset type and assign permissions:

### Ad Account Permissions
- Select your Ad Account (e.g., "Stiltner Landscapes")
- Toggle **ON**: `Manage campaigns`
- Toggle **ON**: `View performance`
- Click **"Save Changes"**

### Page Permissions
- Select your Facebook Page (e.g., "Stiltner Landscapes")
- Toggle **ON**: `Create content`
- Toggle **ON**: `Manage Page`
- Click **"Save Changes"**

---

## Step 4: Generate Access Token

1. From the system user page, click **"Generate new token"**
2. Select your App (or create one if needed - see Step 4a below)
3. Select the following permissions:
   - `ads_management`
   - `ads_read`
   - `pages_read_engagement`
   - `pages_manage_ads`
   - `business_management`
4. Set token expiration to **"Never"** (60-day tokens require manual renewal)
5. Click **"Generate token"**
6. **IMPORTANT:** Copy and save this token immediately - it won't be shown again!

### Step 4a: Create a Meta App (if needed)

If you don't have a Meta App:

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Click **"My Apps"** → **"Create App"**
3. Select **"Business"** as the app type
4. Fill in:
   - **App name:** `Stiltner Dashboard`
   - **App contact email:** Your email
   - **Business account:** Select your business
5. Click **"Create App"**
6. Skip the product setup for now
7. Go to **Settings** → **Basic**
8. Copy your **App ID** and **App Secret**

---

## Step 5: Get Your Account IDs

### Ad Account ID
1. Go to [Business Settings](https://business.facebook.com/settings)
2. Click **"Accounts"** → **"Ad Accounts"**
3. Click on your ad account
4. The ID is shown in the panel (format: `act_123456789`)
5. Copy the full ID including the `act_` prefix

### Page ID
1. Go to [Business Settings](https://business.facebook.com/settings)
2. Click **"Accounts"** → **"Pages"**
3. Click on your Facebook Page
4. The Page ID is shown in the URL or details panel
5. Copy the numeric ID (e.g., `123456789`)

---

## Step 6: Configure Environment Variables

Add these to your `.env.local` file:

```bash
# Meta Ads API Configuration
META_ACCESS_TOKEN=EAAxxxxxxxxxxxxxxxxx...
META_AD_ACCOUNT_ID=act_123456789
META_PAGE_ID=123456789
META_APP_ID=your_app_id
META_APP_SECRET=your_app_secret
```

### Variable Descriptions

| Variable | Description | Example |
|----------|-------------|---------|
| `META_ACCESS_TOKEN` | System user access token | `EAABsbCS1...` (long string) |
| `META_AD_ACCOUNT_ID` | Ad account ID with `act_` prefix | `act_178492239` |
| `META_PAGE_ID` | Facebook Page numeric ID | `123456789` |
| `META_APP_ID` | App ID from developer portal | `1234567890` |
| `META_APP_SECRET` | App secret (keep private!) | `abcd1234...` |

---

## Step 7: Verify Setup

Test your configuration:

```bash
# From the ppc-dashboard directory
npm run dev

# In another terminal, test the Meta connection
curl http://localhost:3000/api/meta/health
```

Expected response:
```json
{
  "success": true,
  "accountName": "Stiltner Landscapes",
  "status": "connected"
}
```

---

## Step 8: Set Up Payment Method

Meta requires a valid payment method to run ads:

1. Go to [Business Settings](https://business.facebook.com/settings)
2. Click **"Payments"**
3. Click **"Add Payment Method"**
4. Enter credit card or bank account details
5. Set as primary payment method

---

## Troubleshooting

### "Invalid OAuth access token"
- Token may have expired (if using 60-day token)
- Generate a new token following Step 4

### "Ad account not found"
- Verify the ad account ID includes `act_` prefix
- Check system user has access to the ad account

### "Permissions error"
- Review Step 3 and ensure all permissions are granted
- Token may need to be regenerated with correct permissions

### "App not approved"
- New apps may need business verification
- Go to [developers.facebook.com](https://developers.facebook.com) and check app status

---

## Security Best Practices

1. **Never commit tokens to git** - Use `.env.local` which is gitignored
2. **Use system users** - Don't use personal access tokens
3. **Minimal permissions** - Only grant required permissions
4. **Rotate tokens** - Change tokens if exposed
5. **Monitor usage** - Check Business Suite for unexpected activity

---

## Quick Reference

| Resource | URL |
|----------|-----|
| Business Suite | [business.facebook.com](https://business.facebook.com) |
| Ads Manager | [business.facebook.com/adsmanager](https://business.facebook.com/adsmanager) |
| Developer Portal | [developers.facebook.com](https://developers.facebook.com) |
| API Documentation | [developers.facebook.com/docs/marketing-apis](https://developers.facebook.com/docs/marketing-apis) |
| Business Help | [facebook.com/business/help](https://www.facebook.com/business/help) |

---

## API Rate Limits

Be aware of Meta's rate limits:
- Standard tier: 200 calls/hour per ad account
- Development tier: 60 calls/hour
- Batch requests count as multiple calls

The dashboard handles rate limiting automatically.

---

## Need Help?

If you encounter issues:
1. Check the [Meta Business Help Center](https://www.facebook.com/business/help)
2. Review API error codes in the [developer documentation](https://developers.facebook.com/docs/marketing-api/error-reference)
3. Contact Meta Business Support through Business Suite

---

*Last updated: January 2026*
