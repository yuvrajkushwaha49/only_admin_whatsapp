# WhatsApp Broadcasting & Rate Limits

## Broadcasting Engine Architecture
Our broadcasting engine is built on Redis-powered **BullMQ** job queues with enterprise-grade flow control:
- **Batch Processing:** Dispatches recipients in chunks of 50 to maximize throughput.
- **Throttling (Rate Limiting):** Regulated at up to 20 messages per second per phone number to strictly conform with Meta Cloud API safety regulations and avoid spam throttling.
- **Auto-Retry Mechanism:** If Meta returns a transient network glitch or temporary 5xx server timeout, exponential backoff retries the message without double-charging or dropping recipients.

## Personalization & Media Support
Broadcasts support dynamic personalization:
- Dynamic text variables (`{{1}}`, `{{2}}`) populated per recipient from contact metadata.
- Media headers: Send rich marketing campaigns containing high-resolution images (JPEG/PNG), PDFs, or video clips hosted on cloud storage.
- Interactive Buttons: Quick Replies (up to 3 buttons) and Call-To-Action buttons (Visit Website URL or Call Phone Number).

## Compliance & Anti-Spam Best Practices
- Only broadcast to customers who have given explicit prior consent (Opt-In).
- Always include an unsubscribe notice in the template footer (e.g., "Reply STOP to unsubscribe").
- Avoid blasting cold lists to prevent recipient blocks and protect your Meta Quality Rating.
