# Contact Management and Compliance

## Contact Database Overview
The **Contacts** section (`/contacts`) is the central repository for your customer audience.

## Contact Attributes
- **Phone Number:** Stored with international country code (E.164 standard, e.g. `+919876543210`).
- **Name & Email:** Optional first name, last name, and email address.
- **Opt-in Status (`is_opted_in`):** Boolean indicating whether the customer consented to receive WhatsApp communications.
- **Status:** Active, Unsubscribed, or Invalid.
- **Tags:** Custom labels (e.g. "VIP", "Lead", "Website Signup", "Wholesale").
- **Custom Fields (JSON):** Dynamic attributes like City, Customer Tier, Loyalty Points, Last Order Date.

## Adding a Single Contact
1. Click **Add Contact** -> **Add Single Contact** in the top-right corner.
2. Enter the Phone Number, Country Code, and Name.
3. Select or search optional Tags from the searchable dropdown.
4. Record Consent Proof (e.g., "Web signup form" or "Walk-in store registration").
5. Click **Save Contact**.
