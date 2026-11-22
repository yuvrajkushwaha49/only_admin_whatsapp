import React from 'react';
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

export default function NumbersTab({ data, loading, onExport }) {
  const kpis = data?.kpis || {};
  const numbers = data?.numbers || [];

  const chartData = numbers.map(n => ({
    name: n.displayName || n.phoneNumber,
    sent: n.sent,
    delivered: n.delivered,
    read: n.read
  }));

  return (
    <div>
      {/* KPI Cards (4 cards) */}
      <div className="an-kpi-grid-4 mb-4">
        <div className="cg-stat-card">
          <div className="cg-stat-icon-wrap cg-stat-icon-blue">
            <i className="bi bi-telephone-fill"></i>
          </div>
          <div>
            <div className="cg-stat-label">Total Allocated Numbers</div>
            <div className="cg-stat-value">{kpis.totalAllocated || 0}</div>
            <div className="small text-muted mt-1">Authorized WABA numbers</div>
          </div>
        </div>

        <div className="cg-stat-card">
          <div className="cg-stat-icon-wrap cg-stat-icon-green">
            <i className="bi bi-link-45deg"></i>
          </div>
          <div>
            <div className="cg-stat-label">Connected Lines</div>
            <div className="cg-stat-value text-green">{kpis.connected || 0}</div>
            <div className="small text-muted mt-1">Active Cloud API Webhook</div>
          </div>
        </div>

        <div className="cg-stat-card">
          <div className="cg-stat-icon-wrap" style={{ background: '#fee2e2', color: '#dc2626' }}>
            <i className="bi bi-slash-circle-fill"></i>
          </div>
          <div>
            <div className="cg-stat-label">Disconnected Lines</div>
            <div className="cg-stat-value" style={{ color: '#dc2626' }}>{kpis.disconnected || 0}</div>
            <div className="small text-muted mt-1">Token expired or restricted</div>
          </div>
        </div>

        <div className="cg-stat-card">
          <div className="cg-stat-icon-wrap cg-stat-icon-cyan">
            <i className="bi bi-shield-check"></i>
          </div>
          <div>
            <div className="cg-stat-label">Quality Rating</div>
            <div className="cg-stat-value" style={{ color: '#0284c7' }}>High (Green)</div>
            <div className="small text-muted mt-1">Meta Tier 250 / 1K / 10K</div>
          </div>
        </div>
      </div>

      {/* Chart: Messages volume per number */}
      {chartData.length > 0 && (
        <div className="an-chart-card mb-4">
          <div className="an-chart-header">
            <div>
              <h4 className="an-chart-title">
                <i className="bi bi-bar-chart-fill text-primary"></i>
                Messages Sent & Delivered per Number
              </h4>
              <div className="an-chart-subtitle">Volume and delivery performance comparison across active lines</div>
            </div>
          </div>
          <div style={{ width: '100%', height: 260 }}>
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

      {/* WhatsApp Numbers Table */}
      <div className="cg-card">
        <div className="cg-card-header">
          <div className="d-flex align-items-center gap-3">
            <h3 className="cg-card-title mb-0">
              <i className="bi bi-sim-fill text-primary me-2"></i>
              WhatsApp Line Performance Table
            </h3>
            <span className="badge bg-light text-secondary border px-2 py-1">
              {numbers.length} Lines
            </span>
          </div>

          <button
            type="button"
            className="btn btn-outline-secondary btn-sm rounded-3 d-inline-flex align-items-center gap-1"
            onClick={() => onExport('numbers', 'csv')}
            title="Download CSV"
          >
            <i className="bi bi-download"></i>
            <span>Export CSV</span>
          </button>
        </div>

        <div className="table-responsive">
          <table className="table cf-table mb-0 align-middle">
            <thead>
              <tr>
                <th>Phone Number</th>
                <th>Display Name</th>
                <th>Connection Status</th>
                <th>Quality Rating</th>
                <th>Tier</th>
                <th>Total Messages</th>
                <th>Sent</th>
                <th>Delivered</th>
                <th>Read</th>
                <th>Failed</th>
                <th>Delivery %</th>
                <th>Last Activity</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="12" className="text-center py-4">
                    <div className="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                    <span className="text-secondary small">Loading number metrics...</span>
                  </td>
                </tr>
              ) : numbers.length === 0 ? (
                <tr>
                  <td colSpan="12" className="text-center py-4 text-muted">
                    No WhatsApp numbers allocated.
                  </td>
                </tr>
              ) : (
                numbers.map((n) => (
                  <tr key={n.id}>
                    <td>
                      <code>{n.phoneNumber}</code>
                      {n.isPrimary && (
                        <span className="badge bg-primary-subtle text-primary ms-1 small">Primary</span>
                      )}
                    </td>
                    <td className="fw-bold text-dark">{n.displayName}</td>
                    <td>
                      <span className={`badge ${n.status === 'Connected' ? 'bg-success' : 'bg-danger'}`}>
                        {n.status}
                      </span>
                    </td>
                    <td>
                      <span className="badge bg-light text-dark border">
                        <i className="bi bi-circle-fill text-success me-1 small"></i>
                        {n.qualityRating}
                      </span>
                    </td>
                    <td className="small text-secondary">{n.tier}</td>
                    <td>{n.totalMessages.toLocaleString()}</td>
                    <td>{n.sent.toLocaleString()}</td>
                    <td className="text-success fw-semibold">{n.delivered.toLocaleString()}</td>
                    <td className="text-primary fw-semibold">{n.read.toLocaleString()}</td>
                    <td className="text-danger">{n.failed.toLocaleString()}</td>
                    <td>
                      <span className="an-rate-badge green">{n.deliveryRate}%</span>
                    </td>
                    <td className="small text-muted">
                      {n.lastActivity ? new Date(n.lastActivity).toLocaleDateString() : '-'}
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
