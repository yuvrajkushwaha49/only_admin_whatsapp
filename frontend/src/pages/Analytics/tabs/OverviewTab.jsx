import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';

export default function OverviewTab({ data, loading }) {
  if (loading) {
    return (
      <div className="py-5 text-center">
        <div className="spinner-border text-primary" role="status"></div>
        <div className="text-secondary small mt-2">Loading overview analytics...</div>
      </div>
    );
  }

  const kpis = data?.kpis || {};
  const timeline = data?.activityTimeline || [];
  const topCampaigns = data?.topCampaigns || [];
  const numberPerformance = data?.numberPerformance || [];
  const recentMessages = data?.recentMessages || [];

  // Direction pie chart data
  const directionData = [
    { name: 'Outgoing (Broadcast / Direct)', value: kpis.outgoing?.value || 0, color: '#7c3aed' },
    { name: 'Incoming (Customer Replies)', value: kpis.incoming?.value || 0, color: '#0284c7' }
  ];

  // Status breakdown data
  const statusData = [
    { name: 'Delivered', value: kpis.delivered?.value || 0, color: '#10b981' },
    { name: 'Read', value: kpis.read?.value || 0, color: '#0284c7' },
    { name: 'Failed', value: kpis.failed?.value || 0, color: '#ef4444' },
    { name: 'Pending / Queued', value: kpis.pending?.value || 0, color: '#f59e0b' }
  ];

  const renderDelta = (kpi) => {
    if (!kpi || kpi.delta === undefined) return null;
    const dir = kpi.direction || 'neutral';
    return (
      <div className={`an-delta-pill ${dir}`}>
        {dir === 'up' && <i className="bi bi-arrow-up-short"></i>}
        {dir === 'down' && <i className="bi bi-arrow-down-short"></i>}
        {dir === 'neutral' && <i className="bi bi-dash"></i>}
        <span>{kpi.delta}% vs prev</span>
      </div>
    );
  };

  return (
    <div>
      {/* 8 KPIs Grid (2 rows of 4 cards) */}
      <div className="an-kpi-grid-4">
        {/* Total Messages */}
        <div className="cg-stat-card">
          <div className="cg-stat-icon-wrap cg-stat-icon-blue">
            <i className="bi bi-chat-left-dots-fill"></i>
          </div>
          <div>
            <div className="cg-stat-label" title="Total unique messages inbound and outbound">
              Total Messages <i className="bi bi-info-circle ms-1 small text-muted"></i>
            </div>
            <div className="cg-stat-value">{kpis.totalMessages?.value?.toLocaleString() || 0}</div>
            {renderDelta(kpis.totalMessages)}
          </div>
        </div>

        {/* Sent Messages */}
        <div className="cg-stat-card">
          <div className="cg-stat-icon-wrap cg-stat-icon-blue">
            <i className="bi bi-send-fill"></i>
          </div>
          <div>
            <div className="cg-stat-label" title="Messages successfully dispatched to Meta WhatsApp Cloud API">
              Sent Messages <i className="bi bi-info-circle ms-1 small text-muted"></i>
            </div>
            <div className="cg-stat-value">{kpis.sent?.value?.toLocaleString() || 0}</div>
            {renderDelta(kpis.sent)}
          </div>
        </div>

        {/* Delivered Messages */}
        <div className="cg-stat-card">
          <div className="cg-stat-icon-wrap cg-stat-icon-green">
            <i className="bi bi-check2-all"></i>
          </div>
          <div>
            <div className="cg-stat-label" title="Confirmed delivered to customer devices by Meta webhook">
              Delivered Messages <i className="bi bi-info-circle ms-1 small text-muted"></i>
            </div>
            <div className="cg-stat-value text-green">{kpis.delivered?.value?.toLocaleString() || 0}</div>
            {renderDelta(kpis.delivered)}
          </div>
        </div>

        {/* Read Messages */}
        <div className="cg-stat-card">
          <div className="cg-stat-icon-wrap cg-stat-icon-cyan">
            <i className="bi bi-eye-fill"></i>
          </div>
          <div>
            <div className="cg-stat-label" title="Messages opened and read by recipient">
              Read Messages <i className="bi bi-info-circle ms-1 small text-muted"></i>
            </div>
            <div className="cg-stat-value" style={{ color: '#0284c7' }}>{kpis.read?.value?.toLocaleString() || 0}</div>
            {renderDelta(kpis.read)}
          </div>
        </div>

        {/* Failed Messages */}
        <div className="cg-stat-card">
          <div className="cg-stat-icon-wrap" style={{ background: '#fee2e2', color: '#dc2626' }}>
            <i className="bi bi-exclamation-triangle-fill"></i>
          </div>
          <div>
            <div className="cg-stat-label" title="Messages rejected or undeliverable">
              Failed Messages <i className="bi bi-info-circle ms-1 small text-muted"></i>
            </div>
            <div className="cg-stat-value" style={{ color: '#dc2626' }}>{kpis.failed?.value?.toLocaleString() || 0}</div>
            {renderDelta(kpis.failed)}
          </div>
        </div>

        {/* Pending / Queued Messages */}
        <div className="cg-stat-card">
          <div className="cg-stat-icon-wrap" style={{ background: '#fef3c7', color: '#d97706' }}>
            <i className="bi bi-hourglass-split"></i>
          </div>
          <div>
            <div className="cg-stat-label" title="Messages queued in streaming batch worker">
              Pending Messages <i className="bi bi-info-circle ms-1 small text-muted"></i>
            </div>
            <div className="cg-stat-value" style={{ color: '#d97706' }}>{kpis.pending?.value?.toLocaleString() || 0}</div>
            {renderDelta(kpis.pending)}
          </div>
        </div>

        {/* Outgoing Messages */}
        <div className="cg-stat-card">
          <div className="cg-stat-icon-wrap cg-stat-icon-blue">
            <i className="bi bi-arrow-up-right-circle-fill"></i>
          </div>
          <div>
            <div className="cg-stat-label">Outgoing Messages</div>
            <div className="cg-stat-value">{kpis.outgoing?.value?.toLocaleString() || 0}</div>
            {renderDelta(kpis.outgoing)}
          </div>
        </div>

        {/* Incoming Messages */}
        <div className="cg-stat-card">
          <div className="cg-stat-icon-wrap cg-stat-icon-cyan">
            <i className="bi bi-arrow-down-left-circle-fill"></i>
          </div>
          <div>
            <div className="cg-stat-label">Incoming Messages</div>
            <div className="cg-stat-value" style={{ color: '#0284c7' }}>{kpis.incoming?.value?.toLocaleString() || 0}</div>
            {renderDelta(kpis.incoming)}
          </div>
        </div>
      </div>

      {/* Conversion & Success Rates Row */}
      <div className="cg-card mb-4">
        <div className="cg-card-header">
          <h3 className="cg-card-title">
            <i className="bi bi-shield-check text-primary me-2"></i>
            Message Delivery & Engagement Rates
          </h3>
          <span className="text-secondary small">Calculated from verified Meta webhook delivery receipts</span>
        </div>
        <div className="row g-4 pt-2">
          <div className="col-12 col-md-4">
            <div className="p-3 rounded-3" style={{ background: '#ecfdf5', border: '1px solid #a7f3d0' }}>
              <div className="d-flex align-items-center justify-content-between">
                <span className="fw-semibold text-secondary small">Delivery Rate (Delivered / Sent)</span>
                <i className="bi bi-check-circle-fill text-success fs-5"></i>
              </div>
              <div className="fs-2 fw-bold text-success mt-2">{kpis.deliveryRate?.value || 0}%</div>
              <div className="small text-muted mt-1">Target benchmark: &gt; 95%</div>
            </div>
          </div>

          <div className="col-12 col-md-4">
            <div className="p-3 rounded-3" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
              <div className="d-flex align-items-center justify-content-between">
                <span className="fw-semibold text-secondary small">Read Rate (Read / Delivered)</span>
                <i className="bi bi-eye-fill text-primary fs-5"></i>
              </div>
              <div className="fs-2 fw-bold text-primary mt-2">{kpis.readRate?.value || 0}%</div>
              <div className="small text-muted mt-1">Average WhatsApp engagement: ~60-80%</div>
            </div>
          </div>

          <div className="col-12 col-md-4">
            <div className="p-3 rounded-3" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
              <div className="d-flex align-items-center justify-content-between">
                <span className="fw-semibold text-secondary small">Failure Rate (Failed / Sent)</span>
                <i className="bi bi-x-circle-fill text-danger fs-5"></i>
              </div>
              <div className="fs-2 fw-bold text-danger mt-2">{kpis.failureRate?.value || 0}%</div>
              <div className="small text-muted mt-1">Healthy threshold: &lt; 3%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row: Daily Message Timeline + Incoming vs Outgoing */}
      <div className="row g-4 mb-4">
        {/* Main Timeline Chart */}
        <div className="col-12 col-lg-8">
          <div className="an-chart-card">
            <div className="an-chart-header">
              <div>
                <h4 className="an-chart-title">
                  <i className="bi bi-graph-up text-primary"></i>
                  Daily Message Activity
                </h4>
                <div className="an-chart-subtitle">Sent, Delivered, Read, and Inbound messages volume over selected date range</div>
              </div>
            </div>
            <div style={{ width: '100%', height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeline} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorDelivered" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorRead" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0284c7" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#0284c7" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickFormatter={(val) => val.slice(5)} />
                  <YAxis stroke="#94a3b8" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" />
                  <Area type="monotone" dataKey="delivered" name="Delivered" stroke="#10b981" fillOpacity={1} fill="url(#colorDelivered)" strokeWidth={2} />
                  <Area type="monotone" dataKey="read" name="Read" stroke="#0284c7" fillOpacity={1} fill="url(#colorRead)" strokeWidth={2} />
                  <Area type="monotone" dataKey="failed" name="Failed" stroke="#ef4444" fill="none" strokeWidth={2} />
                  <Area type="monotone" dataKey="inbound" name="Incoming" stroke="#f59e0b" fill="none" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Incoming vs Outgoing Breakdown Pie Chart */}
        <div className="col-12 col-lg-4">
          <div className="an-chart-card">
            <div className="an-chart-header">
              <div>
                <h4 className="an-chart-title">
                  <i className="bi bi-pie-chart text-primary"></i>
                  Message Direction
                </h4>
                <div className="an-chart-subtitle">Incoming customer replies vs Outgoing broadcasts</div>
              </div>
            </div>
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={directionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {directionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="d-flex flex-column gap-2 mt-2">
              {directionData.map((d, i) => (
                <div key={i} className="d-flex align-items-center justify-content-between small">
                  <div className="d-flex align-items-center gap-2">
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: d.color }}></span>
                    <span className="text-secondary">{d.name}</span>
                  </div>
                  <span className="fw-bold text-dark">{d.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Top Performing Campaigns Table */}
      <div className="cg-card mb-4">
        <div className="cg-card-header">
          <h3 className="cg-card-title">
            <i className="bi bi-trophy-fill text-warning me-2"></i>
            Top Performing Campaigns
          </h3>
          <span className="text-secondary small">Ranked by verified delivery volume and engagement</span>
        </div>
        <div className="table-responsive">
          <table className="table cf-table mb-0 align-middle">
            <thead>
              <tr>
                <th>Campaign</th>
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
              {topCampaigns.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-4 text-muted">
                    No campaign records found in this date range.
                  </td>
                </tr>
              ) : (
                topCampaigns.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="fw-bold text-dark">{c.name}</div>
                      <div className="small text-muted">ID: #{c.id}</div>
                    </td>
                    <td>
                      <span className={`badge ${c.status === 'completed' ? 'bg-success' : 'bg-primary'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td>{c.total_recipients?.toLocaleString()}</td>
                    <td>{c.sent_count?.toLocaleString()}</td>
                    <td className="text-success fw-semibold">{c.delivered_count?.toLocaleString()}</td>
                    <td className="text-primary fw-semibold">{c.read_count?.toLocaleString()}</td>
                    <td>
                      <span className="an-rate-badge green">{c.delivery_rate || 0}%</span>
                    </td>
                    <td>
                      <span className="an-rate-badge blue">{c.read_rate || 0}%</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* WhatsApp Numbers Performance Summary */}
      <div className="cg-card mb-4">
        <div className="cg-card-header">
          <h3 className="cg-card-title">
            <i className="bi bi-telephone-fill text-primary me-2"></i>
            WhatsApp Number Performance
          </h3>
          <span className="text-secondary small">Connected lines delivery metrics and status</span>
        </div>
        <div className="table-responsive">
          <table className="table cf-table mb-0 align-middle">
            <thead>
              <tr>
                <th>Line Name</th>
                <th>Phone Number</th>
                <th>Status</th>
                <th>Quality Rating</th>
                <th>Messages</th>
                <th>Delivered</th>
                <th>Delivery Rate</th>
              </tr>
            </thead>
            <tbody>
              {numberPerformance.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-4 text-muted">
                    No WhatsApp numbers allocated to this account.
                  </td>
                </tr>
              ) : (
                numberPerformance.map((num) => (
                  <tr key={num.id}>
                    <td className="fw-bold text-dark">{num.displayName}</td>
                    <td><code>{num.phoneNumber}</code></td>
                    <td>
                      <span className={`badge ${num.status === 'Connected' ? 'bg-success' : 'bg-danger'}`}>
                        {num.status}
                      </span>
                    </td>
                    <td>
                      <span className="badge bg-light text-dark border">
                        <i className="bi bi-circle-fill text-success me-1 small"></i>
                        {num.qualityRating}
                      </span>
                    </td>
                    <td>{num.totalMessages.toLocaleString()}</td>
                    <td className="text-success fw-semibold">{num.delivered.toLocaleString()}</td>
                    <td>
                      <span className="an-rate-badge green">{num.deliveryRate}%</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Message Activity (Latest 10) */}
      <div className="cg-card">
        <div className="cg-card-header">
          <h3 className="cg-card-title">
            <i className="bi bi-clock-history text-primary me-2"></i>
            Recent Message Activity
          </h3>
          <span className="text-secondary small">Real-time log of latest dispatched and received messages</span>
        </div>
        <div className="table-responsive">
          <table className="table cf-table mb-0 align-middle">
            <thead>
              <tr>
                <th>Contact</th>
                <th>Phone</th>
                <th>Direction</th>
                <th>Type</th>
                <th>Status</th>
                <th>Line</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {recentMessages.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-4 text-muted">
                    No recent message activities.
                  </td>
                </tr>
              ) : (
                recentMessages.map((m) => (
                  <tr key={m.id}>
                    <td className="fw-bold text-dark">{m.contact_name || 'Anonymous Contact'}</td>
                    <td><code>{m.contact_phone || 'N/A'}</code></td>
                    <td>
                      <span className={`badge ${m.direction === 'OUTBOUND' ? 'bg-primary' : 'bg-info'}`}>
                        {m.direction}
                      </span>
                    </td>
                    <td><span className="badge bg-light text-secondary border">{m.message_type || 'text'}</span></td>
                    <td>
                      <span className={`badge ${m.message_status === 'delivered' || m.message_status === 'read' ? 'bg-success' : (m.message_status === 'failed' ? 'bg-danger' : 'bg-secondary')}`}>
                        {m.message_status}
                      </span>
                    </td>
                    <td className="small text-secondary">{m.account_name || m.account_phone || 'Default'}</td>
                    <td className="small text-muted">{new Date(m.created_at).toLocaleString()}</td>
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
