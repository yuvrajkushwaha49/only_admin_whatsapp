import 'dotenv/config';
import { checkConnection, executeQuery, isUsingFallback } from '../src/database/db.js';
import { autoConnectMetaAccount } from '../src/modules/whatsapp/whatsapp.service.js';
import { DEFAULT_BUSINESS_ID } from '../src/middleware/tenant.js';

async function main() {
  const connectedToMySql = await checkConnection();
  if (!connectedToMySql || isUsingFallback()) {
    console.error('❌ Cannot connect to MySQL database using backend/.env. Ensure MySQL host/port/password are reachable.');
    process.exit(1);
  }

  const token = (process.env.META_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN || '').trim();
  if (!token || token.startsWith('placeholder') || token.includes('your_')) {
    console.error('❌ META_ACCESS_TOKEN (or WHATSAPP_TOKEN) is missing in backend/.env.');
    process.exit(1);
  }

  const bizRows = await executeQuery('SELECT id, name FROM businesses ORDER BY id ASC LIMIT 1');
  const businessId = bizRows?.[0]?.id || DEFAULT_BUSINESS_ID;

  console.log(`🔗 Connecting WhatsApp from backend/.env for Business #${businessId} (${bizRows?.[0]?.name || 'Primary'})...`);
  const account = await autoConnectMetaAccount(businessId);

  console.log('✅ WhatsApp Account Connected Successfully:');
  console.log(JSON.stringify({
    id: account.id,
    business_id: account.business_id,
    display_name: account.display_name,
    verified_name: account.verified_name,
    phone_number: account.phone_number,
    phone_number_id: account.phone_number_id,
    waba_id: account.waba_id,
    quality_rating: account.quality_rating,
    status: account.status,
    is_primary: account.is_primary
  }, null, 2));

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ WhatsApp .env connection failed:', err.message);
  process.exit(1);
});
