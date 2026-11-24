# Common Troubleshooting & FAQs

## 1. Messages failing to deliver
- **Check Opt-in Status:** Make sure the contact is marked `is_opted_in = true`.
- **Check WhatsApp Account Status:** Confirm the sending number is in `Connected` status in **WhatsApp Accounts**.
- **Check 24-Hour Window:** Outside the 24-hour window, you cannot send free text; you must use an approved Meta template.

## 2. Template is rejected by Meta
- Check if promotional words exist in a template submitted under Utility category.
- Verify that sample variables were provided for all placeholders like `{{1}}`.
- Avoid emojis or sensational all-caps in titles or bodies.

## 3. Contact Import Fails or Skips Rows
- Verify phone number column has valid numbers with country codes or select the default country code dropdown before import.
- Ensure the CSV or Excel file is under 50MB and formatted in UTF-8.
