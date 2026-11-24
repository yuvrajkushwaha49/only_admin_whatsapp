# Scheduled Campaigns and Automation

## Scheduling Broadcasts
Users can plan marketing broadcasts days or weeks ahead:
1. In the **Campaign Builder**, navigate to the **Schedule** section.
2. Select the desired date and time using the date-time picker.
3. The platform respects your workspace timezone (e.g. `Asia/Kolkata` or `UTC`).
4. Review recipient audience size and template details.
5. Click **Schedule Campaign**.

## Background Scheduler Mechanics
- A background scheduler service runs periodically, checking for scheduled campaigns whose target timestamp has matured.
- When due, the scheduler changes status from `scheduled` to `queued` and enqueues jobs in the `campaignQueue`.
- The real-time floating progress widget immediately reflects active delivery progress across the dashboard.

## Modifying or Cancelling a Scheduled Campaign
- Navigate to **Campaigns** -> find the campaign in `Scheduled` status.
- You can edit parameters, reschedule to another time, or cancel the campaign before it commences execution.
