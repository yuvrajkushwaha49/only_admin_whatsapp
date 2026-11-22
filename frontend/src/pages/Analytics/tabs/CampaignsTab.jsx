import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';

export default function CampaignsTab({ campaignsData, loading }) {
  const [searchTerm, setSearchTerm] = useState('');

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status"></div>
        <div className="text-secondary small mt-2">Loading campaign analytics from database...</div>
      </div>
    );
  }

  const campaigns = campaignsData?.campaigns || [];
  const summary = campaignsData?.summary || {};

  const filtered = campaigns.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.templateName && c.templateName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const chartData = campaigns.slice(0, 8).map(c => ({
    name: c.name.length > 14 ? c.name.slice(0, 14) + '...' : c.name,
    sent: c.sent,
    delivered: c.delivered
  }));

  if (campaigns.length === 0) {
    return (
      <div className="text-center py-5 text-muted">
        <i className="bi bi-send fs-1 text-secondary d-block mb-2"></i>
        <h5 className="fw-bold text-dark">No Campaigns Recorded in Database</h5>
        <p className="small text-secondary mb-3">Send your first WhatsApp broadcast to track real-time delivery and open rates.</p>
        <Link to="/campaigns/new" className="cg-hero-btn-create text-decoration-none">
          <i className="bi bi-plus-lg me-1"></i> Create New Campaign
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* KPI mini-cards row */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-md-4">
          <div className="p-3 rounded-3" style={{ background: '#f8fafc', border: '1px solid #E5EAF2' }}>
            <div className="text-secondary small fw-semibold">Total Campaigns Analyzed</div>
            <div className="fs-4 fw-bold text-dark mt-1">{summary.totalCampaigns || campaigns.length}</div>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="p-3 rounded-3" style={{ background: '#f8fafc', border: '1px solid #E5EAF2' }}>
            <div className="text-secondary small fw-semibold">Average Delivery Rate</div>
            <div className="fs-4 fw-bold text-success mt-1">{summary.avgDeliveryRate || 0}%</div>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="p-3 rounded-3" style={{ background: '#f8fafc', border: '1px solid #E5EAF2' }}>
            <div className="text-secondary small fw-semibold">Average Read / Open Rate</div>
            <div className="fs-4 fw-bold text-info mt-1">{summary.avgReadRate || 0}%</div>
          </div>
        </div>
      </div>

      {/* Bar Chart comparing campaigns */}
      {chartData.length > 0 && (
        <div className="analytics-chart-box mb-4">
          <div className="analytics-chart-header">
            <h3 className="analytics-chart-title">
              <i className="bi bi-bar-chart-fill text-primary"></i>
              <span>Campaign Delivery Comparison</span>
            </h3>
            <div className="d-flex align-items-center gap-3 small text-secondary">
              <span className="d-flex align-items-center gap-1">
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#7c3aed', display: 'inline-block' }}></span>
                <span>Sent</span>
              </span>
              <span className="d-flex align-items-center gap-1">
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
                <span>Delivered</span>
              </span>
            </div>
          </div>

          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} interval={0} angle={-15} textAnchor="end" />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0' }} />
                <Bar dataKey="sent" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                <Bar dataKey="delivered" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Detailed Campaigns Table */}
      <div className="analytics-chart-box">
        <div className="analytics-chart-header flex-wrap gap-2">
          <h3 className="analytics-chart-title">
            <i className="bi bi-table text-primary"></i>
            <span>Campaign Performance Records</span>
          </h3>
          <div style={{ minWidth: 240 }}>
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder="Search campaigns..."
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
                <th>Campaign Name</th>
                <th>Status</th>
                <th>Recipients</th>
                <th>Sent</th>
                <th>Delivered</th>
                <th>Read</th>
                <th>Delivery Rate</th>
                <th>Read Rate</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-4 text-muted">
                    No campaigns found matching criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="fw-bold text-dark">{c.name}</div>
                      <div className="text-muted small">
                        {c.templateName && <span className="me-2"><i className="bi bi-file-text me-1"></i>{c.templateName}</span>}
                        {c.accountName && <span><i className="bi bi-whatsapp me-1 text-success"></i>{c.accountName}</span>}
                      </div>
                    </td>
                    <td>
                      <span className={`analytics-badge-status ${c.status === 'completed' ? 'completed' : (c.status === 'failed' ? 'failed' : 'running')}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="fw-semibold">{c.totalRecipients}</td>
                    <td>{c.sent}</td>
                    <td className="text-success fw-semibold">{c.delivered}</td>
                    <td className="text-info fw-semibold">{c.read}</td>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <span className="fw-bold">{c.deliveryRate}%</span>
                        <div style={{ width: 45, height: 6, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${c.deliveryRate}%`, height: '100%', background: '#10b981' }}></div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <span className="fw-bold">{c.readRate}%</span>
                        <div style={{ width: 45, height: 6, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${c.readRate}%`, height: '100%', background: '#06b6d4' }}></div>
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
    </div>
  );
}
