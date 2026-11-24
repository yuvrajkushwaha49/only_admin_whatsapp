# WhatsApp Business Cloud API Integration

## Overview
Our platform leverages Meta's official WhatsApp Business Cloud API (Graph API v21.0), hosted directly on Meta's enterprise cloud infrastructure. This delivers fast, high-deliverability messaging without requiring on-premise hardware or third-party intermediary SMS gateways.

## Core Architecture
- **WABA ID (WhatsApp Business Account ID):** The unique identifier representing your business entity inside Meta Business Manager.
- **Phone Number ID:** The specific numeric ID assigned by Meta to your registered phone number. All message dispatch APIs target this Phone Number ID.
- **Access Tokens:** System user access tokens securely encrypted with AES-256 on the backend to authenticate API requests with Graph API endpoints.
- **Webhooks:** Secure bi-directional HTTPS event listeners capturing real-time message statuses (`sent`, `delivered`, `read`, `failed`) and inbound customer replies.

## Messaging Tiers and Limits
Meta categorizes phone numbers into messaging tiers determining how many unique customers you can message in a rolling 24-hour window:
- **Tier 250:** Initial unverified sandbox tier allowing messaging up to 250 unique business-initiated contacts in 24 hours.
- **Tier 1K (1,000 customers):** Standard tier after business registration.
- **Tier 10K (10,000 customers):** Unlocked automatically as message volume and high quality ratings are sustained.
- **Tier 100K (100,000 customers) & Unlimited:** For high-volume enterprise senders.

## Quality Rating
Meta computes your phone number's quality rating based on how customers receive your messages:
- **Green (High):** Excellent engagement with minimal blocks or spam reports.
- **Yellow (Medium):** Warning level indicating a rise in user complaints.
- **Red (Low):** Critical state where messaging tiers may be downgraded or paused if spam complaints continue.
