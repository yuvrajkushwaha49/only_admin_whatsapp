import React, { useState, useEffect } from 'react';
import api from '../../services/api';

const TEMPLATE_THEMES = {
  blank: {
    icon: 'bi-file-earmark-plus',
    iconBg: '#f1f5f9',
    iconColor: '#475569',
    badgeClass: 'badge-custom'
  },
  product_enquiry: {
    icon: 'bi-box-seam',
    iconBg: '#ecfdf5',
    iconColor: '#059669',
    badgeClass: 'badge-popular'
  },
  catalogue_callback: {
    icon: 'bi-grid-3x3-gap-fill',
    iconBg: '#eff6ff',
    iconColor: '#2563eb',
    badgeClass: 'badge-sales'
  },
  lead_qualification: {
    icon: 'bi-funnel-fill',
    iconBg: '#fdf2f8',
    iconColor: '#db2777',
    badgeClass: 'badge-conversion'
  },
  feedback_survey: {
    icon: 'bi-star-fill',
    iconBg: '#fffbeb',
    iconColor: '#d97706',
    badgeClass: 'badge-customer-care'
  },
  support_menu: {
    icon: 'bi-headset',
    iconBg: '#f5f3ff',
    iconColor: '#7c3aed',
    badgeClass: 'badge-assistance'
  }
};

const DEFAULT_TEMPLATES = [
  { id: 'blank', name: 'Blank Canvas', badge: 'Custom', description: 'One welcome message; build the complete conversation flow yourself.', icon: 'bi-file-earmark-plus' },
  { id: 'product_enquiry', name: 'Product Enquiry', badge: 'Popular', description: 'Ask what customer is interested in, explain the product, and offer a callback.', icon: 'bi-box-seam' },
  { id: 'catalogue_callback', name: 'Product Catalogue + Call Back', badge: 'Sales', description: 'Show products from Product Library, allow customers to explore, and request callbacks.', icon: 'bi-grid-3x3-gap-fill' },
  { id: 'lead_qualification', name: 'Lead Qualification', badge: 'Conversion', description: 'Collect customer name, city, and requirement, then automatically create a lead for your team.', icon: 'bi-funnel-fill' },
  { id: 'feedback_survey', name: 'Feedback Survey', badge: 'Customer Care', description: 'Ask customers for 1-5 ratings and immediately offer callbacks to unhappy customers.', icon: 'bi-star-fill' },
  { id: 'support_menu', name: 'Support Menu', badge: 'Assistance', description: 'Provide opening hours, location, contact info, and instant human agent handover.', icon: 'bi-headset' }
];

export default function NewAutomationModal({ isOpen, onClose, onCreated }) {
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);
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
      if (res.data?.success && res.data?.data && res.data.data.length > 0) {
        setTemplates(res.data.data);
      } else {
        setTemplates(DEFAULT_TEMPLATES);
      }
    } catch (_) {
      setTemplates(DEFAULT_TEMPLATES);
    }
  };

  const handleSelectTemplate = (tpl) => {
    setSelectedTemplate(tpl.id);
    if (!name.trim() || name === 'My WhatsApp Automation' || templates.some(t => t.name === name)) {
      setName(tpl.id === 'blank' ? 'My WhatsApp Automation' : tpl.name);
    }
    if (!purpose.trim() || templates.some(t => t.description === purpose)) {
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
    <div className="modal show d-block modal-automation-backdrop" tabIndex="-1">
      <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content modal-automation-card">
          
          {/* Header */}
          <div className="modal-header modal-automation-header">
            <div className="d-flex align-items-center gap-3">
              <div className="modal-header-icon-box">
                <i className="bi bi-robot"></i>
              </div>
              <div>
                <h5 className="modal-title fw-bold text-dark mb-1">
                  Create New Automation
                </h5>
                <p className="text-muted small mb-0">
                  Choose a proven starter template or begin with a clean blank canvas.
                </p>
              </div>
            </div>
            <button 
              type="button" 
              className="btn-close modal-close-btn" 
              onClick={onClose} 
              disabled={loading}
              aria-label="Close"
            ></button>
          </div>

          <form onSubmit={handleCreate} className="d-flex flex-column flex-grow-1 overflow-hidden">
            <div className="modal-body modal-automation-body">
              {error && (
                <div className="alert alert-danger py-2 px-3 small d-flex align-items-center mb-3 rounded-3 shadow-sm border-0">
                  <i className="bi bi-exclamation-triangle-fill me-2 fs-6"></i>
                  <span>{error}</span>
                </div>
              )}

              {/* Step 1: Template Picker */}
              <div className="modal-section-header mb-2.5">
                <span className="section-step-badge">1</span>
                <span className="section-step-title">Select Starting Template</span>
              </div>

              <div className="template-grid mb-4">
                {templates.map((tpl) => {
                  const isSelected = selectedTemplate === tpl.id;
                  const theme = TEMPLATE_THEMES[tpl.id] || {
                    icon: tpl.icon || 'bi-robot',
                    iconBg: '#f8fafc',
                    iconColor: '#059669',
                    badgeClass: 'badge-custom'
                  };

                  return (
                    <div
                      key={tpl.id}
                      className={`template-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleSelectTemplate(tpl)}
                    >
                      {/* Top Bar: Icon + Badge + Radio Indicator */}
                      <div className="template-card-top">
                        <div 
                          className="template-icon-circle"
                          style={{ backgroundColor: theme.iconBg, color: theme.iconColor }}
                        >
                          <i className={`bi ${theme.icon}`}></i>
                        </div>

                        <div className="d-flex align-items-center gap-2">
                          {tpl.badge && (
                            <span className={`template-badge ${theme.badgeClass}`}>
                              {tpl.badge}
                            </span>
                          )}
                          <div className={`template-radio-indicator ${isSelected ? 'checked' : ''}`}>
                            {isSelected ? (
                              <i className="bi bi-check2"></i>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      {/* Content */}
                      <h6 className="template-card-title">{tpl.name}</h6>
                      <p className="template-card-desc">{tpl.description}</p>
                    </div>
                  );
                })}
              </div>

              {/* Step 2: Automation Details */}
              <div className="modal-details-card">
                <div className="modal-section-header mb-3">
                  <span className="section-step-badge">2</span>
                  <span className="section-step-title">Automation Details</span>
                </div>

                <div className="mb-3">
                  <label className="form-label small fw-semibold text-dark mb-1">
                    Automation Name <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control form-control-modern"
                    placeholder="e.g., Product Lead Assistant, Support FAQs"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={100}
                    required
                    disabled={loading}
                  />
                  <div className="d-flex justify-content-between align-items-center mt-1">
                    <span className="text-muted" style={{ fontSize: '0.75rem' }}>Give your automation a recognizable name</span>
                    <span className="text-muted" style={{ fontSize: '0.75rem' }}>{name.length}/100</span>
                  </div>
                </div>

                <div className="mb-0">
                  <label className="form-label small fw-semibold text-dark mb-1">
                    Purpose / Notes <span className="text-muted fw-normal">(Optional)</span>
                  </label>
                  <textarea
                    className="form-control form-control-modern"
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

            {/* Footer */}
            <div className="modal-footer modal-automation-footer">
              <button 
                type="button" 
                className="btn btn-modern-secondary px-3 py-2" 
                onClick={onClose} 
                disabled={loading}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn btn-emerald-brand px-4 py-2" 
                disabled={loading || !name.trim()}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                    Creating Automation...
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
