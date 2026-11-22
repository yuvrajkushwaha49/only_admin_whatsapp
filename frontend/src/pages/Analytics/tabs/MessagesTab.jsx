import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';

export default function MessagesTab({ messagesData, loading }) {
  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status"></div>
        <div className="text-secondary small mt-2">Loading message activity metrics...</div>
      </div>
    );
  }

  const hourly = messagesData?.hourlyActivity || [];
  const inboundCount = messagesData?.inboundCount || 0;
  const outboundCount = messagesData?.outboundCount || 0;
  const deliveredCount = messagesData?.deliveredCount || 0;
  const readCount = messagesData?.readCount || 0;
  const failedCount = messagesData?.failedCount || 0;
  const totalVolume = inboundCount + outboundCount;

  return (
    <div>
      {/* 4 Stats Cards */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-sm-6 col-lg-3">
          <div className="p-3 rounded-3" style={{ background: '#f8fafc', border: '1px solid #E5EAF2' }}>
            <div className="text-secondary small fw-semibold">Outbound Messages</div>
            <div className="fs-4 fw-bold text-primary mt-1">{outboundCount}</div>
            <div className="small text-muted mt-1">{totalVolume > 0 ? Math.round((outboundCount / totalVolume) * 100) : 0}% of traffic</div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-lg-3">
          <div className="p-3 rounded-3" style={{ background: '#f8fafc', border: '1px solid #E5EAF2' }}>
            <div className="text-secondary small fw-semibold">Inbound Replies</div>
            <div className="fs-4 fw-bold text-success mt-1">{inboundCount}</div>
            <div className="small text-muted mt-1">{totalVolume > 0 ? Math.round((inboundCount / totalVolume) * 100) : 0}% response rate</div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-lg-3">
          <div className="p-3 rounded-3" style={{ background: '#f8fafc', border: '1px solid #E5EAF2' }}>
            <div className="text-secondary small fw-semibold">Read Receipts</div>
            <div className="fs-4 fw-bold text-info mt-1">{readCount}</div>
            <div className="small text-muted mt-1">{outboundCount > 0 ? Math.round((readCount / outboundCount) * 100) : 0}% confirmed reads</div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-lg-3">
          <div className="p-3 rounded-3" style={{ background: '#f8fafc', border: '1px solid #E5EAF2' }}>
            <div className="text-secondary small fw-semibold">Failed Dispatches</div>
            <div className="fs-4 fw-bold text-danger mt-1">{failedCount}</div>
            <div className="small text-muted mt-1">{outboundCount > 0 ? Math.round((failedCount / outboundCount) * 100) : 0}% failure rate</div>
          </div>
        </div>
      </div>

      {/* Hourly Activity Bar Chart */}
      <div className="analytics-chart-box">
        <div className="analytics-chart-header">
          <div>
            <h3 className="analytics-chart-title">
              <i className="bi bi-clock-history text-primary"></i>
              <span>Peak Engagement Hours (24-Hour Distribution)</span>
            </h3>
            <p className="text-muted small m-0 mt-1">Discover what time of day your audience is most responsive on WhatsApp.</p>
          </div>
          <div className="d-flex align-items-center gap-3 small text-secondary">
            <span className="d-flex align-items-center gap-1">
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#7c3aed', display: 'inline-block' }}></span>
              <span>Outbound</span>
            </span>
            <span className="d-flex align-items-center gap-1">
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
              <span>Inbound</span>
            </span>
          </div>
        </div>

        <div style={{ width: '100%', height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourly} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="hour" tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0' }} />
              <Bar dataKey="outbound" fill="#7c3aed" radius={[3, 3, 0, 0]} stackId="a" />
              <Bar dataKey="inbound" fill="#10b981" radius={[3, 3, 0, 0]} stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

