# Message Delivery Reports and Status Tracking

## Real-Time Delivery Tracking
Every outbound WhatsApp message carries a unique Meta Message ID (`wamid`). Our system tracks lifecycle states:
1. **Queued:** Stored in the local Redis job queue awaiting worker dispatch.
2. **Sent:** Transmitted to Meta Graph API servers.
3. **Delivered:** Device delivery confirmed by recipient carrier/handset.
4. **Read:** Blue tick confirmation that the recipient viewed the chat.
5. **Failed:** Message undeliverable with specific Meta error reason.
