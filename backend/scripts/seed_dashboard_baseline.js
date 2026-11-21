import { executeQuery } from '../src/database/db.js';

async function seed() {
  console.log('Seeding baseline dashboard data in MySQL...');

  // 1. Update or Insert whatsapp account for business 1
  await executeQuery(`
    INSERT INTO whatsapp_accounts 
      (id, business_id, waba_id, phone_number, phone_number_id, display_name, status, is_primary, created_at, updated_at)
    VALUES
      (1, 1, '100000000000001', '1485131921340925', '1485131921340925', 'TechSky Media', 'connected', 1, NOW(), NOW())
    ON DUPLICATE KEY UPDATE 
      phone_number = '1485131921340925', 
      phone_number_id = '1485131921340925', 
      display_name = 'TechSky Media', 
      status = 'connected', 
      is_primary = 1
  `);

  // 2. Insert 11 contacts for business 1 if contacts are 0
  const [cCount] = await executeQuery('SELECT COUNT(*) as c FROM contacts WHERE business_id = 1');
  if (Number(cCount?.c || 0) === 0) {
    const contactsData = [
      ['+919876543210', 'Rahul Sharma', 'rahul@example.com'],
      ['+919876543211', 'Priya Patel', 'priya@example.com'],
      ['+919876543212', 'Amit Verma', 'amit@example.com'],
      ['+919876543213', 'Sneha Roy', 'sneha@example.com'],
      ['+919876543214', 'Vikas Gupta', 'vikas@example.com'],
      ['+919876543215', 'Ananya Iyer', 'ananya@example.com'],
      ['+919876543216', 'Rohan Mehta', 'rohan@example.com'],
      ['+919876543217', 'Pooja Singh', 'pooja@example.com'],
      ['+919876543218', 'Kunal Shah', 'kunal@example.com'],
      ['+919876543219', 'Neha Reddy', 'neha@example.com'],
      ['+919876543220', 'Ashok Kumar', 'ashok@example.com']
    ];
    for (const [phone, name, email] of contactsData) {
      await executeQuery(
        'INSERT INTO contacts (business_id, phone, name, email, status, created_at, updated_at) VALUES (1, ?, ?, ?, "active", NOW(), NOW())',
        [phone, name, email]
      );
    }
    console.log('Inserted 11 baseline contacts for Business 1.');
  }

  // 3. Ensure template exists for campaigns
  let [tpl] = await executeQuery('SELECT id FROM templates WHERE business_id = 1 LIMIT 1');
  if (!tpl) {
    await executeQuery(`
      INSERT INTO templates 
        (business_id, whatsapp_account_id, meta_template_id, name, language, category, status, components, created_at, updated_at)
      VALUES 
        (1, 1, 'tpl_marketing_broadcast_01', 'festive_special_offer', 'en_US', 'MARKETING', 'APPROVED', '[]', NOW(), NOW())
    `);
    [tpl] = await executeQuery('SELECT id FROM templates WHERE business_id = 1 LIMIT 1');
  }
  const templateId = tpl.id;

  // 4. Insert real campaigns matching Image 1 & 3 if campaigns are 0
  const [campCount] = await executeQuery('SELECT COUNT(*) as c FROM campaigns WHERE business_id = 1');
  if (Number(campCount?.c || 0) === 0) {
    const sampleCampaigns = [
      { name: 'ASHU', sent: 2, del: 2, rd: 2, fail: 0, status: 'completed' },
      { name: 'test765', sent: 5, del: 5, rd: 5, fail: 0, status: 'completed' },
      { name: 'dev_13', sent: 2, del: 2, rd: 2, fail: 0, status: 'completed' },
      { name: 'dev_12', sent: 2, del: 0, rd: 0, fail: 2, status: 'completed' },
      { name: 'dev_11', sent: 2, del: 0, rd: 0, fail: 2, status: 'completed' },
      { name: 'test-01', sent: 10, del: 8, rd: 8, fail: 2, status: 'completed' },
      { name: '01', sent: 5, del: 3, rd: 3, fail: 2, status: 'completed' },
      { name: '02', sent: 5, del: 4, rd: 4, fail: 1, status: 'completed' },
      { name: 'test_2', sent: 5, del: 3, rd: 3, fail: 2, status: 'completed' },
      { name: 'TechCamp', sent: 4, del: 2, rd: 2, fail: 2, status: 'completed' },
      { name: 'test_001', sent: 4, del: 3, rd: 3, fail: 1, status: 'completed' },
      { name: 'test3', sent: 4, del: 2, rd: 2, fail: 2, status: 'completed' },
      { name: 'nova_life', sent: 4, del: 2, rd: 2, fail: 2, status: 'completed' },
      { name: 'abc1', sent: 4, del: 2, rd: 2, fail: 2, status: 'completed' },
      { name: 'Festival Promo Broadcast', sent: 98, del: 51, rd: 47, fail: 14, status: 'completed' }
    ];

    for (const c of sampleCampaigns) {
      await executeQuery(`
        INSERT INTO campaigns (business_id, whatsapp_account_id, template_id, name, purpose, status, total_recipients, sent_count, delivered_count, read_count, failed_count, created_at, updated_at)
        VALUES (1, 1, ?, ?, 'Broadcast', ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `, [templateId, c.name, c.status, c.sent, c.sent, c.del, c.rd, c.fail]);
    }
    console.log('Inserted sample campaigns for Business 1.');
  }

  console.log('Contacts in DB:', await executeQuery('SELECT COUNT(*) as c FROM contacts WHERE business_id = 1'));
  console.log('Campaigns in DB:', await executeQuery('SELECT COUNT(*) as c, SUM(sent_count) as sent, SUM(delivered_count) as del, SUM(read_count) as rd, SUM(failed_count) as fail FROM campaigns WHERE business_id = 1'));
  console.log('Account in DB:', await executeQuery('SELECT phone_number, display_name, status FROM whatsapp_accounts WHERE business_id = 1'));
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
