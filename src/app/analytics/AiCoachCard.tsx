'use client';

import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { TradeRecord, BacktestStats } from '@/types';
import styles from './analytics.module.css';

interface AiCoachCardProps {
  stats: BacktestStats;
  recentTrades: TradeRecord[];
  sourceName: string;
}

type ChatMessage = { role: 'user' | 'assistant'; content: string };

// Helper functions to render markdown inline inside JSX
function parseBoldText(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      return <strong key={i} style={{ color: '#ffffff', fontWeight: 700 }}>{part}</strong>;
    }
    return part;
  });
}

function renderAiInsights(text: string | null) {
  if (!text) return null;
  const lines = text.split('\n');
  return lines.map((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('###')) {
      return (
        <h4 key={idx} style={{ color: 'var(--accent)', marginTop: '1.25rem', marginBottom: '0.5rem', fontWeight: 800, fontSize: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '0.25rem' }}>
          {trimmed.replace(/^###\s*/, '')}
        </h4>
      );
    }
    if (trimmed.startsWith('1.') || trimmed.startsWith('2.') || trimmed.startsWith('3.') || trimmed.startsWith('4.')) {
      return (
        <h4 key={idx} style={{ color: 'var(--accent)', marginTop: '1.25rem', marginBottom: '0.5rem', fontWeight: 800, fontSize: '0.95rem' }}>
          {trimmed}
        </h4>
      );
    }
    if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
      const content = trimmed.replace(/^[-*]\s*/, '');
      return (
        <li key={idx} style={{ marginLeft: '1.25rem', marginBottom: '0.5rem', listStyleType: 'disc', fontSize: '0.85rem', lineHeight: 1.5, color: '#94a3b8' }}>
          {parseBoldText(content)}
        </li>
      );
    }
    if (trimmed.length === 0) return <div key={idx} style={{ height: '0.4rem' }} />;

    return (
      <p key={idx} style={{ fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '0.75rem', color: '#94a3b8' }}>
        {parseBoldText(trimmed)}
      </p>
    );
  });
}

export default function AiCoachCard({ stats, recentTrades, sourceName }: AiCoachCardProps) {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const [isGeneratingAi, setIsGeneratingAi] = useState<boolean>(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load saved chat history on mount
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('tradingbook_analytics_ai_chat_history');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setChatMessages(parsed);
          }
        }
      }
    } catch (e) {
      console.error('Failed to load saved analytics AI chat history:', e);
    }
  }, []);

  // Save chat messages to localStorage whenever chatMessages updates
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        if (chatMessages.length > 0) {
          localStorage.setItem('tradingbook_analytics_ai_chat_history', JSON.stringify(chatMessages));
        } else {
          localStorage.removeItem('tradingbook_analytics_ai_chat_history');
        }
      }
    } catch (e) {
      console.error('Failed to save analytics AI chat history:', e);
    }
  }, [chatMessages]);

  // Scroll chat window to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleGenerateAiInsights = async () => {
    setIsGeneratingAi(true);
    setChatMessages([]);
    try {
      const res = await fetch('/api/analytics/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stats,
          recentTrades,
          sourceName,
        })
      });

      const json = await res.json();
      if (json.success && json.data) {
        setChatMessages([{ role: 'assistant', content: json.data }]);
      } else {
        toast.error(json.error || 'Failed to generate AI insights.');
      }
    } catch (e) {
      console.error(e);
      toast.error('Error communicating with the AI Performance Coach.');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isGeneratingAi) return;

    const userMessageText = chatInput.trim();
    setChatInput('');

    const nextMessages = [...chatMessages, { role: 'user' as const, content: userMessageText }];
    setChatMessages(nextMessages);
    setIsGeneratingAi(true);

    try {
      const res = await fetch('/api/analytics/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stats,
          recentTrades,
          sourceName,
          history: nextMessages,
        })
      });

      const json = await res.json();
      if (json.success && json.data) {
        setChatMessages([...nextMessages, { role: 'assistant' as const, content: json.data }]);
      } else {
        toast.error(json.error || 'Failed to get AI coach reply.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error communicating with the AI Performance Coach.');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  return (
    <div className={styles.aiCoachCard}>
      <div className={styles.aiCoachHeader}>
        <div className={styles.aiCoachTitle}>
          🧠 <span>AI Performance Coach</span>
        </div>
        <button
          className={styles.generateBtn}
          onClick={chatMessages.length > 0 ? () => { 
            setChatMessages([]); 
            if (typeof window !== 'undefined') {
              localStorage.removeItem('tradingbook_analytics_ai_chat_history');
            }
          } : handleGenerateAiInsights}
          disabled={isGeneratingAi && chatMessages.length === 0}
        >
          {isGeneratingAi && chatMessages.length === 0 ? (
            <>
              <span className="spinner" style={{ width: '12px', height: '12px', borderWidth: '2px', borderColor: '#ffffff', borderTopColor: 'transparent', display: 'inline-block', borderRadius: '50%', animation: 'spin 1s linear infinite', marginRight: '0.4rem' }} />
              Coaching...
            </>
          ) : chatMessages.length > 0 ? (
            '🧹 Clear Chat'
          ) : (
            '✨ Coach My Trades'
          )}
        </button>
      </div>
      <div className={styles.aiCoachDesc}>
        Get personalized mathematical coaching tips based on your current filter profile. We analyze your win rate, profit factor, drawdown, and recent tags to identify leaks and patterns.
      </div>

      {(isGeneratingAi || chatMessages.length > 0) && (
        <div className={styles.aiCoachBody}>
          {isGeneratingAi && chatMessages.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', padding: '2rem 0' }}>
              <div className="spinner" style={{ borderTopColor: 'var(--accent)', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Nemotron-3-Ultra Coach is reviewing your stats...</span>
            </div>
          )}

          {chatMessages.length > 0 && (
            <>
              <div className={styles.chatTimeline}>
                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`${styles.msgBubble} ${msg.role === 'user' ? styles.userMsg : styles.assistantMsg}`}
                  >
                    {msg.role === 'assistant' ? (
                      <div>{renderAiInsights(msg.content)}</div>
                    ) : (
                      <div style={{ fontSize: '0.85rem', lineHeight: 1.5, color: '#ffffff' }}>{msg.content}</div>
                    )}
                  </div>
                ))}
                {isGeneratingAi && chatMessages.length % 2 === 1 && (
                  <div className={`${styles.msgBubble} ${styles.assistantMsg}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: 0.8 }}>
                    <span className="spinner" style={{ width: '10px', height: '10px', borderWidth: '1.5px', borderTopColor: 'transparent', display: 'inline-block', borderRadius: '50%', animation: 'spin 1s linear infinite', marginRight: '0.25rem' }} />
                    <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Coach is thinking...</span>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <form onSubmit={handleSendMessage} className={styles.chatInputRow}>
                <input
                  type="text"
                  className={styles.chatInputField}
                  placeholder="Ask the AI Coach a follow-up question..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={isGeneratingAi}
                />
                <button
                  type="submit"
                  className={styles.sendBtn}
                  disabled={isGeneratingAi || !chatInput.trim()}
                >
                  💬 Send
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}
