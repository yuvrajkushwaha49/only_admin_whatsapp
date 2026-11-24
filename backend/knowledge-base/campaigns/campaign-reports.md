# Campaign Analytics and Performance Reports

## Campaign Analytics Metrics
Once a broadcast is launched, the platform tracks granular recipient delivery statuses in real-time via Meta Webhooks:
- **Total Recipients:** Total number of contacts targeted in the campaign.
- **Sent:** Messages accepted by Meta Cloud API servers.
- **Delivered:** Messages confirmed received on the recipient's physical device (double grey checkmark).
- **Read:** Messages opened and read by recipients (double blue checkmark).
- **Failed:** Messages rejected by Meta (e.g. invalid number, blocked sender, or expired conversation window).
- **Delivery Rate (%):** `(Delivered / Total) * 100`
- **Read Rate (%):** `(Read / Delivered) * 100`

## Accessing Campaign Reports
1. Navigate to **Campaigns** -> **Campaign Reports** (`/campaigns/reports`).
2. Select a specific campaign to view the delivery breakdown chart and recipient activity table.
3. Inspect detailed failure reasons for undelivered contacts (e.g. Meta Error Code 131026 or 131047).
4. Export delivery logs to Excel or CSV for external offline analysis.
