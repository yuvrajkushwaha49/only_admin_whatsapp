import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';

export default function ContactsTab({ data, loading }) {
  const kpis = data?.kpis || {};
  const sources = data?.sources || [];
  const growthTimeline = data?.growthTimeline || [];

  const COLORS = ['#7c3aed', '#0284c7', '#10b981', '#f59e0b', '#ec4899'];

  return (
    <div>
      {/* KPI Cards (6 cards) */}
      <div className="an-kpi-grid-4 mb-4">
        <div className="cg-stat-card">
          <div className="cg-stat-icon-wrap cg-stat-icon-blue">
            <i className="bi bi-people-fill"></i>
          </div>
          <div>
            <div className="cg-stat-label">Total Contacts</div>
            <div className="cg-stat-value">{kpis.totalContacts?.toLocaleString() || 0}</div>
            <div className="small text-muted mt-1">Total audience directory</div>
          </div>
        </div>

        <div className="cg-stat-card">
          <div className="cg-stat-icon-wrap cg-stat-icon-green">
            <i className="bi bi-person-plus-fill"></i>
          </div>
          <div>
            <div className="cg-stat-label">New Contacts (Period)</div>
            <div className="cg-stat-value text-green">{kpis.newContacts?.toLocaleString() || 0}</div>
            <div className="small text-muted mt-1">Acquired in date range</div>
          </div>
        </div>

        <div className="cg-stat-card">
          <div className="cg-stat-icon-wrap cg-stat-icon-cyan">
            <i className="bi bi-patch-check-fill"></i>
          </div>
          <div>
            <div className="cg-stat-label">WhatsApp Opted-In</div>
            <div className="cg-stat-value" style={{ color: '#0284c7' }}>{kpis.optedInContacts?.toLocaleString() || 0}</div>
            <div className="small text-muted mt-1">Compliant for broadcasts</div>
          </div>
        </div>

        <div className="cg-stat-card">
          <div className="cg-stat-icon-wrap" style={{ background: '#fee2e2', color: '#dc2626' }}>
            <i className="bi bi-person-x-fill"></i>
          </div>
          <div>
            <div className="cg-stat-label">Unsubscribed</div>
            <div className="cg-stat-value" style={{ color: '#dc2626' }}>{kpis.unsubscribedContacts?.toLocaleString() || 0}</div>
            <div className="small text-muted mt-1">Opted-out from marketing</div>
          </div>
        </div>
      </div>

      {/* Charts Row: Growth Timeline + Acquisition Sources */}
      <div className="row g-4 mb-4">
        {/* Growth Timeline Chart */}
        <div className="col-12 col-lg-8">
          <div className="an-chart-card">
            <div className="an-chart-header">
              <div>
                <h4 className="an-chart-title">
                  <i className="bi bi-graph-up-arrow text-primary"></i>
                  Daily Contact Acquisition Trend
                </h4>
                <div className="an-chart-subtitle">New subscribers added to your audience per day</div>
              </div>
            </div>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={growthTimeline} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorContacts" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickFormatter={(val) => val.slice(5)} />
                  <YAxis stroke="#94a3b8" fontSize={11} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                  <Area type="monotone" dataKey="newContacts" name="New Contacts" stroke="#7c3aed" fillOpacity={1} fill="url(#colorContacts)" strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Acquisition Sources Pie Chart */}
        <div className="col-12 col-lg-4">
          <div className="an-chart-card">
            <div className="an-chart-header">
              <div>
                <h4 className="an-chart-title">
                  <i className="bi bi-pie-chart-fill text-primary"></i>
                  Contact Acquisition Sources
                </h4>
                <div className="an-chart-subtitle">Breakdown by channel origin</div>
              </div>
            </div>
            <div style={{ width: '100%', height: 210 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sources}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="count"
                  >
                    {sources.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="d-flex flex-column gap-2 mt-2">
              {sources.map((s, i) => (
                <div key={i} className="d-flex align-items-center justify-content-between small">
                  <div className="d-flex align-items-center gap-2">
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[i % COLORS.length] }}></span>
                    <span className="text-secondary">{s.name}</span>
                  </div>
                  <span className="fw-bold text-dark">{Number(s.count || 0).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
