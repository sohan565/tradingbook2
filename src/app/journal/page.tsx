'use client';

import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { JournalEntry, TradeRecord, Mood } from '@/types';
import { formatCurrency } from '@/lib/trade-math';
import styles from './journal.module.css';

const MOODS: { key: Mood; emoji: string; label: string }[] = [
  { key: 'focused', emoji: '🎯', label: 'Focused' },
  { key: 'confident', emoji: '💪', label: 'Confident' },
  { key: 'neutral', emoji: '😐', label: 'Neutral' },
  { key: 'anxious', emoji: '😰', label: 'Anxious' },
  { key: 'frustrated', emoji: '😡', label: 'Frustrated' },
  { key: 'euphoric', emoji: '🤑', label: 'Euphoric' },
];

function formatMessageContent(text: string) {
  if (!text) return '';

  let escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const codeBlocks: string[] = [];
  escaped = escaped.replace(/```([\s\S]*?)```/g, (_, code) => {
    const index = codeBlocks.length;
    codeBlocks.push(`<pre class="chatCodeBlock"><code>${code.trim()}</code></pre>`);
    return `__CODE_BLOCK_PLACEHOLDER_${index}__`;
  });

  const inlineCodes: string[] = [];
  escaped = escaped.replace(/`([^`]+)`/g, (_, code) => {
    const index = inlineCodes.length;
    inlineCodes.push(`<code class="chatInlineCode">${code}</code>`);
    return `__INLINE_CODE_PLACEHOLDER_${index}__`;
  });

  escaped = escaped.replace(/\*\*([\s\S]*?)\*\*/g, '<strong>$1</strong>');

  const lines = escaped.split('\n');
  const formattedLines = [];
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const content = trimmed.substring(2);
      if (!inList) {
        formattedLines.push('<ul class="chatList">');
        inList = true;
      }
      formattedLines.push(`<li>${content}</li>`);
    } else {
      if (inList) {
        formattedLines.push('</ul>');
        inList = false;
      }
      formattedLines.push(line);
    }
  }
  if (inList) {
    formattedLines.push('</ul>');
  }

  let processedText = '';
  for (let i = 0; i < formattedLines.length; i++) {
    const line = formattedLines[i];
    if (line === '<ul class="chatList">' || line === '</ul>' || line.startsWith('<li>') || line === '') {
      processedText += line;
    } else {
      processedText += line + '<br />';
    }
  }

  inlineCodes.forEach((codeHtml, idx) => {
    processedText = processedText.replace(`__INLINE_CODE_PLACEHOLDER_${idx}__`, codeHtml);
  });
  codeBlocks.forEach((codeHtml, idx) => {
    processedText = processedText.replace(`__CODE_BLOCK_PLACEHOLDER_${idx}__`, codeHtml);
  });

  return processedText;
}

function renderReasoningDetails(details: any): string {
  if (!details) return '';
  if (typeof details === 'string') return details;
  if (Array.isArray(details)) {
    return details
      .map(item => (typeof item === 'string' ? item : (item.text || item.content || '')))
      .join('\n');
  }
  if (typeof details === 'object') {
    return details.text || details.content || JSON.stringify(details);
  }
  return String(details);
}


export default function JournalPage() {
  const [mounted, setMounted] = useState<boolean>(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Date state (defaults to today in local time YYYY-MM-DD)
  const [date, setDate] = useState<string>(() => {
    const local = new Date();
    const offset = local.getTimezoneOffset();
    const adjusted = new Date(local.getTime() - offset * 60 * 1000);
    return adjusted.toISOString().split('T')[0];
  });

  // Journal form states
  const [entryExists, setEntryExists] = useState<boolean>(false);
  const [title, setTitle] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [selectedMood, setSelectedMood] = useState<Mood | null>(null);
  const [preSessionPlan, setPreSessionPlan] = useState<string>('');
  const [postSessionReview, setPostSessionReview] = useState<string>('');
  const [tags, setTags] = useState<string[]>([]);
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [linkedTradeIds, setLinkedTradeIds] = useState<Set<string>>(new Set());

  // Database states
  const [availableTrades, setAvailableTrades] = useState<TradeRecord[]>([]);
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const [tagInput, setTagInput] = useState<string>('');
  // Tab state
  type TabId = 'overview' | 'preSession' | 'notes' | 'postSession' | 'assistant';
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const notesTextareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // AI Assistant states
  interface Message {
    role: 'user' | 'assistant';
    content: string;
    reasoning_details?: string;
  }
  const [assistantMessages, setAssistantMessages] = useState<Message[]>([]);
  const [assistantInput, setAssistantInput] = useState<string>('');
  const [assistantLoading, setAssistantLoading] = useState<boolean>(false);
  const [hasServerKey, setHasServerKey] = useState<boolean | null>(null);
  const [clientApiKey, setClientApiKey] = useState<string>('');
  const [isKeySetupVisible, setIsKeySetupVisible] = useState<boolean>(false);
  const [keyInputTemp, setKeyInputTemp] = useState<string>('');

  // Fetch server key availability & load local client key on mount
  useEffect(() => {
    async function checkServerKey() {
      try {
        const res = await fetch('/api/assistant');
        const json = await res.json();
        setHasServerKey(!!json.hasKeyOnServer);
      } catch (err) {
        console.error('Failed to check server key status:', err);
        setHasServerKey(false);
      }
    }
    checkServerKey();

    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('gemini_api_key') || '';
      setClientApiKey(stored);
      setKeyInputTemp(stored);

      try {
        const savedChat = localStorage.getItem('tradingbook_journal_ai_chat_history');
        if (savedChat) {
          const parsed = JSON.parse(savedChat);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setAssistantMessages(parsed);
          }
        }
      } catch (err) {
        console.error('Failed to load saved journal AI chat history:', err);
      }
    }
  }, []);

  // Save chat messages to localStorage whenever assistantMessages updates
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (assistantMessages.length > 0) {
        localStorage.setItem('tradingbook_journal_ai_chat_history', JSON.stringify(assistantMessages));
      } else {
        localStorage.removeItem('tradingbook_journal_ai_chat_history');
      }
    }
  }, [assistantMessages]);

  // Scroll to bottom when messages or loading state changes
  useEffect(() => {
    if (activeTab === 'assistant') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [assistantMessages, assistantLoading, activeTab]);

  const handleSaveApiKey = () => {
    const trimmed = keyInputTemp.trim();
    setClientApiKey(trimmed);
    if (typeof window !== 'undefined') {
      if (trimmed) {
        localStorage.setItem('gemini_api_key', trimmed);
      } else {
        localStorage.removeItem('gemini_api_key');
      }
    }
    setIsKeySetupVisible(false);
    toast.success(trimmed ? 'API Key saved locally!' : 'API Key cleared.');
  };

  const handleSendAssistantMessage = async (textToSend?: string) => {
    const text = (textToSend || assistantInput).trim();
    if (!text) return;

    if (!textToSend) {
      setAssistantInput('');
    }

    const newMessages: Message[] = [...assistantMessages, { role: 'user', content: text }];
    setAssistantMessages(newMessages);
    setAssistantLoading(true);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (!hasServerKey && clientApiKey) {
        headers['x-gemini-key'] = clientApiKey;
      }

      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: text,
          history: assistantMessages.map(msg => ({
            role: msg.role,
            content: msg.content,
            reasoning_details: msg.reasoning_details
          })),
        }),
      });

      const data = await res.json();

      if (data.success && data.reply) {
        setAssistantMessages(prev => [...prev, { 
          role: 'assistant', 
          content: data.reply,
          reasoning_details: data.reasoning_details 
        }]);
      } else {
        const errorMsg = data.error || 'Failed to get a response from the AI assistant.';
        setAssistantMessages(prev => [
          ...prev,
          { role: 'assistant', content: `❌ **Error**: ${errorMsg}` }
        ]);
      }
    } catch (err: any) {
      console.error('Assistant request error:', err);
      setAssistantMessages(prev => [
        ...prev,
        { role: 'assistant', content: `❌ **Error**: Network request failed. ${err.message || ''}` }
      ]);
    } finally {
      setAssistantLoading(false);
    }
  };



  // Fetch Journal & Today's Trades when date changes
  useEffect(() => {
    let active = true;

    async function loadDailyData() {
      setIsFetching(true);
      try {
        // 1. Fetch Journal Entry
        const journalRes = await fetch(`/api/journal?date=${date}`);
        const journalJson = await journalRes.json();

        // 2. Fetch Trades for this date
        const tradesRes = await fetch(`/api/trades?date=${date}`);
        const tradesJson = await tradesRes.json();

        if (!active) return;

        // Populate Journal States
        if (journalJson.success && journalJson.data) {
          const entry = journalJson.data as JournalEntry;
          setEntryExists(true);
          setTitle(entry.title || '');
          setContent(entry.content || '');
          setSelectedMood((entry.mood as Mood) || null);
          setPreSessionPlan(entry.preSessionPlan || '');
          setPostSessionReview(entry.postSessionReview || '');
          setTags(entry.tags || []);
          setScreenshots(entry.screenshots || []);
          setLinkedTradeIds(new Set(entry.tradeIds || entry.trades?.map((t: TradeRecord) => t.id) || []));
        } else {
          // Reset states for blank day
          setEntryExists(false);
          setTitle('');
          setContent('');
          setSelectedMood(null);
          setPreSessionPlan('');
          setPostSessionReview('');
          setTags([]);
          setScreenshots([]);
          setLinkedTradeIds(new Set());
        }

        // Populate Available Trades
        if (tradesJson.success && tradesJson.data) {
          setAvailableTrades(tradesJson.data);
        } else {
          setAvailableTrades([]);
        }
      } catch (err) {
        console.error('Failed to load daily journal data:', err);
      } finally {
        if (active) setIsFetching(false);
      }
    }

    loadDailyData();

    return () => {
      active = false;
    };
  }, [date]);

  // Date steppers
  const handlePrevDay = () => {
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    setDate(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    setDate(d.toISOString().split('T')[0]);
  };

  // Add tag
  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const cleaned = tagInput.trim().toLowerCase().replace(/,/g, '');
      if (cleaned && !tags.includes(cleaned)) {
        setTags([...tags, cleaned]);
      }
      setTagInput('');
    }
  };

  // Remove tag
  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  // Toggle Trade Linkage
  const handleToggleTradeLink = (tradeId: string) => {
    setLinkedTradeIds(prev => {
      const next = new Set(prev);
      if (next.has(tradeId)) {
        next.delete(tradeId);
      } else {
        next.add(tradeId);
      }
      return next;
    });
  };

  // Format Helper: Markdown insertions in notes
  const insertText = (before: string, after: string = '') => {
    const textarea = notesTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selection = textarea.value.substring(start, end);
    const replacement = before + selection + after;

    setContent(
      textarea.value.substring(0, start) +
      replacement +
      textarea.value.substring(end)
    );

    // Refocus and place cursor
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + before.length,
        start + before.length + selection.length
      );
    }, 50);
  };

  // Image upload API helper
  const uploadImageFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success && data.url) {
        setScreenshots(prev => [...prev, data.url]);
        // Also insert image link in notes
        insertText(`\n![Screenshot](${data.url})\n`, '');
      } else {
        toast.error('Upload failed: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Upload request error:', err);
      toast.error('Error uploading screenshot.');
    }
  };

  // Paste Event Handler (Clipboard upload)
  const handlePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          await uploadImageFile(file);
        }
      }
    }
  };

  // File Selector Upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadImageFile(file);
    }
  };

  // Remove Screenshot
  const handleRemoveScreenshot = (url: string) => {
    setScreenshots(screenshots.filter(s => s !== url));
    // Remove image link references in notes
    const imageMarkdown = `![Screenshot](${url})`;
    setContent(prev => prev.replace(imageMarkdown, ''));
  };

  // Save Journal Entry
  const handleSaveJournal = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/journal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date,
          title,
          content,
          mood: selectedMood,
          preSessionPlan,
          postSessionReview,
          tags,
          screenshots,
          tradeIds: Array.from(linkedTradeIds),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setEntryExists(true);
        toast.success('Journal saved successfully!');
      } else {
        toast.error('Failed to save: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Save journal request error:', err);
      toast.error('Network error while saving.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!mounted) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#080b12', color: '#94a3b8', alignItems: 'center', justifyContent: 'center' }} suppressHydrationWarning>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }} suppressHydrationWarning>
          <div className="spinner" suppressHydrationWarning />
          <span style={{ fontSize: '0.9rem', opacity: 0.8 }}>Loading Daily Journal...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.journalContainer} onPaste={handlePaste}>
      <div className={styles.contentArea}>
        {/* Top bar control */}
        <header className={styles.topBar}>
          <div className={styles.titleArea}>
            <span className={styles.titleText}>Daily Journal</span>
            <div className={styles.datePickerWrapper}>
              <button className={styles.dateArrowBtn} onClick={handlePrevDay}>◀</button>
              <input
                type="date"
                className={styles.dateInput}
                value={date}
                onChange={e => setDate(e.target.value)}
              />
              <button className={styles.dateArrowBtn} onClick={handleNextDay}>▶</button>
            </div>
            {isFetching && (
              <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>Loading data...</span>
            )}
          </div>

          <div className={styles.topBarActions}>
            <button
              className={styles.saveBtn}
              onClick={handleSaveJournal}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : entryExists ? 'Update Entry' : 'Save Entry'}
            </button>
          </div>
        </header>

        {/* Main Workspace split */}
        <main className={styles.mainWorkspace}>
          {/* Left Column - Core Editor */}
          <div className={styles.editorColumn}>
            {/* Inner Tab Sidebar */}
            <div className={styles.tabSidebar}>
              <button 
                className={`${styles.tabBtn} ${activeTab === 'overview' ? styles.activeTabBtn : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                📝 Overview & Mood
              </button>
              <button 
                className={`${styles.tabBtn} ${activeTab === 'preSession' ? styles.activeTabBtn : ''}`}
                onClick={() => setActiveTab('preSession')}
              >
                🎯 Pre-Session Plan
              </button>
              <button 
                className={`${styles.tabBtn} ${activeTab === 'notes' ? styles.activeTabBtn : ''}`}
                onClick={() => setActiveTab('notes')}
              >
                📓 Journal Notes
              </button>
              <button 
                className={`${styles.tabBtn} ${activeTab === 'postSession' ? styles.activeTabBtn : ''}`}
                onClick={() => setActiveTab('postSession')}
              >
                🔍 Post-Session Review
              </button>
              <button 
                className={`${styles.tabBtn} ${activeTab === 'assistant' ? styles.activeTabBtn : ''}`}
                onClick={() => setActiveTab('assistant')}
              >
                🤖 AI Assistant
              </button>
            </div>

            <div className={styles.tabContentContainer}>
              {activeTab === 'overview' && (
                <div className={styles.editorCard}>
                  <h4 className={styles.editorCardTitle}>Title & Mood</h4>
                  <input
                    type="text"
                    placeholder="Name today's session (e.g. CPI Volatility, Golden Cross scalping...)"
                    className={styles.titleInput}
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                  />

                  <div style={{ marginTop: '0.5rem' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>How do you feel?</span>
                    <div className={styles.moodGrid}>
                      {MOODS.map(m => (
                        <button
                          key={m.key}
                          className={`${styles.moodBtn} ${selectedMood === m.key ? styles.activeMood : ''}`}
                          onClick={() => setSelectedMood(selectedMood === m.key ? null : m.key)}
                        >
                          <span className={styles.moodEmoji}>{m.emoji}</span>
                          <span>{m.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'preSession' && (
                <div className={styles.editorCard}>
                  <h4 className={styles.editorCardTitle}>Pre-Session Plan</h4>
                  <textarea
                    placeholder="What is your bias? Key support/resistance levels, news releases to avoid, risk plans today..."
                    className={styles.textareaField}
                    value={preSessionPlan}
                    onChange={e => setPreSessionPlan(e.target.value)}
                  />
                </div>
              )}

              {activeTab === 'notes' && (
                <div className={styles.editorCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 className={styles.editorCardTitle}>Daily Journal Notes</h4>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Markdown supported</span>
                  </div>

                  {/* Formatting Toolbar */}
                  <div className={styles.toolbar}>
                    <button className={styles.toolbarBtn} onClick={() => insertText('**', '**')}>Bold</button>
                    <button className={styles.toolbarBtn} onClick={() => insertText('*', '*')}>Italic</button>
                    <button className={styles.toolbarBtn} onClick={() => insertText('# ', '\n')}>H1</button>
                    <button className={styles.toolbarBtn} onClick={() => insertText('## ', '\n')}>H2</button>
                    <button className={styles.toolbarBtn} onClick={() => insertText('- ', '\n')}>Bullet</button>
                    <button className={styles.toolbarBtn} onClick={() => insertText('> ', '\n')}>Quote</button>
                    <button className={styles.toolbarBtn} onClick={() => insertText('`', '`')}>Code</button>
                    <button
                      className={styles.toolbarBtn}
                      onClick={() => fileInputRef.current?.click()}
                      style={{ marginLeft: 'auto', color: 'var(--accent-primary, #6366f1)' }}
                    >
                      📷 Attach Image
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleFileChange}
                    />
                  </div>

                  <textarea
                    ref={notesTextareaRef}
                    placeholder="Describe your execution, emotional blocks, mistakes, highlights, or paste screenshots directly (Ctrl+V) into this editor..."
                    className={`${styles.textareaField} ${styles.notesField}`}
                    value={content}
                    onChange={e => setContent(e.target.value)}
                  />
                </div>
              )}

              {activeTab === 'postSession' && (
                <div className={styles.editorCard}>
                  <h4 className={styles.editorCardTitle}>Post-Session Review</h4>
                  <textarea
                    placeholder="What did you learn? Did you follow rules? How did you manage emotions? Revenge trades?"
                    className={styles.textareaField}
                    value={postSessionReview}
                    onChange={e => setPostSessionReview(e.target.value)}
                  />
                </div>
              )}

              {activeTab === 'assistant' && (
                <div className={styles.assistantCard}>
                  <div className={styles.assistantHeader}>
                    <div>
                      <h4 className={styles.assistantCardTitle}>🤖 AI Trading Assistant</h4>
                      <p className={styles.assistantSubtitle}>
                        Analyze your journal entries, moods, plans, and trades with Gemini 2.5 Flash.
                      </p>
                    </div>
                    {!hasServerKey && (
                      <button 
                        className={styles.keyConfigToggleBtn}
                        onClick={() => setIsKeySetupVisible(!isKeySetupVisible)}
                      >
                        🔑 {clientApiKey ? 'Change API Key' : 'Configure API Key'}
                      </button>
                    )}
                  </div>

                  {/* API Key Setup Panel */}
                  {(isKeySetupVisible || (!hasServerKey && !clientApiKey && hasServerKey !== null)) ? (
                    <div className={styles.keySetupPanel}>
                      <h5 className={styles.panelTitle}>Setup Gemini API Key</h5>
                      <p className={styles.panelDescription}>
                        To query the assistant, you need a Google Gemini API Key. You can get a free key from{' '}
                        <a 
                          href="https://aistudio.google.com/" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className={styles.studioLink}
                        >
                          Google AI Studio
                        </a>.
                      </p>
                      <div className={styles.keyInputRow}>
                        <input
                          type="password"
                          placeholder="AIzaSy..."
                          className={styles.keyInput}
                          value={keyInputTemp}
                          onChange={e => setKeyInputTemp(e.target.value)}
                        />
                        <button className={styles.keySaveBtn} onClick={handleSaveApiKey}>
                          Save Key
                        </button>
                      </div>
                      <p className={styles.panelSecurityNote}>
                        * Your key is stored locally in your browser's localStorage and is only sent to the AI endpoint.
                      </p>
                    </div>
                  ) : null}

                  {/* Chat Container */}
                  <div className={styles.chatWrapper}>
                    <div className={styles.chatHistory}>
                      {assistantMessages.length === 0 ? (
                        <div className={styles.emptyChatState}>
                          <div className={styles.assistantIntroIcon}>🤖</div>
                          <h5>Ask Your Trading Performance Coach</h5>
                          <p>
                            I have access to your full journal context. I can help analyze your performance, moods, trading habits, and cognitive errors.
                          </p>
                          <div className={styles.suggestionsGrid}>
                            <button
                              className={styles.suggestionChip}
                              onClick={() => handleSendAssistantMessage('Analyze my behavioral patterns and cognitive biases from my journal.')}
                            >
                              🔍 Analyze my habits & biases
                            </button>
                            <button
                              className={styles.suggestionChip}
                              onClick={() => handleSendAssistantMessage('How does my mood affect my trading performance and decisions?')}
                            >
                              📊 Mood vs. Performance
                            </button>
                            <button
                              className={styles.suggestionChip}
                              onClick={() => handleSendAssistantMessage('Summarize my key learnings and rules from my latest journal entries.')}
                            >
                              💡 Summarize my key rules
                            </button>
                            <button
                              className={styles.suggestionChip}
                              onClick={() => handleSendAssistantMessage('What was my trade plan and emotional state during my best winning days?')}
                            >
                              🎯 Best trading days analysis
                            </button>
                          </div>
                        </div>
                      ) : (
                        assistantMessages.map((msg, idx) => (
                          <div 
                            key={idx} 
                            className={`${styles.chatBubbleContainer} ${msg.role === 'user' ? styles.userBubbleContainer : styles.assistantBubbleContainer}`}
                          >
                            <div className={styles.bubbleAvatar}>
                              {msg.role === 'user' ? '👤' : '🤖'}
                            </div>
                            <div className={styles.bubbleWrapper}>
                              {msg.reasoning_details && (
                                <div className={styles.reasoningBox}>
                                  <details open={idx === assistantMessages.length - 1}>
                                    <summary className={styles.reasoningSummary}>🧠 Thought Process</summary>
                                    <div className={styles.reasoningContent}>
                                      {renderReasoningDetails(msg.reasoning_details)}
                                    </div>
                                  </details>
                                </div>
                              )}
                              <div 
                                className={`${styles.chatBubble} ${msg.role === 'user' ? styles.userBubble : styles.assistantBubble}`}
                                dangerouslySetInnerHTML={{ __html: formatMessageContent(msg.content) }}
                              />
                            </div>
                          </div>
                        ))
                      )}
                      
                      {assistantLoading && (
                        <div className={`${styles.chatBubbleContainer} ${styles.assistantBubbleContainer}`}>
                          <div className={styles.bubbleAvatar}>🤖</div>
                          <div className={`${styles.chatBubble} ${styles.assistantBubble} ${styles.typingBubble}`}>
                            <div className={styles.typingIndicator}>
                              <span></span>
                              <span></span>
                              <span></span>
                            </div>
                          </div>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Chat Input controls */}
                    <div className={styles.chatInputArea}>
                      <textarea
                        placeholder="Ask a question about your trading journal..."
                        className={styles.chatInput}
                        value={assistantInput}
                        onChange={e => setAssistantInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendAssistantMessage();
                          }
                        }}
                      />
                      <div className={styles.chatInputActions}>
                        <button 
                          className={styles.clearChatBtn}
                          onClick={() => {
                            setAssistantMessages([]);
                            if (typeof window !== 'undefined') {
                              localStorage.removeItem('tradingbook_journal_ai_chat_history');
                            }
                          }}
                          title="Clear Chat History"
                        >
                          🗑️ Clear
                        </button>
                        <button
                          className={styles.sendChatBtn}
                          onClick={() => handleSendAssistantMessage()}
                          disabled={assistantLoading || !assistantInput.trim()}
                        >
                          Send 🚀
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Side Widgets */}
          <div className={styles.widgetsColumn}>
            {/* Linked Trades Widget */}
            <div className={styles.widgetCard}>
              <h4 className={styles.widgetTitle}>Linked Trades ({linkedTradeIds.size})</h4>
              <div className={styles.tradesList}>
                {availableTrades.length === 0 ? (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', padding: '0.5rem', textAlign: 'center' }}>
                    No trades logged for this date. Run backtests or sync accounts to connect trades.
                  </div>
                ) : (
                  availableTrades.map(trade => {
                    const isLinked = linkedTradeIds.has(trade.id);
                    const pnlVal = trade.pnl ?? 0;
                    return (
                      <div
                        key={trade.id}
                        className={styles.tradeItem}
                        onClick={() => handleToggleTradeLink(trade.id)}
                        style={{ borderColor: isLinked ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255,255,255,0.03)' }}
                      >
                        <input
                          type="checkbox"
                          className={styles.tradeCheckbox}
                          checked={isLinked}
                          onChange={() => {}} // handled by parent click
                        />
                        <div className={styles.tradeLabel}>
                          <div className={styles.tradeSymbolRow}>
                            <span>{trade.symbol}</span>
                            <span className={pnlVal >= 0 ? styles.tradeWin : styles.tradeLoss}>
                              {formatCurrency(pnlVal)}
                            </span>
                          </div>
                          <div className={styles.tradeDetailsRow}>
                            <span>{trade.type} {trade.lotSize} Lots</span>
                            <span>{trade.pnlPips !== undefined ? `${trade.pnlPips.toFixed(1)}p` : ''}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Screenshots Widget */}
            <div className={styles.widgetCard}>
              <h4 className={styles.widgetTitle}>Screenshots ({screenshots.length})</h4>
              <div
                className={styles.pasteInstructions}
                onClick={() => fileInputRef.current?.click()}
              >
                🖱️ Click to Upload or <br />
                📋 paste an image (Ctrl+V) anywhere
              </div>

              {screenshots.length > 0 && (
                <div className={styles.screenshotThumbnails}>
                  {screenshots.map(url => (
                    <div key={url} className={styles.screenshotWrapper}>
                      <img src={url} alt="screenshot" className={styles.screenshotImg} />
                      <button
                        className={styles.removeScreenshotBtn}
                        onClick={() => handleRemoveScreenshot(url)}
                        title="Remove image"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tags Widget */}
            <div className={styles.widgetCard}>
              <h4 className={styles.widgetTitle}>Journal Tags</h4>
              <div className={styles.tagsInputWrapper}>
                <input
                  type="text"
                  placeholder="Add tags... (Enter)"
                  className="input"
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={handleAddTag}
                />
              </div>

              {tags.length > 0 && (
                <div className={styles.tagPills}>
                  {tags.map(t => (
                    <span key={t} className={styles.tagPill}>
                      #{t}
                      <button className={styles.removeTagBtn} onClick={() => handleRemoveTag(t)}>
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

    </div>
  );
}
