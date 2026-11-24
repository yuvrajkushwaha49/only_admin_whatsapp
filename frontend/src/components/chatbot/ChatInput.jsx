import React, { useState, useRef, useEffect } from 'react';

export default function ChatInput({ onSendMessage, disabled = false, placeholder = 'Ask about campaigns, WhatsApp API, templates...' }) {
  const [text, setText] = useState('');
  const textareaRef = useRef(null);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (disabled || !text.trim()) return;
    onSendMessage(text.trim());
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Auto-resize textarea up to 120px
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [text]);

  return (
    <form onSubmit={handleSubmit} className="ai-chat-input-container p-2 border-top bg-white">
      <div className="input-group align-items-end gap-1">
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          className="form-control ai-chat-textarea border-0 shadow-none px-3 py-2"
          maxLength={2000}
        />
        <button
          type="submit"
          disabled={disabled || !text.trim()}
          className="btn btn-primary ai-send-btn rounded-circle d-flex align-items-center justify-content-center"
          title="Send message (Enter)"
          aria-label="Send message"
        >
          <i className="bi bi-send-fill fs-6"></i>
        </button>
      </div>
      <div className="d-flex justify-content-between align-items-center px-2 pt-1 text-muted" style={{ fontSize: '0.72rem' }}>
        <span>Press <b>Enter</b> to send, <b>Shift + Enter</b> for new line</span>
        <span>{text.length}/2000</span>
      </div>
    </form>
  );
}
