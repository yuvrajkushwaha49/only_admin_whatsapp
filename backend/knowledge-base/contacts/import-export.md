# CSV & Excel Contact Import / Export

## Importing Contacts
1. Navigate to **Contacts** -> **Import Contacts** (`/contacts/import`).
2. Upload a `.csv` or `.xlsx` spreadsheet (files up to 50MB supported).
3. Column Mapping: Map columns from your spreadsheet to platform fields:
   - **Phone Number** (Mandatory)
   - **Name** or **First Name** / **Last Name**
   - **Email**
   - **Tags** (Comma-separated)
   - **Custom Attributes**
4. Set default country code (e.g., `91` for India) for numbers without explicit international prefix.
5. Provide Opt-in confirmation compliance statement.
6. Click **Start Import**. The background worker processes rows asynchronously with real-time status reporting.

## Exporting Contacts
1. Navigate to **Contacts** -> **Export** (`/contacts/export`).
2. Choose filters (All Contacts, specific Tags, or Date Added range).
3. Click **Generate Export File**. Download the resulting clean Excel or CSV spreadsheet.
