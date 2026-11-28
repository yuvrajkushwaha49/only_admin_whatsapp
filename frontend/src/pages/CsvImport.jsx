import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../services/api';
import AiwavoHeader from '../components/AiwavoHeader';
import { useAuth } from '../hooks/useAuth';
import '../styles/dashboard.css';

const SAMPLE_CSV = `phone,name,email,consent
9811122233,Ananya Gupta,ananya@test.com,yes
9822233344,Vikram Malhotra,vikram@test.com,yes
9833344455,Sunita Rao,sunita@test.com,yes
9844455566,Rohan Mehra,rohan@test.com,yes
9844455566,Rohan Duplicate,rohan@test.com,yes
9877700011,Karan Johar,karan@test.com,yes`;

export default function CsvImport() {
  const { user, isSuperAdmin } = useAuth();
  const canDelete = Boolean((isSuperAdmin && isSuperAdmin()) || user?.role === 'superadmin' || user?.role === 'owner');
  const outletContext = useOutletContext();
  const onToggleSidebar = outletContext?.onToggleSidebar;
  const fileInputRef = useRef(null);

  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [fileKey, setFileKey] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileType, setFileType] = useState('csv');
  const [fileSize, setFileSize] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [csvText, setCsvText] = useState('');

  const [headers, setHeaders] = useState([]);
  const [sampleRows, setSampleRows] = useState([]);
  const [totalEstimatedRows, setTotalEstimatedRows] = useState(0);

  const [columnMapping, setColumnMapping] = useState({
    phone: '',
    name: '',
    email: '',
    tag: '',
    consent: ''
  });

  const [batchTag, setBatchTag] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [availableTags, setAvailableTags] = useState([]);
  const [availableGroups, setAvailableGroups] = useState([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [showNewGroupInput, setShowNewGroupInput] = useState(false);

  const [importResult, setImportResult] = useState(null);
  const [importHistory, setImportHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Delete modal state
  const [deleteTargetJob, setDeleteTargetJob] = useState(null);
  const [alsoDeleteContacts, setAlsoDeleteContacts] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Change Tag modal state
  const [editTagTargetJob, setEditTagTargetJob] = useState(null);
  const [newTagInput, setNewTagInput] = useState('');
  const [replaceOldTag, setReplaceOldTag] = useState(true);
  const [updatingTag, setUpdatingTag] = useState(false);

  useEffect(() => {
    fetchHistory();
    fetchTags();
    fetchGroups();
  }, []);

  // Polling for active background import job progress
  useEffect(() => {
    let timer = null;
    const activeJobId = importResult?.id || importResult?.jobId;
    const isProcessing = importResult?.status === 'processing' || importResult?.status === 'pending';

    if (activeJobId && isProcessing) {
      timer = setInterval(async () => {
        try {
          const res = await api.get(`/imports/${activeJobId}`);
          if (res.data?.success && res.data.data) {
            const job = res.data.data;
            setImportResult(prev => ({
              ...prev,
              ...job,
              totalRows: job.total_rows,
              processedRows: job.processed_rows,
              successful: job.successful_rows,
              duplicates: job.duplicate_rows,
              failed: job.failed_rows,
              status: job.status
            }));

            if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
              clearInterval(timer);
              // Fetch error rows audit report
              try {
                const errRes = await api.get(`/imports/${activeJobId}/errors`);
                if (errRes.data?.success) {
                  setImportResult(prev => ({
                    ...prev,
                    rowReports: errRes.data.data || []
                  }));
                }
              } catch (_) {}
              fetchHistory();
            }
          }
        } catch (e) {
          console.warn('[Imports] Polling error:', e);
        }
      }, 1500);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [importResult?.id, importResult?.jobId, importResult?.status]);

  const fetchTags = async () => {
    try {
      const res = await api.get('/contacts/tags');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setAvailableTags(res.data.data);
      }
    } catch (err) {
      console.warn('Failed to load existing tags', err);
    }
  };

  const fetchGroups = async () => {
    try {
      const res = await api.get('/contact-groups');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setAvailableGroups(res.data.data);
      }
    } catch (err) {
      console.warn('Failed to load contact groups', err);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await api.get('/imports');
      if (res.data?.success) setImportHistory(res.data.data);
    } catch (err) {
      console.error('Failed to load import history', err);
    }
  };

  // Drag and Drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelected(droppedFile);
    }
  };

  const handleFileInputChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      handleFileSelected(selected);
    }
  };

  const handleFileSelected = (selectedFile) => {
    const allowed = ['.csv', '.xlsx', '.xls'];
    const name = selectedFile.name.toLowerCase();
    const isAllowed = allowed.some(ext => name.endsWith(ext));

    if (!isAllowed) {
      setError('Please select a valid CSV (.csv) or Excel (.xlsx / .xls) file.');
      return;
    }

    if (selectedFile.size > 104857600) { // 100MB limit
      setError('File size exceeds the 100MB limit. Please upload a smaller file.');
      return;
    }

    setError('');
    setFile(selectedFile);
    setFileName(selectedFile.name);
    setFileSize(selectedFile.size);
    setFileType(name.endsWith('.xlsx') || name.endsWith('.xls') ? 'xlsx' : 'csv');
  };

  // Upload file and get streaming preview (Step 1 -> Step 2)
  const handleUploadAndPreview = async () => {
    if (!file && !csvText.trim()) {
      setError('Please choose an Excel/CSV file or paste CSV text to continue.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      if (file) {
        // Multipart file upload with streaming preview
        const formData = new FormData();
        formData.append('file', file);

        const res = await api.post('/imports/upload-preview', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (res.data?.success) {
          const d = res.data.data;
          setFileKey(d.fileKey);
          setHeaders(d.headers);
          setSampleRows(d.sampleRows);
          setTotalEstimatedRows(d.totalEstimatedRows);
          setColumnMapping({
            phone: d.mappingSuggestions.phone || d.headers[0] || '',
            name: d.mappingSuggestions.name || '',
            email: d.mappingSuggestions.email || '',
            tag: d.mappingSuggestions.tag || '',
            consent: d.mappingSuggestions.consent || ''
          });
          setStep(2);
        }
      } else {
        // Raw CSV text fallback
        const res = await api.post('/imports/preview', { csvText });
        if (res.data?.success) {
          setHeaders(res.data.data.headers);
          setSampleRows(res.data.data.sample);
          setTotalEstimatedRows(res.data.data.totalRows);
          setColumnMapping({
            phone: res.data.data.mappingSuggestions.phone || res.data.data.headers[0] || '',
            name: res.data.data.mappingSuggestions.name || '',
            email: res.data.data.mappingSuggestions.email || '',
            tag: res.data.data.mappingSuggestions.tag || '',
            consent: res.data.data.mappingSuggestions.consent || ''
          });
          setStep(2);
        }
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to analyze file. Please ensure the file is valid.');
    } finally {
      setLoading(false);
    }
  };

  // Queue import job (Step 2 -> Step 3)
  const handleCreateImportJob = async () => {
    if (!columnMapping.phone) {
      setError('Please select which column contains the Phone Number.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      let finalGroupId = selectedGroupId ? Number(selectedGroupId) : null;

      // If user typed a new group name, create it first
      if (showNewGroupInput && newGroupName.trim()) {
        try {
          const gRes = await api.post('/contact-groups', {
            name: newGroupName.trim(),
            description: `Auto-created during import of ${fileName || 'contacts'}`
          });
          if (gRes.data?.success && gRes.data.data) {
            finalGroupId = gRes.data.data.id;
          }
        } catch (gErr) {
          console.warn('Failed to create new group, proceeding without group:', gErr);
        }
      }

      let res;
      if (fileKey) {
        // Clean high-performance background queue
        res = await api.post('/imports/create-job', {
          fileKey,
          fileName,
          columnMapping,
          batchTag: batchTag.trim(),
          groupId: finalGroupId,
          consentSource: 'excel_csv_batch',
          defaultCountryCode: '91'
        });
      } else {
        // Raw text fallback
        res = await api.post('/imports/execute', {
          csvText,
          fileName: fileName || 'contacts.csv',
          columnMapping,
          batchTag: batchTag.trim(),
          groupId: finalGroupId,
          consentSource: 'csv_upload_batch',
          defaultCountryCode: '91'
        });
      }

      if (res.data?.success) {
        setImportResult(res.data.data);
        setStep(3);
        fetchHistory();
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to start import job.');
    } finally {
      setLoading(false);
    }
  };

  const handleRetryJob = async (jobId) => {
    try {
      setError('');
      setLoading(true);
      const res = await api.post(`/imports/${jobId}/retry`);
      if (res.data?.success) {
        setSuccessMsg(`Job #${jobId} re-queued successfully.`);
        fetchHistory();
        // If retrying active job in view, update state
        if (importResult?.id === jobId) {
          setImportResult(prev => ({ ...prev, status: 'pending', processed_rows: 0 }));
        }
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to retry job.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelJob = async (jobId) => {
    try {
      const res = await api.post(`/imports/${jobId}/cancel`);
      if (res.data?.success) {
        fetchHistory();
        if (importResult?.id === jobId) {
          setImportResult(prev => ({ ...prev, status: 'cancelled' }));
        }
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to cancel job.');
    }
  };

  const confirmDeleteJob = async () => {
    if (!deleteTargetJob) return;
    try {
      setDeleting(true);
      setError('');
      const res = await api.delete(`/imports/${deleteTargetJob.id}?deleteContacts=${alsoDeleteContacts}`);
      if (res.data?.success) {
        setSuccessMsg(res.data.message || 'Import record deleted successfully.');
        fetchHistory();
        if (importResult?.id === deleteTargetJob.id) {
          setImportResult(null);
          setStep(1);
        }
        setDeleteTargetJob(null);
        setAlsoDeleteContacts(false);
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to delete import job.');
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenEditTag = (job) => {
    setEditTagTargetJob(job);
    const currentTag = job.options?.batchTag || '';
    setNewTagInput(currentTag);
    setReplaceOldTag(true);
  };

  const confirmUpdateTag = async () => {
    if (!editTagTargetJob || !newTagInput.trim()) return;
    try {
      setUpdatingTag(true);
      setError('');
      const res = await api.patch(`/imports/${editTagTargetJob.id}/tag`, {
        newTag: newTagInput.trim(),
        replaceOldTag
      });
      if (res.data?.success) {
        setSuccessMsg(res.data.message || 'Tag updated successfully!');
        fetchHistory();
        fetchTags();
        setEditTagTargetJob(null);
        setNewTagInput('');
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to update tag.');
    } finally {
      setUpdatingTag(false);
    }
  };

  const handleDownloadErrorReport = (jobId) => {
    const targetId = jobId || importResult?.id || importResult?.jobId;
    if (!targetId) return;
    window.open(`/api/imports/${targetId}/export-errors`, '_blank');
  };

  const loadSampleData = () => {
    setCsvText(SAMPLE_CSV);
    setFileName('sample_festive_audience.csv');
    setFile(null);
    setFileKey('');
  };

  const handleDownloadSampleCsv = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_audience_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div>
      <AiwavoHeader
        title="Contacts"
        subtitle="High-performance bulk contact ingestion (up to 100,000 records) with streaming, E.164 normalization, deduplication & audit trail"
        onToggleSidebar={onToggleSidebar}
      />

      <div className="em-page-container">
        {error && (
          <div className="alert alert-danger alert-dismissible fade show mb-4 rounded-3 shadow-sm" role="alert">
            <i className="bi bi-exclamation-triangle-fill me-2"></i>
            {error}
            <button type="button" className="btn-close" onClick={() => setError('')}></button>
          </div>
        )}

        {successMsg && (
          <div className="alert alert-success alert-dismissible fade show mb-4 rounded-3 shadow-sm" role="alert">
            <i className="bi bi-check-circle-fill me-2"></i>
            {successMsg}
            <button type="button" className="btn-close" onClick={() => setSuccessMsg('')}></button>
          </div>
        )}

        {/* Top Hero Banner */}
        <div className="em-hero-banner">
          <div className="em-hero-left">
            <div className="em-hero-icon">
              <i className="bi bi-file-earmark-excel"></i>
            </div>
            <div>
              <h1 className="em-hero-title">Manage Excel & CSV Import</h1>
              <p className="em-hero-subtitle">
                High-scale contact ingestion (up to 100,000 contacts) with streaming XLSX/CSV, background queue, group assignment, and duplicate protection.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDownloadSampleCsv}
            className="em-hero-btn-blue"
          >
            <i className="bi bi-download"></i>
            <span>Download Sample CSV Template</span>
          </button>
        </div>

        {/* Wizard Stepper */}
        <div className="em-stepper-wrap">
          <div className="em-stepper-line">
            <div
              className="em-stepper-line-progress"
              style={{
                width: step === 1 ? '16%' : step === 2 ? '50%' : '100%'
              }}
            ></div>
          </div>

          <div className="em-step-item">
            <div className={`em-step-circle ${step === 1 ? 'active' : step > 1 ? 'completed' : ''}`}>
              {step > 1 ? <i className="bi bi-check-lg"></i> : '1'}
            </div>
            <div className={`em-step-label ${step === 1 ? 'active' : ''}`}>Upload File</div>
          </div>

          <div className="em-step-item">
            <div className={`em-step-circle ${step === 2 ? 'active' : step > 2 ? 'completed' : ''}`}>
              {step > 2 ? <i className="bi bi-check-lg"></i> : '2'}
            </div>
            <div className={`em-step-label ${step === 2 ? 'active' : ''}`}>Column Mapping & Options</div>
          </div>

          <div className="em-step-item">
            <div className={`em-step-circle ${step === 3 ? 'active' : ''}`}>
              3
            </div>
            <div className={`em-step-label ${step === 3 ? 'active' : ''}`}>Live Progress & Results</div>
          </div>
        </div>

        {/* Step 1: Upload File */}
        {step === 1 && (
          <div className="em-card">
            <div className="em-card-header">
              <div>
                <h2 className="em-card-title">Step 1: Upload Contact File (Excel or CSV)</h2>
                <div className="text-muted small mt-1">Supports .xlsx, .xls, and .csv files up to 100,000 rows</div>
              </div>
              <div className="d-flex align-items-center gap-2">
                <button
                  type="button"
                  onClick={loadSampleData}
                  className="em-btn-sample-green"
                >
                  <i className="bi bi-lightning-charge-fill"></i>
                  <span>Load Sample Data</span>
                </button>
              </div>
            </div>

            {/* Drag & Drop File Zone */}
            <div
              className={`em-dropzone ${isDragging ? 'border-primary bg-light' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="em-dropzone-badge">
                <i className={`bi ${fileType === 'xlsx' ? 'bi-filetype-xlsx' : 'bi-filetype-csv'} fs-4`}></i>
              </div>
              <div className="em-dropzone-title">
                {file ? file.name : 'Drag & Drop your Excel or CSV file here'}
              </div>
              <div className="em-dropzone-desc">
                {file ? (
                  <span className="text-success fw-bold">
                    <i className="bi bi-check2-circle me-1"></i>
                    {formatFileSize(fileSize)} &bull; Ready for streaming preview
                  </span>
                ) : (
                  'Supports Microsoft Excel (.xlsx, .xls) and Comma-Separated Values (.csv) up to 100MB'
                )}
              </div>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileInputChange}
                accept=".csv, .xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, text/csv"
                style={{ display: 'none' }}
              />

              <div className="em-file-input-group">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="em-file-choose-btn"
                >
                  <i className="bi bi-folder2-open"></i>
                  <span>Browse Files</span>
                </button>
                <div className="em-file-status-box">
                  {file ? file.name : 'No file chosen'}
                </div>
              </div>
            </div>

            {/* Raw CSV Textarea Fallback */}
            <div className="mb-4">
              <label className="em-raw-label">Or Paste Raw CSV Text directly:</label>
              <textarea
                className="em-textarea"
                rows="5"
                placeholder="phone,name,email,consent&#10;9811122233,Ananya Gupta,ananya@test.com,yes..."
                value={csvText}
                onChange={(e) => {
                  setCsvText(e.target.value);
                  if (file) setFile(null);
                }}
              ></textarea>
            </div>

            {/* Bottom Next Button */}
            <div className="d-flex justify-content-end">
              <button
                type="button"
                onClick={handleUploadAndPreview}
                disabled={loading || (!file && !csvText.trim())}
                className="em-btn-next"
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                    <span>Analyzing File...</span>
                  </>
                ) : (
                  <>
                    <span>Next: Column Mapping & Options</span>
                    <i className="bi bi-arrow-right"></i>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Column Mapping & Options */}
        {step === 2 && (
          <div className="em-card">
            <div className="em-card-header">
              <div>
                <h2 className="em-card-title">Step 2: Map File Headers & Assign Audience Attributes</h2>
                <div className="text-muted small mt-1">
                  {totalEstimatedRows > 0 ? `~${totalEstimatedRows.toLocaleString()} rows detected in file` : 'Preview generated'} &bull; {sampleRows.length} sample rows analyzed
                </div>
              </div>
              <span className="badge bg-light text-dark border px-3 py-2">
                <i className={`bi ${fileType === 'xlsx' ? 'bi-file-earmark-excel text-success' : 'bi-file-earmark-text text-primary'} me-1`}></i>
                {fileName || 'File'}
              </span>
            </div>

            {/* Column Mapping Grid */}
            <div className="row g-3 mb-4">
              <div className="col-12 col-md-6 col-lg-4">
                <label className="form-label fw-bold text-dark small">
                  Phone Column <span className="text-danger">*</span>
                </label>
                <select
                  className="form-select border-success rounded-3 shadow-none"
                  value={columnMapping.phone}
                  onChange={(e) => setColumnMapping({ ...columnMapping, phone: e.target.value })}
                  required
                >
                  <option value="">-- Select Phone Column --</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                <div className="form-text small text-muted">Mandatory for WhatsApp sending</div>
              </div>

              <div className="col-12 col-md-6 col-lg-4">
                <label className="form-label fw-bold text-dark small">Name Column</label>
                <select
                  className="form-select rounded-3 shadow-none"
                  value={columnMapping.name}
                  onChange={(e) => setColumnMapping({ ...columnMapping, name: e.target.value })}
                >
                  <option value="">-- None / Skip --</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                <div className="form-text small text-muted">Used for template variable substitution</div>
              </div>

              <div className="col-12 col-md-6 col-lg-4">
                <label className="form-label fw-bold text-dark small">Email Column</label>
                <select
                  className="form-select rounded-3 shadow-none"
                  value={columnMapping.email}
                  onChange={(e) => setColumnMapping({ ...columnMapping, email: e.target.value })}
                >
                  <option value="">-- None / Skip --</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                <div className="form-text small text-muted">Secondary contact identifier</div>
              </div>

              <div className="col-12 col-md-6 col-lg-6">
                <label className="form-label fw-bold text-dark small">Segment Tag Column (Optional)</label>
                <select
                  className="form-select rounded-3 shadow-none"
                  value={columnMapping.tag}
                  onChange={(e) => setColumnMapping({ ...columnMapping, tag: e.target.value })}
                >
                  <option value="">-- None / Skip (Use Batch Tag Below) --</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                <div className="form-text small text-muted">Reads tags dynamically per row from file</div>
              </div>

              <div className="col-12 col-md-6 col-lg-6">
                <label className="form-label fw-bold text-dark small">Consent / Opt-In Column (Optional)</label>
                <select
                  className="form-select rounded-3 shadow-none"
                  value={columnMapping.consent || ''}
                  onChange={(e) => setColumnMapping({ ...columnMapping, consent: e.target.value })}
                >
                  <option value="">-- Auto Opt-In All (Recommended) --</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                <div className="form-text small text-muted">Keep as Auto Opt-In unless file has explicit Yes/No column</div>
              </div>
            </div>

            {/* Audience Assignment: Contact Groups */}
            <div className="p-3 bg-light rounded-3 border mb-4">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <div className="d-flex align-items-center gap-2">
                  <div className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center" style={{ width: '28px', height: '28px', fontSize: '0.85rem' }}>
                    <i className="bi bi-people-fill"></i>
                  </div>
                  <div>
                    <label className="form-label fw-bold text-dark small mb-0">
                      Assign to Contact Group (Audience List)
                    </label>
                    <div className="text-muted" style={{ fontSize: '0.78rem' }}>
                      Import hone wale sabhi contacts ko is group me add kar diya jayega (Broadcast campaigns target karne ke liye).
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNewGroupInput(!showNewGroupInput)}
                  className="btn btn-sm btn-outline-primary"
                >
                  {showNewGroupInput ? 'Select Existing Group' : '+ Create New Group'}
                </button>
              </div>

              {showNewGroupInput ? (
                <div className="input-group input-group-sm">
                  <span className="input-group-text bg-white"><i className="bi bi-plus-circle text-primary"></i></span>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Enter new group name (e.g., Diwali VIP Audience 2026)..."
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                  />
                </div>
              ) : (
                <select
                  className="form-select form-select-sm rounded-3 shadow-none"
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                >
                  <option value="">-- None / Do not assign to a group --</option>
                  {availableGroups.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.member_count || 0} existing contacts)
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Batch Tag Input for Entire Import */}
            <div className="p-3 bg-light rounded-3 border mb-4">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <div className="d-flex align-items-center gap-2">
                  <div className="rounded-circle bg-success text-white d-flex align-items-center justify-content-center" style={{ width: '28px', height: '28px', fontSize: '0.85rem' }}>
                    <i className="bi bi-tags-fill"></i>
                  </div>
                  <div>
                    <label className="form-label fw-bold text-dark small mb-0">
                      Assign Tag(s) to Entire File Import
                    </label>
                    <div className="text-muted" style={{ fontSize: '0.78rem' }}>
                      Pure file ke sabhi contacts ko ek sath ye tag assign ho jayega (e.g. VIP Customer, Lead 2026).
                    </div>
                  </div>
                </div>
                <span className="badge bg-white text-secondary border small">Batch Tagging</span>
              </div>

              <div className="input-group input-group-sm mb-2">
                <span className="input-group-text bg-white text-muted"><i className="bi bi-tag"></i></span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Diwali Festival 2026, VIP Customer, New Leads..."
                  value={batchTag}
                  onChange={(e) => setBatchTag(e.target.value)}
                />
                {batchTag && (
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setBatchTag('')}
                  >
                    <i className="bi bi-x"></i>
                  </button>
                )}
              </div>

              {availableTags && availableTags.length > 0 && (
                <div className="d-flex align-items-center flex-wrap gap-1 mt-1">
                  <span className="text-muted small me-1" style={{ fontSize: '0.75rem' }}>Quick select:</span>
                  {availableTags.map(t => {
                    const isSelected = batchTag.includes(t.name);
                    return (
                      <button
                        key={t.id || t.name}
                        type="button"
                        className={`btn btn-sm py-0 px-2 rounded-pill ${isSelected ? 'btn-success text-white' : 'btn-outline-secondary bg-white'}`}
                        style={{ fontSize: '0.75rem' }}
                        onClick={() => {
                          if (!batchTag) {
                            setBatchTag(t.name);
                          } else if (!batchTag.includes(t.name)) {
                            setBatchTag(`${batchTag}, ${t.name}`);
                          }
                        }}
                      >
                        {isSelected ? '✓ ' : '+ '}{t.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Compliance Confirmation Checkbox */}
            <div className="p-3 bg-light rounded-3 border mb-4">
              <div className="d-flex align-items-center gap-2 mb-1">
                <i className="bi bi-shield-check text-success fs-5"></i>
                <span className="fw-bold text-dark">Verifiable WhatsApp Consent Check</span>
              </div>
              <p className="text-muted small mb-2">
                Under WhatsApp Business Platform policies, marketing broadcasts may only be sent to customers who explicitly opted in. 
                Any row where consent is explicitly rejected or whose previous unsubscribe record exists in your workspace will be automatically protected and skipped.
              </p>
              <div className="form-check">
                <input 
                  className="form-check-input" 
                  type="checkbox" 
                  id="consentCheckConfirm" 
                  defaultChecked 
                  required 
                />
                <label className="form-check-label small fw-semibold" htmlFor="consentCheckConfirm">
                  I confirm that our business holds auditable marketing opt-in records for these imported customers.
                </label>
              </div>
            </div>

            <div className="d-flex justify-content-between align-items-center">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="btn btn-outline-secondary rounded-3 px-4 fw-semibold"
              >
                ← Back
              </button>
              <button 
                type="button"
                onClick={handleCreateImportJob} 
                disabled={loading} 
                className="em-btn-next"
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                    <span>Starting Background Worker...</span>
                  </>
                ) : (
                  <>
                    <i className="bi bi-cloud-arrow-up"></i>
                    <span>Queue Background Import & Verify</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Live Progress & Results */}
        {step === 3 && importResult && (
          <div className="em-card">
            <div className="em-card-header">
              {importResult.status === 'processing' || importResult.status === 'pending' ? (
                <h2 className="em-card-title text-primary d-flex align-items-center gap-2">
                  <span className="spinner-border spinner-border-sm text-primary" role="status"></span>
                  {importResult.status === 'pending' ? 'Import Queued in Background...' : 'Import Processing in Background...'}
                </h2>
              ) : importResult.status === 'failed' ? (
                <h2 className="em-card-title text-danger d-flex align-items-center gap-2">
                  <i className="bi bi-x-circle-fill"></i>
                  Import Failed
                </h2>
              ) : importResult.status === 'cancelled' ? (
                <h2 className="em-card-title text-secondary d-flex align-items-center gap-2">
                  <i className="bi bi-slash-circle"></i>
                  Import Cancelled
                </h2>
              ) : (
                <h2 className="em-card-title text-success d-flex align-items-center gap-2">
                  <i className="bi bi-check-circle-fill"></i>
                  Import Completed Successfully
                </h2>
              )}

              <div className="d-flex align-items-center gap-2">
                {importResult.status === 'failed' && (
                  <button
                    type="button"
                    onClick={() => handleRetryJob(importResult.id || importResult.jobId)}
                    className="btn btn-sm btn-outline-danger"
                  >
                    <i className="bi bi-arrow-repeat me-1"></i> Retry Import
                  </button>
                )}
                {(importResult.status === 'processing' || importResult.status === 'pending') && (
                  <button
                    type="button"
                    onClick={() => handleCancelJob(importResult.id || importResult.jobId)}
                    className="btn btn-sm btn-outline-secondary"
                  >
                    <i className="bi bi-x-circle me-1"></i> Cancel
                  </button>
                )}
              </div>
            </div>

            {/* Background Live Progress Bar */}
            {(importResult.status === 'processing' || importResult.status === 'pending') && (
              <div className="mb-4 p-3 bg-light rounded-3 border">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="fw-semibold text-dark small">
                    Processing Contacts in Batches of 500: {importResult.processed_rows || importResult.processedRows || 0} / {importResult.total_rows || importResult.totalRows || 0} rows
                  </span>
                  <span className="badge bg-primary text-white">
                    {Math.min(100, Math.round(((importResult.processed_rows || importResult.processedRows || 0) / (importResult.total_rows || importResult.totalRows || 1)) * 100))}%
                  </span>
                </div>
                <div className="progress" style={{ height: '10px', borderRadius: '6px' }}>
                  <div
                    className="progress-bar progress-bar-striped progress-bar-animated bg-success"
                    role="progressbar"
                    style={{
                      width: `${Math.min(100, Math.round(((importResult.processed_rows || importResult.processedRows || 0) / (importResult.total_rows || importResult.totalRows || 1)) * 100))}%`
                    }}
                  ></div>
                </div>
                <div className="text-muted small mt-2 d-flex align-items-center gap-1">
                  <i className="bi bi-info-circle text-primary"></i>
                  <span>Aap is page par reh sakte hain ya doosre tab par jaa sakte hain — contacts background me aaram se securely save ho rahe hain. Browser band hone par bhi processing continue rahegi.</span>
                </div>
              </div>
            )}
            
            <div className="row g-3 text-center mb-4">
              <div className="col-4">
                <div className="p-3 border rounded-3 bg-light">
                  <div className="text-muted small">Total Rows</div>
                  <div className="fs-3 fw-bold text-dark">{importResult.total_rows || importResult.totalRows || 0}</div>
                </div>
              </div>
              <div className="col-4">
                <div className="p-3 border rounded-3 bg-success-subtle">
                  <div className="text-success small fw-semibold">Imported / Updated</div>
                  <div className="fs-3 fw-bold text-success">{importResult.successful_rows ?? importResult.successful ?? 0}</div>
                </div>
              </div>
              <div className="col-4">
                <div className="p-3 border rounded-3 bg-danger-subtle">
                  <div className="text-danger small fw-semibold">Failed / Ineligible</div>
                  <div className="fs-3 fw-bold text-danger">{importResult.failed_rows ?? importResult.failed ?? 0}</div>
                </div>
              </div>
            </div>

            {/* Error Report Download & Audit Table */}
            {((importResult.failed_rows || importResult.failed || 0) > 0 || (importResult.rowReports && importResult.rowReports.length > 0)) && (
              <div className="mt-4 p-3 bg-light rounded-3 border">
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <div className="d-flex align-items-center gap-2">
                    <i className="bi bi-exclamation-triangle-fill text-warning fs-5"></i>
                    <div>
                      <h6 className="fw-bold text-dark mb-0">Audit Report: Skipped & Ineligible Rows</h6>
                      <div className="text-muted small">Review records that were duplicate or missing compliance</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDownloadErrorReport()}
                    className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1"
                  >
                    <i className="bi bi-download"></i>
                    <span>Download Error Report (CSV)</span>
                  </button>
                </div>

                {importResult.rowReports && importResult.rowReports.length > 0 && (
                  <div className="table-responsive bg-white rounded-2 border">
                    <table className="table table-sm cf-table mb-0">
                      <thead>
                        <tr>
                          <th>Row #</th>
                          <th>Phone</th>
                          <th>Status</th>
                          <th>Reason / Compliance Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importResult.rowReports.slice(0, 50).map((r, i) => (
                          <tr key={i}>
                            <td>{r.row_number}</td>
                            <td><code>{r.phone || 'N/A'}</code></td>
                            <td>
                              <span className={`badge ${r.status === 'skipped' ? 'bg-warning text-dark' : 'bg-danger'}`}>
                                {r.status}
                              </span>
                            </td>
                            <td className="text-muted small">{r.error_reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            <div className="d-flex justify-content-end gap-3 mt-4">
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setFile(null);
                  setFileKey('');
                  setFileName('');
                  setCsvText('');
                  setImportResult(null);
                }}
                className="btn btn-outline-secondary rounded-3 px-4 fw-semibold"
              >
                Import Another File
              </button>
              <a href="/contacts" className="em-btn-next text-decoration-none">
                <span>View Audience Database</span>
                <i className="bi bi-arrow-right"></i>
              </a>
            </div>
          </div>
        )}

        {/* Past CSV Import Jobs Table */}
        <div className="em-card">
          <div className="em-card-header">
            <div>
              <h2 className="em-card-title">Past Import Jobs Queue</h2>
              <div className="text-muted small mt-1">Audit log of all background imports and worker queue history</div>
            </div>
            <button
              type="button"
              onClick={fetchHistory}
              className="btn btn-sm btn-outline-secondary"
            >
              <i className="bi bi-arrow-clockwise me-1"></i> Refresh History
            </button>
          </div>
          <div className="table-responsive">
            <table className="table cf-table align-middle">
              <thead>
                <tr>
                  <th>File Name</th>
                  <th>Format</th>
                  <th>Batch Tag</th>
                  <th>Total Rows</th>
                  <th>Imported / Updated</th>
                  <th>Failed</th>
                  <th>Status</th>
                  <th>Import Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {importHistory.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center py-4 text-muted">
                      No past imports recorded.
                    </td>
                  </tr>
                ) : (
                  importHistory.map(job => (
                    <tr key={job.id}>
                      <td>
                        <i className={`bi ${job.file_type === 'xlsx' ? 'bi-file-earmark-excel text-success' : 'bi-file-earmark-text text-primary'} me-2 fs-6`}></i>
                        <span className="fw-semibold text-dark">{job.file_name}</span>
                      </td>
                      <td>
                        <span className="badge bg-light text-secondary border uppercase">
                          {job.file_type ? job.file_type.toUpperCase() : 'CSV'}
                        </span>
                      </td>
                      <td>
                        {job.options?.batchTag ? (
                          <span className="badge bg-primary-subtle text-primary border border-primary-subtle d-inline-flex align-items-center gap-1">
                            <i className="bi bi-tag-fill" style={{ fontSize: '10px' }}></i>
                            <span>{job.options.batchTag}</span>
                          </span>
                        ) : (
                          <span className="text-muted small">No tag</span>
                        )}
                      </td>
                      <td>{Number(job.total_rows || 0).toLocaleString()}</td>
                      <td className="text-success fw-bold">{Number(job.successful_rows || 0).toLocaleString()}</td>
                      <td className="text-danger fw-bold">{Number(job.failed_rows || 0).toLocaleString()}</td>
                      <td>
                        {job.status === 'processing' ? (
                          <span className="badge bg-primary d-inline-flex align-items-center gap-1">
                            <span className="spinner-border spinner-border-sm" style={{ width: '10px', height: '10px' }} role="status"></span>
                            Processing ({job.processed_rows || 0}/{job.total_rows})
                          </span>
                        ) : job.status === 'pending' ? (
                          <span className="badge bg-secondary d-inline-flex align-items-center gap-1">
                            <i className="bi bi-clock"></i> Queued
                          </span>
                        ) : job.status === 'completed' ? (
                          <span className="badge bg-success">Completed</span>
                        ) : job.status === 'cancelled' ? (
                          <span className="badge bg-secondary">Cancelled</span>
                        ) : (
                          <span className="badge bg-danger">Failed</span>
                        )}
                      </td>
                      <td className="text-muted small">
                        {new Date(job.created_at).toLocaleString()}
                      </td>
                      <td>
                        <div className="d-flex align-items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditTag(job)}
                            className="btn btn-sm btn-outline-secondary p-1"
                            title="Change / Assign Tag to this Import"
                          >
                            <i className="bi bi-tag"></i>
                          </button>
                          {Number(job.failed_rows || 0) > 0 && (
                            <button
                              type="button"
                              onClick={() => handleDownloadErrorReport(job.id)}
                              className="btn btn-sm btn-outline-danger p-1"
                              title="Download Error Report CSV"
                            >
                              <i className="bi bi-download"></i>
                            </button>
                          )}
                          {job.status === 'failed' && (
                            <button
                              type="button"
                              onClick={() => handleRetryJob(job.id)}
                              className="btn btn-sm btn-outline-primary p-1"
                              title="Retry Import"
                            >
                              <i className="bi bi-arrow-repeat"></i>
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteTargetJob(job);
                                setAlsoDeleteContacts(false);
                              }}
                              className="btn btn-sm btn-outline-danger p-1"
                              title="Delete Import Job & Records"
                            >
                              <i className="bi bi-trash"></i>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Change Tag Modal */}
        {editTagTargetJob && (
          <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px' }}>
                <div className="modal-header border-bottom">
                  <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2">
                    <i className="bi bi-tag-fill text-primary"></i>
                    <span>Change Past Import Tag</span>
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    disabled={updatingTag}
                    onClick={() => setEditTagTargetJob(null)}
                  ></button>
                </div>
                <div className="modal-body p-4">
                  <div className="p-3 bg-light rounded-3 mb-3 small border">
                    <div><strong>File Name:</strong> {editTagTargetJob.file_name}</div>
                    <div><strong>Current Tag:</strong> <span className="badge bg-secondary ms-1">{editTagTargetJob.options?.batchTag || 'None'}</span></div>
                    <div><strong>Total Contacts:</strong> {Number(editTagTargetJob.successful_rows || editTagTargetJob.total_rows || 0).toLocaleString()}</div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold text-dark">Naya Tag Select Karein ya Type Karein</label>
                    <input
                      type="text"
                      className="form-control mb-2"
                      placeholder="e.g. Festive_Offer, High_Value, November_Leads"
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      autoFocus
                    />

                    {availableTags && availableTags.length > 0 && (
                      <div>
                        <div className="text-muted small mb-1">Existing Tags (Click to select):</div>
                        <div className="d-flex flex-wrap gap-1">
                          {availableTags.slice(0, 15).map(t => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => setNewTagInput(t.name)}
                              className={`badge border text-decoration-none ${newTagInput.toLowerCase() === t.name.toLowerCase() ? 'bg-primary text-white border-primary' : 'bg-light text-dark border-secondary-subtle'}`}
                              style={{ cursor: 'pointer' }}
                            >
                              {t.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="form-check p-3 bg-light rounded-3 border">
                    <input
                      className="form-check-input ms-0 me-2"
                      type="checkbox"
                      id="replaceOldTagCheck"
                      checked={replaceOldTag}
                      onChange={(e) => setReplaceOldTag(e.target.checked)}
                    />
                    <label className="form-check-label small fw-semibold text-dark" htmlFor="replaceOldTagCheck">
                      Purane tag ko naye tag se Replace karein
                    </label>
                    <div className="text-muted small mt-1 ms-4">
                      Agar checked rahega, toh is file ke sabhi contacts se purana tag hatkar naya tag apply ho jayega.
                    </div>
                  </div>
                </div>
                <div className="modal-footer border-top bg-light">
                  <button
                    type="button"
                    className="btn btn-secondary px-3"
                    disabled={updatingTag}
                    onClick={() => setEditTagTargetJob(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary px-4 fw-semibold"
                    disabled={updatingTag || !newTagInput.trim()}
                    onClick={confirmUpdateTag}
                  >
                    {updatingTag ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                        Updating Tags...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check2-circle me-1"></i>
                        Save & Update Tag
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteTargetJob && (
          <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px' }}>
                <div className="modal-header border-bottom">
                  <h5 className="modal-title fw-bold text-danger d-flex align-items-center gap-2">
                    <i className="bi bi-trash-fill"></i>
                    <span>Delete Import Job</span>
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    disabled={deleting}
                    onClick={() => setDeleteTargetJob(null)}
                  ></button>
                </div>
                <div className="modal-body p-4">
                  <p className="mb-3 text-dark">
                    Are you sure you want to delete this imported file and its audit history?
                  </p>
                  <div className="p-3 bg-light rounded-3 mb-3 small border">
                    <div><strong>File Name:</strong> {deleteTargetJob.file_name}</div>
                    <div><strong>Total Rows:</strong> {Number(deleteTargetJob.total_rows || 0).toLocaleString()}</div>
                    <div><strong>Imported / Updated:</strong> {Number(deleteTargetJob.successful_rows || 0).toLocaleString()}</div>
                    <div><strong>Upload Date:</strong> {new Date(deleteTargetJob.created_at).toLocaleString()}</div>
                  </div>

                  <div className="form-check p-3 bg-danger-subtle rounded-3 border border-danger-subtle">
                    <input
                      className="form-check-input ms-0 me-2"
                      type="checkbox"
                      id="alsoDeleteContactsCheck"
                      checked={alsoDeleteContacts}
                      onChange={(e) => setAlsoDeleteContacts(e.target.checked)}
                    />
                    <label className="form-check-label small fw-semibold text-danger" htmlFor="alsoDeleteContactsCheck">
                      Also permanently delete contacts imported from this file
                    </label>
                    <div className="text-muted small mt-1 ms-4">
                      If checked, all contacts added from this Excel/CSV file will be permanently deleted from the CRM.
                    </div>
                  </div>
                </div>
                <div className="modal-footer border-top bg-light">
                  <button
                    type="button"
                    className="btn btn-secondary px-3"
                    disabled={deleting}
                    onClick={() => setDeleteTargetJob(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger px-4 fw-semibold"
                    disabled={deleting}
                    onClick={confirmDeleteJob}
                  >
                    {deleting ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                        Deleting...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-trash me-1"></i>
                        Confirm Delete
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
