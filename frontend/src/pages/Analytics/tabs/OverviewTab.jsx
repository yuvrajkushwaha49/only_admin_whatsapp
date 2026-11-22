import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
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

const STATUS_COLORS = ['#6366f1', '#10b981', '#06b6d4', '#ef4444'];

export default function OverviewTab({ stats, loading }) {
  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status"></div>
        <div className="text-secondary small mt-2">Loading analytics overview from database...</div>
      </div>
    );
  }

  const deliveryTrend = stats?.deliveryTrend || [];
  const statusDist = (stats?.statusDistribution || []).filter(item => item.value > 0);
  const contactGrowth = stats?.contactGrowth || [];

  const summary = stats?.deliverySummary || {
    sent: 0,
    sentPct: 100,
    delivered: 0,
    deliveredPct: 0,
    read: 0,
    readPct: 0,
    failed: 0,
    failedPct: 0
  };

  const hasAnyData = summary.sent > 0 || (stats?.kpis?.totalContacts || 0) > 0;

  return (
    <div>
      {/* Top Row: Delivery Trend Chart + Funnel Breakdown */}
      <div className="row g-4 mb-4">
        <div className="col-12 col-lg-8">
          <div className="analytics-chart-box">
            <div className="analytics-chart-header">
              <h3 className="analytics-chart-title">
                <i className="bi bi-graph-up text-primary"></i>
                <span>Message Delivery Trend</span>
              </h3>
              <div className="d-flex align-items-center gap-3 small text-secondary">
                <span className="d-flex align-items-center gap-1">
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#6366f1', display: 'inline-block' }}></span>
                  <span>Sent</span>
                </span>
                <span className="d-flex align-items-center gap-1">
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
                  <span>Delivered</span>
                </span>
              </div>
            </div>

            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={deliveryTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={{ stroke: '#e2e8f0' }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                  />
                  <Line type="monotone" dataKey="sent" stroke="#6366f1" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="delivered" stroke="#10b981" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Funnel Rates Card */}
        <div className="col-12 col-lg-4">
          <div className="analytics-chart-box">
            <div className="analytics-chart-header">
              <h3 className="analytics-chart-title">
                <i className="bi bi-funnel-fill text-primary"></i>
                <span>Delivery Funnel</span>
              </h3>
            </div>

            <div className="d-flex flex-column justify-content-around flex-grow-1">
              <div className="analytics-rate-item">
                <div className="analytics-rate-label text-dark">
                  <span>Total Sent</span>
                  <span>{summary.sent.toLocaleString()} (100%)</span>
                </div>
                <div className="analytics-rate-bar-bg">
                  <div className="analytics-rate-bar-fill" style={{ width: '100%', background: '#6366f1' }}></div>
                </div>
              </div>

              <div className="analytics-rate-item">
                <div className="analytics-rate-label text-dark">
                  <span>Delivered</span>
                  <span>{summary.delivered.toLocaleString()} ({summary.deliveredPct}%)</span>
                </div>
                <div className="analytics-rate-bar-bg">
                  <div className="analytics-rate-bar-fill" style={{ width: `${Math.min(100, summary.deliveredPct)}%`, background: '#10b981' }}></div>
                </div>
              </div>

              <div className="analytics-rate-item">
                <div className="analytics-rate-label text-dark">
                  <span>Read / Opened</span>
                  <span>{summary.read.toLocaleString()} ({summary.readPct}%)</span>
                </div>
                <div className="analytics-rate-bar-bg">
                  <div className="analytics-rate-bar-fill" style={{ width: `${Math.min(100, summary.readPct)}%`, background: '#06b6d4' }}></div>
                </div>
              </div>

              <div className="analytics-rate-item">
                <div className="analytics-rate-label text-dark">
                  <span>Failed</span>
                  <span>{summary.failed.toLocaleString()} ({summary.failedPct}%)</span>
                </div>
                <div className="analytics-rate-bar-bg">
                  <div className="analytics-rate-bar-fill" style={{ width: `${Math.min(100, summary.failedPct)}%`, background: '#ef4444' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row: Status Donut + Contact Growth */}
      <div className="row g-4">
        <div className="col-12 col-lg-5">
          <div className="analytics-chart-box">
            <div className="analytics-chart-header">
              <h3 className="analytics-chart-title">
                <i className="bi bi-pie-chart-fill text-primary"></i>
                <span>Status Distribution</span>
              </h3>
            </div>
            {statusDist.length === 0 ? (
              <div className="text-center py-5 text-muted my-auto">
                <i className="bi bi-pie-chart fs-1 text-secondary d-block mb-2"></i>
                <div className="small">No message dispatches recorded yet in database.</div>
              </div>
            ) : (
              <>
                <div style={{ width: '100%', height: 240 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusDist}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {statusDist.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color || STATUS_COLORS[index % STATUS_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="d-flex justify-content-center flex-wrap gap-3 small text-secondary mt-2">
                  {statusDist.map((item, idx) => (
                    <span key={item.name} className="d-flex align-items-center gap-1">
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: item.color || STATUS_COLORS[idx % STATUS_COLORS.length] }}></span>
                      <span>{item.name}: <strong>{item.value}</strong></span>
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="col-12 col-lg-7">
          <div className="analytics-chart-box">
            <div className="analytics-chart-header">
              <h3 className="analytics-chart-title">
                <i className="bi bi-people-fill text-primary"></i>
                <span>Audience & Contact Growth</span>
              </h3>
              <span className="badge bg-light text-dark border">
                Total Contacts: {stats?.kpis?.totalContacts || 0}
              </span>
            </div>
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={contactGrowth} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="contactGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#7c3aed" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={{ stroke: '#e2e8f0' }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0' }} />
                  <Area type="monotone" dataKey="contacts" stroke="#7c3aed" strokeWidth={3} fillOpacity={1} fill="url(#contactGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
