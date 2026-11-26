import React, { useState, useEffect } from 'react';
import api from '../../../services/api';
import WhatsAppLivePreview from '../WhatsAppLivePreview';

export default function FallbackCallbackTab({ definition, onChange }) {
  const fallback = definition.fallback || {
    askCallbackOnUnexpected: true,
    askAfterLastMessage: false,
    preQuestionLine: 'I did not quite catch that.',
    question: 'Call back needed?',
    yesButtonText: 'Yes, call me',
    noButtonText: 'No, thanks',
    messageAfterYes: 'Thank you! Our team will call you shortly.',
    messageAfterNo: 'No problem. Let us continue.',
    unexpectedReplyLimit: 2,
    handoverMessage: 'Connecting you with our support team right now. Please wait a moment.',
    assignAgentId: null
  };

  const [teamMembers, setTeamMembers] = useState([]);

  useEffect(() => {
    loadTeam();
  }, []);

  const loadTeam = async () => {
    try {
      const res = await api.get('/users');
      if (res.data?.success && res.data?.data) {
        setTeamMembers(res.data.data.users || res.data.data || []);
      }
    } catch (_) {
      setTeamMembers([]);
    }
  };

  const handleUpdate = (field, value) => {
    onChange({
      ...definition,
      fallback: {
        ...fallback,
        [field]: value
      }
    });
  };

  return (
    <div className="builder-tab-pane">
      <div className="row g-4">
        
        {/* Left Col: Configurations */}
        <div className="col-lg-8">
          <div className="mb-4">
            <h5 className="fw-bold text-dark mb-1">3. Fallback & Call Back Configuration</h5>
            <p className="text-muted small mb-0">
              Handle unexpected customer replies, offer callback assistance, and gracefully handover conversations to human agents.
            </p>
          </div>

          {/* Section A: Unexpected Reply Handling */}
          <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: '0.75rem' }}>
            <div className="card-header bg-white border-bottom py-3 px-4">
              <h6 className="fw-bold mb-0 text-dark d-flex align-items-center">
                <i className="bi bi-shield-check text-success me-2"></i>
                A. Unexpected Reply Handling
              </h6>
            </div>

            <div className="card-body p-4">
              <div className="form-check form-switch mb-3">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="askCallbackToggle"
                  checked={fallback.askCallbackOnUnexpected !== false}
                  onChange={(e) => handleUpdate('askCallbackOnUnexpected', e.target.checked)}
                />
                <label className="form-check-label fw-semibold text-dark small" htmlFor="askCallbackToggle">
                  Ask about a callback on unexpected replies
                </label>
                <div className="text-muted small">
                  When a customer types something custom instead of clicking an option, send the fallback question below.
                </div>
              </div>

              <div className="form-check form-switch mb-4">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="askAfterLastToggle"
                  checked={Boolean(fallback.askAfterLastMessage)}
                  onChange={(e) => handleUpdate('askAfterLastMessage', e.target.checked)}
                />
                <label className="form-check-label fw-semibold text-dark small" htmlFor="askAfterLastToggle">
                  Also ask about callback after the last message
                </label>
              </div>

              {fallback.askCallbackOnUnexpected !== false && (
                <div className="border rounded p-3 bg-light">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold text-dark">
                      Line before the question <span className="text-muted">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="e.g. I did not quite catch that."
                      value={fallback.preQuestionLine || ''}
                      onChange={(e) => handleUpdate('preQuestionLine', e.target.value)}
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold text-dark">
                      Fallback Question <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="Call back needed?"
                      value={fallback.question || 'Call back needed?'}
                      onChange={(e) => handleUpdate('question', e.target.value)}
                    />
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold text-dark">
                        "Yes" Button Text
                      </label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Yes, call me"
                        value={fallback.yesButtonText || 'Yes, call me'}
                        onChange={(e) => handleUpdate('yesButtonText', e.target.value)}
                        maxLength={20}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold text-dark">
                        "No" Button Text
                      </label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="No, thanks"
                        value={fallback.noButtonText || 'No, thanks'}
                        onChange={(e) => handleUpdate('noButtonText', e.target.value)}
                        maxLength={20}
                      />
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold text-dark">
                      Message after "Yes" (Callback Confirmed)
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="Thank you! Our team will call you shortly."
                      value={fallback.messageAfterYes || ''}
                      onChange={(e) => handleUpdate('messageAfterYes', e.target.value)}
                    />
                  </div>

                  <div className="mb-0">
                    <label className="form-label small fw-semibold text-dark">
                      Message after "No" (Dismissed)
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="No problem. Let us continue."
                      value={fallback.messageAfterNo || ''}
                      onChange={(e) => handleUpdate('messageAfterNo', e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section B & C: Limit & Handover */}
          <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: '0.75rem' }}>
            <div className="card-header bg-white border-bottom py-3 px-4">
              <h6 className="fw-bold mb-0 text-dark d-flex align-items-center">
                <i className="bi bi-person-lines-fill text-primary me-2"></i>
                B & C. Unexpected Reply Limit & Human Handover
              </h6>
            </div>

            <div className="card-body p-4">
              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <label className="form-label small fw-semibold text-dark">
                    Unexpected Reply Limit before stopping
                  </label>
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    min="1"
                    max="10"
                    value={fallback.unexpectedReplyLimit || 2}
                    onChange={(e) => handleUpdate('unexpectedReplyLimit', parseInt(e.target.value, 10) || 2)}
                  />
                  <div className="form-text small">Default: 2 unexpected replies before handing over.</div>
                </div>

                <div className="col-md-6">
                  <label className="form-label small fw-semibold text-dark">
                    Assign Handed-over Chats To
                  </label>
                  <select
                    className="form-select form-select-sm"
                    value={fallback.assignAgentId || ''}
                    onChange={(e) => handleUpdate('assignAgentId', e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">Leave Unassigned (Open Queue)</option>
                    {teamMembers.map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mb-0">
                <label className="form-label small fw-semibold text-dark">
                  Hand-over Message
                </label>
                <textarea
                  className="form-control form-control-sm"
                  rows="2"
                  value={fallback.handoverMessage || ''}
                  onChange={(e) => handleUpdate('handoverMessage', e.target.value)}
                  placeholder="Connecting you with our support team right now. Please wait a moment."
                ></textarea>
              </div>
            </div>
          </div>

          {/* Section D: Callback Lead Creation Notice */}
          <div className="card border-success-subtle bg-success-subtle shadow-sm" style={{ borderRadius: '0.75rem' }}>
            <div className="card-body p-3 d-flex align-items-start gap-3">
              <i className="bi bi-telephone-inbound-fill text-success fs-4 mt-1"></i>
              <div>
                <h6 className="fw-bold text-success mb-1">Automatic Lead & Callback Creation</h6>
                <p className="text-dark-emphasis small mb-0">
                  When a customer taps <strong>"Yes, call me"</strong>, a callback lead is instantly registered in your Lead Queue with customer phone, contact details, timestamp, and linked conversation thread. The contact is automatically tagged with <code>Callback Requested</code>.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Live Preview with Fallback Active */}
        <div className="col-lg-4">
          <WhatsAppLivePreview
            step={definition.steps?.[0]}
            fallbackConfig={fallback}
            showFallbackPrompt={true}
          />
        </div>

      </div>
    </div>
  );
}
