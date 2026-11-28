import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';

const DEFAULT_BILLING_HUB_URL = 'https://business.facebook.com/billing_hub/payment_settings';

/**
 * Opens Meta Business Billing / Payment Settings inside a centered browser popup window
 * and invokes `onPopupClosed` when the user closes the popup.
 */
export function openMetaBillingPopup(url = DEFAULT_BILLING_HUB_URL, onPopupClosed = null) {
  const targetUrl = url || DEFAULT_BILLING_HUB_URL;
  const width = 980;
  const height = 760;
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2.5));

  const popup = window.open(
    targetUrl,
    'MetaBusinessBillingPopup',
    `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes,status=1`
  );

  if (!popup || popup.closed || typeof popup.closed === 'undefined') {
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
    return null;
  }

  if (typeof onPopupClosed === 'function') {
    const timer = setInterval(() => {
      try {
        if (popup.closed) {
          clearInterval(timer);
          onPopupClosed();
        }
      } catch (_) {
        clearInterval(timer);
      }
    }, 600);
  }

  return popup;
}

export default function MetaBillingCard({ variant = 'card', wabaId = null, className = '' }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    fetchStatus(true);
    return () => {
      mountedRef.current = false;
    };
  }, [wabaId]);

  const fetchStatus = async (initial = false) => {
    try {
      if (initial) setLoading(true);
      else setRefreshing(true);

      const url = wabaId
        ? `/whatsapp/accounts/billing-status?wabaId=${encodeURIComponent(wabaId)}`
        : '/whatsapp/accounts/billing-status';
      const res = await api.get(url);
      if (mountedRef.current && res.data?.success && res.data.data) {
        setStatus(res.data.data);
      }
    } catch (_) {
      // Silently preserve graceful UI fallback
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  const handleOpenBillingPopup = (useSettingsUrl = false) => {
    const url = useSettingsUrl
      ? status?.whatsappBillingSettingsUrl || status?.billingHubUrl
      : status?.billingHubUrl || DEFAULT_BILLING_HUB_URL;
    openMetaBillingPopup(url, () => fetchStatus(false));
  };

  if (loading && !status) {
    return null;
  }

  const canSend = status?.canSendMessages || 'UNKNOWN';
  const isAvailable = canSend === 'AVAILABLE';
  const hasIssue = Boolean(status?.hasPaymentIssue);

  const badgeClass = hasIssue
    ? 'bg-danger-subtle text-danger border border-danger-subtle'
    : isAvailable
      ? 'bg-success-subtle text-success border border-success-subtle'
      : 'bg-warning-subtle text-dark border border-warning-subtle';

  const badgeLabel = hasIssue
    ? 'Payment / Billing Required'
    : isAvailable
      ? 'Ready for Broadcasts'
      : canSend === 'LIMITED'
        ? 'Limited Messaging'
        : 'Meta Billing Link Ready';

  if (variant === 'compact') {
    return (
      <div
        className={`p-3 rounded-3 border bg-white shadow-xs d-flex flex-wrap align-items-center justify-content-between gap-3 ${className}`}
        style={{ borderColor: hasIssue ? '#fecaca' : '#e2e8f0' }}
      >
        <div className="d-flex align-items-center gap-3">
          <div
            className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
            style={{
              width: '40px',
              height: '40px',
              background: hasIssue ? '#fef2f2' : '#ecfdf5',
              color: hasIssue ? '#dc2626' : '#059669'
            }}
          >
            <i className="bi bi-credit-card-2-front-fill fs-5"></i>
          </div>
          <div>
            <div className="d-flex flex-wrap align-items-center gap-2">
              <strong className="small text-dark">Meta WhatsApp Campaign Billing</strong>
              <span className={`badge ${badgeClass}`} style={{ fontSize: '0.7rem' }}>
                {badgeLabel}
              </span>
              {status?.currency && (
                <span className="badge bg-light text-secondary border" style={{ fontSize: '0.7rem' }}>
                  {status.currency}
                </span>
              )}
            </div>
            <div className="text-muted small" style={{ fontSize: '0.78rem' }}>
              {hasIssue && status?.paymentIssueMessage
                ? status.paymentIssueMessage
                : 'Campaign charges are billed directly by Meta on your Business Portfolio.'}
              {status?.metaBusinessId && (
                <span className="ms-1">
                  (Business ID: <code>{status.metaBusinessId}</code>)
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="d-flex flex-wrap align-items-center gap-2">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            disabled={refreshing}
            onClick={() => fetchStatus(false)}
            title="Re-check live WABA health & billing readiness on Meta"
          >
            <i className={`bi bi-arrow-clockwise ${refreshing ? 'spin' : ''}`}></i>
          </button>
          <button
            type="button"
            className="btn btn-sm btn-success fw-semibold d-inline-flex align-items-center gap-1"
            onClick={() => handleOpenBillingPopup(false)}
          >
            <i className="bi bi-box-arrow-up-right"></i>
            <span>Add / Manage Meta Payment</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`card border-0 shadow-sm mb-4 ${className}`} style={{ borderRadius: '14px', overflow: 'hidden' }}>
      <div className="card-body p-4 bg-white">
        <div className="d-flex flex-wrap align-items-start justify-content-between gap-3">
          <div className="d-flex align-items-start gap-3">
            <div
              className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
              style={{
                width: '48px',
                height: '48px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#fff'
              }}
            >
              <i className="bi bi-credit-card-fill fs-4"></i>
            </div>
            <div>
              <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                <h6 className="fw-bold mb-0 text-dark">Meta Cloud API Billing &amp; Payment Method</h6>
                <span className={`badge ${badgeClass}`}>{badgeLabel}</span>
              </div>
              <p className="text-secondary small mb-2" style={{ maxWidth: '680px' }}>
                WhatsApp marketing and utility campaign charges are billed directly by Meta on your connected Business Portfolio.
                Click below to open Meta&apos;s official Billing Hub in a popup window and attach a Debit/Credit card (Admin / Finance Facebook login required).
              </p>

              <div className="d-flex flex-wrap align-items-center gap-3 small text-muted">
                {status?.metaBusinessId && (
                  <span>
                    Business ID: <code className="text-primary">{status.metaBusinessId}</code>
                  </span>
                )}
                {status?.wabaId && (
                  <span>
                    WABA ID: <code className="text-dark">{status.wabaId}</code>
                  </span>
                )}
                {status?.currency && (
                  <span>
                    Currency: <strong className="text-dark">{status.currency}</strong>
                  </span>
                )}
                {status?.accountReviewStatus && (
                  <span>
                    WABA Review: <strong className="text-success">{status.accountReviewStatus}</strong>
                  </span>
                )}
              </div>

              {hasIssue && status?.paymentIssueMessage && (
                <div className="alert alert-danger py-2 px-3 small mt-3 mb-0">
                  <i className="bi bi-exclamation-triangle-fill me-2"></i>
                  {status.paymentIssueMessage}
                </div>
              )}
            </div>
          </div>

          <div className="d-flex flex-wrap align-items-center gap-2">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1"
              disabled={refreshing}
              onClick={() => fetchStatus(false)}
            >
              <i className={`bi bi-arrow-clockwise ${refreshing ? 'spin' : ''}`}></i>
              <span>{refreshing ? 'Checking...' : 'Check Status'}</span>
            </button>

            <button
              type="button"
              className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1"
              onClick={() => handleOpenBillingPopup(true)}
            >
              <i className="bi bi-gear"></i>
              <span>WABA Settings</span>
            </button>

            <button
              type="button"
              className="btn btn-success btn-sm fw-semibold d-inline-flex align-items-center gap-2 px-3"
              onClick={() => handleOpenBillingPopup(false)}
            >
              <i className="bi bi-box-arrow-up-right"></i>
              <span>Add Meta Payment (Popup)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
