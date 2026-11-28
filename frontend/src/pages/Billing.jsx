import React from 'react';
import { useOutletContext } from 'react-router-dom';
import AiwavoHeader from '../components/AiwavoHeader';
import MetaBillingCard from '../components/MetaBillingCard';
import '../styles/billing.css';

export default function Billing() {
  const outletContext = useOutletContext();
  const onToggleSidebar = outletContext?.onToggleSidebar;

  return (
    <div>
      <AiwavoHeader
        title="Billing & Meta Payment"
        subtitle="Manage your Meta WhatsApp Cloud API payment method (No Workspace Quota Limits)"
        onToggleSidebar={onToggleSidebar}
      />

      <div className="billing-page-container">
        {/* 1. Hero Banner */}
        <div className="billing-hero-banner">
          <div className="billing-hero-left">
            <div className="billing-hero-icon">
              <i className="bi bi-credit-card-2-front-fill fs-4"></i>
            </div>
            <div>
              <h1 className="billing-hero-title">Meta Billing &amp; Payment Settings</h1>
              <p className="billing-hero-subtitle">
                Unlimited contacts, messages, and campaigns — charges apply directly via your linked Meta Payment Method.
              </p>
            </div>
          </div>
        </div>

        {/* 2. Meta Cloud API Payment & Billing Status */}
        <MetaBillingCard variant="card" />

        {/* 3. Pricing Transparency Callout */}
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
            platform quota restrictions.
          </div>
        </div>
      </div>
    </div>
  );
}
