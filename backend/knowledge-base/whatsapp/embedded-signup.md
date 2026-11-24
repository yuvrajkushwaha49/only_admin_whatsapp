# Meta Embedded Signup Workflow

## What is Embedded Signup?
Embedded Signup is Meta's streamlined onboarding flow allowing business owners to connect their WhatsApp Business Account with just a few clicks directly from our dashboard without needing a Facebook Developer account or manual App creation.

## Step-by-Step Connection Guide
1. Navigate to **WhatsApp Accounts** in the client dashboard.
2. Click the **Connect WhatsApp Account** (or **Continue with Facebook**) button.
3. A secure Meta dialog window opens (`facebook.com/v21.0/dialog/oauth`).
4. Log into your verified Facebook profile that holds administrator permissions over your Meta Business Account.
5. Select or create your Meta Business Account.
6. Choose or create your WhatsApp Business Profile (Display Name, Category, Business Description).
7. Enter the business phone number you wish to use for WhatsApp messaging.
8. Receive a 6-digit verification code via SMS or Voice Call, and enter it to confirm number ownership.
9. Click **Finish**. Meta immediately grants our platform token permissions (`whatsapp_business_messaging`, `whatsapp_business_management`), returning the WABA ID and Phone Number ID to our system.

## Important Requirements
- The phone number being added must **NOT** be currently active on standard WhatsApp consumer app or WhatsApp Business mobile app. If it is, you must delete that account from the mobile app settings first before connecting to Cloud API.
- The user completing the flow must be an Admin of the Meta Business Manager.
