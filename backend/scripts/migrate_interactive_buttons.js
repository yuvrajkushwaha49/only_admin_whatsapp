import { executeQuery, isUsingFallback, getMemoryStore, saveMemoryStore } from '../src/database/db.js';

export async function migrateInteractiveButtons() {
  const sql = `
    CREATE TABLE IF NOT EXISTS interactive_buttons (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      business_id BIGINT UNSIGNED NOT NULL,
      title VARCHAR(150) NOT NULL,
      button_type ENUM('URL', 'PHONE_NUMBER', 'QUICK_REPLY', 'COPY_CODE') NOT NULL DEFAULT 'URL',
      button_text VARCHAR(50) NOT NULL,
      value TEXT NOT NULL,
      url_type ENUM('STATIC', 'DYNAMIC') DEFAULT 'STATIC',
      category VARCHAR(50) DEFAULT 'MARKETING',
      icon VARCHAR(50) DEFAULT 'bi-link-45deg',
      click_count INT DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_by BIGINT UNSIGNED NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_btn_business (business_id),
      INDEX idx_btn_type (button_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  try {
    await executeQuery(sql);
    console.log('✅ [Migration] interactive_buttons table ready in MySQL.');

    // Seed default baseline buttons for business 1 if empty
    const existing = await executeQuery('SELECT COUNT(*) as count FROM interactive_buttons WHERE business_id = 1');
    if (!existing || existing[0]?.count === 0) {
      console.log('🌱 [Seed] Seeding sample baseline Call to Action buttons...');
      const seedSql = `
        INSERT INTO interactive_buttons 
          (business_id, title, button_type, button_text, value, url_type, category, icon)
        VALUES
          (1, 'Visit Main Website', 'URL', 'Visit Website', 'https://aiveexa.com', 'STATIC', 'MARKETING', 'bi-globe'),
          (1, 'Direct WhatsApp Support Call', 'PHONE_NUMBER', 'Call Support', '+919876543210', 'STATIC', 'SUPPORT', 'bi-telephone'),
          (1, 'Claim 20% Festive Discount', 'COPY_CODE', 'FESTIVE20', 'FESTIVE20', 'STATIC', 'MARKETING', 'bi-tag'),
          (1, 'Quick Reply: I Am Interested', 'QUICK_REPLY', 'Yes, I am interested', 'QUICK_YES_INTERESTED', 'STATIC', 'MARKETING', 'bi-reply'),
          (1, 'Track Order Status Link', 'URL', 'Track Order', 'https://aiveexa.com/track?id={{1}}', 'DYNAMIC', 'UTILITY', 'bi-box-seam')
      `;
      await executeQuery(seedSql);
      console.log('✅ [Seed] 5 baseline interactive buttons created.');
    }
  } catch (err) {
    console.warn('⚠️ [Migration] Could not create table in MySQL, checking fallback:', err.message);
  }

  // Also support mock memory store
  const store = getMemoryStore();
  if (store && !store.interactive_buttons) {
    store.interactive_buttons = [
      {
        id: 1,
        business_id: 1,
        title: 'Visit Main Website',
        button_type: 'URL',
        button_text: 'Visit Website',
        value: 'https://aiveexa.com',
        url_type: 'STATIC',
        category: 'MARKETING',
        icon: 'bi-globe',
        click_count: 42,
        is_active: 1,
        created_at: new Date().toISOString()
      },
      {
        id: 2,
        business_id: 1,
        title: 'Direct WhatsApp Support Call',
        button_type: 'PHONE_NUMBER',
        button_text: 'Call Support',
        value: '+919876543210',
        url_type: 'STATIC',
        category: 'SUPPORT',
        icon: 'bi-telephone',
        click_count: 18,
        is_active: 1,
        created_at: new Date().toISOString()
      },
      {
        id: 3,
        business_id: 1,
        title: 'Claim 20% Festive Discount',
        button_type: 'COPY_CODE',
        button_text: 'FESTIVE20',
        value: 'FESTIVE20',
        url_type: 'STATIC',
        category: 'MARKETING',
        icon: 'bi-tag',
        click_count: 65,
        is_active: 1,
        created_at: new Date().toISOString()
      },
      {
        id: 4,
        business_id: 1,
        title: 'Quick Reply: I Am Interested',
        button_type: 'QUICK_REPLY',
        button_text: 'Yes, I am interested',
        value: 'QUICK_YES_INTERESTED',
        url_type: 'STATIC',
        category: 'MARKETING',
        icon: 'bi-reply',
        click_count: 92,
        is_active: 1,
        created_at: new Date().toISOString()
      },
      {
        id: 5,
        business_id: 1,
        title: 'Track Order Status Link',
        button_type: 'URL',
        button_text: 'Track Order',
        value: 'https://aiveexa.com/track?id={{1}}',
        url_type: 'DYNAMIC',
        category: 'UTILITY',
        icon: 'bi-box-seam',
        click_count: 31,
        is_active: 1,
        created_at: new Date().toISOString()
      }
    ];
    saveMemoryStore();
  }
}

if (process.argv[1] && process.argv[1].endsWith('migrate_interactive_buttons.js')) {
  migrateInteractiveButtons().then(() => {
    console.log('Migration completed.');
    process.exit(0);
  });
}
