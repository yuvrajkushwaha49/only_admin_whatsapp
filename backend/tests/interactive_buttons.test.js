process.env.NODE_ENV = 'test';
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { checkConnection } from '../src/database/db.js';
import * as buttonsService from '../src/modules/interactive_buttons/interactiveButtons.service.js';

describe('Interactive Buttons Service & Presets Test Suite', () => {
  before(async () => {
    await checkConnection();
  });

  let createdButton = null;

  test('1. List buttons & aggregated type statistics', async () => {
    const res = await buttonsService.getButtons(1);
    assert.ok(res.buttons, 'Buttons array must be present');
    assert.ok(res.stats, 'Stats object must be present');
    assert.ok(typeof res.stats.total === 'number');
    assert.ok(typeof res.stats.urlCount === 'number');
    assert.ok(typeof res.stats.phoneCount === 'number');
    assert.ok(typeof res.stats.quickReplyCount === 'number');
    assert.ok(typeof res.stats.copyCodeCount === 'number');
  });

  test('2. Create pre-configured Call to Action (URL Button)', async () => {
    const payload = {
      title: 'Unit Test Website Button',
      button_type: 'URL',
      button_text: 'Visit Demo Store',
      value: 'https://aiveexa.com/store',
      url_type: 'STATIC',
      category: 'MARKETING'
    };

    createdButton = await buttonsService.createButton(1, 101, payload);
    assert.ok(createdButton.id, 'Button ID must be returned');
    assert.equal(createdButton.button_text, 'Visit Demo Store');
    assert.equal(createdButton.button_type, 'URL');
    assert.equal(createdButton.value, 'https://aiveexa.com/store');
  });

  test('3. Enforce 25-character Meta WhatsApp limit on button text', async () => {
    const payload = {
      title: 'Invalid Text Length',
      button_type: 'URL',
      button_text: 'This button text is far too long for Meta policy specifications',
      value: 'https://aiveexa.com'
    };

    await assert.rejects(
      async () => {
        await buttonsService.createButton(1, 101, payload);
      },
      /25 characters/i
    );
  });

  test('4. Update existing button preset', async () => {
    assert.ok(createdButton?.id);
    const updated = await buttonsService.updateButton(1, createdButton.id, {
      button_text: 'Shop Now 50% Off',
      value: 'https://aiveexa.com/sale'
    });

    assert.equal(updated.button_text, 'Shop Now 50% Off');
    assert.equal(updated.value, 'https://aiveexa.com/sale');
  });

  test('5. Delete button preset', async () => {
    assert.ok(createdButton?.id);
    const delRes = await buttonsService.deleteButton(1, createdButton.id);
    assert.equal(delRes.success, true);

    const fetched = await buttonsService.getButtonById(1, createdButton.id);
    assert.equal(fetched, null, 'Deleted button should no longer exist');
  });
});
