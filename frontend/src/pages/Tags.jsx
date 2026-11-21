import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import tagsService from '../services/tags.service';
import { useAuth } from '../hooks/useAuth';
import '../styles/tags.css';

const PRESET_COLORS = [
  '#7c3aed', // Purple
  '#10b981', // Green
  '#3b82f6', // Blue
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#6366f1'  // Indigo
];

export default function Tags() {
  const { user, isSuperAdmin } = useAuth();
  const canDelete = Boolean((isSuperAdmin && isSuperAdmin()) || user?.role === 'superadmin' || user?.role === 'owner');

  const [tags, setTags] = useState([]);
  const [stats, setStats] = useState({ totalTags: 0, taggedContacts: 0, totalContacts: 0, untaggedContacts: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toastMsg, setToastMsg] = useState(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingTag, setEditingTag] = useState(null);
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState('#7c3aed');
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  // Delete Confirm Modal State
  const [deletingTag, setDeletingTag] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const showToast = (type, text) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [tagsRes, statsRes] = await Promise.allSettled([
        tagsService.getTags(),
        tagsService.getTagStats()
      ]);

      if (tagsRes.status === 'fulfilled' && tagsRes.value?.success) {
        setTags(tagsRes.value.data || []);
      }
      if (statsRes.status === 'fulfilled' && statsRes.value?.success) {
        setStats(statsRes.value.data || {});
      }
    } catch (err) {
      console.error('[Tags] Error loading data:', err);
      showToast('danger', 'Failed to load tags');
    } finally {
      setLoading(false);
    }
  };

  const filteredTags = useMemo(() => {
    if (!search.trim()) return tags;
    const q = search.toLowerCase();
    return tags.filter(t => t.name.toLowerCase().includes(q));
  }, [tags, search]);

  const openCreateModal = () => {
    setEditingTag(null);
    setTagName('');
    setTagColor('#7c3aed');
    setModalError('');
    setShowModal(true);
  };

  const openEditModal = (tag) => {
    setEditingTag(tag);
    setTagName(tag.name);
    setTagColor(tag.color || '#7c3aed');
    setModalError('');
    setShowModal(true);
  };

  const handleSaveTag = async (e) => {
    e.preventDefault();
    setModalError('');

    const clean = tagName.trim();
    if (!clean) {
      setModalError('Tag name is required');
      return;
    }

    try {
      setSaving(true);
      if (editingTag) {
        await tagsService.updateTag(editingTag.id, { name: clean, color: tagColor });
        showToast('success', `Tag "${clean}" updated successfully`);
      } else {
        await tagsService.createTag({ name: clean, color: tagColor });
        showToast('success', `Tag "${clean}" created successfully`);
      }
      setShowModal(false);
      loadData();
    } catch (err) {
      console.error('[Tags] Save failed:', err);
      setModalError(err.response?.data?.message || 'Failed to save tag');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTag = async () => {
    if (!deletingTag) return;
    try {
      setDeleting(true);
      await tagsService.deleteTag(deletingTag.id);
      showToast('success', `Tag "${deletingTag.name}" deleted successfully`);
      setDeletingTag(null);
      loadData();
    } catch (err) {
      console.error('[Tags] Delete failed:', err);
      showToast('danger', err.response?.data?.message || 'Failed to delete tag');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="tag-page-container">
      {/* Toast Alert */}
      {toastMsg && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          background: toastMsg.type === 'danger' ? '#ef4444' : '#10b981',
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
          <i className={`bi ${toastMsg.type === 'danger' ? 'bi-exclamation-circle' : 'bi-check-circle-fill'}`}></i>
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Hero Title Bar */}
      <div className="tag-hero-banner">
        <div className="tag-hero-left">
          <div className="tag-brand-square">
            <i className="bi bi-tags-fill"></i>
          </div>
          <div>
            <h1 className="tag-hero-title">
              Tags Management
            </h1>
            <p className="tag-hero-subtitle">
              Organize, segment, and filter your contacts using custom color-coded tags.
            </p>
          </div>
        </div>

        <div>
          <button className="tag-primary-btn" onClick={openCreateModal}>
            <i className="bi bi-plus-lg"></i>
            <span>+ Create Tag</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="tag-kpi-grid">
        <div className="tag-kpi-card">
          <div className="tag-kpi-icon-circle purple">
            <i className="bi bi-tags-fill"></i>
          </div>
          <div>
            <span className="tag-kpi-value">{stats.totalTags || tags.length}</span>
            <span className="tag-kpi-label">Total Tags</span>
          </div>
        </div>

        <div className="tag-kpi-card">
          <div className="tag-kpi-icon-circle green">
            <i className="bi bi-people-fill"></i>
          </div>
          <div>
            <span className="tag-kpi-value">{stats.taggedContacts}</span>
            <span className="tag-kpi-label">Tagged Contacts</span>
          </div>
        </div>

        <div className="tag-kpi-card">
          <div className="tag-kpi-icon-circle blue">
            <i className="bi bi-person-lines-fill"></i>
          </div>
          <div>
            <span className="tag-kpi-value">{stats.totalContacts}</span>
            <span className="tag-kpi-label">Total Directory Contacts</span>
          </div>
        </div>

        <div className="tag-kpi-card">
          <div className="tag-kpi-icon-circle amber">
            <i className="bi bi-person-dash-fill"></i>
          </div>
          <div>
            <span className="tag-kpi-value">{stats.untaggedContacts}</span>
            <span className="tag-kpi-label">Untagged Contacts</span>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="tag-filter-bar">
        <div className="tag-search-box">
          <i className="bi bi-search"></i>
          <input
            type="text"
            className="tag-search-input"
            placeholder="Search tags by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="text-muted small">
          Showing <strong>{filteredTags.length}</strong> tag{filteredTags.length === 1 ? '' : 's'}
        </div>
      </div>

      {/* Tags Cards Grid */}
      {loading ? (
        <div className="d-flex justify-content-center p-5">
          <div className="spinner-border text-primary" role="status"></div>
        </div>
      ) : filteredTags.length === 0 ? (
        <div className="card border-0 shadow-sm rounded-4 p-5 text-center">
          <div className="tag-empty-state">
            <i className="bi bi-tag tag-empty-icon"></i>
            <h4 className="fw-bold text-dark mb-2">No Tags Found</h4>
            <p className="text-secondary mb-4">
              {search ? 'No tags match your search query.' : 'Get started by creating your first contact tag.'}
            </p>
            <button className="tag-primary-btn mx-auto" onClick={openCreateModal}>
              <i className="bi bi-plus-lg"></i> + Create Tag
            </button>
          </div>
        </div>
      ) : (
        <div className="tag-grid">
          {filteredTags.map((tag) => {
            const color = tag.color || '#7c3aed';
            return (
              <div key={tag.id} className="tag-card">
                <div>
                  <div className="tag-card-head mb-3">
                    <span
                      className="tag-pill-badge"
                      style={{
                        backgroundColor: `${color}18`,
                        color: color,
                        borderColor: `${color}35`
                      }}
                    >
                      <span className="tag-dot-circle" style={{ backgroundColor: color }}></span>
                      <span>{tag.name}</span>
                    </span>

                    <span className="badge bg-light text-dark border">
                      <i className="bi bi-people me-1"></i>
                      {tag.contact_count ?? 0}
                    </span>
                  </div>

                  <div className="text-muted small mb-2">
                    <i className="bi bi-calendar3 me-1"></i>
                    Created {tag.created_at ? new Date(tag.created_at).toLocaleDateString() : 'Recently'}
                  </div>
                </div>

                <div className="tag-card-stats">
                  <div className="tag-card-actions">
                    <Link to={`/tags/${tag.id}`} className="tag-btn-action" title="View Tagged Contacts">
                      <i className="bi bi-eye"></i>
                      <span>Contacts</span>
                    </Link>

                    <button
                      type="button"
                      className="tag-btn-action"
                      onClick={() => openEditModal(tag)}
                      title="Edit Tag"
                    >
                      <i className="bi bi-pencil"></i>
                      <span>Edit</span>
                    </button>

                    {canDelete && (
                      <button
                        type="button"
                        className="tag-btn-action delete"
                        onClick={() => setDeletingTag(tag)}
                        title="Delete Tag"
                      >
                        <i className="bi bi-trash"></i>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================= */}
      {/* CREATE / EDIT TAG MODAL */}
      {/* ========================================================= */}
      {showModal && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15,23,42,0.65)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px' }}>
              <div className="modal-header bg-light border-bottom px-4 py-3">
                <div className="d-flex align-items-center gap-2">
                  <div
                    className="p-2 rounded-circle"
                    style={{ backgroundColor: `${tagColor}22`, color: tagColor }}
                  >
                    <i className="bi bi-tag-fill fs-5"></i>
                  </div>
                  <div>
                    <h5 className="modal-title fw-bold text-dark mb-0">
                      {editingTag ? 'Edit Tag' : 'Create New Tag'}
                    </h5>
                    <p className="text-muted small mb-0">
                      {editingTag ? 'Update tag name or color' : 'Define a color-coded tag for contacts'}
                    </p>
                  </div>
                </div>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>

              <form onSubmit={handleSaveTag}>
                <div className="modal-body p-4">
                  {modalError && (
                    <div className="alert alert-danger py-2 px-3 small d-flex align-items-center gap-2 mb-3 rounded-3">
                      <i className="bi bi-exclamation-triangle-fill fs-5"></i>
                      <div>{modalError}</div>
                    </div>
                  )}

                  {/* Tag Name Input */}
                  <div className="mb-3">
                    <label className="form-label small fw-bold">
                      Tag Name <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. VIP Customer, Lead, Warm Prospect"
                      value={tagName}
                      onChange={(e) => setTagName(e.target.value)}
                      maxLength={120}
                      required
                      autoFocus
                    />
                  </div>

                  {/* Color Preset Swatches */}
                  <div className="mb-3">
                    <label className="form-label small fw-bold mb-1">
                      Choose Tag Color
                    </label>
                    <div className="tag-color-swatches mb-2">
                      {PRESET_COLORS.map((c) => (
                        <div
                          key={c}
                          className={`tag-color-swatch-item ${tagColor.toLowerCase() === c.toLowerCase() ? 'selected' : ''}`}
                          style={{ backgroundColor: c }}
                          onClick={() => setTagColor(c)}
                        >
                          {tagColor.toLowerCase() === c.toLowerCase() && <i className="bi bi-check"></i>}
                        </div>
                      ))}
                    </div>

                    <div className="d-flex align-items-center gap-2 mt-2">
                      <input
                        type="color"
                        className="form-control form-control-color"
                        value={tagColor}
                        onChange={(e) => setTagColor(e.target.value)}
                        title="Pick custom hex color"
                      />
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        style={{ maxWidth: '110px' }}
                        value={tagColor}
                        onChange={(e) => setTagColor(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Live Preview */}
                  <div className="p-3 bg-light rounded-3 text-center border">
                    <div className="small text-muted mb-2">Tag Preview:</div>
                    <span
                      className="tag-pill-badge"
                      style={{
                        backgroundColor: `${tagColor}18`,
                        color: tagColor,
                        borderColor: `${tagColor}35`,
                        fontSize: '0.95rem'
                      }}
                    >
                      <span className="tag-dot-circle" style={{ backgroundColor: tagColor }}></span>
                      <span>{tagName.trim() || 'Sample Tag'}</span>
                    </span>
                  </div>
                </div>

                <div className="modal-footer bg-light px-4 py-3">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setShowModal(false)}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn text-white fw-semibold"
                    style={{ backgroundColor: '#7c3aed' }}
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>{editingTag ? 'Update Tag' : 'Create Tag'}</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* DELETE CONFIRM MODAL */}
      {/* ========================================================= */}
      {deletingTag && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15,23,42,0.65)' }}>
          <div className="modal-dialog modal-dialog-centered modal-sm">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px' }}>
              <div className="modal-body p-4 text-center">
                <div className="p-3 bg-danger bg-opacity-10 text-danger rounded-circle d-inline-block mb-3">
                  <i className="bi bi-trash-fill fs-2"></i>
                </div>
                <h5 className="fw-bold text-dark mb-2">Delete Tag?</h5>
                <p className="text-secondary small mb-3">
                  Are you sure you want to delete <strong>"{deletingTag.name}"</strong>? This tag will be removed from all assigned contacts.
                </p>
                <div className="d-flex justify-content-center gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setDeletingTag(null)}
                    disabled={deleting}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={handleDeleteTag}
                    disabled={deleting}
                  >
                    {deleting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
