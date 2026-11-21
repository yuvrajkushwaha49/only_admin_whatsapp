import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import tagsService from '../services/tags.service';
import api from '../services/api';
import { useAuth } from '../hooks/useAuth';
import '../styles/tags.css';

export default function TagDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isSuperAdmin } = useAuth();
  const canDelete = Boolean((isSuperAdmin && isSuperAdmin()) || user?.role === 'superadmin' || user?.role === 'owner');

  const [tag, setTag] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [totalContacts, setTotalContacts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toastMsg, setToastMsg] = useState(null);

  // Edit Tag Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#7c3aed');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  // Add Contacts Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [directoryContacts, setDirectoryContacts] = useState([]);
  const [selectedContactIds, setSelectedContactIds] = useState([]);
  const [loadingDirectory, setLoadingDirectory] = useState(false);
  const [addingContacts, setAddingContacts] = useState(false);
  const [contactSearch, setContactSearch] = useState('');

  // Delete Tag Confirm Modal
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadTagDetail();
  }, [id, search]);

  const showToast = (type, text) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const loadTagDetail = async () => {
    try {
      setLoading(true);
      const res = await tagsService.getTagDetail(id, { search });
      if (res.success && res.data) {
        setTag(res.data.tag);
        setContacts(res.data.contacts || []);
        setTotalContacts(res.data.totalContacts || 0);
      }
    } catch (err) {
      console.error('[TagDetail] Error loading detail:', err);
      showToast('danger', err.response?.data?.message || 'Failed to load tag details');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEdit = () => {
    if (!tag) return;
    setEditName(tag.name);
    setEditColor(tag.color || '#7c3aed');
    setEditError('');
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editName.trim()) return;

    try {
      setSavingEdit(true);
      await tagsService.updateTag(id, { name: editName.trim(), color: editColor });
      showToast('success', 'Tag updated successfully');
      setShowEditModal(false);
      loadTagDetail();
    } catch (err) {
      console.error('[TagDetail] Update failed:', err);
      setEditError(err.response?.data?.message || 'Failed to update tag');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteTag = async () => {
    try {
      setDeleting(true);
      await tagsService.deleteTag(id);
      navigate('/tags', { replace: true });
    } catch (err) {
      console.error('[TagDetail] Delete failed:', err);
      showToast('danger', err.response?.data?.message || 'Failed to delete tag');
      setDeleting(false);
    }
  };

  const handleRemoveContact = async (contactId, contactName) => {
    if (!window.confirm(`Remove tag from ${contactName || 'this contact'}?`)) return;

    try {
      await tagsService.removeContactFromTag(id, contactId);
      showToast('success', 'Contact removed from tag');
      loadTagDetail();
    } catch (err) {
      console.error('[TagDetail] Remove contact failed:', err);
      showToast('danger', err.response?.data?.message || 'Failed to remove contact from tag');
    }
  };

  const handleOpenAddModal = async () => {
    try {
      setShowAddModal(true);
      setLoadingDirectory(true);
      setSelectedContactIds([]);
      setContactSearch('');

      const res = await api.get('/contacts', { params: { limit: 100 } });
      if (res.data?.success) {
        const allContacts = res.data.data || [];
        const existingIds = new Set(contacts.map(c => c.id));
        setDirectoryContacts(allContacts.filter(c => !existingIds.has(c.id)));
      }
    } catch (err) {
      console.error('[TagDetail] Load contacts failed:', err);
    } finally {
      setLoadingDirectory(false);
    }
  };

  const handleToggleSelectContact = (cId) => {
    setSelectedContactIds(prev =>
      prev.includes(cId) ? prev.filter(x => x !== cId) : [...prev, cId]
    );
  };

  const handleAddSelectedContacts = async () => {
    if (selectedContactIds.length === 0) return;

    try {
      setAddingContacts(true);
      await tagsService.addContactsToTag(id, selectedContactIds);
      showToast('success', `Assigned tag to ${selectedContactIds.length} contacts`);
      setShowAddModal(false);
      loadTagDetail();
    } catch (err) {
      console.error('[TagDetail] Add contacts failed:', err);
      showToast('danger', err.response?.data?.message || 'Failed to assign tag');
    } finally {
      setAddingContacts(false);
    }
  };

  const filteredDirectory = directoryContacts.filter(c => {
    if (!contactSearch.trim()) return true;
    const q = contactSearch.toLowerCase();
    return (
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  });

  const PRESET_COLORS = ['#7c3aed', '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#6366f1'];

  if (loading && !tag) {
    return (
      <div className="tag-page-container d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
        <div className="spinner-border text-primary" role="status"></div>
      </div>
    );
  }

  if (!tag) {
    return (
      <div className="tag-page-container text-center py-5">
        <h4 className="fw-bold mb-3">Tag Not Found</h4>
        <Link to="/tags" className="btn btn-outline-primary">
          &larr; Back to Tags
        </Link>
      </div>
    );
  }

  const tagColor = tag.color || '#7c3aed';
  const optedInCount = contacts.filter(c => c.is_opted_in).length;

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

      {/* Back Link */}
      <div className="mb-3">
        <Link to="/tags" className="text-secondary text-decoration-none fw-semibold small d-inline-flex align-items-center gap-1">
          <i className="bi bi-arrow-left"></i>
          <span>Back to All Tags</span>
        </Link>
      </div>

      {/* Tag Detail Top Header Banner */}
      <div className="tag-detail-banner">
        <div className="tag-detail-info">
          <span
            className="tag-detail-pill"
            style={{
              backgroundColor: `${tagColor}18`,
              color: tagColor,
              borderColor: `${tagColor}40`
            }}
          >
            <span className="tag-dot-circle" style={{ backgroundColor: tagColor, width: '14px', height: '14px' }}></span>
            <span>{tag.name}</span>
          </span>

          <div className="d-flex align-items-center gap-3 text-secondary small">
            <div>
              <i className="bi bi-people-fill text-primary me-1"></i>
              <strong>{totalContacts}</strong> contact{totalContacts === 1 ? '' : 's'}
            </div>
            <div>
              <i className="bi bi-patch-check-fill text-success me-1"></i>
              <strong>{optedInCount}</strong> opted-in
            </div>
            <div>
              <i className="bi bi-clock-history me-1"></i>
              Created {tag.created_at ? new Date(tag.created_at).toLocaleDateString() : 'Recently'}
            </div>
          </div>
        </div>

        <div className="tag-detail-actions">
          <button className="tag-primary-btn" onClick={handleOpenAddModal}>
            <i className="bi bi-person-plus-fill"></i>
            <span>+ Add Contacts to Tag</span>
          </button>

          <button
            type="button"
            className="btn btn-outline-secondary d-inline-flex align-items-center gap-1"
            style={{ borderRadius: '10px' }}
            onClick={handleOpenEdit}
          >
            <i className="bi bi-pencil"></i>
            <span>Edit</span>
          </button>

          {canDelete && (
            <button
              type="button"
              className="btn btn-outline-danger d-inline-flex align-items-center gap-1"
              style={{ borderRadius: '10px' }}
              onClick={() => setShowDeleteConfirm(true)}
            >
              <i className="bi bi-trash"></i>
              <span>Delete</span>
            </button>
          )}
        </div>
      </div>

      {/* Tagged Contacts Table Card */}
      <div className="tag-contacts-card">
        <div className="tag-contacts-head">
          <h5 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
            <i className="bi bi-person-lines-fill text-primary"></i>
            <span>Tagged Contacts ({totalContacts})</span>
          </h5>

          <div className="tag-search-box" style={{ maxWidth: '320px' }}>
            <i className="bi bi-search"></i>
            <input
              type="text"
              className="tag-search-input"
              placeholder="Search contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {contacts.length === 0 ? (
          <div className="tag-empty-state">
            <i className="bi bi-people tag-empty-icon"></i>
            <h5 className="fw-bold text-dark mb-2">No Contacts In This Tag</h5>
            <p className="text-secondary small mb-3">
              {search ? 'No contacts match your search query.' : 'Assign contacts from your directory to this tag.'}
            </p>
            <button className="tag-primary-btn mx-auto" onClick={handleOpenAddModal}>
              <i className="bi bi-person-plus-fill"></i> + Add Contacts
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="tag-contacts-table">
              <thead>
                <tr>
                  <th>Contact</th>
                  <th>Phone Number</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Tagged Date</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => {
                  const initial = (c.name || c.phone || 'C').charAt(0).toUpperCase();
                  return (
                    <tr key={c.id}>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <div className="tag-contact-avatar">{initial}</div>
                          <div>
                            <div className="fw-bold text-dark">{c.name || 'Unnamed'}</div>
                            <div className="text-muted small">ID: #{c.id}</div>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className="fw-semibold text-dark">{c.phone}</span>
                      </td>

                      <td>
                        <span className="text-secondary">{c.email || '—'}</span>
                      </td>

                      <td>
                        {c.is_opted_in ? (
                          <span className="badge bg-success bg-opacity-10 text-success border border-success-subtle">
                            <i className="bi bi-check-circle-fill me-1"></i> Opted-In
                          </span>
                        ) : (
                          <span className="badge bg-secondary bg-opacity-10 text-secondary">
                            Not Opted-In
                          </span>
                        )}
                      </td>

                      <td>
                        <span className="text-muted small">
                          {c.tagged_at ? new Date(c.tagged_at).toLocaleDateString() : '—'}
                        </span>
                      </td>

                      <td className="text-end">
                        <div className="d-inline-flex align-items-center gap-2">
                          <Link
                            to={`/contacts/${c.id}`}
                            className="btn btn-sm btn-outline-primary"
                            style={{ borderRadius: '6px' }}
                            title="View Contact Profile"
                          >
                            <i className="bi bi-person"></i> View
                          </Link>

                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            style={{ borderRadius: '6px' }}
                            onClick={() => handleRemoveContact(c.id, c.name)}
                            title="Remove Tag from Contact"
                          >
                            <i className="bi bi-x-lg"></i>
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
      </div>

      {/* ========================================================= */}
      {/* ADD CONTACTS MODAL */}
      {/* ========================================================= */}
      {showAddModal && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15,23,42,0.65)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px' }}>
              <div className="modal-header bg-light border-bottom px-4 py-3">
                <div className="d-flex align-items-center gap-2">
                  <div
                    className="p-2 rounded-circle"
                    style={{ backgroundColor: `${tagColor}20`, color: tagColor }}
                  >
                    <i className="bi bi-person-plus-fill fs-5"></i>
                  </div>
                  <div>
                    <h5 className="modal-title fw-bold text-dark mb-0">Assign Tag to Contacts</h5>
                    <p className="text-muted small mb-0">
                      Select contacts to tag with <strong>"{tag.name}"</strong>
                    </p>
                  </div>
                </div>
                <button type="button" className="btn-close" onClick={() => setShowAddModal(false)}></button>
              </div>

              <div className="modal-body p-4">
                <div className="mb-3">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search available contacts by name, phone or email..."
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                  />
                </div>

                {loadingDirectory ? (
                  <div className="text-center py-4">
                    <div className="spinner-border spinner-border-sm text-primary" role="status"></div>
                    <div className="small text-muted mt-2">Loading contacts...</div>
                  </div>
                ) : filteredDirectory.length === 0 ? (
                  <div className="text-center py-4 text-muted small">
                    {contactSearch ? 'No matching contacts found.' : 'All contacts in your workspace already have this tag.'}
                  </div>
                ) : (
                  <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                    <div className="list-group">
                      {filteredDirectory.map((c) => {
                        const isChecked = selectedContactIds.includes(c.id);
                        return (
                          <label
                            key={c.id}
                            className={`list-group-item list-group-item-action d-flex align-items-center gap-3 cursor-pointer ${isChecked ? 'bg-light' : ''}`}
                            style={{ cursor: 'pointer' }}
                          >
                            <input
                              type="checkbox"
                              className="form-check-input mt-0"
                              checked={isChecked}
                              onChange={() => handleToggleSelectContact(c.id)}
                            />
                            <div className="flex-grow-1">
                              <div className="fw-bold text-dark">{c.name || 'Unnamed'}</div>
                              <div className="text-muted small">
                                {c.phone} {c.email ? `• ${c.email}` : ''}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer bg-light px-4 py-3 justify-content-between">
                <div className="small text-muted">
                  <strong>{selectedContactIds.length}</strong> selected
                </div>
                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setShowAddModal(false)}
                    disabled={addingContacts}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn text-white fw-semibold"
                    style={{ backgroundColor: '#7c3aed' }}
                    onClick={handleAddSelectedContacts}
                    disabled={addingContacts || selectedContactIds.length === 0}
                  >
                    {addingContacts ? 'Assigning...' : `Add Selected (${selectedContactIds.length})`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* EDIT TAG MODAL */}
      {/* ========================================================= */}
      {showEditModal && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15,23,42,0.65)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px' }}>
              <div className="modal-header bg-light border-bottom px-4 py-3">
                <h5 className="modal-title fw-bold text-dark mb-0">Edit Tag</h5>
                <button type="button" className="btn-close" onClick={() => setShowEditModal(false)}></button>
              </div>

              <form onSubmit={handleSaveEdit}>
                <div className="modal-body p-4">
                  {editError && (
                    <div className="alert alert-danger py-2 px-3 small d-flex align-items-center gap-2 mb-3 rounded-3">
                      <i className="bi bi-exclamation-triangle-fill fs-5"></i>
                      <div>{editError}</div>
                    </div>
                  )}

                  <div className="mb-3">
                    <label className="form-label small fw-bold">Tag Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-bold mb-1">Color</label>
                    <div className="tag-color-swatches mb-2">
                      {PRESET_COLORS.map((c) => (
                        <div
                          key={c}
                          className={`tag-color-swatch-item ${editColor.toLowerCase() === c.toLowerCase() ? 'selected' : ''}`}
                          style={{ backgroundColor: c }}
                          onClick={() => setEditColor(c)}
                        >
                          {editColor.toLowerCase() === c.toLowerCase() && <i className="bi bi-check"></i>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="modal-footer bg-light px-4 py-3">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setShowEditModal(false)}
                    disabled={savingEdit}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn text-white fw-semibold"
                    style={{ backgroundColor: '#7c3aed' }}
                    disabled={savingEdit}
                  >
                    {savingEdit ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* DELETE TAG CONFIRM MODAL */}
      {/* ========================================================= */}
      {showDeleteConfirm && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15,23,42,0.65)' }}>
          <div className="modal-dialog modal-dialog-centered modal-sm">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px' }}>
              <div className="modal-body p-4 text-center">
                <div className="p-3 bg-danger bg-opacity-10 text-danger rounded-circle d-inline-block mb-3">
                  <i className="bi bi-trash-fill fs-2"></i>
                </div>
                <h5 className="fw-bold text-dark mb-2">Delete Tag?</h5>
                <p className="text-secondary small mb-3">
                  Are you sure you want to delete <strong>"{tag.name}"</strong>? It will be unassigned from all {totalContacts} contacts.
                </p>
                <div className="d-flex justify-content-center gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setShowDeleteConfirm(false)}
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
