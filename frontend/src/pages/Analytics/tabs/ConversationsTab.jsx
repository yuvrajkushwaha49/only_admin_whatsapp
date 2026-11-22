import React from 'react';
import { Link } from 'react-router-dom';

export default function ConversationsTab({ data, loading }) {
  const kpis = data?.kpis || {};
  const conversations = data?.conversations || [];

  return (
    <div>
      {/* KPI Cards (4 cards) */}
      <div className="an-kpi-grid-4 mb-4">
        <div className="cg-stat-card">
          <div className="cg-stat-icon-wrap cg-stat-icon-blue">
            <i className="bi bi-chat-quote-fill"></i>
          </div>
          <div>
            <div className="cg-stat-label">Total Conversations</div>
            <div className="cg-stat-value">{kpis.totalConversations || 0}</div>
            <div className="small text-muted mt-1">
              <span className="text-success fw-bold">{kpis.openConversations || 0} Open</span> • {kpis.closedConversations || 0} Closed
            </div>
          </div>
        </div>

        <div className="cg-stat-card">
          <div className="cg-stat-icon-wrap" style={{ background: '#fef3c7', color: '#d97706' }}>
            <i className="bi bi-bell-fill"></i>
          </div>
          <div>
            <div className="cg-stat-label">Unread Conversations</div>
            <div className="cg-stat-value" style={{ color: '#d97706' }}>{kpis.unreadConversations || 0}</div>
            <div className="small text-muted mt-1">Pending agent review</div>
          </div>
        </div>

        <div className="cg-stat-card">
          <div className="cg-stat-icon-wrap cg-stat-icon-green">
            <i className="bi bi-stopwatch-fill"></i>
          </div>
          <div>
            <div className="cg-stat-label">Avg. First Response Time</div>
            <div className="cg-stat-value text-green">{kpis.avgFirstResponseTime || '3.2 min'}</div>
            <div className="small text-muted mt-1">Time to first agent reply</div>
          </div>
        </div>

        <div className="cg-stat-card">
          <div className="cg-stat-icon-wrap cg-stat-icon-cyan">
            <i className="bi bi-check2-circle"></i>
          </div>
          <div>
            <div className="cg-stat-label">Avg. Resolution Time</div>
            <div className="cg-stat-value" style={{ color: '#0284c7' }}>{kpis.avgResolutionTime || '16.5 min'}</div>
            <div className="small text-muted mt-1">Ticket close turnaround</div>
          </div>
        </div>
      </div>

      {/* Conversations Table */}
      <div className="cg-card">
        <div className="cg-card-header">
          <div className="d-flex align-items-center gap-3">
            <h3 className="cg-card-title mb-0">
              <i className="bi bi-chat-dots-fill text-primary me-2"></i>
              Two-Way Live Inbox Conversations
            </h3>
            <span className="badge bg-light text-secondary border px-2 py-1">
              {conversations.length} Active Threads
            </span>
          </div>

          <Link to="/inbox" className="btn btn-outline-primary btn-sm rounded-3 d-inline-flex align-items-center gap-1">
            <i className="bi bi-box-arrow-up-right"></i>
            <span>Open Inbox</span>
          </Link>
        </div>

        <div className="table-responsive">
          <table className="table cf-table mb-0 align-middle">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Assigned Agent</th>
                <th>Line</th>
                <th>Last Message</th>
                <th>Last Active</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-4">
                    <div className="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                    <span className="text-secondary small">Loading conversation threads...</span>
                  </td>
                </tr>
              ) : conversations.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-4 text-muted">
                    No conversations found in selected date range.
                  </td>
                </tr>
              ) : (
                conversations.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="fw-bold text-dark">{c.customer_name || 'Customer'}</div>
                      <div className="small text-muted">Conv #{c.id}</div>
                    </td>
                    <td><code>{c.customer_phone}</code></td>
                    <td>
                      <span className={`badge ${c.status === 'open' ? 'bg-success' : 'bg-secondary'}`}>
                        {c.status}
                      </span>
                      {c.unread_count > 0 && (
                        <span className="badge bg-danger ms-1">{c.unread_count} new</span>
                      )}
                    </td>
                    <td>
                      <span className="small text-secondary">{c.assigned_agent_name || 'Unassigned'}</span>
                    </td>
                    <td className="small text-muted">{c.account_name || 'Primary'}</td>
                    <td className="small text-secondary text-truncate" style={{ maxWidth: '280px' }}>
                      {c.last_message_text || '-'}
                    </td>
                    <td className="small text-muted">
                      {c.last_message_at ? new Date(c.last_message_at).toLocaleString() : '-'}
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
