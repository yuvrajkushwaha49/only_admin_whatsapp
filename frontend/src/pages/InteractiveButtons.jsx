import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import interactiveButtonsService from '../services/interactiveButtons.service';
import '../styles/interactiveButtons.css';

const QUICK_EMOJIS = ['👍', '👎', '✅', '❌', '📞', '🔗', '⭐', '😃'];

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
  const [selectedButton, setSelectedButton] = useState(null);
  const [viewMode, setViewMode] = useState('box'); // 'box' or 'table'

  // Modal State matching user reference screenshot
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('feedback_btn');
  const [componentType, setComponentType] = useState('Feedback');
  const [delivery, setDelivery] = useState('Buttons');
  const [messageText, setMessageText] = useState('Are you interested in this property?');
  const [buttonsList, setButtonsList] = useState([
    {
      id: 'helpful',
      label: '👍 Helpful',
      when_chosen: 'Record feedback',
      target: '',
      auto_reply: 'Thanks for your interest.'
    },
    {
      id: 'not_helpful',
      label: '👎 Not Helpful',
      when_chosen: 'Record feedback',
      target: '',
      auto_reply: 'Thanks {{name}}! An agent will contact you shortly.'
    }
  ]);
  const [askFollowUp, setAskFollowUp] = useState(false);
  const [followUpText, setFollowUpText] = useState('');
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
        type: selectedType
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
  }, [search, selectedType]);

  const handleOpenCreateModal = () => {
    setEditingId(null);
    setName('feedback_btn');
    setComponentType('Feedback');
    setDelivery('Buttons');
    setMessageText('Are you interested in this property?');
    setButtonsList([
      {
        id: 'helpful',
        label: '👍 Helpful',
        when_chosen: 'Record feedback',
        target: '',
        auto_reply: 'Thanks for your interest.'
      },
      {
        id: 'not_helpful',
        label: '👎 Not Helpful',
        when_chosen: 'Record feedback',
        target: '',
        auto_reply: 'Thanks {{name}}! An agent will contact you shortly.'
      }
    ]);
    setAskFollowUp(false);
    setFollowUpText('');
    setFormError('');
    setShowModal(true);
  };

  const handleOpenEditModal = (item, e) => {
    e.stopPropagation();
    setEditingId(item.id);
    setName(item.title || item.name || 'feedback_btn');
    setComponentType(item.component_type || 'Feedback');
    setDelivery(item.delivery_type === 'keyword_list' ? 'Keyword list' : 'Buttons');
    setMessageText(item.message_text || 'Are you interested in this property?');

    const loadedBtns = Array.isArray(item.buttons_data) && item.buttons_data.length > 0
      ? item.buttons_data
      : (item.button_text ? [{ id: item.value || 'btn_1', label: item.button_text, when_chosen: 'Record feedback', target: item.value || '', auto_reply: '' }] : []);

    setButtonsList(loadedBtns.length > 0 ? loadedBtns : [
      { id: 'btn_1', label: 'Option 1', when_chosen: 'Record feedback', target: '', auto_reply: '' }
    ]);
    setAskFollowUp(Boolean(item.follow_up_enabled));
    setFollowUpText(item.follow_up_text || '');
    setFormError('');
    setShowModal(true);
  };

  const handleAddButton = () => {
    if (buttonsList.length >= 3) {
      showToast('WhatsApp allows a maximum of 3 interactive buttons.', 'error');
      return;
    }
    const nextIdx = buttonsList.length + 1;
    setButtonsList([
      ...buttonsList,
      {
        id: `option_${nextIdx}`,
        label: `Option ${nextIdx}`,
        when_chosen: 'Record feedback',
        target: '',
        auto_reply: ''
      }
    ]);
  };

  const handleRemoveButton = (idx) => {
    if (buttonsList.length <= 1) {
      showToast('A button set must have at least one button.', 'error');
      return;
    }
    const updated = buttonsList.filter((_, i) => i !== idx);
    setButtonsList(updated);
  };

  const handleMoveButton = (idx, direction) => {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= buttonsList.length) return;
    const updated = [...buttonsList];
    const temp = updated[idx];
    updated[idx] = updated[targetIdx];
    updated[targetIdx] = temp;
    setButtonsList(updated);
  };

  const handleUpdateButtonField = (idx, field, value) => {
    const updated = [...buttonsList];
    updated[idx] = { ...updated[idx], [field]: value };
    // Auto-generate button id from label if not manually customized
    if (field === 'label' && (!updated[idx].id || updated[idx].id.startsWith('btn_') || updated[idx].id.startsWith('option_'))) {
      const cleanSlug = value.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/[-\s]+/g, '_');
      if (cleanSlug) updated[idx].id = cleanSlug;
    }
    setButtonsList(updated);
  };

  const handleAppendEmoji = (btnIdx, emoji) => {
    const currentLabel = buttonsList[btnIdx]?.label || '';
    if (currentLabel.length + emoji.length <= 20) {
      handleUpdateButtonField(btnIdx, 'label', `${emoji} ${currentLabel}`.trim());
    } else {
      handleUpdateButtonField(btnIdx, 'label', `${emoji}`);
    }
  };

  const handleCopySnippet = (btn, e) => {
    if (e) e.stopPropagation();
    const cardButtons = Array.isArray(btn.buttons_data) && btn.buttons_data.length > 0
      ? btn.buttons_data
      : (btn.button_text ? [{ id: btn.value, label: btn.button_text }] : []);

    const metaComponent = {
      type: 'BUTTONS',
      buttons: cardButtons.map((cb) => ({
        type: cb.when_chosen === 'Open URL' ? 'URL' : (cb.when_chosen === 'Call phone number' ? 'PHONE_NUMBER' : 'QUICK_REPLY'),
        text: cb.label,
        ...(cb.when_chosen === 'Open URL' ? { url: cb.target } : {}),
        ...(cb.when_chosen === 'Call phone number' ? { phone_number: cb.target } : {})
      }))
    };
    navigator.clipboard.writeText(JSON.stringify(metaComponent, null, 2));
    showToast('Meta WhatsApp JSON snippet copied!');
  };

  const handleSaveButtonSet = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!name.trim()) {
      setFormError('Name is required');
      return;
    }

    if (buttonsList.length === 0) {
      setFormError('Please add at least one button');
      return;
    }

    for (let i = 0; i < buttonsList.length; i++) {
      const b = buttonsList[i];
      if (!b.label?.trim()) {
        setFormError(`Button ${i + 1} Label is required`);
        return;
      }
      if (b.label.length > 20) {
        setFormError(`Button ${i + 1} Label exceeds 20 characters`);
        return;
      }
      if (!b.id?.trim()) {
        setFormError(`Button ${i + 1} Button ID is required`);
        return;
      }
    }

    const payload = {
      name: name.trim(),
      title: name.trim(),
      component_type: componentType,
      delivery_type: delivery === 'Buttons' ? 'buttons' : 'keyword_list',
      message_text: messageText,
      buttons_data: buttonsList,
      follow_up_enabled: askFollowUp ? 1 : 0,
      follow_up_text: followUpText,
      button_type: componentType === 'Call to action' ? 'URL' : 'QUICK_REPLY',
      button_text: buttonsList[0]?.label || 'Button',
      value: buttonsList[0]?.target || buttonsList[0]?.id || 'btn_1'
    };

    try {
      setSubmitting(true);
      if (editingId) {
        await interactiveButtonsService.updateButton(editingId, payload);
        showToast('Button set updated successfully');
      } else {
        await interactiveButtonsService.createButton(payload);
        showToast('Button set created successfully');
      }
      setShowModal(false);
      await loadButtons();
    } catch (err) {
      setFormError(err.response?.data?.error?.message || err.message || 'Failed to save button set');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteButtonSet = async (btn, e) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete the button set "${btn.title}"?`)) {
      return;
    }
    try {
      await interactiveButtonsService.deleteButton(btn.id);
      showToast('Button set deleted');
      if (selectedButton?.id === btn.id) {
        setSelectedButton(null);
      }
      await loadButtons();
    } catch (err) {
      showToast(err.response?.data?.error?.message || 'Failed to delete button set', 'error');
    }
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

      {/* 1. Top Header Bar */}
      <div className="ib-header-bar">
        <div className="ib-title-wrap">
          <h1>
            Interactive Buttons Library
            <span className="ib-role-badge">Super Admin & Owner & Admin</span>
          </h1>
          <p>
            Create, store, and reuse verified WhatsApp Call-to-Action (CTA), Feedback, and Quick Reply button presets.
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
            <div className="ib-stat-lbl">Total Button Sets</div>
          </div>
        </div>
        <div className="ib-stat-card">
          <div className="ib-stat-icon green"><i className="bi bi-chat-square-dots-fill"></i></div>
          <div>
            <div className="ib-stat-num">{stats.quickReplyCount}</div>
            <div className="ib-stat-lbl">Feedback / Quick Replies</div>
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
          <div className="ib-stat-icon indigo"><i className="bi bi-telephone-fill"></i></div>
          <div>
            <div className="ib-stat-num">{stats.phoneCount}</div>
            <div className="ib-stat-lbl">Phone Call Buttons</div>
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
            placeholder="Search button set name, label, or message..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="ib-filter-controls-right">
          <div className="ib-filter-tabs">
            <button
              className={`ib-tab-btn ${selectedType === 'ALL' ? 'active' : ''}`}
              onClick={() => setSelectedType('ALL')}
            >
              All Types
            </button>
            <button
              className={`ib-tab-btn ${selectedType === 'Feedback' ? 'active' : ''}`}
              onClick={() => setSelectedType('Feedback')}
            >
              <i className="bi bi-hand-thumbs-up"></i> Feedback Sets
            </button>
            <button
              className={`ib-tab-btn ${selectedType === 'Call to action' ? 'active' : ''}`}
              onClick={() => setSelectedType('Call to action')}
            >
              <i className="bi bi-link-45deg"></i> Call To Action
            </button>
            <button
              className={`ib-tab-btn ${selectedType === 'Quick reply' ? 'active' : ''}`}
              onClick={() => setSelectedType('Quick reply')}
            >
              <i className="bi bi-reply"></i> Quick Reply
            </button>
          </div>

          <div className="ib-view-switcher">
            <button
              type="button"
              className={`ib-view-btn ${viewMode === 'box' ? 'active' : ''}`}
              onClick={() => setViewMode('box')}
              title="Box / Cards View"
            >
              <i className="bi bi-grid-fill"></i>
              <span>Box</span>
            </button>
            <button
              type="button"
              className={`ib-view-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
              title="Table View"
            >
              <i className="bi bi-table"></i>
              <span>Table</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. Button Sets Content (Box or Table View) */}
      {loading ? (
        <div className="d-flex justify-content-center p-5">
          <div className="spinner-border text-primary" role="status"></div>
        </div>
      ) : buttons.length === 0 ? (
        <div className="ib-empty-state">
          <i className="bi bi-grid ib-empty-icon"></i>
          <div className="ib-empty-title">No Interactive Button Sets Found</div>
          <p className="small mb-3">
            Get started by creating your first pre-configured Interactive Button Set.
          </p>
          <button className="ib-create-btn" onClick={handleOpenCreateModal}>
            <i className="bi bi-plus-lg"></i> + Create Button Set
          </button>
        </div>
      ) : viewMode === 'box' ? (
        <div className="ib-cards-grid">
          {buttons.map((btn) => {
            const isSelected = selectedButton?.id === btn.id;
            const cardButtons = Array.isArray(btn.buttons_data) && btn.buttons_data.length > 0
              ? btn.buttons_data
              : (btn.button_text ? [{ id: btn.value, label: btn.button_text }] : []);

            return (
              <div
                key={btn.id}
                className={`ib-card ${isSelected ? 'selected' : ''}`}
                onClick={() => setSelectedButton(btn)}
              >
                <div>
                  <div className="ib-card-head">
                    <h4 className="ib-card-title">{btn.title}</h4>
                    <span className="ib-badge-type">
                      {btn.component_type || btn.button_type}
                    </span>
                  </div>

                  {btn.message_text && (
                    <div className="ib-card-msg">
                      "{btn.message_text}"
                    </div>
                  )}

                  {/* Render the buttons list in the card */}
                  <div className="ib-card-btns-list">
                    {cardButtons.map((cb, idx) => (
                      <div key={idx} className="ib-card-btn-item">
                        <span>{cb.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="ib-card-actions">
                  <span className="small text-muted">
                    {cardButtons.length} button{cardButtons.length !== 1 ? 's' : ''}
                  </span>
                  <div className="d-flex align-items-center gap-1">
                    <button
                      className="ib-card-action-btn"
                      onClick={(e) => handleCopySnippet(btn, e)}
                      title="Copy Meta JSON Snippet"
                    >
                      <i className="bi bi-code-slash"></i>
                    </button>
                    <button
                      className="ib-card-action-btn edit"
                      onClick={(e) => handleOpenEditModal(btn, e)}
                      title="Edit Button Set"
                    >
                      <i className="bi bi-pencil"></i> Edit
                    </button>
                    <button
                      className="ib-card-action-btn delete"
                      onClick={(e) => handleDeleteButtonSet(btn, e)}
                      title="Delete Button Set"
                    >
                      <i className="bi bi-trash"></i>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="ib-table-wrap">
          <table className="ib-data-table">
            <thead>
              <tr>
                <th>Name / ID</th>
                <th>Component Type</th>
                <th>Delivery</th>
                <th>Message Text</th>
                <th>Buttons Configured</th>
                <th>Follow-up</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {buttons.map((btn) => {
                const cardButtons = Array.isArray(btn.buttons_data) && btn.buttons_data.length > 0
                  ? btn.buttons_data
                  : (btn.button_text ? [{ id: btn.value, label: btn.button_text }] : []);

                return (
                  <tr key={btn.id}>
                    <td>
                      <span className="ib-table-name">{btn.title}</span>
                      <span className="ib-table-sub">ID: #{btn.id}</span>
                    </td>
                    <td>
                      <span className={`ib-table-badge ${btn.component_type ? btn.component_type.replace(/\s+/g, '_') : 'Feedback'}`}>
                        {btn.component_type || 'Feedback'}
                      </span>
                    </td>
                    <td>
                      <span className="badge bg-light text-dark border">
                        {btn.delivery_type === 'keyword_list' ? 'Keyword list' : 'Buttons'}
                      </span>
                    </td>
                    <td>
                      <div className="ib-table-msg" title={btn.message_text}>
                        {btn.message_text ? `"${btn.message_text}"` : <span className="text-muted italic">No message text</span>}
                      </div>
                    </td>
                    <td>
                      <div className="ib-table-btns-wrap">
                        {cardButtons.map((cb, idx) => (
                          <span key={idx} className="ib-table-btn-chip">
                            {cb.label}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      {btn.follow_up_enabled ? (
                        <span className="badge bg-success-subtle text-success border border-success-subtle">
                          <i className="bi bi-check-circle me-1"></i> Enabled
                        </span>
                      ) : (
                        <span className="text-muted small">None</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="ib-table-actions justify-content-end">
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          onClick={(e) => handleCopySnippet(btn, e)}
                          title="Copy Meta JSON Snippet"
                        >
                          <i className="bi bi-code-slash"></i>
                        </button>
                        <button
                          className="btn btn-sm btn-outline-success"
                          onClick={(e) => handleOpenEditModal(btn, e)}
                          title="Edit"
                        >
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={(e) => handleDeleteButtonSet(btn, e)}
                          title="Delete"
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* =========================================================
          5. Pixel-Perfect Modal Matching Reference Image
          ========================================================= */}
      {showModal && (
        <div className="ib-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="ib-modal-box" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="ib-modal-header">
              <h2>{editingId ? 'Edit button set' : 'Create button set'}</h2>
              <button className="ib-modal-close" onClick={() => setShowModal(false)}>
                ✕
              </button>
            </div>

            {/* Modal Body: Split 2-Column Grid */}
            <form onSubmit={handleSaveButtonSet}>
              <div className="ib-modal-body-split">
                {/* Left Side: Form Controls */}
                <div>
                  {formError && (
                    <div className="alert alert-danger py-2 small mb-3">
                      <i className="bi bi-exclamation-triangle-fill me-2"></i>
                      {formError}
                    </div>
                  )}

                  {/* 1. Name */}
                  <div className="ib-field-group">
                    <label className="ib-field-label">Name *</label>
                    <input
                      type="text"
                      className="ib-input"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="feedback_btn"
                      required
                    />
                    <div className="ib-field-help">
                      Internal only — customers never see this.
                    </div>
                  </div>

                  {/* 2. Component type */}
                  <div className="ib-field-group">
                    <label className="ib-field-label">Component type</label>
                    <select
                      className="ib-input"
                      value={componentType}
                      onChange={(e) => setComponentType(e.target.value)}
                    >
                      <option value="Feedback">Feedback</option>
                      <option value="Call to action">Call to action</option>
                      <option value="Custom interactive">Custom interactive</option>
                      <option value="Quick reply">Quick reply</option>
                      <option value="List menu">List menu</option>
                    </select>
                    <div className="ib-field-help">
                      {componentType === 'Feedback'
                        ? 'Exactly two options — one positive, one negative — with an optional follow-up question.'
                        : 'Interactive buttons for fast customer engagement and click-throughs.'}
                    </div>
                  </div>

                  {/* 3. Delivery */}
                  <div className="ib-field-group">
                    <label className="ib-field-label">Delivery</label>
                    <div className="ib-delivery-toggle">
                      <button
                        type="button"
                        className={`ib-delivery-btn ${delivery === 'Buttons' ? 'active' : ''}`}
                        onClick={() => setDelivery('Buttons')}
                      >
                        Buttons
                      </button>
                      <button
                        type="button"
                        className={`ib-delivery-btn ${delivery === 'Keyword list' ? 'active' : ''}`}
                        onClick={() => setDelivery('Keyword list')}
                      >
                        Keyword list
                      </button>
                    </div>
                    <div className="ib-field-help">
                      Tappable buttons. WhatsApp allows 3 at most, and only inside the 24-hour window unless carried by an approved template.
                    </div>
                    <div className="ib-field-note">
                      <strong>ⓘ WhatsApp leaves buttons tappable even after they are used.</strong> Only a recipient's <strong>first answer per message</strong> counts — later taps still show in the inbox but change nothing.
                    </div>
                  </div>

                  {/* 4. Message text */}
                  <div className="ib-field-group">
                    <label className="ib-field-label">Message text</label>
                    <textarea
                      className="ib-input"
                      rows={3}
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder="Are you interested in this property?"
                    />
                  </div>

                  {/* 5. Buttons Section */}
                  <div className="ib-buttons-section-header">
                    <h3>Buttons</h3>
                    <button
                      type="button"
                      className="ib-add-btn-pill"
                      onClick={handleAddButton}
                      disabled={buttonsList.length >= 3}
                    >
                      + Add button
                    </button>
                  </div>

                  {/* Render each button box */}
                  {buttonsList.map((btn, idx) => (
                    <div key={idx} className="ib-button-box">
                      <div className="ib-button-box-header">
                        <span className="ib-button-box-title">Button {idx + 1}</span>
                        <div className="ib-button-box-controls">
                          <button
                            type="button"
                            className="ib-icon-btn"
                            onClick={() => handleMoveButton(idx, -1)}
                            disabled={idx === 0}
                            title="Move Up"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="ib-icon-btn"
                            onClick={() => handleMoveButton(idx, 1)}
                            disabled={idx === buttonsList.length - 1}
                            title="Move Down"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            className="ib-icon-btn delete"
                            onClick={() => handleRemoveButton(idx)}
                            disabled={buttonsList.length <= 1}
                            title="Delete Button"
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        </div>
                      </div>

                      <div className="ib-btn-two-col">
                        {/* Label Column */}
                        <div>
                          <label className="ib-field-label">Label *</label>
                          <input
                            type="text"
                            className="ib-input"
                            maxLength={20}
                            value={btn.label}
                            onChange={(e) => handleUpdateButtonField(idx, 'label', e.target.value)}
                            placeholder="Helpful"
                            required
                          />
                          {/* Quick Emoji Bar */}
                          <div className="ib-emoji-bar">
                            {QUICK_EMOJIS.map((em) => (
                              <button
                                key={em}
                                type="button"
                                className="ib-emoji-chip"
                                onClick={() => handleAppendEmoji(idx, em)}
                                title={`Add ${em}`}
                              >
                                {em}
                              </button>
                            ))}
                          </div>
                          <div className="ib-char-indicator">
                            {btn.label?.length || 0}/20
                          </div>
                          <div className="ib-field-help" style={{ fontSize: '0.74rem' }}>
                            An emoji on its own is a valid label — it shows as an icon.
                          </div>
                        </div>

                        {/* Button ID Column */}
                        <div>
                          <label className="ib-field-label">Button ID</label>
                          <input
                            type="text"
                            className="ib-input"
                            value={btn.id}
                            onChange={(e) => handleUpdateButtonField(idx, 'id', e.target.value)}
                            placeholder="helpful"
                            required
                          />
                          <div className="ib-field-help" style={{ marginTop: '0.65rem' }}>
                            Tracking key. Stays stable when the label changes.
                          </div>
                        </div>
                      </div>

                      {/* When Chosen */}
                      <div className="ib-field-group">
                        <label className="ib-field-label">When chosen</label>
                        <select
                          className="ib-input"
                          value={btn.when_chosen || 'Record feedback'}
                          onChange={(e) => handleUpdateButtonField(idx, 'when_chosen', e.target.value)}
                        >
                          <option value="Record feedback">Record feedback</option>
                          <option value="Open URL">Open URL</option>
                          <option value="Call phone number">Call phone number</option>
                          <option value="Send auto-reply">Send auto-reply</option>
                        </select>
                      </div>

                      {btn.when_chosen === 'Open URL' && (
                        <div className="ib-field-group">
                          <label className="ib-field-label">Destination URL</label>
                          <input
                            type="text"
                            className="ib-input"
                            value={btn.target || ''}
                            onChange={(e) => handleUpdateButtonField(idx, 'target', e.target.value)}
                            placeholder="https://example.com/promo"
                            required
                          />
                        </div>
                      )}

                      {btn.when_chosen === 'Call phone number' && (
                        <div className="ib-field-group">
                          <label className="ib-field-label">Phone Number (E.164)</label>
                          <input
                            type="text"
                            className="ib-input"
                            value={btn.target || ''}
                            onChange={(e) => handleUpdateButtonField(idx, 'target', e.target.value)}
                            placeholder="+919876543210"
                            required
                          />
                        </div>
                      )}

                      {/* Auto-reply */}
                      <div className="ib-field-group mb-0">
                        <label className="ib-field-label">Auto-reply (optional)</label>
                        <textarea
                          className="ib-input"
                          rows={2}
                          value={btn.auto_reply || ''}
                          onChange={(e) => handleUpdateButtonField(idx, 'auto_reply', e.target.value)}
                          placeholder="Thanks for your interest."
                        />
                        <div className="ib-field-help">
                          Sent the moment this option is chosen, in addition to the action above. Use <code>{`{{name}}`}</code> for the contact's name. Leave empty to send nothing.
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* 6. Follow-up Toggle */}
                  <div className="ib-followup-row">
                    <label className="ib-switch">
                      <input
                        type="checkbox"
                        checked={askFollowUp}
                        onChange={(e) => setAskFollowUp(e.target.checked)}
                      />
                      <span className="ib-slider"></span>
                    </label>
                    <span className="ib-switch-label">
                      Ask a follow-up after negative feedback
                    </span>
                  </div>

                  {askFollowUp && (
                    <div className="mt-3">
                      <input
                        type="text"
                        className="ib-input"
                        placeholder="e.g. Could you tell us how we can improve?"
                        value={followUpText}
                        onChange={(e) => setFollowUpText(e.target.value)}
                      />
                    </div>
                  )}
                </div>

                {/* Right Side: Sticky Live Preview */}
                <div className="ib-preview-panel">
                  <div className="ib-preview-heading">Preview</div>
                  <div className="ib-preview-card">
                    {/* Message Bubble */}
                    <div className="ib-preview-bubble">
                      {messageText || 'Your message text appears here.'}
                    </div>

                    {/* Preview Buttons */}
                    <div className="ib-preview-buttons-list">
                      {buttonsList.map((btn, idx) => (
                        <div key={idx} className="ib-preview-btn-pill">
                          <span>{btn.label || `Button ${idx + 1}`}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="ib-modal-footer">
                <button
                  type="button"
                  className="ib-btn-cancel-text"
                  onClick={() => setShowModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ib-btn-save-green"
                  disabled={submitting}
                >
                  <i className="bi bi-check-lg"></i>
                  <span>{submitting ? 'Saving...' : 'Save'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
