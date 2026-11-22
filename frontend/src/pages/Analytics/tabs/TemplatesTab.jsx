import React from 'react';
import { Link } from 'react-router-dom';

export default function TemplatesTab({ data, loading }) {
  const kpis = data?.kpis || {};
  const templates = data?.templates || [];

  return (
    <div>
      {/* KPI Cards (4 cards) */}
      <div className="an-kpi-grid-4 mb-4">
        <div className="cg-stat-card">
          <div className="cg-stat-icon-wrap cg-stat-icon-blue">
            <i className="bi bi-file-earmark-text-fill"></i>
          </div>
          <div>
            <div className="cg-stat-label">Total Templates</div>
            <div className="cg-stat-value">{kpis.totalTemplates || 0}</div>
            <div className="small text-muted mt-1">Submitted to Meta Cloud API</div>
          </div>
        </div>

        <div className="cg-stat-card">
          <div className="cg-stat-icon-wrap cg-stat-icon-green">
            <i className="bi bi-patch-check-fill"></i>
          </div>
          <div>
            <div className="cg-stat-label">Approved by Meta</div>
            <div className="cg-stat-value text-green">{kpis.approved || 0}</div>
            <div className="small text-muted mt-1">Active for bulk broadcasts</div>
          </div>
        </div>

        <div className="cg-stat-card">
          <div className="cg-stat-icon-wrap" style={{ background: '#fef3c7', color: '#d97706' }}>
            <i className="bi bi-hourglass-split"></i>
          </div>
          <div>
            <div className="cg-stat-label">Pending Approval</div>
            <div className="cg-stat-value" style={{ color: '#d97706' }}>{kpis.pending || 0}</div>
            <div className="small text-muted mt-1">Under review by Meta</div>
          </div>
        </div>

        <div className="cg-stat-card">
          <div className="cg-stat-icon-wrap" style={{ background: '#ede9fe', color: '#7c3aed' }}>
            <i className="bi bi-send-check-fill"></i>
          </div>
          <div>
            <div className="cg-stat-label">Total Template Dispatches</div>
            <div className="cg-stat-value" style={{ color: '#7c3aed' }}>{kpis.totalSent?.toLocaleString() || 0}</div>
            <div className="small text-muted mt-1">Sent across all campaigns</div>
          </div>
        </div>
      </div>

      {/* Templates Performance Table */}
      <div className="cg-card">
        <div className="cg-card-header">
          <div className="d-flex align-items-center gap-3">
            <h3 className="cg-card-title mb-0">
              <i className="bi bi-layout-text-window text-primary me-2"></i>
              Meta Approved WhatsApp Templates
            </h3>
            <span className="badge bg-light text-secondary border px-2 py-1">
              {templates.length} Templates
            </span>
          </div>

          <Link to="/templates" className="btn btn-outline-primary btn-sm rounded-3 d-inline-flex align-items-center gap-1">
            <i className="bi bi-plus-lg"></i>
            <span>Create New Template</span>
          </Link>
        </div>

        <div className="table-responsive">
          <table className="table cf-table mb-0 align-middle">
            <thead>
              <tr>
                <th>Template Name</th>
                <th>Category</th>
                <th>Language</th>
                <th>Approval Status</th>
                <th>Campaigns</th>
                <th>Total Sent</th>
                <th>Delivered</th>
                <th>Delivery %</th>
                <th>Read %</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" className="text-center py-4">
                    <div className="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                    <span className="text-secondary small">Loading template performance...</span>
                  </td>
                </tr>
              ) : templates.length === 0 ? (
                <tr>
                  <td colSpan="9" className="text-center py-4 text-muted">
                    No template records found.
                  </td>
                </tr>
              ) : (
                templates.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <div className="fw-bold text-dark">{t.name}</div>
                      <div className="small text-muted">ID: #{t.id}</div>
                    </td>
                    <td>
                      <span className="badge bg-light text-dark border">{t.category || 'MARKETING'}</span>
                    </td>
                    <td><code>{t.language || 'en_US'}</code></td>
                    <td>
                      <span className={`badge ${
                        t.status === 'APPROVED' ? 'bg-success' :
                        t.status === 'PENDING' ? 'bg-warning' :
                        'bg-danger'
                      }`}>
                        {t.status}
                      </span>
                    </td>
                    <td>{t.campaigns_count || 0}</td>
                    <td>{Number(t.total_sent || 0).toLocaleString()}</td>
                    <td className="text-success fw-semibold">{Number(t.total_delivered || 0).toLocaleString()}</td>
                    <td>
                      <span className="an-rate-badge green">{t.delivery_rate || 0}%</span>
                    </td>
                    <td>
                      <span className="an-rate-badge blue">{t.read_rate || 0}%</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
