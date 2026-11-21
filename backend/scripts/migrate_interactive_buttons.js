import { executeQuery, isUsingFallback, getMemoryStore, saveMemoryStore } from '../src/database/db.js';

export async function migrateInteractiveButtons() {
  const sql = `
    CREATE TABLE IF NOT EXISTS interactive_buttons (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      business_id BIGINT UNSIGNED NOT NULL,
      title VARCHAR(150) NOT NULL,
      component_type VARCHAR(50) DEFAULT 'Feedback',
      delivery_type VARCHAR(50) DEFAULT 'buttons',
      message_text TEXT NULL,
      buttons_data JSON NULL,
      follow_up_enabled TINYINT(1) DEFAULT 0,
      follow_up_text TEXT NULL,
      button_type VARCHAR(50) DEFAULT 'QUICK_REPLY',
      button_text VARCHAR(100) NULL,
      value TEXT NULL,
      url_type ENUM('STATIC', 'DYNAMIC') DEFAULT 'STATIC',
      category VARCHAR(50) DEFAULT 'MARKETING',
      icon VARCHAR(50) DEFAULT 'bi-grid',
      click_count INT DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_by BIGINT UNSIGNED NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_btn_business (business_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  try {
    await executeQuery(sql);
    console.log('✅ [Migration] interactive_buttons table verified in MySQL.');

    // Check if columns exist; if not, add them
    const cols = await executeQuery('DESCRIBE interactive_buttons');
    const colNames = cols.map(c => c.Field);

    const alterStatements = [];
    if (!colNames.includes('component_type')) alterStatements.push('ADD COLUMN component_type VARCHAR(50) DEFAULT "Feedback"');
    if (!colNames.includes('delivery_type')) alterStatements.push('ADD COLUMN delivery_type VARCHAR(50) DEFAULT "buttons"');
    if (!colNames.includes('message_text')) alterStatements.push('ADD COLUMN message_text TEXT NULL');
    if (!colNames.includes('buttons_data')) alterStatements.push('ADD COLUMN buttons_data JSON NULL');
    if (!colNames.includes('follow_up_enabled')) alterStatements.push('ADD COLUMN follow_up_enabled TINYINT(1) DEFAULT 0');
    if (!colNames.includes('follow_up_text')) alterStatements.push('ADD COLUMN follow_up_text TEXT NULL');

    if (alterStatements.length > 0) {
      await executeQuery(`ALTER TABLE interactive_buttons ${alterStatements.join(', ')}`);
      console.log('✅ [Migration] Added new button set columns:', alterStatements);
    }

    // Seed sample button set matching the screenshot if empty
    const existing = await executeQuery('SELECT COUNT(*) as count FROM interactive_buttons WHERE business_id = 1 AND buttons_data IS NOT NULL');
    if (!existing || existing[0]?.count === 0) {
      console.log('🌱 [Seed] Seeding sample baseline Button Set (feedback_btn)...');
      const sampleButtons = [
        {
          id: 'helpful',
          label: '👍 Helpful',
          when_chosen: 'Record feedback',
          auto_reply: 'Thanks for your interest.'
        },
        {
          id: 'not_helpful',
          label: '👎 Not Helpful',
          when_chosen: 'Record feedback',
          auto_reply: 'Thanks {{name}}! An agent will contact you shortly.'
        }
      ];

      await executeQuery(`
        INSERT INTO interactive_buttons 
          (business_id, title, component_type, delivery_type, message_text, buttons_data, follow_up_enabled, button_type, button_text, value, category)
        VALUES
          (1, 'feedback_btn', 'Feedback', 'buttons', 'Are you interested in this property?', ?, 1, 'QUICK_REPLY', '👍 Helpful', 'helpful', 'MARKETING')
      `, [JSON.stringify(sampleButtons)]);
      console.log('✅ [Seed] feedback_btn button set created.');
    }
  } catch (err) {
    console.warn('⚠️ [Migration] Database migration notice:', err.message);
  }

  // Also support mock memory store
  const store = getMemoryStore();
  if (store) {
    if (!store.interactive_buttons) store.interactive_buttons = [];
    if (!store.interactive_buttons.some(b => b.title === 'feedback_btn')) {
      store.interactive_buttons.unshift({
        id: 101,
        business_id: 1,
        title: 'feedback_btn',
        component_type: 'Feedback',
        delivery_type: 'buttons',
        message_text: 'Are you interested in this property?',
        buttons_data: [
          {
            id: 'helpful',
            label: '👍 Helpful',
            when_chosen: 'Record feedback',
            auto_reply: 'Thanks for your interest.'
          },
          {
            id: 'not_helpful',
            label: '👎 Not Helpful',
            when_chosen: 'Record feedback',
            auto_reply: 'Thanks {{name}}! An agent will contact you shortly.'
          }
        ],
        follow_up_enabled: 1,
        follow_up_text: 'How could we have done better?',
        button_type: 'QUICK_REPLY',
        button_text: '👍 Helpful',
        value: 'helpful',
        category: 'MARKETING',
        click_count: 0,
        is_active: 1,
        created_at: new Date().toISOString()
      });
      saveMemoryStore();
    }
  }
}

if (process.argv[1] && process.argv[1].endsWith('migrate_interactive_buttons.js')) {
  migrateInteractiveButtons().then(() => {
    console.log('Migration completed.');
    process.exit(0);
  });
}
