'use client';

import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import styles from './page.module.css';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

interface CoachTabProps {
  backtestRecordId: string;
}

export default function CoachTab({ backtestRecordId }: CoachTabProps) {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Welcome to your AI Trading Coach. Ask me anything about your trades, mistakes, setups, or sessions in this project!' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [coachLoading, setCoachLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Default initial greeting
  const DEFAULT_GREETING: ChatMessage = {
    role: 'assistant',
    content: 'Welcome to your AI Trading Coach. Ask me anything about your trades, mistakes, setups, or sessions in this project!'
  };

  // Load chat history from localStorage on mount / record change
  useEffect(() => {
    if (!backtestRecordId || typeof window === 'undefined') return;
    try {
      const key = `tradingbook_backtest_coach_history_${backtestRecordId}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setChatMessages(parsed);
        }
      }
    } catch (e) {
      console.error('Failed to load backtest coach history:', e);
    }
  }, [backtestRecordId]);

  // Save chat history to localStorage whenever chatMessages changes
  useEffect(() => {
    if (!backtestRecordId || typeof window === 'undefined') return;
    try {
      const key = `tradingbook_backtest_coach_history_${backtestRecordId}`;
      if (chatMessages.length > 1 || (chatMessages.length === 1 && chatMessages[0].content !== DEFAULT_GREETING.content)) {
        localStorage.setItem(key, JSON.stringify(chatMessages));
      } else {
        localStorage.removeItem(key);
      }
    } catch (e) {
      console.error('Failed to save backtest coach history:', e);
    }
  }, [chatMessages, backtestRecordId]);

  // Keep the newest message in view
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chatMessages, coachLoading]);

  const handleClearChat = () => {
    setChatMessages([DEFAULT_GREETING]);
    if (backtestRecordId && typeof window !== 'undefined') {
      localStorage.removeItem(`tradingbook_backtest_coach_history_${backtestRecordId}`);
    }
  };

  // AI Performance Coach Chat Trigger
  const handleSendCoachMessage = async (overridePrompt?: string) => {
    const activePrompt = overridePrompt || chatInput;
    if (!activePrompt.trim()) return;

    const userKey = localStorage.getItem('google_ai_pro_key') || '';
    if (!userKey) {
      toast.info('Please configure your Google AI Pro API Key in the Settings tab first.');
      return;
    }

    const newHistory = [...chatMessages];
    if (!overridePrompt) {
      newHistory.push({ role: 'user', content: chatInput });
      setChatMessages(newHistory);
      setChatInput('');
    } else {
      newHistory.push({ role: 'user', content: overridePrompt });
      setChatMessages(newHistory);
    }

    setCoachLoading(true);

    try {
      const res = await fetch('/api/backtest-journal/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          backtestRecordId,
          message: activePrompt,
          history: chatMessages.slice(1), // ignore greeting card
          googleApiKey: userKey,
        }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: data.data }]);
      } else {
        setChatMessages(prev => [...prev, { role: 'assistant', content: `Error: ${data.error || 'Failed to query AI Coach.'}` }]);
      }
    } catch (err: any) {
      console.error(err);
      setChatMessages(prev => [...prev, { role: 'assistant', content: `Connection error: ${err.message || err}` }]);
    } finally {
      setCoachLoading(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 className={styles.tabTitle} style={{ margin: 0 }}>AI Performance Coach</h1>
        {chatMessages.length > 1 && (
          <button
            onClick={handleClearChat}
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              color: '#ef4444',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.15s'
            }}
          >
            🗑️ Clear Chat
          </button>
        )}
      </div>

      <div className={styles.coachWrapper}>
        <div className={styles.coachMessages}>
          {chatMessages.map((msg, i) => (
            <div key={i} className={`${styles.message} ${msg.role === 'user' ? styles.userMessage : styles.aiMessage}`}>
              <div className={`${styles.avatarCircle} ${msg.role === 'assistant' ? styles.avatarAi : ''}`}>
                {msg.role === 'user' ? 'U' : 'AI'}
              </div>
              <div className={`${styles.messageContent} ${msg.role === 'assistant' ? styles.coachMarkdown : ''}`}>
                {msg.role === 'user' ? (
                  msg.content
                ) : (
                  // Basic Markdown renderer
                  <div dangerouslySetInnerHTML={{
                    __html: msg.content
                      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                      .replace(/\*(.*?)\*/g, '<em>$1</em>')
                      .replace(/### (.*?)\n/g, '<h3>$1</h3>')
                      .replace(/## (.*?)\n/g, '<h2>$1</h2>')
                      .replace(/- (.*?)\n/g, '<li>$1</li>')
                      .replace(/\n\n/g, '<p></p>')
                      .replace(/\n/g, '<br/>')
                  }} />
                )}
              </div>
            </div>
          ))}
          {coachLoading && (
            <div className={`${styles.message} ${styles.aiMessage}`}>
              <div className={`${styles.avatarCircle} ${styles.avatarAi}`}>AI</div>
              <div className={styles.messageContent} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="tb-typing-dots" aria-label="Coach is typing">
                  <span /><span /><span />
                </span>
                Analyzing trading data...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className={styles.coachInputArea}>
          <div className={styles.chipsContainer}>
            <button className={styles.promptChip} onClick={() => handleSendCoachMessage('Why am I losing?')}>
              Why am I losing?
            </button>
            <button className={styles.promptChip} onClick={() => handleSendCoachMessage('What is my biggest mistake?')}>
              What is my biggest mistake?
            </button>
            <button className={styles.promptChip} onClick={() => handleSendCoachMessage('Which confirmation works best?')}>
              Which confirmation works best?
            </button>
            <button className={styles.promptChip} onClick={() => handleSendCoachMessage('Compare London vs New York')}>
              Compare London vs New York
            </button>
          </div>
          <div className={styles.inputRow}>
            <input
              type="text"
              placeholder="Ask the Performance Coach a question..."
              className={styles.coachInput}
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendCoachMessage()}
              disabled={coachLoading}
            />
            <button className={styles.sendBtn} onClick={() => handleSendCoachMessage()} disabled={coachLoading}>
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
