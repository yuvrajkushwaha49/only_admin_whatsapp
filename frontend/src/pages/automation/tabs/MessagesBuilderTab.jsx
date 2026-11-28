import React, { useState } from 'react';
import WhatsAppLivePreview from '../WhatsAppLivePreview';

export default function MessagesBuilderTab({ definition, onChange }) {
  const steps = definition.steps || [];
  const [selectedStepId, setSelectedStepId] = useState(steps[0]?.id || 'step_1');

  const selectedStep = steps.find(s => s.id === selectedStepId) || steps[0] || {
    id: 'step_1',
    name: 'Welcome Message',
    messageType: 'text',
    isFirst: true,
    content: '',
    buttons: []
  };

  // Add a new step
  const handleAddStep = () => {
    const newIndex = steps.length + 1;
    const newId = `step_${Date.now()}`;
    const newStep = {
      id: newId,
      name: `Step ${newIndex}: Follow-up`,
      messageType: 'interactive_buttons',
      isFirst: false,
      content: 'Here is the next option for you. Please select below:',
      buttons: [
        { id: `btn_${Date.now()}_1`, text: 'Next Option', action: 'next_step', targetStepId: null },
        { id: `btn_${Date.now()}_2`, text: 'Request Call', action: 'request_callback', targetStepId: null }
      ]
    };

    const updated = [...steps, newStep];
    onChange({ ...definition, steps: updated });
    setSelectedStepId(newId);
  };

  // Delete step
  const handleDeleteStep = (stepIdToDelete) => {
    if (steps.length <= 1) {
      alert('An automation requires at least one message step.');
      return;
    }

    const updated = steps.filter(s => s.id !== stepIdToDelete);
    // Ensure first step flag is preserved
    if (updated.length > 0 && !updated.some(s => s.isFirst)) {
      updated[0].isFirst = true;
    }

    onChange({ ...definition, steps: updated });
    if (selectedStepId === stepIdToDelete) {
      setSelectedStepId(updated[0]?.id || null);
    }
  };

  // Reorder steps up / down
  const handleMoveStep = (index, direction) => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= steps.length) return;

    const updated = [...steps];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    // First item is marked isFirst
    updated.forEach((s, i) => {
      s.isFirst = i === 0;
    });

    onChange({ ...definition, steps: updated });
  };

  // Update fields of the active step
  const handleUpdateStepField = (field, value) => {
    const updated = steps.map(s => {
      if (s.id === selectedStepId) {
        return { ...s, [field]: value };
      }
      return s;
    });
    onChange({ ...definition, steps: updated });
  };

  // Insert dynamic tag into message content
  const handleInsertTag = (tag) => {
    const current = selectedStep.content || '';
    handleUpdateStepField('content', `${current} {{${tag}}}`.trim());
  };

  // Buttons CRUD
  const handleAddButton = () => {
    const currentButtons = selectedStep.buttons || [];
    if (currentButtons.length >= 3) {
      alert('WhatsApp Cloud API allows a maximum of 3 Quick Reply buttons per message.');
      return;
    }

    const newBtn = {
      id: `btn_${Date.now()}`,
      text: `Option ${currentButtons.length + 1}`,
      action: 'next_step',
      targetStepId: null
    };

    handleUpdateStepField('buttons', [...currentButtons, newBtn]);
  };

  const handleUpdateButton = (btnIdx, field, val) => {
    const currentButtons = [...(selectedStep.buttons || [])];
    currentButtons[btnIdx] = { ...currentButtons[btnIdx], [field]: val };
    handleUpdateStepField('buttons', currentButtons);
  };

  const handleDeleteButton = (btnIdx) => {
    const currentButtons = (selectedStep.buttons || []).filter((_, idx) => idx !== btnIdx);
    handleUpdateStepField('buttons', currentButtons);
  };

  return (
    <div className="builder-tab-pane">
      <div className="messages-3panel-grid">
        
        {/* PANEL 1: Ordered Steps List */}
        <div className="step-list-card">
          <div className="step-list-header">
            <span>Automation Steps</span>
            <span className="badge bg-light text-muted border">{steps.length} Steps</span>
          </div>

          <div className="step-items-container">
            {steps.map((step, idx) => {
              const isActive = step.id === selectedStepId;
              return (
                <div
                  key={step.id}
                  className={`step-item-row ${isActive ? 'active' : ''}`}
                  onClick={() => setSelectedStepId(step.id)}
                >
                  <div className="d-flex align-items-center gap-2 overflow-hidden">
                    <span className="step-number-pill">{idx + 1}</span>
                    <div className="text-truncate">
                      <div className="fw-semibold text-dark small text-truncate">
                        {step.name || `Step ${idx + 1}`}
                      </div>
                      <div className="text-muted" style={{ fontSize: '0.7rem' }}>
                        {step.isFirst ? '🟢 First Message' : `${(step.buttons || []).length} buttons`}
                      </div>
                    </div>
                  </div>

                  {/* Actions: Move & Delete */}
                  <div className="d-flex align-items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="btn btn-sm btn-link text-muted p-0"
                      disabled={idx === 0}
                      onClick={() => handleMoveStep(idx, 'up')}
                      title="Move Up"
                    >
                      <i className="bi bi-chevron-up"></i>
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-link text-muted p-0"
                      disabled={idx === steps.length - 1}
                      onClick={() => handleMoveStep(idx, 'down')}
                      title="Move Down"
                    >
                      <i className="bi bi-chevron-down"></i>
                    </button>
                    {steps.length > 1 && (
                      <button
                        type="button"
                        className="btn btn-sm btn-link text-danger p-0 ms-1"
                        onClick={() => handleDeleteStep(step.id)}
                        title="Delete Step"
                      >
                        <i className="bi bi-trash"></i>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-2 border-top">
            <button
              type="button"
              className="btn btn-outline-success btn-sm w-100 fw-semibold"
              onClick={handleAddStep}
            >
              <i className="bi bi-plus-circle me-1"></i> Add a Step
            </button>
          </div>
        </div>

        {/* PANEL 2: Step Editor */}
        <div className="step-editor-card">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
            <h6 className="fw-bold mb-0 text-dark">
              <i className="bi bi-pencil-square text-success me-2"></i>
              Edit Step: <span className="text-primary">{selectedStep.name}</span>
            </h6>
            {selectedStep.isFirst && (
              <span className="badge bg-success-subtle text-success border border-success-subtle text-nowrap">
                <i className="bi bi-flag-fill me-1"></i> Starting Step
              </span>
            )}
          </div>

          {/* Step Name */}
          <div className="mb-3">
            <label className="form-label small fw-semibold text-dark">
              Step Name <span className="text-muted">(Internal Reference, Max 60 chars)</span>
            </label>
            <input
              type="text"
              className="form-control form-control-sm"
              value={selectedStep.name || ''}
              onChange={(e) => handleUpdateStepField('name', e.target.value)}
              maxLength={60}
              placeholder="e.g. Welcome Message, Pricing Overview"
            />
          </div>

          {/* Message Content */}
          <div className="mb-3">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
              <label className="form-label small fw-semibold text-dark mb-0 text-nowrap">
                Message Content <span className="text-danger">*</span>
              </label>
              <div className="d-flex flex-wrap gap-1 align-items-center">
                <span className="text-muted small me-1">Insert:</span>
                <span className="dynamic-tag-pill" onClick={() => handleInsertTag('name')} title="Insert Customer Name">
                  + Name
                </span>
                <span className="dynamic-tag-pill" onClick={() => handleInsertTag('phone')} title="Insert Phone">
                  + Phone
                </span>
                <span className="dynamic-tag-pill" onClick={() => handleInsertTag('city')} title="Insert City">
                  + City
                </span>
              </div>
            </div>

            <textarea
              className="form-control"
              rows="5"
              placeholder="Type your WhatsApp message here. Use {{name}} for customer's first name, *bold*, _italic_..."
              value={selectedStep.content || ''}
              onChange={(e) => handleUpdateStepField('content', e.target.value)}
              maxLength={4096}
            ></textarea>
            <div className="d-flex justify-content-between mt-1 text-muted small" style={{ fontSize: '0.75rem' }}>
              <span>Format: <code>*bold*</code>, <code>_italic_</code>, <code>~strike~</code></span>
              <span>{(selectedStep.content || '').length} / 4096 characters</span>
            </div>
          </div>

          {/* Interactive Buttons Builder */}
          <div className="border-top pt-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <div>
                <label className="form-label small fw-bold text-dark mb-0">
                  <i className="bi bi-ui-radios text-success me-1"></i> Interactive Quick Reply Buttons
                </label>
                <div className="text-muted small" style={{ fontSize: '0.75rem' }}>
                  Customers can tap these buttons instead of typing. Max 3 buttons.
                </div>
              </div>
              {(selectedStep.buttons || []).length < 3 && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-success"
                  onClick={handleAddButton}
                >
                  <i className="bi bi-plus-lg me-1"></i> Add Button
                </button>
              )}
            </div>

            {/* Buttons list */}
            {(selectedStep.buttons || []).length === 0 ? (
              <div className="text-center py-3 bg-light rounded text-muted small">
                No buttons configured. Customer will see plain text message.
              </div>
            ) : (
              <div className="d-flex flex-column gap-2 mt-2">
                {(selectedStep.buttons || []).map((btn, bIdx) => (
                  <div key={btn.id || bIdx} className="p-2 border rounded bg-light">
                    <div className="row g-2 align-items-center">
                      <div className="col-md-5">
                        <label className="form-label text-muted" style={{ fontSize: '0.7rem' }}>
                          Button Text (Max 25 chars)
                        </label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={btn.text || ''}
                          onChange={(e) => handleUpdateButton(bIdx, 'text', e.target.value)}
                          maxLength={25}
                          placeholder="e.g. Yes, Learn More"
                        />
                      </div>

                      <div className="col-md-4">
                        <label className="form-label text-muted" style={{ fontSize: '0.7rem' }}>
                          When Tapped (Next Action)
                        </label>
                        <select
                          className="form-select form-select-sm"
                          value={btn.action || 'next_step'}
                          onChange={(e) => handleUpdateButton(bIdx, 'action', e.target.value)}
                        >
                          <option value="next_step">Go to Next Step</option>
                          <option value="go_to_step">Go to Specific Step</option>
                          <option value="request_callback">Request Callback</option>
                          <option value="human_handover">Transfer to Human Agent</option>
                          <option value="end_conversation">End Conversation</option>
                        </select>
                      </div>

                      <div className="col-md-2">
                        {btn.action === 'go_to_step' ? (
                          <>
                            <label className="form-label text-muted" style={{ fontSize: '0.7rem' }}>
                              Target Step
                            </label>
                            <select
                              className="form-select form-select-sm"
                              value={btn.targetStepId || ''}
                              onChange={(e) => handleUpdateButton(bIdx, 'targetStepId', e.target.value)}
                            >
                              <option value="">Select...</option>
                              {steps.filter(s => s.id !== selectedStep.id).map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                          </>
                        ) : (
                          <div style={{ height: '31px' }}></div>
                        )}
                      </div>

                      <div className="col-md-1 text-end">
                        <label className="form-label d-block text-muted" style={{ fontSize: '0.7rem' }}>&nbsp;</label>
                        <button
                          type="button"
                          className="btn btn-sm btn-link text-danger p-0"
                          onClick={() => handleDeleteButton(bIdx)}
                          title="Remove Button"
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* PANEL 3: Live Preview */}
        <WhatsAppLivePreview
          step={selectedStep}
          triggerKeyword={definition.triggers?.keywords?.[0] || 'menu'}
        />

      </div>
    </div>
  );
}
