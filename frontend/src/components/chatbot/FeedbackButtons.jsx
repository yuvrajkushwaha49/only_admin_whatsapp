import React from 'react';

export default function FeedbackButtons({ messageId, currentFeedback, onFeedback, disabled = false }) {
  return (
    <div className="ai-feedback-actions d-flex align-items-center gap-2 mt-2">
      <span className="small text-muted">Was this helpful?</span>
      <button
        type="button"
        className={`btn btn-sm ai-feedback-btn ${currentFeedback === 'helpful' ? 'active helpful' : ''}`}
        onClick={() => onFeedback(messageId, 'helpful')}
        disabled={disabled}
        title="Helpful"
        aria-label="Helpful"
      >
        <i className="bi bi-hand-thumbs-up-fill"></i>
      </button>
      <button
        type="button"
        className={`btn btn-sm ai-feedback-btn ${currentFeedback === 'not_helpful' ? 'active not-helpful' : ''}`}
        onClick={() => onFeedback(messageId, 'not_helpful')}
        disabled={disabled}
        title="Not Helpful"
        aria-label="Not Helpful"
      >
        <i className="bi bi-hand-thumbs-down-fill"></i>
      </button>
    </div>
  );
}
