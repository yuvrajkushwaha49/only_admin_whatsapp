import React, { useEffect, useRef } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import SourceReferences from './SourceReferences';
import FeedbackButtons from './FeedbackButtons';
import TypingIndicator from './TypingIndicator';

// Configure marked options
marked.setOptions({
  gfm: true,
  breaks: true
});

function formatMarkdown(content) {
  if (!content) return '';
  const rawHtml = marked.parse(content);
  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'b', 'i', 'u', 'ul', 'ol', 'li', 'code', 'pre', 'blockquote', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span'],
    ALLOWED_ATTR: ['class']
  });
}

export default function ChatMessages({
  messages = [],
  loading = false,
  onFeedback,
  onRetry
}) {
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  return (
    <div className="ai-chat-messages px-3 py-3 overflow-y-auto flex-grow-1">
      {messages.map((msg, index) => {
        const isUser = msg.role === 'user';
        const isAssistant = msg.role === 'assistant';

        return (
          <div
            key={msg.id || index}
            className={`ai-message ${isUser ? 'ai-message-user' : 'ai-message-assistant'} d-flex align-items-start gap-2 mb-3`}
          >
            {isAssistant && (
              <div className="ai-msg-avatar flex-shrink-0">
                <i className="bi bi-robot"></i>
              </div>
            )}

            <div className={`ai-bubble ${isUser ? 'ai-bubble-user' : 'ai-bubble-assistant'}`}>
              {isUser ? (
                <div className="ai-user-text">{msg.content}</div>
              ) : (
                <div
                  className="ai-markdown-body"
                  dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.content) }}
                />
              )}

              {/* Source References */}
              {isAssistant && msg.sources && msg.sources.length > 0 && (
                <SourceReferences sources={msg.sources} />
              )}

              {/* Feedback Actions */}
              {isAssistant && msg.id && (
                <FeedbackButtons
                  messageId={msg.id}
                  currentFeedback={msg.feedback}
                  onFeedback={onFeedback}
                />
              )}

              {/* Error Retry Option */}
              {msg.status === 'failed' && onRetry && (
                <div className="mt-2 pt-2 border-top border-danger-subtle">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger d-flex align-items-center gap-1"
                    onClick={() => onRetry(msg)}
                  >
                    <i className="bi bi-arrow-clockwise"></i>
                    <span>Retry Question</span>
                  </button>
                </div>
              )}
            </div>

            {isUser && (
              <div className="ai-msg-avatar ai-user-avatar flex-shrink-0">
                <i className="bi bi-person-fill"></i>
              </div>
            )}
          </div>
        );
      })}

      {loading && <TypingIndicator />}

      <div ref={messagesEndRef} />
    </div>
  );
}
