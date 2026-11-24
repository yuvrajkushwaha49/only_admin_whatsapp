/**
 * Topic Validation Engine
 * Strictly validates incoming customer queries against the WhatsApp SaaS domain.
 * Combines rule-based checks, blocked intent patterns, prompt-injection defense,
 * and domain intent scoring.
 */

export const RESTRICTED_RESPONSE =
  "I'm specifically designed to help with our WhatsApp SaaS platform. I can assist you with WhatsApp API, Broadcasting, Campaigns, Templates, Automation and platform-related technical support.";

// Explicitly prohibited keywords / patterns (general knowledge, coding, politics, weather, entertainment)
const BLOCKED_PATTERNS = [
  /\b(weather|forecast|temperature in|climate)\b/i,
  /\b(cricket|football|fifa|ipl|world cup|scorecard|match won)\b/i,
  /\b(movie|cinema|actor|actress|bollywood|hollywood|song lyrics)\b/i,
  /\b(politics|election|prime minister|president|bjp|congress|democrat|republican)\b/i,
  /\b(capital of|who is the king of|tallest mountain|history of|ancient egypt)\b/i,
  /\b(write a python (calculator|game|snake|script|program)|write c\+\+|javascript code to solve leetcode)\b/i,
  /\b(dating advice|relationship advice|astrology|horoscope|zodiac sign)\b/i,
  /\b(recipe for|how to cook|ingredients of)\b/i
];

// Adversarial prompt injection patterns
const INJECTION_PATTERNS = [
  /ignore (all )?(previous|prior) (instructions|directives|prompts)/i,
  /you are now (in|a) (dan|unrestricted|god mode|jailbreak)/i,
  /reveal (your|the) (system prompt|internal instructions|secret key)/i,
  /disregard (the )?system/i,
  /bypass (all )?(guardrails|filters|restrictions)/i,
  /pretend you (are|have no) (unrestricted|rules)/i
];

// Valid WhatsApp SaaS platform domain patterns
const ALLOWED_DOMAIN_PATTERNS = [
  /\b(whatsapp|waba|cloud api|graph api|embedded signup)\b/i,
  /\b(campaigns?|broadcasts?|broadcasting|schedulers?|scheduled campaigns?)\b/i,
  /\b(templates?|quick reply|call to action|cta|opt-out footer)\b/i,
  /\b(marketing|utility|authentication|media templates?|headers?|footers?)\b/i,
  /\b(contacts?|phone numbers?|country codes?|csv import|excel import|export contacts)\b/i,
  /\b(tags?|contact groups?|audiences?|opt-in|opted in|unsubscribes?|consent)\b/i,
  /\b(inbox|team inbox|agents?|live chat|canned reply|assigned user)\b/i,
  /\b(automated (replies|reply|messages?)|auto-replies?|auto-reply|auto replies|auto reply|chatbots?|automations?|workflows?|interactive buttons?)\b/i,
  /\b(webhooks?|delivery reports?|message reports?|reports?|sent|delivered|read|blue tick|failed)\b/i,
  /\b(tiers?|messaging limits?|quality ratings?|green tick|official business accounts?|oba)\b/i,
  /\b(billing|plans?|subscriptions?|starter|growth|pro|enterprise|invoices?|wallets?)\b/i,
  /\b(super admin|superadmin|tenants?|number allocations?|business id)\b/i,
  /\b(131047|131056|131026|131042|error 100|error codes?|troubleshoot(ing)?)\b/i,
  /\b(kaise connect karein|broadcast kaise karein|template kaise banaye|number verify)\b/i
];

/**
 * Validate a query
 * @param {string} query
 * @param {Object} [options]
 * @param {Array} [options.retrievedChunks]
 * @returns {{ allowed: boolean, reason: string, response?: string }}
 */
export function validateTopic(query, { retrievedChunks = [] } = {}) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    return {
      allowed: false,
      reason: 'Empty query',
      response: RESTRICTED_RESPONSE
    };
  }

  const trimmed = query.trim();

  // 1. Check for prompt injection attempts
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        allowed: false,
        reason: 'Prompt injection attempt detected',
        response: RESTRICTED_RESPONSE
      };
    }
  }

  // 2. Check for explicitly forbidden topics (even if they slyly append "WhatsApp")
  // e.g. "What is the weather today on WhatsApp?" or "Write a python calculator using whatsapp"
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(trimmed)) {
      // If asking to write an unrelated python program/game or asking weather/cricket
      return {
        allowed: false,
        reason: 'Prohibited off-domain topic',
        response: RESTRICTED_RESPONSE
      };
    }
  }

  // 3. Domain Pattern Match
  const hasDomainPattern = ALLOWED_DOMAIN_PATTERNS.some(p => p.test(trimmed));
  if (hasDomainPattern) {
    return { allowed: true, reason: 'Matched domain pattern' };
  }

  // 4. Grounded Knowledge Base Match (if documentation chunks scored high relevance)
  if (Array.isArray(retrievedChunks) && retrievedChunks.length > 0) {
    const hasHighScoringChunk = retrievedChunks.some(c => c.score && c.score >= 0.5);
    if (hasHighScoringChunk) {
      return { allowed: true, reason: 'Matched knowledge base documentation' };
    }
  }

  // 5. Conversational greeting / platform-specific greeting checks
  const isGreeting = /^(hi|hello|hey|namaste|help|kaise ho|kya kar sakte ho|what can you do)[\s!?.Ready]*$/i.test(trimmed);
  if (isGreeting) {
    return { allowed: true, reason: 'Allowed greeting' };
  }

  // If none matched, reject with the standardized restriction response
  return {
    allowed: false,
    reason: 'Out of domain',
    response: RESTRICTED_RESPONSE
  };
}

export default {
  validateTopic,
  RESTRICTED_RESPONSE
};
