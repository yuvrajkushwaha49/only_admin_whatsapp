import React, { useState, useEffect } from 'react';
import ChatHeader from './ChatHeader';
import ChatMessages from './ChatMessages';
import ChatInput from './ChatInput';
import SuggestedQuestions from './SuggestedQuestions';
import api from '../../services/api';
import '../../styles/aiChatbot.css';

const WELCOME_MESSAGE = {
  id: 'welcome-0',
  role: 'assistant',
  content: `नमस्ते! 🙏 I am your **WhatsApp SaaS AI Support Assistant**.

Main aapki WhatsApp Marketing & Automation Platform se judi queries mein madad kar sakta hoon.

Aap mujhse platform ke kisi bhi feature ke baare mein pooch sakte hain, jaise ki:
* WhatsApp number connection aur Embedded Signup
* Broadcasting campaigns aur scheduling
* Marketing, Utility aur Authentication templates
* Contacts management aur CSV import
* Team Inbox aur live chat support
* Delivery reports aur error codes troubleshooting`,
  createdAt: new Date().toISOString()
};

export default function AIChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [loading, setLoading] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  // Restore active conversation ID or create new one when opened
  useEffect(() => {
    const savedConvId = sessionStorage.getItem('cf_ai_conv_id');
    if (savedConvId) {
      setConversationId(Number(savedConvId));
      loadConversationHistory(Number(savedConvId));
    }
  }, []);

  const loadConversationHistory = async (convId) => {
    try {
      const res = await api.get(`/ai/conversations/${convId}`);
      if (res.data?.success && Array.isArray(res.data.messages) && res.data.messages.length > 0) {
        setMessages([WELCOME_MESSAGE, ...res.data.messages]);
      }
    } catch (_) {
      // If conversation expired or not found, reset
      sessionStorage.removeItem('cf_ai_conv_id');
      setConversationId(null);
    }
  };

  const handleStartNewChat = async () => {
    setLoading(true);
    try {
      const res = await api.post('/ai/conversations', { title: 'New Support Conversation' });
      if (res.data?.success && res.data.conversation?.id) {
        const newId = res.data.conversation.id;
        setConversationId(newId);
        sessionStorage.setItem('cf_ai_conv_id', String(newId));
        setMessages([WELCOME_MESSAGE]);
      }
    } catch (err) {
      setMessages([WELCOME_MESSAGE]);
      setConversationId(null);
      sessionStorage.removeItem('cf_ai_conv_id');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (text) => {
    if (!text || !text.trim() || loading) return;

    const userMsg = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString()
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await api.post('/ai/chat', {
        conversationId,
        message: text
      });

      if (res.data?.success) {
        if (res.data.conversationId && res.data.conversationId !== conversationId) {
          setConversationId(res.data.conversationId);
          sessionStorage.setItem('cf_ai_conv_id', String(res.data.conversationId));
        }

        const assistantMsg = {
          id: res.data.message?.id || `ai-${Date.now()}`,
          role: 'assistant',
          content: res.data.message?.content || '',
          sources: res.data.sources || [],
          createdAt: res.data.message?.createdAt || new Date().toISOString()
        };

        setMessages((prev) => [...prev, assistantMsg]);

        if (!isOpen) {
          setHasUnread(true);
        }
      }
    } catch (err) {
      const errMsg = err.response?.data?.error?.message || err.message || 'Something went wrong while communicating with the assistant.';
      const fallbackMsg = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ ${errMsg}\n\nPlease try again or contact our human support team if the issue persists.`,
        status: 'failed',
        failedQuery: text,
        createdAt: new Date().toISOString()
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = async (messageId, type) => {
    try {
      await api.post('/ai/feedback', {
        conversationId,
        messageId,
        feedbackType: type
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, feedback: type } : m))
      );
    } catch (_) {}
  };

  const handleRetry = (failedMsg) => {
    if (failedMsg?.failedQuery) {
      handleSendMessage(failedMsg.failedQuery);
    }
  };

  const toggleOpen = () => {
    setIsOpen((prev) => !prev);
    if (!isOpen) {
      setHasUnread(false);
    }
  };

  return (
    <div className="ai-chat-root position-fixed bottom-0 end-0 p-3" style={{ zIndex: 1060 }}>
      {/* Floating Chat Launcher Button */}
      {!isOpen && (
        <button
          type="button"
          className="ai-chat-launcher btn btn-primary rounded-circle shadow-lg d-flex align-items-center justify-content-center position-relative"
          onClick={toggleOpen}
          title="Open WhatsApp SaaS AI Support Assistant"
          aria-label="Open AI Assistant"
        >
          <i className="bi bi-chat-dots-fill fs-4"></i>
          {hasUnread && <span className="ai-unread-badge position-absolute top-0 start-100 translate-middle p-1 bg-danger border border-light rounded-circle"></span>}
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="ai-chat-window card shadow-lg border-0 d-flex flex-column animate__animated animate__fadeInUp">
          {/* Header */}
          <ChatHeader
            onNewChat={handleStartNewChat}
            onClose={() => setIsOpen(false)}
            isOnline={true}
          />

          {/* Messages */}
          <ChatMessages
            messages={messages}
            loading={loading}
            onFeedback={handleFeedback}
            onRetry={handleRetry}
          />

          {/* Suggested Questions */}
          {messages.length <= 2 && (
            <SuggestedQuestions
              onSelectQuestion={handleSendMessage}
              disabled={loading}
            />
          )}

          {/* Input Area */}
          <ChatInput
            onSendMessage={handleSendMessage}
            disabled={loading}
          />
        </div>
      )}
    </div>
  );
}
