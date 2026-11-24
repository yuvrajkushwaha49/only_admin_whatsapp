import React from 'react';

export default function TypingIndicator() {
  return (
    <div className="ai-message ai-message-assistant d-flex align-items-start gap-2 mb-3">
      <div className="ai-msg-avatar">
        <i className="bi bi-robot"></i>
      </div>
      <div className="ai-bubble ai-bubble-assistant ai-typing-bubble">
        <div className="typing-dots d-flex align-items-center gap-1">
          <span className="dot dot-1"></span>
          <span className="dot dot-2"></span>
          <span className="dot dot-3"></span>
        </div>
      </div>
    </div>
  );
}
