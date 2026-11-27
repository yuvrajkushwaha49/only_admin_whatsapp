import { describe, it, beforeEach } from 'node:test';
import assert from 'assert';
import * as automationsService from '../src/modules/automations/automations.service.js';
import * as automationEngine from '../src/modules/automations/automationEngine.service.js';
import { validateAutomationDefinition } from '../src/modules/automations/automations.validator.js';
import { PREDEFINED_TEMPLATES } from '../src/modules/automations/automations.templates.js';
import { getMemoryStore } from '../src/database/db.js';

describe('WhatsApp Conversational Automation Module', () => {
  const businessId = 1;
  const userId = 10;
  let testAutomation = null;

  beforeEach(() => {
    // Reset test memory store
    const store = getMemoryStore();
    store.automations = [];
    store.automation_versions = [];
    store.automation_triggers = [];
    store.automation_sessions = [];
    store.automation_callbacks = [];
    store.whatsapp_messages = [];
    store.whatsapp_conversations = [];
    store.contacts = [
      {
        id: 101,
        business_id: 1,
        first_name: 'Yuvraj',
        last_name: 'Kushwaha',
        phone: '+919565763089',
        tags: ['lead'],
        is_opted_in: 1
      }
    ];
  });

  it('1. should provide all 6 predefined starter templates', () => {
    const templates = Object.keys(PREDEFINED_TEMPLATES);
    assert.ok(templates.includes('blank'));
    assert.ok(templates.includes('product_enquiry'));
    assert.ok(templates.includes('catalogue_callback'));
    assert.ok(templates.includes('lead_qualification'));
    assert.ok(templates.includes('feedback_survey'));
    assert.ok(templates.includes('support_menu'));
  });

  it('2. should create a new automation from Product Enquiry template', async () => {
    testAutomation = await automationsService.createAutomation(businessId, userId, {
      name: 'Product Enquiry Bot',
      purpose: 'Guide customers through product catalog and generate callbacks',
      templateId: 'product_enquiry'
    });

    assert.ok(testAutomation.id);
    assert.strictEqual(testAutomation.name, 'Product Enquiry Bot');
    assert.strictEqual(testAutomation.status, 'draft');
    assert.strictEqual(testAutomation.draft_definition.steps.length, 4);
    assert.ok(testAutomation.draft_definition.triggers.keywords.includes('product'));
  });

  it('3. should validate definitions and reject reserved STOP keywords', () => {
    const invalidDef = {
      triggers: { keywords: ['STOP', 'UNSUBSCRIBE', 'help'] },
      steps: [{ id: 's1', name: 'Hi', content: 'Hello' }]
    };

    const result = validateAutomationDefinition(invalidDef);
    assert.strictEqual(result.isValid, false);
    assert.ok(result.errors.some(e => e.includes('reserved WhatsApp opt-out keyword')));
  });

  it('4. should publish an automation, create immutable version and index triggers', async () => {
    const auto = await automationsService.createAutomation(businessId, userId, {
      name: 'Sales Bot',
      templateId: 'product_enquiry'
    });

    const pubResult = await automationsService.publishAutomation(businessId, auto.id, userId);
    assert.strictEqual(pubResult.success, true);
    assert.strictEqual(pubResult.automation.status, 'published');

    const store = getMemoryStore();
    const version = store.automation_versions.find(v => Number(v.automation_id) === Number(auto.id));
    assert.ok(version);
    assert.strictEqual(version.version_number, 1);

    const triggers = store.automation_triggers.filter(t => Number(t.automation_id) === Number(auto.id));
    assert.ok(triggers.length > 0);
    assert.ok(triggers.some(t => t.keyword === 'product'));
  });

  it('5. should handle inbound keyword, start session, and dispatch Step 1', async () => {
    const auto = await automationsService.createAutomation(businessId, userId, {
      name: 'Live Chatbot',
      templateId: 'product_enquiry'
    });
    await automationsService.publishAutomation(businessId, auto.id, userId);

    const contact = { id: 101, phone: '+919565763089', first_name: 'Yuvraj' };
    const conversation = { id: 501, customer_phone: '+919565763089' };
    const message = { message_body: 'product', message_type: 'text' };

    const result = await automationEngine.handleInboundEvent({
      businessId,
      accountId: 1,
      contact,
      conversation,
      message,
      rawMsg: {}
    });

    assert.strictEqual(result.handledByAutomation, true);
    assert.strictEqual(result.stepId, 'step_1');

    const store = getMemoryStore();
    const session = store.automation_sessions.find(s => s.customer_phone === contact.phone && s.status === 'active');
    assert.ok(session);
    assert.strictEqual(session.current_step_id, 'step_1');
  });

  it('6. should transition steps when customer taps interactive button', async () => {
    const auto = await automationsService.createAutomation(businessId, userId, {
      name: 'Interactive Bot',
      templateId: 'product_enquiry'
    });
    await automationsService.publishAutomation(businessId, auto.id, userId);

    const contact = { id: 101, phone: '+919565763089', first_name: 'Yuvraj' };
    const conversation = { id: 501, customer_phone: '+919565763089' };

    // Step 1: Start session
    await automationEngine.handleInboundEvent({
      businessId,
      accountId: 1,
      contact,
      conversation,
      message: { message_body: 'product' },
      rawMsg: {}
    });

    // Step 2: Customer selects button 'btn_cat_1' ("Enterprise Plans" -> go_to_step 'step_2')
    const btnResult = await automationEngine.handleInboundEvent({
      businessId,
      accountId: 1,
      contact,
      conversation,
      message: { message_body: 'Enterprise Plans', message_type: 'interactive' },
      rawMsg: { interactive: { button_reply: { id: 'btn_cat_1', title: 'Enterprise Plans' } } }
    });

    assert.strictEqual(btnResult.handledByAutomation, true);
    assert.strictEqual(btnResult.stepId, 'step_2');

    const store = getMemoryStore();
    const session = store.automation_sessions.find(s => s.customer_phone === contact.phone && s.status === 'active');
    assert.strictEqual(session.current_step_id, 'step_2');
  });

  it('7. should trigger callback lead creation when customer requests a callback', async () => {
    const auto = await automationsService.createAutomation(businessId, userId, {
      name: 'Callback Bot',
      templateId: 'product_enquiry'
    });
    await automationsService.publishAutomation(businessId, auto.id, userId);

    const contact = { id: 101, phone: '+919565763089', first_name: 'Yuvraj' };
    const conversation = { id: 501, customer_phone: '+919565763089' };

    // Start session
    await automationEngine.handleInboundEvent({
      businessId,
      accountId: 1,
      contact,
      conversation,
      message: { message_body: 'product' },
      rawMsg: {}
    });

    // Customer taps 'btn_cat_3' ("Request Call")
    const callResult = await automationEngine.handleInboundEvent({
      businessId,
      accountId: 1,
      contact,
      conversation,
      message: { message_body: 'Request Call', message_type: 'interactive' },
      rawMsg: { interactive: { button_reply: { id: 'btn_cat_3', title: 'Request Call' } } }
    });

    assert.strictEqual(callResult.handledByAutomation, true);
    assert.strictEqual(callResult.action, 'callback');

    const store = getMemoryStore();
    const callback = store.automation_callbacks.find(c => c.customer_phone === contact.phone);
    assert.ok(callback);
    assert.strictEqual(callback.status, 'pending');

    const updatedContact = store.contacts.find(c => c.id === contact.id);
    assert.ok(updatedContact.tags.includes('Callback Requested'));
  });

  it('8. should handle unexpected replies, send fallback, and handover at limit', async () => {
    const auto = await automationsService.createAutomation(businessId, userId, {
      name: 'Fallback Limit Bot',
      templateId: 'product_enquiry'
    });
    await automationsService.publishAutomation(businessId, auto.id, userId);

    const contact = { id: 101, phone: '+919565763089', first_name: 'Yuvraj' };
    const conversation = { id: 501, customer_phone: '+919565763089' };

    // Start session
    await automationEngine.handleInboundEvent({
      businessId,
      accountId: 1,
      contact,
      conversation,
      message: { message_body: 'product' },
      rawMsg: {}
    });

    // Unexpected reply #1: custom text
    const unexp1 = await automationEngine.handleInboundEvent({
      businessId,
      accountId: 1,
      contact,
      conversation,
      message: { message_body: 'what is your discount?' },
      rawMsg: {}
    });
    assert.strictEqual(unexp1.action, 'fallback_asked');

    // Unexpected reply #2: limit reached (limit is 2)
    const unexp2 = await automationEngine.handleInboundEvent({
      businessId,
      accountId: 1,
      contact,
      conversation,
      message: { message_body: 'can someone call me right now?' },
      rawMsg: {}
    });
    assert.strictEqual(unexp2.action, 'handover_limit_reached');

    const store = getMemoryStore();
    const session = store.automation_sessions.find(s => s.customer_phone === contact.phone);
    assert.strictEqual(session.status, 'handed_over');
  });

  it('9. should trigger automation when customer queries/replies after receiving a WhatsApp template', async () => {
    // 1. Create and publish automation with Template Reply trigger
    const auto = await automationsService.createAutomation(businessId, userId, {
      name: 'Welcome Template Followup Bot',
      templateId: 'product_enquiry'
    });

    // Update definition to listen for replies to 'welcome_msg'
    await automationsService.updateAutomation(businessId, auto.id, {
      definition: {
        ...auto.draft_definition,
        triggers: {
          keywords: [],
          buttonId: null,
          templateName: 'welcome_msg',
          templateMatchType: 'ANY_REPLY'
        }
      }
    });

    await automationsService.publishAutomation(businessId, auto.id, userId);

    const store = getMemoryStore();
    // 2. Simulate outbound template broadcast sent to customer
    const targetPhone = '+919988776655';
    const contact = { id: 202, phone: targetPhone, first_name: 'Rohit' };
    const conversation = { id: 602, customer_phone: targetPhone };

    if (!store.messages) store.messages = [];
    store.messages.push({
      id: Date.now(),
      business_id: businessId,
      phone: targetPhone,
      contact_id: contact.id,
      direction: 'OUTBOUND',
      message_type: 'template',
      template_name: 'welcome_msg',
      created_at: new Date()
    });

    // 3. Customer sends an inbound question/query
    const queryResult = await automationEngine.handleInboundEvent({
      businessId,
      accountId: 1,
      contact,
      conversation,
      message: { message_body: 'Hi, what are your service charges?', message_type: 'text' },
      rawMsg: {}
    });

    assert.strictEqual(queryResult.handledByAutomation, true);
    assert.strictEqual(queryResult.stepId, 'step_1');

    const session = (store.automation_sessions || []).find(s => s.customer_phone === targetPhone && s.status === 'active');
    assert.ok(session, 'Expected active automation session to be created for customer query');
    assert.strictEqual(Number(session.automation_id), Number(auto.id));
  });
});
