import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../services/api';
import AiwavoHeader from '../components/AiwavoHeader';
import MetaBillingCard from '../components/MetaBillingCard';
import '../styles/billing.css';

export default function Billing() {
  const outletContext = useOutletContext();
  const onToggleSidebar = outletContext?.onToggleSidebar;
  const [usage, setUsage] = useState(null);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchUsageData();
  }, []);

  const fetchUsageData = async () => {
    try {
      const usageRes = await api.get('/billing/usage').catch(() => ({ data: { success: false } }));
      if (usageRes.data?.success && usageRes.data.data) {
        setUsage(usageRes.data.data);
      }
    } catch (err) {
      console.error('Failed to load usage details', err);
    }
  };

  const contactsCurrent = usage?.metrics?.contacts?.current ?? 0;
  const contactsLimit = usage?.metrics?.contacts?.limit ?? 15000;
  const contactsPercent = usage?.metrics?.contacts?.percentage ?? (contactsLimit > 0 ? Math.round((contactsCurrent / contactsLimit) * 100) : 0);

  const messagesCurrent = usage?.metrics?.messages?.current ?? 0;
  const messagesLimit = usage?.metrics?.messages?.limit ?? 75000;
  const messagesPercent = usage?.metrics?.messages?.percentage ?? (messagesLimit > 0 ? Math.round((messagesCurrent / messagesLimit) * 100) : 0);

  const currentPeriod = usage?.periodMonth ?? new Date().toISOString().substring(0, 7);

  const campaignsCurrent = usage?.metrics?.campaigns?.current ?? 0;
  const campaignsLimit = usage?.metrics?.campaigns?.limit ?? 50;
  const campaignsPercent = usage?.metrics?.campaigns?.percentage ?? (campaignsLimit > 0 ? Math.round((campaignsCurrent / campaignsLimit) * 100) : 0);

  return (
    <div>
      <AiwavoHeader
        title="Billing & Meta Payment"
        subtitle="Manage Meta WhatsApp payment method and workspace broadcast usage"
        onToggleSidebar={onToggleSidebar}
      />

      <div className="billing-page-container">
        {feedback.text && (
          <div className={`alert alert-${feedback.type} alert-dismissible fade show mb-4`} role="alert">
            {feedback.text}
            <button type="button" className="btn-close" onClick={() => setFeedback({ type: '', text: '' })}></button>
          </div>
        )}

        {/* 1. Hero Banner */}
        <div className="billing-hero-banner">
          <div className="billing-hero-left">
            <div className="billing-hero-icon">
              <i className="bi bi-credit-card-2-front-fill fs-4"></i>
            </div>
            <div>
              <h1 className="billing-hero-title">Meta Billing &amp; Usage Overview</h1>
              <p className="billing-hero-subtitle">
                Manage your Meta WhatsApp Cloud API payment method and track monthly messaging volume.
              </p>
            </div>
          </div>
        </div>

        {/* 2. Meta Cloud API Payment & Billing Status */}
        <MetaBillingCard variant="card" />

        {/* 3. Usage / Quota Metric Cards */}
        <div className="billing-metrics-row">
          {/* Card 1: Stored Audience Contacts */}
          <div className="billing-metric-card">
            <div className="billing-metric-icon icon-contacts">
              <svg
                viewBox="0 0 24 24"
                width="22"
                height="22"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div className="billing-metric-content">
              <div className="billing-metric-label">Stored Audience Contacts</div>
              <div className="billing-metric-val">
                {contactsCurrent.toLocaleString()} / {contactsLimit.toLocaleString()}
              </div>
              <div className="billing-progress-track">
                <div
                  className="billing-progress-fill fill-emerald"
                  style={{ width: `${Math.min(100, Math.max(contactsPercent, contactsCurrent > 0 ? 2 : 0))}%` }}
                ></div>
              </div>
              <div className="billing-metric-sub">{contactsPercent}% of contact quota used</div>
            </div>
          </div>

          {/* Card 2: Monthly Messages Dispatched */}
          <div className="billing-metric-card">
            <div className="billing-metric-icon icon-messages">
              <svg
                viewBox="0 0 24 24"
                width="22"
                height="22"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </div>
            <div className="billing-metric-content">
              <div className="billing-metric-label">Monthly Messages Dispatched</div>
              <div className="billing-metric-val">
                {messagesCurrent.toLocaleString()} / {messagesLimit.toLocaleString()}
              </div>
              <div className="billing-progress-track">
                <div
                  className="billing-progress-fill fill-blue"
                  style={{ width: `${Math.min(100, Math.max(messagesPercent, messagesCurrent > 0 ? 1 : 0))}%` }}
                ></div>
              </div>
              <div className="billing-metric-sub">Period: {currentPeriod}</div>
            </div>
          </div>

          {/* Card 3: Campaigns Executed */}
          <div className="billing-metric-card">
            <div className="billing-metric-icon icon-campaigns">
              <svg
                viewBox="0 0 24 24"
                width="22"
                height="22"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
            </div>
            <div className="billing-metric-content">
              <div className="billing-metric-label">Campaigns Executed</div>
              <div className="billing-metric-val">
                {campaignsCurrent.toLocaleString()} / {campaignsLimit.toLocaleString()}
              </div>
              <div className="billing-progress-track">
                <div
                  className="billing-progress-fill fill-amber"
                  style={{ width: `${Math.min(100, Math.max(campaignsPercent, campaignsCurrent > 0 ? 4 : 0))}%` }}
                ></div>
              </div>
              <div className="billing-metric-sub">{campaignsPercent}% of campaign quota</div>
            </div>
          </div>
        </div>

        {/* 4. Pricing Transparency Callout */}
        <div className="billing-transparency-box">
          <svg
            className="billing-transparency-icon"
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <div className="billing-transparency-text">
            <strong>Direct Meta Billing:</strong> Official WhatsApp marketing, utility, and authentication conversation
            charges are billed directly through your linked Meta Payment Method as per Meta&apos;s rate cards — with zero
            third-party markup.
          </div>
        </div>
      </div>
    </div>
  );
}
