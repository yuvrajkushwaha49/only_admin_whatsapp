import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import tagsService from '../services/tags.service';
import api from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { encodeHashId } from '../utils/hashId';
import '../styles/dashboard.css';

const PRESET_COLORS = [
  '#7c3aed', // Purple
  '#0d6efd', // Blue
  '#198754', // Green
  '#fd7e14', // Orange
  '#d63384', // Pink
  '#20c997', // Teal
  '#ffc107', // Yellow
  '#0dcaf0'  // Cyan
];

export default function TagDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isSuperAdmin } = useAuth();
  const canDelete = Boolean((isSuperAdmin && isSuperAdmin()) || user?.role === 'superadmin' || user?.role === 'owner');

  const [tag, setTag] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [totalContacts, setTotalContacts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [toastMsg, setToastMsg] = useState(null);

  // Edit Tag Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#7c3aed');
  const [savingEdit, setSavingEdit] = useState(false);

  // Add Contacts Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [availableContacts, setAvailableContacts] = useState([]);
  const [selectedContactIds, setSelectedContactIds] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
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
    // Strictly block direct numeric IDs (e.g. /tags/5) for security
    const strId = String(id || '').trim();
    if (/^\d+$/.test(strId)) {
      setLoading(false);
      setError('Direct numeric tag IDs are disabled for security. Contact tags can only be accessed using verified secure links.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await tagsService.getTagDetail(id, { search });
      if (res.success && res.data) {
        setTag(res.data.tag);
        setContacts(res.data.contacts || []);
        setTotalContacts(res.data.totalContacts || 0);
      }
    } catch (err) {
      console.error('[TagDetail] Error loading detail:', err);
      const errMsg = err.response?.data?.message || 'Failed to load tag details';
      setError(errMsg);
      showToast('danger', errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEdit = () => {
    if (!tag) return;
    setEditName(tag.name);
    setEditColor(tag.color || '#7c3aed');
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editName.trim()) return;

    try {
      setSavingEdit(true);
      await tagsService.updateTag(id, { name: editName.trim(), color: editColor });
      showToast('success', 'Contact tag updated successfully!');
      setShowEditModal(false);
      loadTagDetail();
    } catch (err) {
      showToast('danger', err.response?.data?.message || 'Failed to update tag');
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
      showToast('danger', err.response?.data?.message || 'Failed to delete tag');
      setDeleting(false);
    }
  };

  const handleRemoveContact = async (contactId, contactName) => {
    if (!window.confirm(`Remove tag from ${contactName || 'this contact'}?`)) return;

    try {
      await tagsService.removeContactFromTag(id, contactId);
      showToast('success', 'Contact removed from tag.');
      loadTagDetail();
    } catch (err) {
      showToast('danger', err.response?.data?.message || 'Failed to remove contact from tag');
    }
  };

  const handleOpenAddModal = async () => {
    try {
      setShowAddModal(true);
      setLoadingContacts(true);
      setSelectedContactIds([]);
      setContactSearch('');

      const res = await api.get('/contacts', { params: { limit: 100 } });
      if (res.data?.success) {
        const allContacts = res.data.data || [];
        const existingIds = new Set(contacts.map(c => c.id));
        setAvailableContacts(allContacts.filter(c => !existingIds.has(c.id)));
      }
    } catch (err) {
      showToast('danger', 'Failed to load contacts list');
    } finally {
      setLoadingContacts(false);
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
      showToast('success', `${selectedContactIds.length} contact(s) added to tag!`);
      setShowAddModal(false);
      loadTagDetail();
    } catch (err) {
      showToast('danger', err.response?.data?.message || 'Failed to assign contacts to tag');
    } finally {
      setAddingContacts(false);
    }
  };

  const filteredAvailable = availableContacts.filter(c => {
    if (!contactSearch.trim()) return true;
    const q = contactSearch.toLowerCase();
    return (
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  });

  if (loading && !tag) {
    return (
      <div className="contact-groups-page text-center py-5">
        <div className="spinner-border text-primary" role="status"></div>
      </div>
    );
  }

  if (!tag) {
    const isDirectNumericBlocked = String(error).toLowerCase().includes('numeric');
    return (
      <div className="contact-groups-page text-center py-5">
        <div className="alert alert-danger shadow-sm p-4 text-center rounded-3 d-inline-block" style={{ maxWidth: '480px' }}>
          <i className={`bi ${isDirectNumericBlocked ? 'bi-shield-lock-fill text-warning' : 'bi-exclamation-triangle-fill'} fs-2 mb-2 d-block`}></i>
          <h4>{isDirectNumericBlocked ? 'Direct ID Access Blocked' : 'Tag Not Found'}</h4>
          <p className="text-muted small">{error || 'This tag may have been removed or deleted.'}</p>
          <Link to="/tags" className="btn btn-primary btn-sm mt-2">
            <i className="bi bi-arrow-left me-1"></i> Back to Tags
          </Link>
        </div>
      </div>
    );
  }

  const tagColor = tag.color || '#7c3aed';

  return (
    <div className="contact-groups-page pb-5">
      {/* Toast Alert */}
      {toastMsg && (
        <div
          className={`alert alert-${toastMsg.type} alert-dismissible fade show shadow-sm position-fixed top-0 end-0 m-3 z-3`}
          role="alert"
          style={{ maxWidth: '420px', zIndex: 1080 }}
        >
          <div className="d-flex align-items-center gap-2">
            <i className={`bi ${toastMsg.type === 'success' ? 'bi-check-circle-fill' : 'bi-info-circle-fill'}`}></i>
            <span>{toastMsg.text}</span>
          </div>
          <button type="button" className="btn-close" onClick={() => setToastMsg(null)}></button>
        </div>
      )}

      <div className="cg-page-container">
        {/* Back Navigation Bar */}
        <div className="mb-3">
          <Link to="/tags" className="text-secondary text-decoration-none fw-semibold small d-inline-flex align-items-center gap-1">
            <i className="bi bi-arrow-left"></i>
            <span>Back to All Tags</span>
          </Link>
        </div>

        {/* Selected Tag Detail Section (Matching Contact Groups activeGroupDetail) */}
        <div className="cg-card">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-3">
            <div className="d-flex align-items-center gap-2">
              <span
                className="rounded-circle d-inline-block"
                style={{ width: '14px', height: '14px', backgroundColor: tagColor }}
              ></span>
              <h3 className="cg-card-title mb-0">
                {tag.name} ({totalContacts} {totalContacts === 1 ? 'Member' : 'Members'})
              </h3>
            </div>

            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                onClick={handleOpenAddModal}
                className="cg-hero-btn-create py-2 px-3"
              >
                <i className="bi bi-person-plus-fill"></i>
                <span>Add Contacts to Tag</span>
              </button>

              <button
                type="button"
                className="btn btn-outline-secondary py-2 px-3"
                style={{ borderRadius: '10px' }}
                onClick={handleOpenEdit}
                title="Edit Tag"
              >
                <i className="bi bi-pencil"></i>
                <span className="ms-1">Edit</span>
              </button>

              {canDelete && (
                <button
                  type="button"
                  className="btn btn-outline-danger py-2 px-3"
                  style={{ borderRadius: '10px' }}
                  onClick={() => setShowDeleteConfirm(true)}
                  title="Delete Tag"
                >
                  <i className="bi bi-trash3"></i>
                </button>
              )}
            </div>
          </div>

          {/* Search Contacts in Tag */}
          <div className="mb-3" style={{ maxWidth: '340px' }}>
            <div className="cg-search-box" style={{ minWidth: '100%' }}>
              <i className="bi bi-search cg-search-icon"></i>
              <input
                type="text"
                className="cg-search-input"
                placeholder="Search tagged contacts..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="table-responsive">
            <table className="table cf-table mb-0 align-middle">
              <thead>
                <tr>
                  <th>Contact Name</th>
                  <th>Phone Number</th>
                  <th>Email</th>
                  <th>Consent Status</th>
                  <th>Tagged Date</th>
                  <th className="text-end">Action</th>
                </tr>
              </thead>
              <tbody>
                {contacts.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-5 text-muted">
                      No contacts in this tag yet. Click <strong>"Add Contacts to Tag"</strong> above to assign contacts!
                    </td>
                  </tr>
                ) : (
                  contacts.map(c => (
                    <tr key={c.id}>
                      <td>
                        <Link to={`/contacts/${c.hash_id || encodeHashId(c.id)}`} className="fw-semibold text-dark text-decoration-none">
                          {c.name || 'Anonymous Customer'}
                        </Link>
                      </td>
                      <td>
                        <code className="text-dark fw-bold">{c.phone}</code>
                      </td>
                      <td className="small text-muted">{c.email || '-'}</td>
                      <td>
                        {c.is_opted_in ? (
                          <span className="badge bg-success-subtle text-success border border-success-subtle">
                            Opted In
                          </span>
                        ) : (
                          <span className="badge bg-secondary-subtle text-secondary border">
                            Opted Out
                          </span>
                        )}
                      </td>
                      <td className="small text-muted">
                        {c.tagged_at ? new Date(c.tagged_at).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="text-end">
                        <button
                          type="button"
                          onClick={() => handleRemoveContact(c.id, c.name)}
                          className="btn btn-sm btn-outline-danger"
                          style={{ borderRadius: '6px' }}
                          title="Remove from tag"
                        >
                          <i className="bi bi-x-circle me-1"></i> Remove
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* ADD CONTACTS TO TAG MODAL (Matching Contact Groups Modal) */}
      {/* ========================================================= */}
      {showAddModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">Add Contacts to Tag</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowAddModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search available contacts..."
                    value={contactSearch}
                    onChange={e => setContactSearch(e.target.value)}
                  />
                </div>

                {loadingContacts ? (
                  <div className="text-center py-4">
                    <div className="spinner-border spinner-border-sm text-success" role="status"></div>
                    <div className="text-muted small mt-2">Loading contacts...</div>
                  </div>
                ) : filteredAvailable.length === 0 ? (
                  <div className="text-center py-4 text-muted">
                    No available contacts to add (or all matching contacts are already in this tag).
                  </div>
                ) : (
                  <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    <div className="list-group">
                      {filteredAvailable.map(c => {
                        const isChecked = selectedContactIds.includes(c.id);
                        return (
                          <label
                            key={c.id}
                            className={`list-group-item list-group-item-action d-flex align-items-center gap-3 ${isChecked ? 'bg-light' : ''}`}
                            style={{ cursor: 'pointer' }}
                          >
                            <input
                              type="checkbox"
                              className="form-check-input mt-0"
                              checked={isChecked}
                              onChange={() => handleToggleSelectContact(c.id)}
                            />
                            <div className="flex-grow-1">
                              <div className="fw-semibold text-dark">{c.name || 'Anonymous Customer'}</div>
                              <div className="small text-muted">{c.phone} {c.email ? `• ${c.email}` : ''}</div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer justify-content-between">
                <div className="small text-muted">
                  {selectedContactIds.length} contact(s) selected
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
                    disabled={addingContacts || selectedContactIds.length === 0}
                    onClick={handleAddSelectedContacts}
                    className="btn btn-cf-primary text-white"
                    style={{ backgroundColor: '#7c3aed', borderColor: '#7c3aed' }}
                  >
                    {addingContacts ? 'Adding...' : `Add Selected (${selectedContactIds.length})`}
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
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <form onSubmit={handleSaveEdit}>
                <div className="modal-header">
                  <h5 className="modal-title fw-bold">Edit Contact Tag</h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setShowEditModal(false)}
                  ></button>
                </div>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Tag Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Tag Color</label>
                    <div className="d-flex align-items-center gap-2 flex-wrap mb-2">
                      {PRESET_COLORS.map(c => (
                        <button
                          key={c}
                          type="button"
                          className="rounded-circle border-0 d-inline-block"
                          style={{
                            width: '28px',
                            height: '28px',
                            backgroundColor: c,
                            outline: editColor.toLowerCase() === c.toLowerCase() ? '3px solid #000' : 'none',
                            outlineOffset: '2px',
                            cursor: 'pointer'
                          }}
                          onClick={() => setEditColor(c)}
                        ></button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
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
                    disabled={savingEdit}
                    className="btn btn-cf-primary text-white"
                    style={{ backgroundColor: '#7c3aed', borderColor: '#7c3aed' }}
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
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header">
                <h5 className="modal-title fw-bold text-danger">Delete Contact Tag</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowDeleteConfirm(false)}
                ></button>
              </div>
              <div className="modal-body">
                <p className="text-muted mb-2">
                  Are you sure you want to delete the tag <strong>"{tag.name}"</strong>?
                </p>
                <div className="small text-danger">
                  <i className="bi bi-exclamation-triangle-fill me-1"></i>
                  The tag will be removed from all assigned contacts. Contacts belonging to this tag will <strong>not</strong> be deleted from your database.
                </div>
              </div>
              <div className="modal-footer">
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
                  {deleting ? 'Deleting...' : 'Delete Tag'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
