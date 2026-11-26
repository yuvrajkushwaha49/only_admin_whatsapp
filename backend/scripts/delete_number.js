import { executeQuery, isUsingFallback, getMemoryStore, saveMemoryStore } from '../src/database/db.js';
import { syncDatabaseToLocalBackup } from '../src/database/syncBackup.js';

async function deleteNumber() {
  const targetPattern = process.argv[2] || '783-6922';
  const targetPhoneId = process.argv[3] || '1385992741274204';

  console.log(`\n======================================================`);
  console.log(`[WhatsApp Cleanup] Searching for invalid number pattern: "${targetPattern}" or Phone ID: "${targetPhoneId}"...`);
  console.log(`======================================================\n`);

  if (!isUsingFallback()) {
    try {
      const rows = await executeQuery(
        `SELECT id, business_id, phone_number, display_name, phone_number_id, waba_id, is_primary, status 
         FROM whatsapp_accounts 
         WHERE phone_number LIKE ? OR phone_number LIKE ? OR phone_number_id = ?`,
        [`%${targetPattern}%`, `%${targetPattern.replace(/\D/g, '')}%`, targetPhoneId]
      );

      if (!rows || rows.length === 0) {
        console.log(`ℹ️ [MySQL] No accounts found matching "${targetPattern}" or ID "${targetPhoneId}".`);
      } else {
        console.log(`Found ${rows.length} matching account(s) in MySQL:`);
        rows.forEach(r => {
          console.log(` - ID: ${r.id} | Biz: ${r.business_id} | Phone: ${r.phone_number} | PhoneID: ${r.phone_number_id} | Name: ${r.display_name} | Primary: ${r.is_primary}`);
        });

        // Delete matching accounts
        const ids = rows.map(r => r.id);
        const placeholders = ids.map(() => '?').join(',');
        await executeQuery(`DELETE FROM whatsapp_accounts WHERE id IN (${placeholders})`, ids);
        console.log(`\n✅ [MySQL] Successfully deleted ${ids.length} invalid WhatsApp account(s)!`);

        // Ensure each affected business has an active primary number if any exist
        const businessIds = Array.from(new Set(rows.map(r => r.business_id)));
        for (const bId of businessIds) {
          const remaining = await executeQuery(
            `SELECT id, phone_number, is_primary FROM whatsapp_accounts WHERE business_id = ? ORDER BY is_primary DESC, created_at ASC`,
            [bId]
          );
          if (remaining.length > 0 && !remaining.some(r => r.is_primary)) {
            await executeQuery(`UPDATE whatsapp_accounts SET is_primary = 1 WHERE id = ?`, [remaining[0].id]);
            console.log(`ℹ️ [MySQL] Promoted account #${remaining[0].id} (${remaining[0].phone_number}) as Primary for business #${bId}.`);
          }
        }
      }
    } catch (err) {
      console.error(`❌ [MySQL Error]`, err.message);
    }
  }

  // Also clean memory store (.dev_store.json)
  const store = getMemoryStore();
  if (Array.isArray(store.whatsapp_accounts)) {
    const beforeCount = store.whatsapp_accounts.length;
    store.whatsapp_accounts = store.whatsapp_accounts.filter(acc => {
      const p = acc.phone_number || '';
      const pid = String(acc.phone_number_id || '');
      const match = p.includes(targetPattern) || p.includes(targetPattern.replace(/\D/g, '')) || pid === targetPhoneId;
      return !match;
    });
    const deletedCount = beforeCount - store.whatsapp_accounts.length;
    if (deletedCount > 0) {
      saveMemoryStore();
      console.log(`✅ [Local Store] Deleted ${deletedCount} account(s) from .dev_store.json`);
    }
  }

  // Sync to local backup
  try {
    await syncDatabaseToLocalBackup();
    console.log(`✅ [Backup] Database backup updated successfully.`);
  } catch (_) {}

  console.log(`\n✨ Done! You can now restart pm2: pm2 restart all\n`);
  process.exit(0);
}

deleteNumber();
