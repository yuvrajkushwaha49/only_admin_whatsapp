import React, { useState, useEffect } from 'react';
import api from '../../../services/api';

const RESERVED_KEYWORDS = new Set([
  'STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT', 'OPTOUT', 'OPT OUT'
]);

export default function HowItStartsTab({ definition, onChange, whatsappAccounts = [], currentAccountId, onAccountChange }) {
  const triggers = definition.triggers || { keywords: [], buttonId: null };
  const [keywordInput, setKeywordInput] = useState('');
  const [keywordError, setKeywordError] = useState(null);

  const [buttonSets, setButtonSets] = useState([]);
  const [loadingButtons, setLoadingButtons] = useState(false);

  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  useEffect(() => {
    loadButtonSets();
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const res = await api.get('/whatsapp/templates?status=APPROVED&limit=100');
      if (res.data?.success && res.data?.data) {
        setTemplates(res.data.data);
      }
    } catch (_) {
      setTemplates([]);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const loadButtonSets = async () => {
    setLoadingButtons(true);
    try {
      const res = await api.get('/interactive-buttons');
      if (res.data?.success && res.data?.data) {
        setButtonSets(res.data.data.buttons || res.data.data || []);
      }
    } catch (_) {
      setButtonSets([]);
    } finally {
      setLoadingButtons(false);
    }
  };

  const handleAddKeyword = (e) => {
    if (e.key === 'Enter' || e.type === 'click') {
      e.preventDefault();
      const clean = keywordInput.trim().toLowerCase();
      setKeywordError(null);

      if (!clean) return;

      if (RESERVED_KEYWORDS.has(clean.toUpperCase())) {
        setKeywordError(`"${clean}" is a reserved WhatsApp opt-out keyword and cannot be used.`);
        return;
      }

      const existingKeywords = triggers.keywords || [];
      if (existingKeywords.map(k => k.toLowerCase()).includes(clean)) {
        setKeywordError(`"${clean}" is already added.`);
        return;
      }

      if (existingKeywords.length >= 10) {
        setKeywordError('Maximum of 10 keywords reached.');
        return;
      }

      const updated = [...existingKeywords, clean];
      onChange({
        ...definition,
        triggers: {
          ...triggers,
          keywords: updated
        }
      });
      setKeywordInput('');
    }
  };

  const handleRemoveKeyword = (keywordToRemove) => {
    const updated = (triggers.keywords || []).filter(k => k !== keywordToRemove);
    onChange({
      ...definition,
      triggers: {
        ...triggers,
        keywords: updated
      }
    });
  };

  const handleSelectButton = (btnId) => {
    onChange({
      ...definition,
      triggers: {
        ...triggers,
        buttonId: btnId || null
      }
    });
  };

  const handleSelectTemplate = (tplName) => {
    onChange({
      ...definition,
      triggers: {
        ...triggers,
        templateName: tplName || null,
        templateMatchType: triggers.templateMatchType || 'ANY_REPLY'
      }
    });
  };

  const handleSelectMatchType = (matchType) => {
    onChange({
      ...definition,
      triggers: {
        ...triggers,
        templateMatchType: matchType
      }
    });
  };

  return (
    <div className="builder-tab-pane" style={{ maxWidth: '960px' }}>
      <div className="mb-4">
        <h5 className="fw-bold text-dark mb-1">1. How This Automation Starts</h5>
        <p className="text-muted small mb-0">
          Configure what triggers this automated conversation when a customer contacts you on WhatsApp.
        </p>
      </div>

      {/* WhatsApp Number Selection */}
      <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: '0.75rem' }}>
        <div className="card-body p-4">
          <label className="form-label fw-bold small text-dark d-flex align-items-center mb-1">
            <i className="bi bi-whatsapp text-success me-2"></i> Listening WhatsApp Number
          </label>
          <p className="text-muted small mb-3">
            Choose which of your connected WhatsApp numbers should listen for this trigger.
          </p>

          <select
            className="form-select form-select-lg fs-6"
            value={currentAccountId || ''}
            onChange={(e) => onAccountChange(e.target.value || null)}
          >
            <option value="">All Connected Numbers (Default)</option>
            {whatsappAccounts.map(acc => (
              <option key={acc.id} value={acc.id}>
                {acc.display_name || acc.verified_name || 'Account'} ({acc.phone_number || acc.phone_number_id})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Trigger Option A: Keywords */}
      <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: '0.75rem' }}>
        <div className="card-body p-4">
          <div className="d-flex align-items-center justify-content-between mb-2">
            <label className="form-label fw-bold small text-dark d-flex align-items-center mb-0">
              <i className="bi bi-chat-text text-primary me-2"></i> Trigger A: Incoming Keywords
            </label>
            <span className="badge bg-light text-muted border small">
              {(triggers.keywords || []).length} / 10 Keywords
            </span>
          </div>
          <p className="text-muted small mb-3">
            When a customer sends any of these words (case-insensitive), this automation will start automatically.
          </p>

          {/* Keyword tags box */}
          <div className="keyword-tags-box mb-2">
            {(triggers.keywords || []).map((kw, i) => (
              <span key={i} className="keyword-tag-badge">
                <i className="bi bi-tag-fill me-1 small"></i> {kw}
                <button type="button" onClick={() => handleRemoveKeyword(kw)} title="Remove keyword">
                  &times;
                </button>
              </span>
            ))}
            <input
              type="text"
              className="keyword-input-bare"
              placeholder={(triggers.keywords || []).length >= 10 ? 'Limit reached' : 'Type keyword & press Enter...'}
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={handleAddKeyword}
              disabled={(triggers.keywords || []).length >= 10}
            />
          </div>

          {keywordError && (
            <div className="text-danger small mt-1">
              <i className="bi bi-exclamation-circle me-1"></i> {keywordError}
            </div>
          )}

          <div className="d-flex justify-content-between align-items-center mt-3">
            <div className="small text-muted">
              💡 <em>Examples: menu, pricing, help, catalogue, enquiry, offer</em>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-outline-success"
              onClick={handleAddKeyword}
              disabled={!keywordInput.trim()}
            >
              <i className="bi bi-plus-lg me-1"></i> Add Keyword
            </button>
          </div>
        </div>
      </div>

      {/* Trigger Option B: Campaign Interactive Button */}
      <div className="card border-0 shadow-sm" style={{ borderRadius: '0.75rem' }}>
        <div className="card-body p-4">
          <label className="form-label fw-bold small text-dark d-flex align-items-center mb-1">
            <i className="bi bi-grid text-warning me-2"></i> Trigger B: Campaign Interactive Button
          </label>
          <p className="text-muted small mb-3">
            Connect an existing interactive button set from your campaign templates. When a recipient taps that button, this automation will instantly trigger.
          </p>

          <select
            className="form-select form-select-lg fs-6 mb-2"
            value={triggers.buttonId || ''}
            onChange={(e) => handleSelectButton(e.target.value || null)}
            disabled={loadingButtons}
          >
            <option value="">None (Keywords only)</option>
            {buttonSets.map(btn => (
              <option key={btn.id} value={btn.id}>
                {btn.title || btn.name} ({btn.button_type || 'Button'})
              </option>
            ))}
          </select>

          {triggers.buttonId && (
            <div className="alert alert-success py-2 small d-flex align-items-center mt-2 mb-0">
              <i className="bi bi-check-circle-fill me-2"></i>
              Connected to button set ID #{triggers.buttonId}. Clicking this button in any campaign will launch this automation.
            </div>
          )}
        </div>
      </div>

      {/* Trigger Option C: WhatsApp Template Broadcast Reply */}
      <div className="card border-0 shadow-sm mt-4" style={{ borderRadius: '0.75rem' }}>
        <div className="card-body p-4">
          <div className="d-flex align-items-center justify-content-between mb-1">
            <label className="form-label fw-bold small text-dark d-flex align-items-center mb-0">
              <i className="bi bi-file-earmark-text text-success me-2"></i> Trigger C: WhatsApp Template Broadcast Reply
            </label>
            <span className="badge bg-success-subtle text-success border border-success-subtle small">
              High Converting
            </span>
          </div>
          <p className="text-muted small mb-3">
            Send template broadcasts via Campaigns or Live Chat. Whenever a customer asks a query or replies, this bot will start and answer them instantly!
          </p>

          <label className="form-label small fw-semibold text-secondary mb-1">Target WhatsApp Template</label>
          <select
            className="form-select form-select-lg fs-6 mb-3"
            value={triggers.templateName || ''}
            onChange={(e) => handleSelectTemplate(e.target.value)}
            disabled={loadingTemplates}
          >
            <option value="">Disabled (Do not trigger on template replies)</option>
            <option value="ANY">⭐ Any Template (Triggers on customer query after ANY template broadcast)</option>
            {templates.length > 0 && (
              <optgroup label="Your Approved WhatsApp Templates">
                {templates.map(tpl => (
                  <option key={tpl.id} value={tpl.name}>
                    {tpl.name} ({tpl.language || 'en'}) - {tpl.category || 'Marketing'}
                  </option>
                ))}
              </optgroup>
            )}
          </select>

          {triggers.templateName && (
            <div className="bg-light p-3 rounded-3 border">
              <label className="form-label small fw-bold text-dark mb-2">When should the bot trigger?</label>
              
              <div className="form-check mb-2">
                <input
                  className="form-check-input"
                  type="radio"
                  name="templateMatchType"
                  id="matchAnyReply"
                  checked={!triggers.templateMatchType || triggers.templateMatchType === 'ANY_REPLY'}
                  onChange={() => handleSelectMatchType('ANY_REPLY')}
                />
                <label className="form-check-label small" htmlFor="matchAnyReply">
                  <strong>Any Customer Reply / Query (Recommended)</strong>
                  <div className="text-muted small">Customer asks any question or sends any text/button reply after receiving the template.</div>
                </label>
              </div>

              <div className="form-check mb-2">
                <input
                  className="form-check-input"
                  type="radio"
                  name="templateMatchType"
                  id="matchButtonClick"
                  checked={triggers.templateMatchType === 'BUTTON_CLICK'}
                  onChange={() => handleSelectMatchType('BUTTON_CLICK')}
                />
                <label className="form-check-label small" htmlFor="matchButtonClick">
                  <strong>Only when clicking Quick Reply Button</strong>
                  <div className="text-muted small">Customer taps any interactive Quick Reply button inside the template message.</div>
                </label>
              </div>

              <div className="form-check">
                <input
                  className="form-check-input"
                  type="radio"
                  name="templateMatchType"
                  id="matchKeywordsOnly"
                  checked={triggers.templateMatchType === 'KEYWORD'}
                  onChange={() => handleSelectMatchType('KEYWORD')}
                />
                <label className="form-check-label small" htmlFor="matchKeywordsOnly">
                  <strong>Only if customer reply matches Trigger A keywords</strong>
                  <div className="text-muted small">Customer must reply with one of the keywords added in Trigger A above.</div>
                </label>
              </div>

              <div className="alert alert-success py-2 px-3 small d-flex align-items-center mt-3 mb-0">
                <i className="bi bi-check-circle-fill me-2 fs-6"></i>
                <div>
                  Active: When a customer receives <strong>"{triggers.templateName === 'ANY' ? 'Any Template' : triggers.templateName}"</strong> and sends a query, this bot will reply automatically!
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
