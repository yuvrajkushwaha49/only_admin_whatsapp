import React from 'react';

const DEFAULT_QUESTIONS = [
  'How can I connect my WhatsApp number?',
  'How does broadcasting work?',
  'How can I create a WhatsApp template?',
  'How can I create a campaign?',
  'How does chatbot automation work?',
  'How can I check message delivery reports?'
];

export default function SuggestedQuestions({ onSelectQuestion, disabled = false }) {
  return (
    <div className="ai-suggested-questions px-3 py-2">
      <div className="small fw-semibold text-muted mb-2 d-flex align-items-center gap-1">
        <i className="bi bi-lightbulb text-warning"></i>
        <span>Suggested Questions:</span>
      </div>
      <div className="d-flex flex-wrap gap-1">
        {DEFAULT_QUESTIONS.map((q, idx) => (
          <button
            key={idx}
            type="button"
            className="btn btn-sm ai-suggested-pill text-start"
            onClick={() => onSelectQuestion(q)}
            disabled={disabled}
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
