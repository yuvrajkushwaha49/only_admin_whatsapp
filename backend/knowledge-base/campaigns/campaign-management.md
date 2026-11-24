# Campaign Management and Workflow

## What is Campaign Management?
Campaign Management enables businesses to design, launch, schedule, and track targeted WhatsApp broadcast messages to thousands of customers simultaneously with personalized content.

## Campaign Lifecycle & Statuses
1. **Draft:** The campaign has been configured and saved but not yet launched or scheduled.
2. **Scheduled:** The campaign has a future launch timestamp assigned and will trigger automatically via the background scheduler.
3. **Queued / Processing:** BullMQ background workers are actively processing message batches and dispatching through Meta Cloud API.
4. **Completed:** All target recipients in the campaign audience have been processed.
5. **Paused / Cancelled:** Sender halted campaign execution.

## Creating a Campaign
1. Open **Campaigns** -> **Create Campaign** (`/campaigns/create`).
2. Provide a descriptive **Campaign Name** (e.g., "Holi VIP Early Bird Offer").
3. Select the sending **WhatsApp Account**.
4. Choose an approved **Message Template** (Marketing, Utility, or Authentication).
5. Map dynamic variables (`{{1}}`, `{{2}}`, etc.) to contact fields (e.g., Contact Name, Order ID, Coupon Code).
6. Select Target Audience:
   - All Opted-In Contacts.
   - Filter by specific **Tags** (e.g., "VIP", "Wholesale").
   - Filter by **Contact Groups** (e.g., "Delhi Leads", "Recent Buyers").
7. Select delivery timing: **Send Now** or **Schedule for Later**.
8. Click **Launch Campaign**.
