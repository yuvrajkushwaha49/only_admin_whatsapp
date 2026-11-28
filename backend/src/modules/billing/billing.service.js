import { executeQuery, isUsingFallback, getMemoryStore } from '../../database/db.js';
import { SINGLE_COMPANY_MODE } from '../../middleware/tenant.js';

export async function listPlans() {
  if (isUsingFallback()) {
    const store = getMemoryStore();
    return store.subscription_plans;
  }
  const plans = await executeQuery('SELECT * FROM subscription_plans WHERE is_active = TRUE ORDER BY monthly_price ASC');
  return plans.map(p => ({
    ...p,
    features: typeof p.features === 'string' ? JSON.parse(p.features) : p.features
  }));
}

export async function getSubscription(businessId) {
  if (isUsingFallback()) {
    const store = getMemoryStore();
    const sub = store.subscriptions.find(s => s.business_id === Number(businessId));
    const plan = sub ? store.subscription_plans.find(p => p.id === sub.plan_id) : null;
    return { subscription: sub, plan };
  }

  const rows = await executeQuery(
    `SELECT s.*, p.name as plan_name, p.slug as plan_slug, p.monthly_price, p.max_contacts, p.max_campaigns_per_month, p.max_messages_per_month, p.max_team_members, p.features
     FROM subscriptions s
     JOIN subscription_plans p ON s.plan_id = p.id
     WHERE s.business_id = ? LIMIT 1`,
    [businessId]
  );

  if (rows.length === 0) return null;
  const sub = rows[0];
  return {
    ...sub,
    features: typeof sub.features === 'string' ? JSON.parse(sub.features) : sub.features
  };
}

export async function getUsage(businessId) {
  const currentMonth = new Date().toISOString().substring(0, 7); // 'YYYY-MM'

  if (isUsingFallback()) {
    const store = getMemoryStore();
    const contactsCount = store.contacts.filter(c => c.business_id === Number(businessId)).length;
    const campaignsCount = store.campaigns.filter(c => c.business_id === Number(businessId)).length;
    const messagesCount = store.campaigns
      .filter(c => c.business_id === Number(businessId))
      .reduce((sum, c) => sum + (c.sent_count || 0), 0);

    return {
      periodMonth: currentMonth,
      unlimited: SINGLE_COMPANY_MODE,
      metrics: {
        contacts: { current: contactsCount, limit: SINGLE_COMPANY_MODE ? null : 15000, unlimited: SINGLE_COMPANY_MODE, percentage: SINGLE_COMPANY_MODE ? 0 : Math.round((contactsCount / 15000) * 100) },
        campaigns: { current: campaignsCount, limit: SINGLE_COMPANY_MODE ? null : 50, unlimited: SINGLE_COMPANY_MODE, percentage: SINGLE_COMPANY_MODE ? 0 : Math.round((campaignsCount / 50) * 100) },
        messages: { current: messagesCount, limit: SINGLE_COMPANY_MODE ? null : 75000, unlimited: SINGLE_COMPANY_MODE, percentage: SINGLE_COMPANY_MODE ? 0 : Math.round((messagesCount / 75000) * 100) }
      }
    };
  }

  const [contactRow] = await executeQuery('SELECT COUNT(*) as total FROM contacts WHERE business_id = ?', [businessId]);
  const [campaignRow] = await executeQuery('SELECT COUNT(*) as total FROM campaigns WHERE business_id = ?', [businessId]);
  const [ledgerRow] = await executeQuery(
    `SELECT COALESCE(SUM(quantity), 0) as total FROM usage_ledger WHERE business_id = ? AND metric_type = 'messages_sent' AND period_month = ?`,
    [businessId, currentMonth]
  );

  const currentContacts = contactRow?.total || 0;
  const currentCampaigns = campaignRow?.total || 0;
  const currentMessages = Number(ledgerRow?.total || 0);

  if (SINGLE_COMPANY_MODE) {
    return {
      periodMonth: currentMonth,
      unlimited: true,
      metrics: {
        contacts: { current: currentContacts, limit: null, unlimited: true, percentage: 0 },
        campaigns: { current: currentCampaigns, limit: null, unlimited: true, percentage: 0 },
        messages: { current: currentMessages, limit: null, unlimited: true, percentage: 0 }
      }
    };
  }

  const sub = await getSubscription(businessId);
  const maxContacts = sub?.max_contacts || 2500;
  const maxCampaigns = sub?.max_campaigns_per_month || 15;
  const maxMessages = sub?.max_messages_per_month || 10000;

  return {
    periodMonth: currentMonth,
    unlimited: false,
    metrics: {
      contacts: { current: currentContacts, limit: maxContacts, unlimited: false, percentage: Math.round((currentContacts / maxContacts) * 100) },
      campaigns: { current: currentCampaigns, limit: maxCampaigns, unlimited: false, percentage: Math.round((currentCampaigns / maxCampaigns) * 100) },
      messages: { current: currentMessages, limit: maxMessages, unlimited: false, percentage: Math.round((currentMessages / maxMessages) * 100) }
    }
  };
}

export async function changePlan(businessId, planId) {
  if (isUsingFallback()) {
    const store = getMemoryStore();
    let sub = store.subscriptions.find(s => s.business_id === Number(businessId));
    if (sub) {
      sub.plan_id = Number(planId);
    } else {
      sub = { id: store.subscriptions.length + 1, business_id: Number(businessId), plan_id: Number(planId), status: 'active', current_period_start: new Date() };
      store.subscriptions.push(sub);
    }
    return { success: true, planId };
  }

  await executeQuery(
    `UPDATE subscriptions SET plan_id = ?, updated_at = NOW() WHERE business_id = ?`,
    [planId, businessId]
  );
  return { success: true, planId };
}

export default {
  listPlans,
  getSubscription,
  getUsage,
  changePlan
};
