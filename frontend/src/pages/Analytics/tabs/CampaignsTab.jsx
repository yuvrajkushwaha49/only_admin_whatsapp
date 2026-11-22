import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';

export default function CampaignsTab({ data, loading, onExport }) {
  const [searchTerm, setSearchTerm] = useState('');

  const kpis = data?.kpis || {};
  const campaigns = data?.campaigns || [];
  const bestCampaign = data?.bestCampaign;
  const lowestCampaign = data?.lowestCampaign;

  const filteredCampaigns = campaigns.filter(c =>
    (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.purpose || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Top 5 campaigns for comparison chart
  const chartData = filteredCampaigns.slice(0, 5).map(c => ({
    name: c.name?.length > 15 ? c.name.slice(0, 15) + '...' : c.name,
    sent: Number(c.sent_count || 0),
    delivered: Number(c.delivered_count || 0),
    read: Number(c.read_count || 0)
  }));

  return (
    <div>
      {/* KPI Cards (4 cards) */}
      <div className="an-kpi-grid-4 mb-4">
        <div className="cg-stat-card">
          <div className="cg-stat-icon-wrap cg-stat-icon-blue">
            <i className="bi bi-send-fill"></i>
          </div>
          <div>
            <div className="cg-stat-label">Total Campaigns</div>
            <div className="cg-stat-value">{kpis.totalCampaigns || 0}</div>
            <div className="small text-muted mt-1">
              <span className="text-success fw-bold">{kpis.completed || 0} Completed</span> • {kpis.running || 0} Running
            </div>
          </div>
        </div>

        <div className="cg-stat-card">
          <div className="cg-stat-icon-wrap cg-stat-icon-green">
            <i className="bi bi-people-fill"></i>
          </div>
          <div>
            <div className="cg-stat-label">Total Recipients</div>
            <div className="cg-stat-value text-green">{kpis.totalRecipients?.toLocaleString() || 0}</div>
            <div className="small text-muted mt-1">{kpis.totalSent?.toLocaleString() || 0} Messages Sent</div>
          </div>
        </div>

        <div className="cg-stat-card">
          <div className="cg-stat-icon-wrap cg-stat-icon-cyan">
            <i className="bi bi-check-circle-fill"></i>
          </div>
          <div>
            <div className="cg-stat-label">Avg. Delivery Rate</div>
            <div className="cg-stat-value" style={{ color: '#0284c7' }}>{kpis.avgDeliveryRate || 0}%</div>
            <div className="small text-muted mt-1">Delivered to recipient devices</div>
          </div>
        </div>

        <div className="cg-stat-card">
          <div className="cg-stat-icon-wrap" style={{ background: '#ede9fe', color: '#7c3aed' }}>
            <i className="bi bi-eye-fill"></i>
          </div>
          <div>
            <div className="cg-stat-label">Avg. Read Rate</div>
            <div className="cg-stat-value" style={{ color: '#7c3aed' }}>{kpis.avgReadRate || 0}%</div>
            <div className="small text-muted mt-1">Confirmed read by recipient</div>
          </div>
        </div>
      </div>

      {/* Best & Lowest Performing Campaign Highlights */}
      <div className="row g-4 mb-4">
        <div className="col-12 col-md-6">
          <div className="an-highlight-card best">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="fw-bold text-success d-flex align-items-center gap-2">
                <i className="bi bi-award-fill fs-5"></i>
                Best Performing Campaign
              </span>
              {bestCampaign && (
                <span className="an-rate-badge green">{bestCampaign.delivery_rate || 100}% Delivery</span>
              )}
            </div>
            {bestCampaign ? (
              <div>
                <h5 className="text-dark fw-bold mb-1">{bestCampaign.name}</h5>
                <div className="small text-secondary mb-3">{bestCampaign.purpose || 'Promotional broadcast'}</div>
                <div className="row g-2 small">
                  <div className="col-4">
                    <span className="text-muted d-block">Recipients</span>
                    <strong className="text-dark">{bestCampaign.total_recipients?.toLocaleString()}</strong>
                  </div>
                  <div className="col-4">
                    <span className="text-muted d-block">Delivered</span>
                    <strong className="text-success">{bestCampaign.delivered_count?.toLocaleString()}</strong>
                  </div>
                  <div className="col-4">
                    <span className="text-muted d-block">Read Rate</span>
                    <strong className="text-primary">{bestCampaign.read_rate || 0}%</strong>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-muted small">No campaign data available for benchmark.</div>
            )}
          </div>
        </div>

        <div className="col-12 col-md-6">
          <div className="an-highlight-card lowest">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="fw-bold text-warning d-flex align-items-center gap-2">
                <i className="bi bi-exclamation-triangle-fill fs-5"></i>
                Lowest Performing Campaign
              </span>
              {lowestCampaign && (
                <span className="an-rate-badge amber">{lowestCampaign.delivery_rate || 0}% Delivery</span>
              )}
            </div>
            {lowestCampaign ? (
              <div>
                <h5 className="text-dark fw-bold mb-1">{lowestCampaign.name}</h5>
                <div className="small text-secondary mb-3">{lowestCampaign.purpose || 'Targeted broadcast'}</div>
                <div className="row g-2 small">
                  <div className="col-4">
                    <span className="text-muted d-block">Recipients</span>
                    <strong className="text-dark">{lowestCampaign.total_recipients?.toLocaleString()}</strong>
                  </div>
                  <div className="col-4">
                    <span className="text-muted d-block">Delivered</span>
                    <strong className="text-dark">{lowestCampaign.delivered_count?.toLocaleString()}</strong>
                  </div>
                  <div className="col-4">
                    <span className="text-muted d-block">Failed Count</span>
                    <strong className="text-danger">{lowestCampaign.failed_count?.toLocaleString() || 0}</strong>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-muted small">No campaign data available for benchmark.</div>
            )}
          </div>
        </div>
      </div>

      {/* Campaign Comparison Chart */}
      {chartData.length > 0 && (
        <div className="an-chart-card mb-4">
          <div className="an-chart-header">
            <div>
              <h4 className="an-chart-title">
                <i className="bi bi-bar-chart-steps text-primary"></i>
                Campaign Performance Comparison
              </h4>
              <div className="an-chart-subtitle">Sent vs Delivered vs Read counts across top campaigns</div>
            </div>
          </div>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                <Legend verticalAlign="top" height={36} iconType="circle" />
                <Bar dataKey="sent" name="Sent" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                <Bar dataKey="delivered" name="Delivered" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="read" name="Read" fill="#0284c7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Campaign Performance Table */}
      <div className="cg-card">
        <div className="cg-card-header">
          <div className="d-flex align-items-center gap-3 flex-wrap">
            <h3 className="cg-card-title mb-0">
              <i className="bi bi-broadcast text-primary me-2"></i>
              Campaign Performance Table
            </h3>
            <span className="badge bg-light text-secondary border px-2 py-1">
              {filteredCampaigns.length} Campaigns
            </span>
          </div>

          <div className="d-flex align-items-center gap-2 flex-wrap">
            <div className="cg-search-box">
              <i className="bi bi-search cg-search-icon"></i>
              <input
                type="text"
                className="form-control cg-search-input"
                placeholder="Search campaign by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <button
              type="button"
              className="btn btn-outline-secondary btn-sm rounded-3 d-inline-flex align-items-center gap-1"
              onClick={() => onExport('campaigns', 'csv')}
              title="Download CSV"
            >
              <i className="bi bi-download"></i>
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table cf-table mb-0 align-middle">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Status</th>
                <th>Line</th>
                <th>Recipients</th>
                <th>Sent</th>
                <th>Delivered</th>
                <th>Read</th>
                <th>Failed</th>
                <th>Delivery %</th>
                <th>Read %</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="11" className="text-center py-4">
                    <div className="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                    <span className="text-secondary small">Loading campaign records...</span>
                  </td>
                </tr>
              ) : filteredCampaigns.length === 0 ? (
                <tr>
                  <td colSpan="11" className="text-center py-4 text-muted">
                    No campaigns found matching search criteria.
                  </td>
                </tr>
              ) : (
                filteredCampaigns.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link to={`/campaigns/${c.id}`} className="fw-bold text-dark text-decoration-none hover-primary">
                        {c.name}
                      </Link>
                      <div className="small text-muted">{c.purpose || 'Marketing broadcast'}</div>
                    </td>
                    <td>
                      <span className={`badge ${
                        c.status === 'completed' ? 'bg-success' :
                        c.status === 'running' ? 'bg-primary' :
                        c.status === 'scheduled' ? 'bg-info' :
                        c.status === 'paused' ? 'bg-warning' :
                        'bg-secondary'
                      }`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="small text-secondary">{c.account_phone || c.account_name || 'Primary'}</td>
                    <td>{c.total_recipients?.toLocaleString()}</td>
                    <td>{c.sent_count?.toLocaleString()}</td>
                    <td className="text-success fw-semibold">{c.delivered_count?.toLocaleString()}</td>
                    <td className="text-primary fw-semibold">{c.read_count?.toLocaleString()}</td>
                    <td className="text-danger">{c.failed_count?.toLocaleString() || 0}</td>
                    <td>
                      <span className="an-rate-badge green">{c.delivery_rate || 0}%</span>
                    </td>
                    <td>
                      <span className="an-rate-badge blue">{c.read_rate || 0}%</span>
                    </td>
                    <td>
                      <Link
                        to={`/campaigns/${c.id}`}
                        className="btn btn-sm btn-outline-primary rounded-2 py-1 px-2 d-inline-flex align-items-center gap-1"
                        title="Open Campaign Details"
                      >
                        <i className="bi bi-box-arrow-up-right"></i>
                        <span>Details</span>
                      </Link>
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
