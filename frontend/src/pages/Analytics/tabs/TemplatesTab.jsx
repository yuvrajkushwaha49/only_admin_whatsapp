import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export default function TemplatesTab({ templatesData, loading }) {
  const [searchTerm, setSearchTerm] = useState('');

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status"></div>
        <div className="text-secondary small mt-2">Loading template analytics from database...</div>
      </div>
    );
  }

  const templates = templatesData?.templates || [];

  const filtered = templates.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (templates.length === 0) {
    return (
      <div className="text-center py-5 text-muted">
        <i className="bi bi-file-earmark-text fs-1 text-secondary d-block mb-2"></i>
        <h5 className="fw-bold text-dark">No Templates Recorded in Database</h5>
        <p className="small text-secondary mb-3">Create and sync WhatsApp templates with Meta to view usage and delivery performance.</p>
        <Link to="/templates" className="cg-hero-btn-create text-decoration-none">
          <i className="bi bi-plus-lg me-1"></i> Manage Templates
        </Link>
      </div>
    );
  }

  return (
    <div className="analytics-chart-box">
      <div className="analytics-chart-header flex-wrap gap-2">
        <div>
          <h3 className="analytics-chart-title">
            <i className="bi bi-file-earmark-text text-primary"></i>
            <span>Template Performance & Delivery Conversion</span>
          </h3>
          <p className="text-muted small m-0 mt-1">Compare which WhatsApp message templates have the highest delivery and open rates.</p>
        </div>
        <div style={{ minWidth: 240 }}>
          <input
            type="text"
            className="form-control form-control-sm"
            placeholder="Search templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ borderRadius: 8 }}
          />
        </div>
      </div>

      <div className="table-responsive">
        <table className="table analytics-table align-middle mb-0">
          <thead>
            <tr>
              <th>Template Name</th>
              <th>Category</th>
              <th>Usage Count</th>
              <th>Total Dispatches</th>
              <th>Delivered</th>
              <th>Delivery Rate</th>
              <th>Read Rate</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="7" className="text-center py-4 text-muted">
                  No templates matching search.
                </td>
              </tr>
            ) : (
              filtered.map((t) => (
                <tr key={t.id}>
                  <td>
                    <div className="fw-bold text-dark">{t.name}</div>
                    <div className="text-muted small">{t.language?.toUpperCase() || 'EN'}</div>
                  </td>
                  <td>
                    <span className="badge bg-light text-dark border">
                      {t.category}
                    </span>
                  </td>
                  <td className="fw-semibold">
                    <i className="bi bi-broadcast me-1 text-primary"></i>
                    {t.usageCount} campaigns
                  </td>
                  <td className="fw-semibold">{t.totalSent}</td>
                  <td className="text-success fw-semibold">{t.totalDelivered}</td>
                  <td>
                    <div className="d-flex align-items-center gap-2">
                      <span className="fw-bold">{t.deliveryRate}%</span>
                      <div style={{ width: 45, height: 6, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${t.deliveryRate}%`, height: '100%', background: '#10b981' }}></div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="d-flex align-items-center gap-2">
                      <span className="fw-bold">{t.readRate}%</span>
                      <div style={{ width: 45, height: 6, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${t.readRate}%`, height: '100%', background: '#06b6d4' }}></div>
                      </div>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
