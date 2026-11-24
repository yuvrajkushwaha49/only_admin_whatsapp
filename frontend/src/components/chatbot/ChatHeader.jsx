import React from 'react';

export default function ChatHeader({ onNewChat, onClose, isOnline = true }) {
  return (
    <div className="ai-chat-header d-flex align-items-center justify-content-between px-3 py-2 text-white">
      <div className="d-flex align-items-center gap-2">
        <div className="ai-chat-avatar position-relative">
          <div className="ai-avatar-circle d-flex align-items-center justify-content-center">
            <i className="bi bi-robot fs-5"></i>
          </div>
          {isOnline && <span className="ai-online-dot position-absolute" title="Assistant Online"></span>}
        </div>
        <div>
          <h6 className="mb-0 fw-bold fs-6 ai-header-title">WhatsApp SaaS AI Assistant</h6>
          <span className="small text-white-50 ai-header-subtitle">Your dedicated platform support assistant</span>
        </div>
      </div>

      <div className="d-flex align-items-center gap-1">
        <button
          type="button"
          className="btn btn-sm btn-icon text-white ai-btn-hover"
          onClick={onNewChat}
          title="Start New Chat"
          aria-label="Start New Chat"
        >
          <i className="bi bi-arrow-repeat fs-6"></i>
        </button>
        <button
          type="button"
          className="btn btn-sm btn-icon text-white ai-btn-hover"
          onClick={onClose}
          title="Close Support Chat"
          aria-label="Close Support Chat"
        >
          <i className="bi bi-x-lg fs-6"></i>
        </button>
      </div>
    </div>
  );
}
