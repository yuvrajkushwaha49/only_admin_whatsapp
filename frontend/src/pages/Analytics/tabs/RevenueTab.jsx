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

export default function RevenueTab({ data, loading }) {
  const kpis = data?.kpis || {};
  const planDistribution = data?.planDistribution || [];
  const topClients = data?.topClientsByUsage || [];

  const planChartData = planDistribution.map(p => ({
    name: p.name,
    clients: Number(p.client_count || 0),
    mrr: Number(p.total_mrr || 0)
  }));

  return (
    <div>
      {/* Super Admin Notice */}
      <div className="alert alert-primary d-flex align-items-center gap-2 mb-4 rounded-3 border-0 shadow-sm" style={{ background: '#ede9fe', color: '#5b21b6' }}>
        <i className="bi bi-shield-lock-fill fs-5"></i>
        <div>
          <strong>Super Admin Intelligence Console:</strong> This section aggregates cross-tenant subscription revenue, Monthly Recurring Revenue (MRR), and platform-wide WhatsApp Cloud API usage.
        </div>
      </div>

      {/* KPI Cards (4 cards) */}
      <div className="an-kpi-grid-4 mb-4">
        <div className="cg-stat-card">
          <div className="cg-stat-icon-wrap cg-stat-icon-blue">
            <i className="bi bi-buildings-fill"></i>
          </div>
          <div>
            <div className="cg-stat-label">Total Client Tenants</div>
            <div className="cg-stat-value">{kpis.totalClients || 0}</div>
            <div className="small text-muted mt-1">
              <span className="text-success fw-bold">{kpis.activeClients || 0} Active</span> • {kpis.trialClients || 0} Trial
            </div>
          </div>
        </div>

        <div className="cg-stat-card">
          <div className="cg-stat-icon-wrap cg-stat-icon-green">
            <i className="bi bi-cash-stack"></i>
          </div>
          <div>
            <div className="cg-stat-label">Monthly Recurring Revenue (MRR)</div>
            <div className="cg-stat-value text-green">${Number(kpis.mrr || 0).toLocaleString()}</div>
            <div className="small text-muted mt-1">Active paid subscriptions</div>
          </div>
        </div>

        <div className="cg-stat-card">
          <div className="cg-stat-icon-wrap cg-stat-icon-cyan">
            <i className="bi bi-wallet2"></i>
          </div>
          <div>
            <div className="cg-stat-label">Annualized Run Rate (ARR)</div>
            <div className="cg-stat-value" style={{ color: '#0284c7' }}>${Number(kpis.totalRevenue || 0).toLocaleString()}</div>
            <div className="small text-muted mt-1">Projected annual gross</div>
          </div>
        </div>

        <div className="cg-stat-card">
          <div className="cg-stat-icon-wrap" style={{ background: '#ede9fe', color: '#7c3aed' }}>
            <i className="bi bi-activity"></i>
          </div>
          <div>
            <div className="cg-stat-label">Total Messages Dispatched</div>
            <div className="cg-stat-value" style={{ color: '#7c3aed' }}>{Number(kpis.totalMessageUsage || 0).toLocaleString()}</div>
            <div className="small text-muted mt-1">Platform ledger sum</div>
          </div>
        </div>
      </div>

      {/* Plan Distribution Chart */}
      {planChartData.length > 0 && (
        <div className="an-chart-card mb-4">
          <div className="an-chart-header">
            <div>
              <h4 className="an-chart-title">
                <i className="bi bi-pie-chart text-primary"></i>
                Subscription Plan Client Distribution & MRR
              </h4>
              <div className="an-chart-subtitle">Active accounts and revenue contribution per tier</div>
            </div>
          </div>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={planChartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                <Legend verticalAlign="top" height={36} iconType="circle" />
                <Bar dataKey="clients" name="Active Clients" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                <Bar dataKey="mrr" name="MRR ($)" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Top 10 Clients by Message Usage Table */}
      <div className="cg-card">
        <div className="cg-card-header">
          <div className="d-flex align-items-center gap-3">
            <h3 className="cg-card-title mb-0">
              <i className="bi bi-bar-chart-line-fill text-primary me-2"></i>
              Top Clients by Message Usage & Tier
            </h3>
            <span className="badge bg-light text-secondary border px-2 py-1">
              Top {topClients.length} Tenants
            </span>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table cf-table mb-0 align-middle">
            <thead>
              <tr>
                <th>Tenant Name</th>
                <th>Slug</th>
                <th>Subscription Plan</th>
                <th>Monthly Price</th>
                <th>Status</th>
                <th>Campaigns Run</th>
                <th>Messages Sent</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-4">
                    <div className="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                    <span className="text-secondary small">Loading client metrics...</span>
                  </td>
                </tr>
              ) : topClients.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-4 text-muted">
                    No client usage data recorded.
                  </td>
                </tr>
              ) : (
                topClients.map((client) => (
                  <tr key={client.id}>
                    <td>
                      <div className="fw-bold text-dark">{client.name}</div>
                      <div className="small text-muted">Tenant #{client.id}</div>
                    </td>
                    <td><code>{client.slug}</code></td>
                    <td>
                      <span className="badge bg-primary-subtle text-primary border">{client.plan_name || 'Standard'}</span>
                    </td>
                    <td className="fw-semibold text-dark">${client.monthly_price || 0}/mo</td>
                    <td>
                      <span className={`badge ${client.status === 'active' ? 'bg-success' : 'bg-warning'}`}>
                        {client.status}
                      </span>
                    </td>
                    <td>{client.total_campaigns || 0}</td>
                    <td className="fw-bold text-success">{Number(client.messages_sent || 0).toLocaleString()}</td>
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
