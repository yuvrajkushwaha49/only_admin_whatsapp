import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import interactiveButtonsService from '../services/interactiveButtons.service';
import '../styles/interactiveButtons.css';

export default function InteractiveButtons() {
  const { user, isSuperAdmin } = useAuth();

  // Role validation: Super Admin, Owner, Admin only
  const userRole = (user?.role || '').toLowerCase();
  const isSuper = typeof isSuperAdmin === 'function' ? isSuperAdmin() : Boolean(isSuperAdmin);
  const hasAccess = isSuper || ['superadmin', 'super_admin', 'owner', 'admin'].includes(userRole);

  const [buttons, setButtons] = useState([]);
  const [stats, setStats] = useState({ total: 0, urlCount: 0, phoneCount: 0, quickReplyCount: 0, copyCodeCount: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedButton, setSelectedButton] = useState(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    button_type: 'URL',
    button_text: '',
    value: '',
    url_type: 'STATIC',
    category: 'MARKETING',
    icon: 'bi-link-45deg',
    is_active: 1
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (text, type = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadButtons = async () => {
    if (!hasAccess) return;
    try {
      setLoading(true);
      const res = await interactiveButtonsService.getButtons({
        search,
        type: selectedType,
        category: selectedCategory
      });
      if (res.success && res.data) {
        setButtons(res.data.buttons || []);
        setStats(res.data.stats || { total: 0, urlCount: 0, phoneCount: 0, quickReplyCount: 0, copyCodeCount: 0 });
        if (res.data.buttons?.length > 0 && !selectedButton) {
          setSelectedButton(res.data.buttons[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load interactive buttons:', err);
      showToast(err.response?.data?.error?.message || 'Error loading buttons', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadButtons();
  }, [search, selectedType, selectedCategory]);

  const handleOpenCreateModal = () => {
    setEditingId(null);
    setFormData({
      title: '',
      button_type: 'URL',
      button_text: '',
      value: '',
      url_type: 'STATIC',
      category: 'MARKETING',
      icon: 'bi-link-45deg',
      is_active: 1
    });
    setFormError('');
    setShowModal(true);
  };

  const handleOpenEditModal = (btn, e) => {
    e.stopPropagation();
    setEditingId(btn.id);
    setFormData({
      title: btn.title || '',
      button_type: btn.button_type || 'URL',
      button_text: btn.button_text || '',
      value: btn.value || '',
      url_type: btn.url_type || 'STATIC',
      category: btn.category || 'MARKETING',
      icon: btn.icon || 'bi-link-45deg',
      is_active: btn.is_active !== undefined ? btn.is_active : 1
    });
    setFormError('');
    setShowModal(true);
  };

  const handleSaveButton = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.title.trim()) {
      setFormError('Please enter a preset title');
      return;
    }
    if (!formData.button_text.trim()) {
      setFormError('Please enter button display text');
      return;
    }
    if (formData.button_text.length > 25) {
      setFormError('Button display text cannot exceed 25 characters (Meta WhatsApp requirement)');
      return;
    }
    if (!formData.value.trim()) {
      setFormError('Please enter the destination value (URL, phone number, or coupon code)');
      return;
    }

    try {
      setSubmitting(true);
      if (editingId) {
        await interactiveButtonsService.updateButton(editingId, formData);
        showToast('Interactive button updated successfully');
      } else {
        await interactiveButtonsService.createButton(formData);
        showToast('Interactive button preset created successfully');
      }
      setShowModal(false);
      await loadButtons();
    } catch (err) {
      setFormError(err.response?.data?.error?.message || err.message || 'Failed to save button');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteButton = async (btn, e) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete the interactive button "${btn.title}"?`)) {
      return;
    }
    try {
      await interactiveButtonsService.deleteButton(btn.id);
      showToast('Button preset deleted');
      if (selectedButton?.id === btn.id) {
        setSelectedButton(null);
      }
      await loadButtons();
    } catch (err) {
      showToast(err.response?.data?.error?.message || 'Failed to delete button', 'error');
    }
  };

  const handleCopySnippet = (btn, e) => {
    e.stopPropagation();
    const metaComponent = {
      type: 'BUTTONS',
      buttons: [
        {
          type: btn.button_type,
          text: btn.button_text,
          ...(btn.button_type === 'URL' ? { url: btn.value } : {}),
          ...(btn.button_type === 'PHONE_NUMBER' ? { phone_number: btn.value } : {}),
          ...(btn.button_type === 'COPY_CODE' ? { coupon_code: btn.value } : {})
        }
      ]
    };
    navigator.clipboard.writeText(JSON.stringify(metaComponent, null, 2));
    showToast('Meta WhatsApp JSON Component copied to clipboard!');
  };

  if (!hasAccess) {
    return (
      <div className="ib-container">
        <div className="alert alert-danger d-flex align-items-center gap-3 p-4 rounded-3 shadow-sm" role="alert">
          <i className="bi bi-shield-lock-fill fs-2 text-danger"></i>
          <div>
            <h5 className="mb-1 fw-bold">Access Restricted</h5>
            <p className="mb-0 text-secondary">
              Interactive Buttons management is exclusively available to <strong>Super Admin</strong>, <strong>Owner</strong>, and <strong>Admin</strong> roles.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const getButtonIcon = (type) => {
    switch (type) {
      case 'PHONE_NUMBER': return 'bi-telephone-fill';
      case 'QUICK_REPLY':  return 'bi-reply-fill';
      case 'COPY_CODE':    return 'bi-clipboard-check-fill';
      default:             return 'bi-box-arrow-up-right';
    }
  };

  return (
    <div className="ib-container">
      {/* Toast Alert */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          background: toastMessage.type === 'error' ? '#ef4444' : '#10b981',
          color: '#ffffff',
          padding: '0.75rem 1.25rem',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontWeight: 600,
          fontSize: '0.88rem'
        }}>
          <i className={`bi ${toastMessage.type === 'error' ? 'bi-exclamation-circle' : 'bi-check-circle-fill'}`}></i>
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* 1. Header Bar */}
      <div className="ib-header-bar">
        <div className="ib-title-wrap">
          <h1>
            Interactive Buttons Library
            <span className="ib-role-badge">Super Admin & Owner & Admin</span>
          </h1>
          <p>
            Create, store, and reuse verified WhatsApp Call-to-Action (CTA) and Quick Reply buttons across templates and broadcasts.
          </p>
        </div>
        <div>
          <button className="ib-create-btn" onClick={handleOpenCreateModal}>
            <i className="bi bi-plus-lg"></i>
            <span>+ Create Interactive Button</span>
          </button>
        </div>
      </div>

      {/* 2. Stat Metric Cards */}
      <div className="ib-stats-grid">
        <div className="ib-stat-card">
          <div className="ib-stat-icon purple"><i className="bi bi-grid-fill"></i></div>
          <div>
            <div className="ib-stat-num">{stats.total}</div>
            <div className="ib-stat-lbl">Total Preset Buttons</div>
          </div>
        </div>
        <div className="ib-stat-card">
          <div className="ib-stat-icon blue"><i className="bi bi-link-45deg"></i></div>
          <div>
            <div className="ib-stat-num">{stats.urlCount}</div>
            <div className="ib-stat-lbl">Website URL CTAs</div>
          </div>
        </div>
        <div className="ib-stat-card">
          <div className="ib-stat-icon green"><i className="bi bi-telephone-fill"></i></div>
          <div>
            <div className="ib-stat-num">{stats.phoneCount}</div>
            <div className="ib-stat-lbl">Phone Call Buttons</div>
          </div>
        </div>
        <div className="ib-stat-card">
          <div className="ib-stat-icon indigo"><i className="bi bi-reply-fill"></i></div>
          <div>
            <div className="ib-stat-num">{stats.quickReplyCount}</div>
            <div className="ib-stat-lbl">Quick Replies</div>
          </div>
        </div>
        <div className="ib-stat-card">
          <div className="ib-stat-icon amber"><i className="bi bi-tag-fill"></i></div>
          <div>
            <div className="ib-stat-num">{stats.copyCodeCount}</div>
            <div className="ib-stat-lbl">Coupon / Code Copies</div>
          </div>
        </div>
      </div>

      {/* 3. Filter Bar */}
      <div className="ib-filter-bar">
        <div className="ib-search-box">
          <i className="bi bi-search"></i>
          <input
            type="text"
            className="ib-search-input"
            placeholder="Search button name, label, or URL..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="ib-filter-tabs">
          <button
            className={`ib-tab-btn ${selectedType === 'ALL' ? 'active' : ''}`}
            onClick={() => setSelectedType('ALL')}
          >
            All Types
          </button>
          <button
            className={`ib-tab-btn ${selectedType === 'URL' ? 'active' : ''}`}
            onClick={() => setSelectedType('URL')}
          >
            <i className="bi bi-link-45deg"></i> URL Links
          </button>
          <button
            className={`ib-tab-btn ${selectedType === 'PHONE_NUMBER' ? 'active' : ''}`}
            onClick={() => setSelectedType('PHONE_NUMBER')}
          >
            <i className="bi bi-telephone"></i> Phone Call
          </button>
          <button
            className={`ib-tab-btn ${selectedType === 'QUICK_REPLY' ? 'active' : ''}`}
            onClick={() => setSelectedType('QUICK_REPLY')}
          >
            <i className="bi bi-reply"></i> Quick Reply
          </button>
          <button
            className={`ib-tab-btn ${selectedType === 'COPY_CODE' ? 'active' : ''}`}
            onClick={() => setSelectedType('COPY_CODE')}
          >
            <i className="bi bi-tag"></i> Copy Code
          </button>
        </div>
      </div>

      {/* 4. Two Column Layout */}
      <div className="ib-main-layout">
        {/* Left Column: Button Cards */}
        <div>
          {loading ? (
            <div className="d-flex justify-content-center p-5">
              <div className="spinner-border text-primary" role="status"></div>
            </div>
          ) : buttons.length === 0 ? (
            <div className="ib-empty-state">
              <i className="bi bi-grid ib-empty-icon"></i>
              <div className="ib-empty-title">No Interactive Buttons Found</div>
              <p className="small mb-3">
                {search || selectedType !== 'ALL'
                  ? 'No buttons match the current search filters.'
                  : 'Get started by creating your first pre-configured Call to Action button.'}
              </p>
              <button className="ib-create-btn" onClick={handleOpenCreateModal}>
                <i className="bi bi-plus-lg"></i> Create First Button
              </button>
            </div>
          ) : (
            <div className="ib-cards-grid">
              {buttons.map((btn) => {
                const isSelected = selectedButton?.id === btn.id;
                return (
                  <div
                    key={btn.id}
                    className={`ib-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedButton(btn)}
                  >
                    <div>
                      <div className="ib-card-head">
                        <h4 className="ib-card-title">{btn.title}</h4>
                        <span className={`ib-badge-type ${btn.button_type}`}>
                          <i className={`bi ${getButtonIcon(btn.button_type)}`}></i>
                          {btn.button_type === 'PHONE_NUMBER' ? 'CALL' : btn.button_type}
                        </span>
                      </div>

                      {/* WhatsApp Simulated Button */}
                      <div className={`ib-wa-btn-preview ${
                        btn.button_type === 'PHONE_NUMBER' ? 'phone' :
                        btn.button_type === 'QUICK_REPLY' ? 'reply' :
                        btn.button_type === 'COPY_CODE' ? 'code' : ''
                      }`}>
                        <i className={`bi ${getButtonIcon(btn.button_type)}`}></i>
                        <span>{btn.button_text}</span>
                      </div>

                      <div className="ib-card-meta">
                        <i className="bi bi-arrow-return-right"></i>
                        <span>{btn.value}</span>
                      </div>
                    </div>

                    <div className="ib-card-actions">
                      <button
                        className="ib-card-action-btn"
                        onClick={(e) => handleCopySnippet(btn, e)}
                        title="Copy Meta JSON Snippet"
                      >
                        <i className="bi bi-code-slash"></i> Snippet
                      </button>
                      <div className="d-flex align-items-center gap-1">
                        <button
                          className="ib-card-action-btn edit"
                          onClick={(e) => handleOpenEditModal(btn, e)}
                          title="Edit Button"
                        >
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button
                          className="ib-card-action-btn delete"
                          onClick={(e) => handleDeleteButton(btn, e)}
                          title="Delete Button"
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Sticky Live WhatsApp Preview */}
        <div>
          <div className="ib-preview-sticky">
            <div className="ib-mockup-header">
              <div className="ib-mockup-avatar">
                <i className="bi bi-whatsapp"></i>
              </div>
              <div>
                <div className="ib-mockup-title">
                  TechSky Media <i className="bi bi-patch-check-fill text-info"></i>
                </div>
                <div className="ib-mockup-sub">Meta WhatsApp Official Business</div>
              </div>
            </div>

            <div className="ib-mockup-body">
              <div className="ib-mockup-bubble">
                <div className="ib-mockup-bubble-text">
                  Hello! Thank you for reaching out to us. We have prepared an update for you. Click the button below to take immediate action:
                </div>
                <div className="ib-mockup-time">10:42 AM <i className="bi bi-check2-all text-primary"></i></div>
              </div>

              {/* The CTA Interactive Button */}
              {selectedButton ? (
                <div className="ib-mockup-cta-btn">
                  <i className={`bi ${getButtonIcon(selectedButton.button_type)}`}></i>
                  <span>{selectedButton.button_text}</span>
                </div>
              ) : (
                <div className="text-center p-3 text-muted small bg-white rounded-2">
                  Select a button on the left to preview it here
                </div>
              )}
            </div>

            {selectedButton && (
              <div className="ib-mockup-details">
                <div className="ib-mockup-row">
                  <span>Preset Name:</span>
                  <span>{selectedButton.title}</span>
                </div>
                <div className="ib-mockup-row">
                  <span>Type:</span>
                  <span>{selectedButton.button_type}</span>
                </div>
                <div className="ib-mockup-row">
                  <span>Target Value:</span>
                  <span style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedButton.value}
                  </span>
                </div>
                <div className="ib-mockup-row">
                  <span>Category:</span>
                  <span>{selectedButton.category || 'MARKETING'}</span>
                </div>
                <div className="mt-3">
                  <button
                    className="btn btn-sm btn-outline-primary w-100 fw-semibold"
                    onClick={(e) => handleCopySnippet(selectedButton, e)}
                  >
                    <i className="bi bi-clipboard me-1"></i> Copy Meta WhatsApp JSON Component
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 5. Create / Edit Modal */}
      {showModal && (
        <div className="ib-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="ib-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="ib-modal-header">
              <h3>{editingId ? 'Edit Interactive Button' : 'Create Interactive Button Preset'}</h3>
              <button className="ib-modal-close" onClick={() => setShowModal(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <form onSubmit={handleSaveButton}>
              <div className="ib-modal-body">
                {formError && (
                  <div className="alert alert-danger py-2 small mb-3">
                    <i className="bi bi-exclamation-triangle-fill me-2"></i>
                    {formError}
                  </div>
                )}

                <div className="ib-form-group">
                  <label className="ib-form-label">Preset Title / Internal Name</label>
                  <input
                    type="text"
                    className="ib-form-control"
                    placeholder="e.g. Schedule Consultation Call"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>

                <div className="row">
                  <div className="col-md-6 ib-form-group">
                    <label className="ib-form-label">Button Action Type</label>
                    <select
                      className="ib-form-control"
                      value={formData.button_type}
                      onChange={(e) => setFormData({ ...formData, button_type: e.target.value })}
                    >
                      <option value="URL">Website Link (URL)</option>
                      <option value="PHONE_NUMBER">Phone Call (Click to Dial)</option>
                      <option value="QUICK_REPLY">Quick Reply (Payload)</option>
                      <option value="COPY_CODE">Coupon Code (Copy to Clipboard)</option>
                    </select>
                  </div>

                  <div className="col-md-6 ib-form-group">
                    <label className="ib-form-label">Category</label>
                    <select
                      className="ib-form-control"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    >
                      <option value="MARKETING">Marketing</option>
                      <option value="UTILITY">Utility</option>
                      <option value="SUPPORT">Support</option>
                    </select>
                  </div>
                </div>

                <div className="ib-form-group">
                  <label className="ib-form-label">
                    Button Display Text (What Customer Sees)
                  </label>
                  <input
                    type="text"
                    className="ib-form-control"
                    placeholder="e.g. Visit Website, Call Us, Book Now"
                    maxLength={25}
                    value={formData.button_text}
                    onChange={(e) => setFormData({ ...formData, button_text: e.target.value })}
                    required
                  />
                  <div className={`ib-char-count ${formData.button_text.length > 25 ? 'warn' : ''}`}>
                    <span>Max 25 characters per Meta policy</span>
                    <span>{formData.button_text.length} / 25</span>
                  </div>
                </div>

                <div className="ib-form-group">
                  <label className="ib-form-label">
                    {formData.button_type === 'URL' && 'Destination Website URL'}
                    {formData.button_type === 'PHONE_NUMBER' && 'Phone Number (E.164 with Country Code)'}
                    {formData.button_type === 'QUICK_REPLY' && 'Quick Reply Identifier / Payload'}
                    {formData.button_type === 'COPY_CODE' && 'Coupon Code to Copy'}
                  </label>
                  <input
                    type="text"
                    className="ib-form-control"
                    placeholder={
                      formData.button_type === 'URL' ? 'https://example.com/promo or https://site.com/track?id={{1}}' :
                      formData.button_type === 'PHONE_NUMBER' ? '+919876543210' :
                      formData.button_type === 'QUICK_REPLY' ? 'YES_INTERESTED' :
                      'FESTIVE20'
                    }
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                    required
                  />
                  {formData.button_type === 'URL' && (
                    <small className="text-muted d-block mt-1">
                      Tip: You can include variable <code>{`{{1}}`}</code> for dynamic personalized links.
                    </small>
                  )}
                </div>

                {/* Live Preview within modal */}
                <div className="p-3 bg-light rounded-3 mt-3 border">
                  <div className="small text-muted fw-bold mb-2">LIVE BUTTON PREVIEW:</div>
                  <div className="d-flex align-items-center justify-content-center p-2 bg-white rounded border text-primary fw-semibold gap-2">
                    <i className={`bi ${getButtonIcon(formData.button_type)}`}></i>
                    <span>{formData.button_text || 'Button Display Text'}</span>
                  </div>
                </div>
              </div>

              <div className="ib-modal-footer">
                <button
                  type="button"
                  className="ib-btn-cancel"
                  onClick={() => setShowModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ib-btn-save"
                  disabled={submitting}
                >
                  {submitting ? 'Saving...' : editingId ? 'Update Button' : 'Create Button'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
