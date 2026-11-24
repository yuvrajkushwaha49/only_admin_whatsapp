# Meta WhatsApp Cloud API Error Codes

## Meta Error Reference Guide
Below are the most common Meta Cloud API error codes and their resolutions:

### Error 131047: Re-engagement Message Window Expired
- **Meaning:** More than 24 hours have passed since the customer last messaged your business.
- **Solution:** You cannot send a free-form session message. You must send an approved Meta Template (Marketing, Utility, or Authentication) to re-open the conversation window.

### Error 131056: Rate Limit Hit
- **Meaning:** Your account has exceeded Meta's throughput limit or the 24-hour messaging limit tier (e.g. 250 or 1,000 unique recipients).
- **Solution:** Slow down campaign sending rate or wait until the rolling 24-hour window resets. Maintain high quality ratings to unlock higher tiers.

### Error 131026: Message Undeliverable
- **Meaning:** The recipient phone number is not registered on WhatsApp, or the recipient has blocked your WhatsApp Business account.
- **Solution:** Verify the phone number format or mark the contact invalid.

### Error 131042: Payment Issue or WABA Suspended
- **Meaning:** There is an unpaid balance on your Meta Business Manager payment method, or the WABA is temporarily restricted by Meta policy.
- **Solution:** Visit Meta Business Manager -> Billing & Payments and resolve outstanding invoice or appeal policy restriction.

### Error 100: Invalid Parameter
- **Meaning:** Missing required template variables, incorrect media URL format, or invalid phone number formatting.
