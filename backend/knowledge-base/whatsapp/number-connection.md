# WhatsApp Number Connection & Management

## Managing WhatsApp Accounts in Dashboard
In the **WhatsApp Accounts** page (`/whatsapp`), users can manage all connected WhatsApp lines across their business.

## Account Card Details
Each connected account card displays:
- **Display Name & Phone Number:** The official name and international format phone number shown to recipients.
- **Primary Default Indicator:** The designated line used for default system notifications and single contact messages.
- **Connection Status:** Shows active (`Connected`), `Disconnected`, or `Restricted`.
- **Quality Rating:** Indicates Meta health status (`UNKNOWN`, `GREEN / High`, `YELLOW / Medium`, `RED / Low`).
- **Messaging Limit Tier:** Shows current 24-hour limit (e.g. `TIER_250`, `TIER_1K`, `TIER_10K`).
- **Webhook Status:** Confirms whether inbound webhooks are active and subscribed.

## Available Actions
- **Verify Status:** Pings Meta Graph API to refresh current token validity, quality rating, and messaging limit.
- **Sync Templates:** Pulls all approved, pending, and rejected templates directly from Meta into your workspace.
- **Set as Primary:** Designates this number as the default outbound sender for automated campaigns.
- **Disconnect / Delete:** Safely detaches the number from the workspace without affecting historic chat logs.
