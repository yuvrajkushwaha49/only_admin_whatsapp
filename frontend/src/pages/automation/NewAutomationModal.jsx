import React, { useState, useEffect } from 'react';
import api from '../../services/api';

export default function NewAutomationModal({ isOpen, onClose, onCreated }) {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('blank');
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
      setName('');
      setPurpose('');
      setSelectedTemplate('blank');
      setError(null);
    }
  }, [isOpen]);

  const loadTemplates = async () => {
    try {
      const res = await api.get('/automations/templates');
      if (res.data?.success && res.data?.data) {
        setTemplates(res.data.data);
      }
    } catch (_) {
      // Fallback predefined templates if offline
      setTemplates([
        { id: 'blank', name: 'Blank', badge: 'Custom', description: 'One welcome message; build the rest yourself.', icon: 'bi-file-earmark-plus' },
        { id: 'product_enquiry', name: 'Product Enquiry', badge: 'Popular', description: 'Ask what customer is interested in, explain the product, and offer a callback.', icon: 'bi-box-seam' },
        { id: 'catalogue_callback', name: 'Product Catalogue + Call Back', badge: 'Sales', description: 'Show products from Product Library, allow customers to explore products, and request callbacks.', icon: 'bi-grid-3x3-gap' },
        { id: 'lead_qualification', name: 'Lead Qualification', badge: 'Conversion', description: 'Collect customer name, city, and requirement, create a lead and pass it to team.', icon: 'bi-funnel' },
        { id: 'feedback_survey', name: 'Feedback Survey', badge: 'Customer Care', description: 'Ask customers for ratings and offer callbacks for unhappy customers.', icon: 'bi-star' },
        { id: 'support_menu', name: 'Support Menu', badge: 'Assistance', description: 'Provide opening hours, location, contact info and human support options.', icon: 'bi-headset' }
      ]);
    }
  };

  const handleSelectTemplate = (tpl) => {
    setSelectedTemplate(tpl.id);
    if (!name.trim()) {
      setName(tpl.name === 'Blank' ? 'My WhatsApp Automation' : tpl.name);
    }
    if (!purpose.trim()) {
      setPurpose(tpl.description || '');
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide an automation name.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.post('/automations', {
        name: name.trim(),
        purpose: purpose.trim(),
        templateId: selectedTemplate
      });

      if (res.data?.success && res.data?.data) {
        onCreated(res.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to create automation');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(17, 24, 39, 0.65)' }}>
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '1rem' }}>
          
          <div className="modal-header border-0 pb-0 pt-4 px-4">
            <div>
              <h5 className="modal-title fw-bold text-dark fs-5">
                <i className="bi bi-robot text-success me-2"></i> Create New Automation
              </h5>
              <p className="text-muted small mb-0">
                Choose a proven starter template or begin with a clean blank canvas.
              </p>
            </div>
            <button type="button" className="btn-close" onClick={onClose} disabled={loading}></button>
          </div>

          <form onSubmit={handleCreate}>
            <div className="modal-body px-4 py-3">
              {error && (
                <div className="alert alert-danger py-2 small d-flex align-items-center mb-3">
                  <i className="bi bi-exclamation-triangle-fill me-2"></i> {error}
                </div>
              )}

              {/* Template Picker */}
              <label className="form-label fw-bold small text-muted text-uppercase mb-2">
                1. Select Starting Template
              </label>

              <div className="template-grid mb-4">
                {templates.map((tpl) => {
                  const isSelected = selectedTemplate === tpl.id;
                  return (
                    <div
                      key={tpl.id}
                      className={`template-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleSelectTemplate(tpl)}
                    >
                      {tpl.badge && <span className="template-badge">{tpl.badge}</span>}
                      <div className="template-icon">
                        <i className={`bi ${tpl.icon || 'bi-robot'}`}></i>
                      </div>
                      <h6 className="fw-bold mb-1 text-dark fs-6">{tpl.name}</h6>
                      <p className="text-muted small mb-0 flex-grow-1" style={{ fontSize: '0.825rem' }}>
                        {tpl.description}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Automation Details */}
              <div className="border-top pt-3">
                <label className="form-label fw-bold small text-muted text-uppercase mb-2">
                  2. Automation Details
                </label>

                <div className="mb-3">
                  <label className="form-label small fw-semibold text-dark">
                    Automation Name <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g., Product Lead Assistant, Support FAQs"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={100}
                    required
                    disabled={loading}
                  />
                  <div className="form-text text-end small">{name.length}/100</div>
                </div>

                <div className="mb-2">
                  <label className="form-label small fw-semibold text-dark">
                    Purpose / Notes <span className="text-muted">(Optional)</span>
                  </label>
                  <textarea
                    className="form-control"
                    rows="2"
                    placeholder="Briefly describe what this automation helps customers with..."
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    maxLength={500}
                    disabled={loading}
                  ></textarea>
                </div>
              </div>
            </div>

            <div className="modal-footer border-0 pt-0 px-4 pb-4 d-flex justify-content-between">
              <button type="button" className="btn btn-outline-secondary px-3" onClick={onClose} disabled={loading}>
                Cancel
              </button>
              <button type="submit" className="btn btn-emerald px-4" disabled={loading || !name.trim()}>
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                    Creating...
                  </>
                ) : (
                  <>
                    Create and Continue <i className="bi bi-arrow-right ms-1"></i>
                  </>
                )}
              </button>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
}
