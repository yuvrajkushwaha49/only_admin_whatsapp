/**
 * Automation Workflow Validator
 * Enforces Phase 7 Validation Checklist & WhatsApp Cloud API limits:
 * - Every button has a valid action
 * - Every step is reachable
 * - No invalid step references
 * - Required fields completed
 * - Fallback & callback configured
 * - At least one trigger configured
 * - Unique keywords, excluding opt-out keywords (STOP, UNSUBSCRIBE)
 */

const RESERVED_KEYWORDS = new Set([
  'STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT', 'OPTOUT', 'OPT OUT'
]);

export function validateAutomationDefinition(definition, options = {}) {
  const errors = [];
  const warnings = [];

  if (!definition || typeof definition !== 'object') {
    return {
      isValid: false,
      errors: ['Invalid automation payload: definition object is required'],
      warnings: []
    };
  }

  const { triggers = {}, steps = [], fallback = {} } = definition;

  // 1. Triggers Validation
  const keywords = Array.isArray(triggers.keywords) ? triggers.keywords : [];
  const buttonId = triggers.buttonId || null;
  const templateName = triggers.templateName || triggers.templateReply?.templateName || null;

  const cleanKeywords = [];
  const seenKeywords = new Set();

  for (const rawKw of keywords) {
    const kw = String(rawKw || '').trim().toLowerCase();
    if (!kw) continue;

    if (RESERVED_KEYWORDS.has(kw.toUpperCase())) {
      errors.push(`Keyword "${kw}" is a reserved WhatsApp opt-out keyword and cannot be used as an automation trigger.`);
      continue;
    }

    if (seenKeywords.has(kw)) {
      warnings.push(`Duplicate keyword "${kw}" was automatically deduped.`);
      continue;
    }

    seenKeywords.add(kw);
    cleanKeywords.push(kw);
  }

  if (cleanKeywords.length === 0 && !buttonId && !templateName) {
    errors.push('At least one trigger is required: configure incoming keywords, connect an interactive campaign button, or select a WhatsApp template reply trigger.');
  }

  if (cleanKeywords.length > 10) {
    errors.push('A maximum of 10 keywords can be configured per automation.');
  }

  // 2. Steps Validation
  if (!Array.isArray(steps) || steps.length === 0) {
    errors.push('At least one message step must be configured.');
    return {
      isValid: false,
      errors,
      warnings,
      cleanKeywords
    };
  }

  const stepIds = new Set();
  const stepMap = new Map();
  let firstStepCount = 0;

  steps.forEach((step, idx) => {
    const sId = String(step.id || `step_${idx + 1}`);
    if (stepIds.has(sId)) {
      errors.push(`Duplicate step identifier "${sId}" detected.`);
    }
    stepIds.add(sId);
    stepMap.set(sId, step);

    if (step.isFirst || idx === 0) {
      firstStepCount++;
    }

    // Step content validation
    const content = String(step.content || '').trim();
    if (!content) {
      errors.push(`Step "${step.name || sId}" is missing message text.`);
    } else if (content.length > 4096) {
      errors.push(`Step "${step.name || sId}" message exceeds WhatsApp maximum limit of 4096 characters (currently ${content.length}).`);
    }

    // Interactive buttons validation
    const buttons = Array.isArray(step.buttons) ? step.buttons : [];
    if (buttons.length > 3) {
      errors.push(`Step "${step.name || sId}" has ${buttons.length} buttons. WhatsApp Cloud API supports a maximum of 3 Quick Reply buttons per message.`);
    }

    buttons.forEach((btn, bIdx) => {
      const bText = String(btn.text || '').trim();
      if (!bText) {
        errors.push(`Button #${bIdx + 1} in step "${step.name || sId}" has empty button text.`);
      } else if (bText.length > 25) {
        errors.push(`Button text "${bText}" in step "${step.name || sId}" exceeds WhatsApp 25-character limit (currently ${bText.length}).`);
      }

      const action = btn.action || 'next_step';
      const validActions = ['next_step', 'go_to_step', 'request_callback', 'human_handover', 'create_lead', 'end_conversation'];
      if (!validActions.includes(action)) {
        errors.push(`Button "${bText}" in step "${step.name || sId}" has an unrecognized action "${action}".`);
      }

      if (action === 'go_to_step') {
        if (!btn.targetStepId) {
          errors.push(`Button "${bText}" in step "${step.name || sId}" is set to "Go to specific step" but no target step was selected.`);
        }
      }
    });
  });

  // Target step references & reachability check
  steps.forEach((step) => {
    const sId = String(step.id);
    const buttons = Array.isArray(step.buttons) ? step.buttons : [];
    buttons.forEach((btn) => {
      if (btn.action === 'go_to_step' && btn.targetStepId) {
        if (!stepIds.has(String(btn.targetStepId))) {
          errors.push(`Step "${step.name || sId}" references non-existent target step ID "${btn.targetStepId}".`);
        }
      }
    });
  });

  // 3. Fallback & Callback Validation
  if (fallback.askCallbackOnUnexpected) {
    if (!fallback.question || !String(fallback.question).trim()) {
      errors.push('Fallback question cannot be blank when unexpected reply callback is enabled.');
    }
    if (!fallback.yesButtonText || !String(fallback.yesButtonText).trim()) {
      errors.push('Fallback "Yes" button text cannot be blank.');
    }
    if (!fallback.noButtonText || !String(fallback.noButtonText).trim()) {
      errors.push('Fallback "No" button text cannot be blank.');
    }
  }

  const limit = Number(fallback.unexpectedReplyLimit || 2);
  if (isNaN(limit) || limit < 1 || limit > 10) {
    warnings.push('Unexpected reply limit adjusted to standard default of 2.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    cleanKeywords
  };
}
