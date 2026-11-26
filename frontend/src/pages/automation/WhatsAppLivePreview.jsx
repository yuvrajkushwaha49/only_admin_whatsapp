import React from 'react';

export default function WhatsAppLivePreview({
  step,
  businessName = 'Aiveexa WhatsApp',
  triggerKeyword = 'menu',
  fallbackConfig = null,
  showFallbackPrompt = false
}) {
  const content = step?.content || 'Hello! Welcome to our automated WhatsApp assistance.';
  const buttons = Array.isArray(step?.buttons) ? step.buttons : [];

  // Simulate dynamic variable replacement for preview
  const previewText = content
    .replace(/\{\{\s*name\s*\}\}/gi, 'Yuvraj')
    .replace(/\{\{\s*full_name\s*\}\}/gi, 'Yuvraj Kushwaha')
    .replace(/\{\{\s*phone\s*\}\}/gi, '+91 95657 63089')
    .replace(/\{\{\s*email\s*\}\}/gi, 'client@example.com')
    .replace(/\{\{\s*city\s*\}\}/gi, 'Mumbai');

  // Helper for basic WhatsApp bold formatting (*bold* -> <strong>)
  const formatWhatsAppText = (txt) => {
    return txt.split('\n').map((line, i) => {
      const parts = line.split(/(\*[^*]+\*)/g);
      return (
        <span key={i}>
          {parts.map((p, pIdx) => {
            if (p.startsWith('*') && p.endsWith('*')) {
              return <strong key={pIdx}>{p.slice(1, -1)}</strong>;
            }
            return p;
          })}
          {i < txt.split('\n').length - 1 && <br />}
        </span>
      );
    });
  };

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="preview-panel-col">
      <div className="d-flex align-items-center justify-content-between mb-2">
        <span className="fw-bold small text-muted text-uppercase">
          <i className="bi bi-phone me-1"></i> Live WhatsApp Preview
        </span>
        <span className="badge bg-success-subtle text-success small">Real-Time</span>
      </div>

      <div className="whatsapp-preview-frame">
        {/* Phone Notch */}
        <div className="whatsapp-phone-notch"></div>

        {/* WhatsApp Chat Header */}
        <div className="whatsapp-header-bar">
          <i className="bi bi-arrow-left text-white me-1" style={{ fontSize: '1.1rem' }}></i>
          <div className="whatsapp-header-avatar">
            <i className="bi bi-whatsapp"></i>
          </div>
          <div className="flex-grow-1 overflow-hidden">
            <div className="fw-bold text-truncate small" style={{ fontSize: '0.85rem' }}>
              {businessName} <i className="bi bi-patch-check-fill text-warning ms-1" title="Verified Business"></i>
            </div>
            <div className="small text-white-50" style={{ fontSize: '0.7rem' }}>
              Official Business Account
            </div>
          </div>
          <i className="bi bi-three-dots-vertical text-white"></i>
        </div>

        {/* Chat Conversation Body */}
        <div className="whatsapp-chat-body">
          {/* Customer Trigger Message */}
          <div className="whatsapp-bubble-in">
            <div>{triggerKeyword || 'hi'}</div>
            <div className="whatsapp-time">{timeStr}</div>
          </div>

          {/* Automated Outbound Message Bubble */}
          <div className="whatsapp-bubble-out">
            <div>{formatWhatsAppText(previewText)}</div>
            <div className="whatsapp-time">
              {timeStr} <i className="bi bi-check2-all text-primary ms-1"></i>
            </div>
          </div>

          {/* Interactive Buttons (Quick Replies) */}
          {buttons.length > 0 && (
            <div className="d-flex flex-column gap-1" style={{ maxWidth: '88%', alignSelf: 'flex-end', width: '100%' }}>
              {buttons.map((btn, idx) => (
                <div key={btn.id || idx} className="whatsapp-quick-reply-btn">
                  <i className="bi bi-reply me-1 text-muted"></i>
                  <span>{btn.text || `Option ${idx + 1}`}</span>
                </div>
              ))}
            </div>
          )}

          {/* Fallback Simulation (if enabled) */}
          {showFallbackPrompt && fallbackConfig && (
            <>
              <div className="whatsapp-bubble-in mt-2">
                <div>(Customer sends an unexpected reply)</div>
                <div className="whatsapp-time">{timeStr}</div>
              </div>
              <div className="whatsapp-bubble-out">
                {fallbackConfig.preQuestionLine && (
                  <div className="mb-1 text-muted small">{fallbackConfig.preQuestionLine}</div>
                )}
                <div className="fw-semibold">{fallbackConfig.question || 'Call back needed?'}</div>
                <div className="whatsapp-time">
                  {timeStr} <i className="bi bi-check2-all text-primary ms-1"></i>
                </div>
              </div>
              <div className="d-flex flex-column gap-1" style={{ maxWidth: '88%', alignSelf: 'flex-end', width: '100%' }}>
                <div className="whatsapp-quick-reply-btn text-success fw-bold">
                  {fallbackConfig.yesButtonText || 'Yes, call me'}
                </div>
                <div className="whatsapp-quick-reply-btn text-secondary">
                  {fallbackConfig.noButtonText || 'No, thanks'}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
