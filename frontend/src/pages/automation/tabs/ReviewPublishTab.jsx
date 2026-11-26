import React, { useState, useEffect } from 'react';
import api from '../../../services/api';

export default function ReviewPublishTab({
  automation,
  definition,
  onSaveDraft,
  onPublish,
  saving = false,
  publishing = false
}) {
  const [validation, setValidation] = useState({ isValid: true, errors: [], warnings: [] });
  const [validating, setValidating] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    runValidation();
  }, [definition]);

  const runValidation = async () => {
    setValidating(true);
    try {
      const res = await api.post('/automations/validate', { definition });
      if (res.data?.success && res.data?.data) {
        setValidation(res.data.data);
      }
    } catch (_) {
      // Local fallback validator
      const errs = [];
      const warns = [];
      const kws = definition.triggers?.keywords || [];
      const btnId = definition.triggers?.buttonId;
      const steps = definition.steps || [];

      if (kws.length === 0 && !btnId) errs.push('At least one trigger is required (keyword or button).');
      if (steps.length === 0) errs.push('At least one message step is required.');
      steps.forEach(s => {
        if (!s.content?.trim()) errs.push(`Step "${s.name}" is missing message text.`);
      });

      setValidation({
        isValid: errs.length === 0,
        errors: errs,
        warnings: warns
      });
    } finally {
      setValidating(false);
    }
  };

  const steps = definition.steps || [];
  const triggers = definition.triggers || { keywords: [] };
  const fallback = definition.fallback || {};

  const handleConfirmPublish = () => {
    setShowConfirmModal(false);
    onPublish();
  };

  return (
    <div className="builder-tab-pane" style={{ maxWidth: '960px' }}>
      <div className="mb-4">
        <h5 className="fw-bold text-dark mb-1">4. Review & Publish</h5>
        <p className="text-muted small mb-0">
          Verify configuration checklist before launching your automated WhatsApp bot live.
        </p>
      </div>

      {/* Validation Checklist Card */}
      <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: '0.75rem' }}>
        <div className="card-header bg-white border-bottom py-3 px-4 d-flex justify-content-between align-items-center">
          <h6 className="fw-bold mb-0 text-dark d-flex align-items-center">
            <i className="bi bi-clipboard-check text-success me-2"></i>
            Validation Checklist
          </h6>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={runValidation}
            disabled={validating}
          >
            {validating ? 'Checking...' : 'Re-check Rules'}
          </button>
        </div>

        <div className="card-body p-4">
          {validation.errors.length > 0 && (
            <div className="alert alert-danger mb-4">
              <h6 className="fw-bold mb-2">
                <i className="bi bi-x-circle-fill me-2"></i> Blocking Issues ({validation.errors.length})
              </h6>
              <ul className="mb-0 ps-3 small">
                {validation.errors.map((err, i) => (
                  <li key={i} className="mb-1">{err}</li>
                ))}
              </ul>
            </div>
          )}

          {validation.warnings.length > 0 && (
            <div className="alert alert-warning mb-4">
              <h6 className="fw-bold mb-2">
                <i className="bi bi-exclamation-triangle-fill me-2"></i> Notice / Warnings ({validation.warnings.length})
              </h6>
              <ul className="mb-0 ps-3 small">
                {validation.warnings.map((w, i) => (
                  <li key={i} className="mb-1">{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Rule check items */}
          <div className="d-flex flex-column gap-3">
            <div className="d-flex align-items-center gap-3">
              {triggers.keywords?.length > 0 || triggers.buttonId ? (
                <i className="bi bi-check-circle-fill text-success fs-5"></i>
              ) : (
                <i className="bi bi-x-circle-fill text-danger fs-5"></i>
              )}
              <div>
                <div className="fw-semibold text-dark small">Trigger configured</div>
                <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                  {triggers.keywords?.length > 0
                    ? `Keywords: ${triggers.keywords.join(', ')}`
                    : triggers.buttonId ? `Button Set #${triggers.buttonId}` : 'No triggers set'}
                </div>
              </div>
            </div>

            <div className="d-flex align-items-center gap-3">
              {steps.length > 0 && steps.every(s => s.content?.trim()) ? (
                <i className="bi bi-check-circle-fill text-success fs-5"></i>
              ) : (
                <i className="bi bi-x-circle-fill text-danger fs-5"></i>
              )}
              <div>
                <div className="fw-semibold text-dark small">All message steps contain valid content</div>
                <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                  {steps.length} sequential message step(s) configured without empty text.
                </div>
              </div>
            </div>

            <div className="d-flex align-items-center gap-3">
              {fallback.askCallbackOnUnexpected !== false ? (
                <i className="bi bi-check-circle-fill text-success fs-5"></i>
              ) : (
                <i className="bi bi-info-circle-fill text-warning fs-5"></i>
              )}
              <div>
                <div className="fw-semibold text-dark small">Unexpected reply fallback protection</div>
                <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                  {fallback.askCallbackOnUnexpected !== false
                    ? `Active (Limit: ${fallback.unexpectedReplyLimit || 2} unexpected replies before handover)`
                    : 'Disabled'}
                </div>
              </div>
            </div>

            <div className="d-flex align-items-center gap-3">
              <i className="bi bi-check-circle-fill text-success fs-5"></i>
              <div>
                <div className="fw-semibold text-dark small">Multi-tenant isolation & version management</div>
                <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                  Publishing will create an immutable snapshot version and preserve running conversations.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons Row */}
      <div className="card border-0 shadow-sm" style={{ borderRadius: '0.75rem' }}>
        <div className="card-body p-4 d-flex justify-content-between align-items-center flex-wrap gap-3">
          <div>
            <h6 className="fw-bold mb-1 text-dark">Ready to activate?</h6>
            <p className="text-muted small mb-0">
              You can save as Draft to continue later, or Publish immediately.
            </p>
          </div>

          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-outline-secondary px-4 fw-semibold"
              onClick={onSaveDraft}
              disabled={saving || publishing}
            >
              {saving ? 'Saving...' : 'Save Draft'}
            </button>

            <button
              type="button"
              className="btn btn-emerald px-4"
              disabled={!validation.isValid || saving || publishing}
              onClick={() => setShowConfirmModal(true)}
            >
              {publishing ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                  Publishing...
                </>
              ) : (
                <>
                  <i className="bi bi-send-check-fill me-1"></i> Publish Automation
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Publish Confirmation Modal */}
      {showConfirmModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(17, 24, 39, 0.65)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '1rem' }}>
              <div className="modal-header border-0 pt-4 px-4 pb-0">
                <h5 className="modal-title fw-bold text-dark fs-5">
                  <i className="bi bi-rocket-takeoff-fill text-success me-2"></i> Publish Automation
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowConfirmModal(false)}></button>
              </div>
              <div className="modal-body px-4 py-3">
                <p className="text-muted small mb-3">
                  Are you sure you want to publish <strong>{automation?.name}</strong>?
                </p>
                <div className="border rounded p-3 bg-light text-dark small mb-0">
                  <div className="mb-2">
                    <strong>Version:</strong> Creates a new immutable version snapshot.
                  </div>
                  <div className="mb-2">
                    <strong>Trigger:</strong> Listening for keywords: <code>{(triggers.keywords || []).join(', ') || 'N/A'}</code>
                  </div>
                  <div>
                    <strong>Effect:</strong> Customer messages will immediately be answered by this automation.
                  </div>
                </div>
              </div>
              <div className="modal-footer border-0 px-4 pb-4 pt-0 d-flex justify-content-between">
                <button
                  type="button"
                  className="btn btn-outline-secondary px-3"
                  onClick={() => setShowConfirmModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-emerald px-4"
                  onClick={handleConfirmPublish}
                >
                  Confirm & Publish
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
