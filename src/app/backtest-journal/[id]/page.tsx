'use client';

import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import styles from './page.module.css';

interface TradeEntry {
  id: string;
  tradeNumber: number;
  tradeName: string | null;
  pair: string;
  direction: string;
  timeframe: string | null;
  entryPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  riskReward: number | null;
  pips: number | null;
  pnl: number | null;
  outcome: string;
  tradeDate: string | null;
  tradeTime: string | null;
  session: string | null;
  levelsPlayed: string[];
  confirmations: string[];
  notes: string | null;
  mistakes: string[];
  lessons: string | null;
  category: string | null;
  screenshot: string | null;
  charts: string[];
  replayLink: string | null;
  tvLink: string | null;
  tags: string[];
  confidence: number | null;
  executionRating: number | null;
  disciplineRating: number | null;
  patienceRating: number | null;
  psychologyRating: number | null;
  emotionBefore: string | null;
  emotionAfter: string | null;
  aiReview: any | null;
  createdAt: string;
}

interface RecordData {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  trades: TradeEntry[];
}

const CONFIRMATIONS_OPTIONS = [
  'BOS', 'CHOCH', 'MSS', 'Engulfing', 'Pin Bar', 'Liquidity Sweep', 'Volume Spike',
  'Retest', 'Breakout', 'Rejection', 'Displacement', 'FVG Tap', 'SMT', 'Divergence'
];

const LEVELS_OPTIONS = [
  'Daily High', 'Daily Low', 'Weekly High', 'Weekly Low', 'Previous Day High', 'Previous Day Low',
  'Asian High', 'Asian Low', 'London High', 'London Low', 'Equal Highs', 'Equal Lows',
  'Liquidity Sweep', 'Order Block', 'Breaker', 'Mitigation Block', 'Fair Value Gap', 'Inverse FVG',
  'Premium', 'Discount', 'OTE', 'Support', 'Resistance', 'Trendline', 'Supply', 'Demand'
];

const MISTAKES_OPTIONS = [
  'FOMO', 'Revenge Trading', 'Entered Too Early', 'Entered Too Late', 'Chasing Price',
  'Overleveraging', 'Moved SL Too Early', 'Moved SL to BE Too Early', 'Wide Stop',
  'Tight Stop', 'Ignored News', 'Broke Rules', 'Held Too Long', 'Exited Too Early',
  'Distracted', 'No Plan'
];

const EMOTIONS_OPTIONS = [
  'Focused', 'Confident', 'Anxious', 'Greedy', 'Fearful', 'Calm', 'Bored', 'Excited', 'Frustrated'
];

export default function RecordWorkspacePage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [record, setRecord] = useState<RecordData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'entries' | 'analytics' | 'coach' | 'settings'>('dashboard');

  // API Key state
  const [apiKey, setApiKey] = useState('');
  const [isApiKeySet, setIsApiKeySet] = useState(false);

  // Search/Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOutcome, setFilterOutcome] = useState('ALL');
  const [filterPair, setFilterPair] = useState('ALL');

  // Trade entries states
  const [expandedTrade, setExpandedTrade] = useState<string | null>(null);

  // Form Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [editingTradeId, setEditingTradeId] = useState<string | null>(null);

  // Analysis State
  const [analyzingScreenshot, setAnalyzingScreenshot] = useState(false);
  const [confidenceScore, setConfidenceScore] = useState<number | null>(null);

  // Trade review loading states
  const [analyzingTradeId, setAnalyzingTradeId] = useState<string | null>(null);

  // AI Coach Chat State
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    { role: 'assistant', content: 'Welcome to your AI Trading Coach. Ask me anything about your trades, mistakes, setups, or sessions in this project!' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [coachLoading, setCoachLoading] = useState(false);

  // Form Fields
  const [formTradeName, setFormTradeName] = useState('');
  const [formPair, setFormPair] = useState('XAUUSD');
  const [formDirection, setFormDirection] = useState<'LONG' | 'SHORT'>('LONG');
  const [formTimeframe, setFormTimeframe] = useState('15m');
  const [formEntryPrice, setFormEntryPrice] = useState('');
  const [formStopLoss, setFormStopLoss] = useState('');
  const [formTakeProfit, setFormTakeProfit] = useState('');
  const [formRiskReward, setFormRiskReward] = useState('');
  const [formPips, setFormPips] = useState('');
  const [formPnl, setFormPnl] = useState('');
  const [formOutcome, setFormOutcome] = useState<'WIN' | 'LOSS' | 'BREAKEVEN'>('WIN');
  const [formDate, setFormDate] = useState('');
  const [formTime, setFormTime] = useState('');
  const [formSession, setFormSession] = useState('London');
  const [formLevels, setFormLevels] = useState<string[]>([]);
  const [formConfirmations, setFormConfirmations] = useState<string[]>([]);
  const [formMistakes, setFormMistakes] = useState<string[]>([]);
  const [formNotes, setFormNotes] = useState('');
  const [formLessons, setFormLessons] = useState('');
  const [formCategory, setFormCategory] = useState('A');
  const [formScreenshot, setFormScreenshot] = useState('');
  const [formCharts, setFormCharts] = useState<string[]>([]);
  const [formReplayLink, setFormReplayLink] = useState('');
  const [formTvLink, setFormTvLink] = useState('');
  const [formTags, setFormTags] = useState<string[]>([]);

  // Ratings
  const [formExecutionRating, setFormExecutionRating] = useState(5);
  const [formDisciplineRating, setFormDisciplineRating] = useState(5);
  const [formPatienceRating, setFormPatienceRating] = useState(5);
  const [formPsychologyRating, setFormPsychologyRating] = useState(5);
  const [formEmotionBefore, setFormEmotionBefore] = useState('Focused');
  const [formEmotionAfter, setFormEmotionAfter] = useState('Calm');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load API key from local storage on mount
  useEffect(() => {
    const key = localStorage.getItem('google_ai_pro_key') || '';
    setApiKey(key);
    setIsApiKeySet(!!key);
  }, []);

  const fetchRecord = useCallback(async () => {
    try {
      const res = await fetch(`/api/backtest-journal/records/${id}`);
      const data = await res.json();
      if (data.success) {
        setRecord(data.data);
      }
    } catch (e) {
      console.error('Failed to fetch record:', e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchRecord();
    }
  }, [id, fetchRecord]);

  const handleSaveApiKey = () => {
    localStorage.setItem('google_ai_pro_key', apiKey.trim());
    setIsApiKeySet(!!apiKey.trim());
    alert('Google AI Pro API Key saved successfully to local storage.');
  };

  const handleUpdateRecordSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!record) return;

    try {
      const res = await fetch(`/api/backtest-journal/records/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: record.name, description: record.description }),
      });
      const data = await res.json();
      if (data.success) {
        alert('Settings updated successfully.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteRecord = async () => {
    if (!confirm('Are you sure you want to delete this backtest record? All associated trade entries will be permanently deleted.')) {
      return;
    }
    try {
      const res = await fetch(`/api/backtest-journal/records/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        router.push('/backtest-journal');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Image base64 conversion & Gemini OCR Trigger
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      setFormScreenshot(base64String);

      // Trigger Gemini Analysis
      setAnalyzingScreenshot(true);
      setConfidenceScore(null);

      try {
        const userKey = localStorage.getItem('google_ai_pro_key') || '';
        const res = await fetch('/api/backtest-journal/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64String, googleApiKey: userKey }),
        });
        const parsed = await res.json();
        if (parsed.success && parsed.data) {
          const ai = parsed.data;
          
          if (ai.tradeDirection) setFormDirection(ai.tradeDirection);
          if (ai.pair) setFormPair(ai.pair);
          if (ai.timeframe) setFormTimeframe(ai.timeframe);
          if (ai.entryPrice) setFormEntryPrice(ai.entryPrice.toString());
          if (ai.stopLoss) setFormStopLoss(ai.stopLoss.toString());
          if (ai.takeProfit) setFormTakeProfit(ai.takeProfit.toString());
          if (ai.riskReward) setFormRiskReward(ai.riskReward.toString());
          if (ai.pips) setFormPips(ai.pips.toString());
          if (ai.outcome) setFormOutcome(ai.outcome);
          if (ai.tradeDate) setFormDate(ai.tradeDate);
          if (ai.tradeTime) setFormTime(ai.tradeTime);
          if (ai.session) setFormSession(ai.session);
          if (ai.notes) setFormNotes(ai.notes);
          if (ai.confidenceScore) setConfidenceScore(ai.confidenceScore);

          // Calculate default R-multiple if outcome and riskReward are set
          if (ai.riskReward) {
            if (ai.outcome === 'WIN') {
              setFormPnl(ai.riskReward.toString());
            } else if (ai.outcome === 'LOSS') {
              setFormPnl('-1');
            } else {
              setFormPnl('0');
            }
          }
        } else {
          alert(parsed.error || 'Failed to analyze screenshot.');
        }
      } catch (err) {
        console.error(err);
        alert('An error occurred while contacting the Vision API.');
      } finally {
        setAnalyzingScreenshot(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Add / Edit submission
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPair || !formDirection || !formOutcome) return;

    const payload = {
      backtestRecordId: id,
      tradeName: formTradeName || null,
      pair: formPair,
      direction: formDirection,
      timeframe: formTimeframe || null,
      entryPrice: formEntryPrice ? parseFloat(formEntryPrice) : null,
      stopLoss: formStopLoss ? parseFloat(stopLossOffset()) : null,
      takeProfit: formTakeProfit ? parseFloat(takeProfitOffset()) : null,
      riskReward: formRiskReward ? parseFloat(formRiskReward) : null,
      pips: formPips ? parseFloat(formPips) : null,
      pnl: formPnl ? parseFloat(formPnl) : null,
      outcome: formOutcome,
      tradeDate: formDate || null,
      tradeTime: formTime || null,
      session: formSession || null,
      levelsPlayed: formLevels,
      confirmations: formConfirmations,
      notes: formNotes || null,
      mistakes: formMistakes,
      lessons: formLessons || null,
      category: formCategory || null,
      screenshot: formScreenshot || null,
      charts: formCharts,
      replayLink: formReplayLink || null,
      tvLink: formTvLink || null,
      tags: formTags,
      confidence: confidenceScore,
      executionRating: formExecutionRating,
      disciplineRating: formDisciplineRating,
      patienceRating: formPatienceRating,
      psychologyRating: formPsychologyRating,
      emotionBefore: formEmotionBefore,
      emotionAfter: formEmotionAfter,
    };

    try {
      let res;
      if (formMode === 'add') {
        res = await fetch('/api/backtest-journal/trades', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/backtest-journal/trades/${editingTradeId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      const data = await res.json();
      if (data.success) {
        fetchRecord();
        setIsFormOpen(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const stopLossOffset = () => formStopLoss || '';
  const takeProfitOffset = () => formTakeProfit || '';

  const handleOpenAddForm = () => {
    setFormMode('add');
    setEditingTradeId(null);
    setFormTradeName('');
    setFormPair('XAUUSD');
    setFormDirection('LONG');
    setFormTimeframe('15m');
    setFormEntryPrice('');
    setFormStopLoss('');
    setFormTakeProfit('');
    setFormRiskReward('');
    setFormPips('');
    setFormPnl('');
    setFormOutcome('WIN');
    setFormDate('');
    setFormTime('');
    setFormSession('London');
    setFormLevels([]);
    setFormConfirmations([]);
    setFormMistakes([]);
    setFormNotes('');
    setFormLessons('');
    setFormCategory('A');
    setFormScreenshot('');
    setFormCharts([]);
    setFormReplayLink('');
    setFormTvLink('');
    setFormTags([]);
    setConfidenceScore(null);
    setFormExecutionRating(5);
    setFormDisciplineRating(5);
    setFormPatienceRating(5);
    setFormPsychologyRating(5);
    setFormEmotionBefore('Focused');
    setFormEmotionAfter('Calm');
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (t: TradeEntry) => {
    setFormMode('edit');
    setEditingTradeId(t.id);
    setFormTradeName(t.tradeName || '');
    setFormPair(t.pair);
    setFormDirection(t.direction as any);
    setFormTimeframe(t.timeframe || '');
    setFormEntryPrice(t.entryPrice?.toString() || '');
    setFormStopLoss(t.stopLoss?.toString() || '');
    setFormTakeProfit(t.takeProfit?.toString() || '');
    setFormRiskReward(t.riskReward?.toString() || '');
    setFormPips(t.pips?.toString() || '');
    setFormPnl(t.pnl?.toString() || '');
    setFormOutcome(t.outcome as any);
    setFormDate(t.tradeDate || '');
    setFormTime(t.tradeTime || '');
    setFormSession(t.session || '');
    setFormLevels(t.levelsPlayed);
    setFormConfirmations(t.confirmations);
    setFormMistakes(t.mistakes);
    setFormNotes(t.notes || '');
    setFormLessons(t.lessons || '');
    setFormCategory(t.category || 'A');
    setFormScreenshot(t.screenshot || '');
    setFormCharts(t.charts);
    setFormReplayLink(t.replayLink || '');
    setFormTvLink(t.tvLink || '');
    setFormTags(t.tags);
    setConfidenceScore(t.confidence);
    setFormExecutionRating(t.executionRating || 5);
    setFormDisciplineRating(t.disciplineRating || 5);
    setFormPatienceRating(t.patienceRating || 5);
    setFormPsychologyRating(t.psychologyRating || 5);
    setFormEmotionBefore(t.emotionBefore || 'Focused');
    setFormEmotionAfter(t.emotionAfter || 'Calm');
    setIsFormOpen(true);
  };

  const handleDeleteTrade = async (tradeId: string) => {
    if (!confirm('Are you sure you want to delete this trade entry?')) return;
    try {
      const res = await fetch(`/api/backtest-journal/trades/${tradeId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchRecord();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDuplicateTrade = async (tradeId: string) => {
    try {
      const res = await fetch(`/api/backtest-journal/trades/${tradeId}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        fetchRecord();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Analyze Trade Critiques via Gemini Vision / Text
  const handleAnalyzeTrade = async (trade: TradeEntry) => {
    setAnalyzingTradeId(trade.id);
    try {
      const userKey = localStorage.getItem('google_ai_pro_key') || '';
      if (!userKey) {
        alert('Please configure your Google AI Pro API Key in the Settings tab first.');
        setAnalyzingTradeId(null);
        return;
      }

      const prompt = `Critique this trade setup:
Direction: ${trade.direction}
Pair: ${trade.pair}
Outcome: ${trade.outcome}
PnL: ${trade.pnl}R
Pips: ${trade.pips}
Stop Loss: ${trade.stopLoss}
Take Profit: ${trade.takeProfit}
Entry Price: ${trade.entryPrice}
Levels Played: ${trade.levelsPlayed.join(', ') || 'None'}
Confirmations: ${trade.confirmations.join(', ') || 'None'}
Mistakes: ${trade.mistakes.join(', ') || 'None'}
Psychology/Discipline Ratings: Execution=${trade.executionRating}/5, Discipline=${trade.disciplineRating}/5, Patience=${trade.patienceRating}/5
Notes: ${trade.notes || 'None'}

Provide an analytical breakdown of this trade in structured JSON format. Break it down into:
- strengths: array of strings summarizing good points
- weaknesses: array of strings summarizing risks/violations
- alternatives: string explaining potential better entry or exit points
- score: execution grade/score from 0 to 100
- mistakes: list of mistakes observed

Required JSON structure:
{
  "strengths": [string],
  "weaknesses": [string],
  "alternatives": string,
  "score": number,
  "mistakes": [string]
}`;

      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${userKey}`;

      const bodyPayload: any = {
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json'
        }
      };

      // If screenshot exists, send it along!
      if (trade.screenshot) {
        const matches = trade.screenshot.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const mimeType = matches[1];
          const base64Data = matches[2];
          bodyPayload.contents[0].parts.push({
            inlineData: { mimeType, data: base64Data }
          } as any);
        }
      }

      const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });

      if (!response.ok) {
        throw new Error(response.statusText);
      }

      const result = await response.json();
      const contentText = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (contentText) {
        const parsedReview = JSON.parse(contentText.trim());

        // Update trade with review cache in DB
        const updateRes = await fetch(`/api/backtest-journal/trades/${trade.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ aiReview: parsedReview }),
        });
        const updateData = await updateRes.json();
        if (updateData.success) {
          fetchRecord();
        }
      }
    } catch (err: any) {
      console.error(err);
      alert(`AI Analysis failed: ${err.message || err}`);
    } finally {
      setAnalyzingTradeId(null);
    }
  };

  // AI Performance Coach Chat Trigger
  const handleSendCoachMessage = async (overridePrompt?: string) => {
    const activePrompt = overridePrompt || chatInput;
    if (!activePrompt.trim()) return;

    const userKey = localStorage.getItem('google_ai_pro_key') || '';
    if (!userKey) {
      alert('Please configure your Google AI Pro API Key in the Settings tab first.');
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
          backtestRecordId: id,
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

  // Dashboard & Analytics Math calculations
  const stats = useMemo(() => {
    if (!record || record.trades.length === 0) return null;
    const trades = record.trades;
    const total = trades.length;

    let wins = 0;
    let losses = 0;
    let breakevens = 0;
    let totalR = 0;
    let totalPips = 0;
    let winningR = 0;
    let losingR = 0;
    let maxWin = 0;
    let maxLoss = 0;
    let longCount = 0;
    let shortCount = 0;
    let longWins = 0;
    let shortWins = 0;

    const weekdayWins: Record<string, { w: number; t: number }> = {};
    const sessionWins: Record<string, { w: number; t: number }> = {};
    const setupWins: Record<string, { w: number; t: number }> = {};
    const mistakesCount: Record<string, number> = {};

    trades.forEach(t => {
      const outcome = t.outcome.toUpperCase();
      const pnlR = t.pnl || 0;
      const pips = t.pips || 0;

      totalR += pnlR;
      totalPips += pips;

      if (outcome === 'WIN') {
        wins++;
        winningR += pnlR;
        if (pnlR > maxWin) maxWin = pnlR;
      } else if (outcome === 'LOSS') {
        losses++;
        losingR += Math.abs(pnlR);
        if (pnlR < maxLoss) maxLoss = pnlR;
      } else {
        breakevens++;
      }

      if (t.direction === 'LONG') {
        longCount++;
        if (outcome === 'WIN') longWins++;
      } else {
        shortCount++;
        if (outcome === 'WIN') shortWins++;
      }

      // Date calculations
      if (t.tradeDate) {
        const dateObj = new Date(t.tradeDate);
        const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
        if (!weekdayWins[dayName]) weekdayWins[dayName] = { w: 0, t: 0 };
        weekdayWins[dayName].t++;
        if (outcome === 'WIN') weekdayWins[dayName].w++;
      }

      // Session
      const sess = t.session || 'Unknown';
      if (!sessionWins[sess]) sessionWins[sess] = { w: 0, t: 0 };
      sessionWins[sess].t++;
      if (outcome === 'WIN') sessionWins[sess].w++;

      // Confirmations/Setups
      t.confirmations.forEach(c => {
        if (!setupWins[c]) setupWins[c] = { w: 0, t: 0 };
        setupWins[c].t++;
        if (outcome === 'WIN') setupWins[c].w++;
      });

      // Mistakes
      t.mistakes.forEach(m => {
        mistakesCount[m] = (mistakesCount[m] || 0) + 1;
      });
    });

    const winRate = (wins / total) * 100;
    const profitFactor = losingR > 0 ? winningR / losingR : winningR > 0 ? 999 : 0;
    const expectancy = total > 0 ? totalR / total : 0;

    return {
      total, wins, losses, breakevens,
      winRate: parseFloat(winRate.toFixed(1)),
      profitFactor: parseFloat(profitFactor.toFixed(2)),
      expectancy: parseFloat(expectancy.toFixed(2)),
      netR: parseFloat(totalR.toFixed(2)),
      netPips: parseFloat(totalPips.toFixed(1)),
      maxWin: parseFloat(maxWin.toFixed(2)),
      maxLoss: parseFloat(maxLoss.toFixed(2)),
      longCount, shortCount,
      longWinRate: longCount > 0 ? parseFloat(((longWins / longCount) * 100).toFixed(1)) : 0,
      shortWinRate: shortCount > 0 ? parseFloat(((shortWins / shortCount) * 100).toFixed(1)) : 0,
      weekdayWins, sessionWins, setupWins, mistakesCount
    };
  }, [record]);

  // List of unique pairs for filtering
  const pairsList = useMemo(() => {
    if (!record) return [];
    const set = new Set<string>();
    record.trades.forEach(t => set.add(t.pair.toUpperCase()));
    return Array.from(set);
  }, [record]);

  // Filtered trades list
  const filteredTrades = useMemo(() => {
    if (!record) return [];
    return record.trades.filter(t => {
      const matchesSearch = t.pair.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (t.tradeName && t.tradeName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (t.notes && t.notes.toLowerCase().includes(searchTerm.toLowerCase())) ||
        t.confirmations.some(c => c.toLowerCase().includes(searchTerm.toLowerCase())) ||
        t.levelsPlayed.some(l => l.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesOutcome = filterOutcome === 'ALL' || t.outcome.toUpperCase() === filterOutcome;
      const matchesPair = filterPair === 'ALL' || t.pair.toUpperCase() === filterPair;

      return matchesSearch && matchesOutcome && matchesPair;
    }).sort((a, b) => b.tradeNumber - a.tradeNumber); // newest first
  }, [record, searchTerm, filterOutcome, filterPair]);

  // SVG chart builders (cumulative equity and mistakes)
  const renderEquitySvg = () => {
    if (!record || record.trades.length === 0) return null;
    const trades = [...record.trades].sort((a, b) => a.tradeNumber - b.tradeNumber);
    const dataPoints = [0];
    let rolling = 0;
    trades.forEach(t => {
      rolling += t.pnl || 0;
      dataPoints.push(rolling);
    });

    const width = 500;
    const height = 220;
    const padding = 30;

    const maxVal = Math.max(...dataPoints, 5);
    const minVal = Math.min(...dataPoints, -5);
    const range = maxVal - minVal;

    const getX = (idx: number) => padding + (idx / (dataPoints.length - 1)) * (width - 2 * padding);
    const getY = (val: number) => height - padding - ((val - minVal) / range) * (height - 2 * padding);

    let pathD = `M ${getX(0)} ${getY(0)}`;
    for (let i = 1; i < dataPoints.length; i++) {
      pathD += ` L ${getX(i)} ${getY(i)}`;
    }

    return (
      <svg width="100%" height="220" viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
        {/* Grid lines */}
        <line x1={padding} y1={getY(0)} x2={width - padding} y2={getY(0)} stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />
        {/* Path line */}
        <path d={pathD} fill="none" stroke="url(#equityGrad)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {/* Glow */}
        <path d={pathD} fill="none" stroke="#8b5cf6" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" opacity="0.15" />
        {/* Gradients */}
        <defs>
          <linearGradient id="equityGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#c084fc" />
          </linearGradient>
        </defs>
        {/* Data points */}
        {dataPoints.map((pt, i) => (
          <circle key={i} cx={getX(i)} cy={getY(i)} r="4" fill="#ffffff" stroke="#8b5cf6" strokeWidth="2" />
        ))}
      </svg>
    );
  };

  const renderMistakesSvg = () => {
    if (!stats || Object.keys(stats.mistakesCount).length === 0) {
      return <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)' }}>No mistakes logged yet! Great discipline!</div>;
    }
    const mistakes = Object.entries(stats.mistakesCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const width = 500;
    const height = 220;
    const barHeight = 25;
    const spacing = 15;
    const paddingLeft = 140;
    const paddingRight = 40;

    const maxCount = Math.max(...mistakes.map(m => m[1]), 1);

    return (
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {mistakes.map(([name, count], idx) => {
          const y = idx * (barHeight + spacing) + 20;
          const barWidth = ((width - paddingLeft - paddingRight) * count) / maxCount;

          return (
            <g key={name}>
              {/* Mistake label */}
              <text x={paddingLeft - 10} y={y + 17} fill="var(--text-muted)" fontSize="12" textAnchor="end">{name}</text>
              {/* Bar back */}
              <rect x={paddingLeft} y={y} width={width - paddingLeft - paddingRight} height={barHeight} fill="rgba(255,255,255,0.02)" rx="4" />
              {/* Bar fill */}
              <rect x={paddingLeft} y={y} width={barWidth} height={barHeight} fill="#f87171" rx="4" opacity="0.8" />
              {/* Occurrence count */}
              <text x={paddingLeft + barWidth + 8} y={y + 17} fill="#ffffff" fontSize="12" fontWeight="600">{count}</text>
            </g>
          );
        })}
      </svg>
    );
  };

  const renderSetupPerformanceSvg = () => {
    if (!stats || Object.keys(stats.setupWins).length === 0) {
      return <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)' }}>No setups evaluated yet.</div>;
    }
    const setups = Object.entries(stats.setupWins).sort((a, b) => b[1].t - a[1].t).slice(0, 5);
    const width = 500;
    const height = 220;
    const barHeight = 25;
    const spacing = 15;
    const paddingLeft = 140;
    const paddingRight = 40;

    return (
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {setups.map(([name, s], idx) => {
          const y = idx * (barHeight + spacing) + 20;
          const totalWidth = width - paddingLeft - paddingRight;
          const winPercent = (s.w / s.t) * 100;
          const barWidth = (totalWidth * s.t) / Math.max(...setups.map(x => x[1].t), 1);
          const winFillWidth = (barWidth * s.w) / s.t;

          return (
            <g key={name}>
              <text x={paddingLeft - 10} y={y + 17} fill="var(--text-muted)" fontSize="12" textAnchor="end">{name}</text>
              <rect x={paddingLeft} y={y} width={totalWidth} height={barHeight} fill="rgba(255,255,255,0.02)" rx="4" />
              {/* Total volume bar */}
              <rect x={paddingLeft} y={y} width={barWidth} height={barHeight} fill="rgba(255,255,255,0.06)" rx="4" />
              {/* Win proportion */}
              <rect x={paddingLeft} y={y} width={winFillWidth} height={barHeight} fill="#10b981" rx="4" opacity="0.75" />
              <text x={paddingLeft + barWidth + 8} y={y + 17} fill="#ffffff" fontSize="12" fontWeight="600">
                {s.w}/{s.t} ({winPercent.toFixed(0)}%)
              </text>
            </g>
          );
        })}
      </svg>
    );
  };

  const renderRatingStars = (rating: number, setRating?: (val: number) => void) => {
    return (
      <div className={styles.starRating}>
        {[1, 2, 3, 4, 5].map(star => (
          <span
            key={star}
            className={`${styles.star} ${star <= rating ? styles.starFilled : ''}`}
            onClick={() => setRating && setRating(star)}
          >
            ★
          </span>
        ))}
      </div>
    );
  };

  if (loading) return <div className={styles.loadingSpinner} />;
  if (!record) return <div className={styles.content}>Record not found.</div>;

  return (
    <div className={styles.wrapper}>
      {/* Workspace Sidebar */}
      <div className={styles.sidebar}>
        <div>
          <div className={styles.recordTitleSection}>
            <Link href="/backtest-journal" className={styles.backLink}>
              🡠 Back to Records
            </Link>
            <h2 className={styles.recordName} title={record.name}>{record.name}</h2>
          </div>
          
          <nav className={styles.navGroup} aria-label="Record categories">
            <button
              className={`${styles.navItem} ${activeTab === 'dashboard' ? styles.activeNavItem : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              📊 Dashboard
            </button>
            <button
              className={`${styles.navItem} ${activeTab === 'entries' ? styles.activeNavItem : ''}`}
              onClick={() => setActiveTab('entries')}
            >
              📓 Trade Entries
            </button>
            <button
              className={`${styles.navItem} ${activeTab === 'analytics' ? styles.activeNavItem : ''}`}
              onClick={() => setActiveTab('analytics')}
            >
              📈 Analytics
            </button>
            <button
              className={`${styles.navItem} ${activeTab === 'coach' ? styles.activeNavItem : ''}`}
              onClick={() => setActiveTab('coach')}
            >
              🤖 AI Coach
            </button>
            <button
              className={`${styles.navItem} ${activeTab === 'settings' ? styles.activeNavItem : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              ⚙️ Settings
            </button>
          </nav>
        </div>

        <div className={styles.sidebarFooter}>
          <div className={styles.apiKeyBadge}>
            <span className={`${styles.apiKeyStatus} ${isApiKeySet ? styles.apiKeyStatusActive : styles.apiKeyStatusMissing}`} />
            <span style={{ color: 'var(--text-muted)' }}>Gemini AI Pro</span>
          </div>
        </div>
      </div>

      {/* Main Workspace Content Area */}
      <div className={styles.content}>
        {/* ========================================================
            DASHBOARD TAB
            ======================================================== */}
        {activeTab === 'dashboard' && (
          <div>
            <h1 className={styles.tabTitle}>Dashboard Summary</h1>
            {!stats ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyTitle}>Your Dashboard is Empty</div>
                <p className={styles.emptyDesc}>Add manual trade entries with screenshots to populate advanced strategy analytics charts.</p>
                <button className={styles.emptyBtn} onClick={() => setActiveTab('entries')}>Go to Entries</button>
              </div>
            ) : (
              <div>
                <div className={styles.dashboardGrid}>
                  <div className={styles.widgetCard}>
                    <span className={styles.widgetLabel}>Total Trades</span>
                    <span className={styles.widgetVal}>{stats.total}</span>
                  </div>
                  <div className={styles.widgetCard}>
                    <span className={styles.widgetLabel}>Win Rate</span>
                    <span className={styles.widgetVal}>{stats.winRate}%</span>
                  </div>
                  <div className={styles.widgetCard}>
                    <span className={styles.widgetLabel}>Net PnL (R)</span>
                    <span className={`${styles.widgetVal} ${stats.netR >= 0 ? styles.pnlPositive : styles.pnlNegative}`}>
                      {stats.netR >= 0 ? '+' : ''}{stats.netR}R
                    </span>
                  </div>
                  <div className={styles.widgetCard}>
                    <span className={styles.widgetLabel}>Net Pips</span>
                    <span className={`${styles.widgetVal} ${stats.netPips >= 0 ? styles.pnlPositive : styles.pnlNegative}`}>
                      {stats.netPips >= 0 ? '+' : ''}{stats.netPips}
                    </span>
                  </div>
                  <div className={styles.widgetCard}>
                    <span className={styles.widgetLabel}>Profit Factor</span>
                    <span className={styles.widgetVal}>{stats.profitFactor}</span>
                  </div>
                  <div className={styles.widgetCard}>
                    <span className={styles.widgetLabel}>Expectancy</span>
                    <span className={styles.widgetVal}>{stats.expectancy} R</span>
                  </div>
                  <div className={styles.widgetCard}>
                    <span className={styles.widgetLabel}>Largest Win</span>
                    <span className={`${styles.widgetVal} styles.pnlPositive`}>+{stats.maxWin}R</span>
                  </div>
                  <div className={styles.widgetCard}>
                    <span className={styles.widgetLabel}>Largest Loss</span>
                    <span className={`${styles.widgetVal} styles.pnlNegative`}>{stats.maxLoss}R</span>
                  </div>
                </div>

                <div className={styles.chartsRow}>
                  <div className={styles.chartCard}>
                    <h3 className={styles.chartTitle}>Equity Curve (Cumulative R)</h3>
                    {renderEquitySvg()}
                  </div>
                  <div className={styles.chartCard}>
                    <h3 className={styles.chartTitle}>Top Mistakes Frequency</h3>
                    {renderMistakesSvg()}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            TRADE ENTRIES TAB
            ======================================================== */}
        {activeTab === 'entries' && (
          <div>
            <h1 className={styles.tabTitle}>Trade Entries</h1>
            
            <div className={styles.actionsRow}>
              <div style={{ display: 'flex', gap: '0.75rem', flex: 1 }}>
                <div className={styles.searchBar}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.5 }}>
                    <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                  <input
                    type="text"
                    placeholder="Search by pair, setup, tag..."
                    className={styles.searchInput}
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
                
                <select
                  className={styles.searchInput}
                  style={{ maxWidth: '130px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '0 0.5rem', color: '#fff' }}
                  value={filterOutcome}
                  onChange={e => setFilterOutcome(e.target.value)}
                >
                  <option value="ALL">All Outcomes</option>
                  <option value="WIN">Wins</option>
                  <option value="LOSS">Losses</option>
                  <option value="BREAKEVEN">Breakeven</option>
                </select>

                <select
                  className={styles.searchInput}
                  style={{ maxWidth: '130px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '0 0.5rem', color: '#fff' }}
                  value={filterPair}
                  onChange={e => setFilterPair(e.target.value)}
                >
                  <option value="ALL">All Pairs</option>
                  {pairsList.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              <button className={styles.addEntryBtn} onClick={handleOpenAddForm}>
                + Add Entry
              </button>
            </div>

            {filteredTrades.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyTitle}>No Entries Found</div>
                <p className={styles.emptyDesc}>Try adjusting your search criteria or add a new trade entry.</p>
              </div>
            ) : (
              <div className={styles.entriesList}>
                {filteredTrades.map(t => {
                  const isExpanded = expandedTrade === t.id;
                  const tradeTitle = t.tradeName || `Trade #${t.tradeNumber}`;
                  return (
                    <div key={t.id} className={styles.entryRow}>
                      {/* Row Header (click to expand) */}
                      <div className={styles.entryHeader} onClick={() => setExpandedTrade(isExpanded ? null : t.id)}>
                        <span className={styles.tradeNo}>#{t.tradeNumber}</span>
                        <div className={styles.tradeDetailsSummary}>
                          <div className={styles.summaryCol} style={{ minWidth: '120px' }}>
                            <span className={styles.summaryLabel}>Trade Name</span>
                            <span className={styles.summaryVal}>{tradeTitle}</span>
                          </div>
                          <div className={styles.summaryCol}>
                            <span className={styles.summaryLabel}>Pair / TF</span>
                            <span className={styles.summaryVal}>{t.pair} ({t.timeframe || 'N/A'})</span>
                          </div>
                          <div className={styles.summaryCol}>
                            <span className={styles.summaryLabel}>Direction</span>
                            <span className={`${styles.badge} ${t.direction === 'LONG' ? styles.badgeLong : styles.badgeShort}`}>
                              {t.direction}
                            </span>
                          </div>
                          <div className={styles.summaryCol}>
                            <span className={styles.summaryLabel}>Outcome</span>
                            <span className={`${styles.badge} ${t.outcome === 'WIN' ? styles.badgeWin : t.outcome === 'LOSS' ? styles.badgeLoss : styles.badgeBreakeven}`}>
                              {t.outcome}
                            </span>
                          </div>
                          <div className={styles.summaryCol}>
                            <span className={styles.summaryLabel}>PnL (R)</span>
                            <span className={`${styles.summaryVal} ${t.pnl && t.pnl >= 0 ? styles.pnlPositive : styles.pnlNegative}`}>
                              {t.pnl !== null ? `${t.pnl >= 0 ? '+' : ''}${t.pnl}R` : 'N/A'}
                            </span>
                          </div>
                          <div className={styles.summaryCol}>
                            <span className={styles.summaryLabel}>Date</span>
                            <span className={styles.summaryVal}>{t.tradeDate || 'Unknown'}</span>
                          </div>
                        </div>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          {isExpanded ? '▲' : '▼'}
                        </span>
                      </div>

                      {/* Row Expanded Details */}
                      {isExpanded && (
                        <div className={styles.entryExpandContent}>
                          {/* Image side */}
                          <div className={styles.screenshotCol}>
                            {t.screenshot ? (
                              <img src={t.screenshot} alt="TradingView Chart Setup" className={styles.entryScreenshot} />
                            ) : (
                              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)', height: '220px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                No screenshot uploaded.
                              </div>
                            )}

                            {/* Optional Annotated Charts */}
                            {t.charts && t.charts.length > 0 && (
                              <div className={styles.chipGroup}>
                                {t.charts.map((img, i) => (
                                  <a key={i} href={img} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                                    <span className={styles.tagChip}>Chart Preview #{i + 1}</span>
                                  </a>
                                ))}
                              </div>
                            )}

                            {/* AI Trade Review Panel */}
                            <div className={styles.aiReviewSection}>
                              <div className={styles.aiReviewTitle}>
                                <span>🤖 AI Trade Review</span>
                                {t.aiReview?.score && (
                                  <span className={styles.aiReviewScore}>{t.aiReview.score}/100</span>
                                )}
                              </div>
                              {t.aiReview ? (
                                <div className={styles.aiReviewContent}>
                                  <div style={{ marginBottom: '0.75rem' }}>
                                    <strong style={{ color: '#10b981' }}>Strengths:</strong>
                                    <ul style={{ paddingLeft: '1rem', marginTop: '0.25rem' }}>
                                      {t.aiReview.strengths?.map((s: string, idx: number) => <li key={idx}>{s}</li>)}
                                    </ul>
                                  </div>
                                  <div style={{ marginBottom: '0.75rem' }}>
                                    <strong style={{ color: '#ef4444' }}>Weaknesses:</strong>
                                    <ul style={{ paddingLeft: '1rem', marginTop: '0.25rem' }}>
                                      {t.aiReview.weaknesses?.map((w: string, idx: number) => <li key={idx}>{w}</li>)}
                                    </ul>
                                  </div>
                                  {t.aiReview.alternatives && (
                                    <div>
                                      <strong style={{ color: '#3b82f6' }}>Alternatives:</strong>
                                      <p style={{ marginTop: '0.25rem' }}>{t.aiReview.alternatives}</p>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <button
                                  className={styles.addEntryBtn}
                                  style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}
                                  onClick={() => handleAnalyzeTrade(t)}
                                  disabled={analyzingTradeId === t.id}
                                >
                                  {analyzingTradeId === t.id ? 'Critiquing...' : 'Analyze This Trade'}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Data details side */}
                          <div className={styles.detailsCol}>
                            <div className={styles.detailsGrid}>
                              <div className={styles.detailField}>
                                <span className={styles.detailLabel}>Entry Price</span>
                                <span className={styles.detailVal}>{t.entryPrice || 'N/A'}</span>
                              </div>
                              <div className={styles.detailField}>
                                <span className={styles.detailLabel}>Stop Loss</span>
                                <span className={styles.detailVal}>{t.stopLoss || 'N/A'}</span>
                              </div>
                              <div className={styles.detailField}>
                                <span className={styles.detailLabel}>Take Profit</span>
                                <span className={styles.detailVal}>{t.takeProfit || 'N/A'}</span>
                              </div>
                              <div className={styles.detailField}>
                                <span className={styles.detailLabel}>Pips Won/Lost</span>
                                <span className={styles.detailVal}>{t.pips || 'N/A'}</span>
                              </div>
                              <div className={styles.detailField}>
                                <span className={styles.detailLabel}>Risk Reward Ratio</span>
                                <span className={styles.detailVal}>{t.riskReward || 'N/A'}</span>
                              </div>
                              <div className={styles.detailField}>
                                <span className={styles.detailLabel}>Trading Session</span>
                                <span className={styles.detailVal}>{t.session || 'N/A'}</span>
                              </div>
                              <div className={styles.detailField}>
                                <span className={styles.detailLabel}>Trade Category</span>
                                <span className={styles.detailVal}>{t.category || 'N/A'}</span>
                              </div>
                              <div className={styles.detailField}>
                                <span className={styles.detailLabel}>Time Executed</span>
                                <span className={styles.detailVal}>{t.tradeTime || 'N/A'}</span>
                              </div>
                              <div className={styles.detailField}>
                                <span className={styles.detailLabel}>AI Confidence</span>
                                <span className={styles.detailVal}>
                                  {t.confidence !== null ? `${(t.confidence * 100).toFixed(0)}%` : 'N/A'}
                                </span>
                              </div>
                            </div>

                            {/* Ratings */}
                            <div className={styles.detailsGrid} style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
                              <div className={styles.detailField}>
                                <span className={styles.detailLabel}>Execution Quality</span>
                                {renderRatingStars(t.executionRating || 0)}
                              </div>
                              <div className={styles.detailField}>
                                <span className={styles.detailLabel}>Discipline</span>
                                {renderRatingStars(t.disciplineRating || 0)}
                              </div>
                              <div className={styles.detailField}>
                                <span className={styles.detailLabel}>Patience</span>
                                {renderRatingStars(t.patienceRating || 0)}
                              </div>
                              <div className={styles.detailField}>
                                <span className={styles.detailLabel}>Psychology Rating</span>
                                {renderRatingStars(t.psychologyRating || 0)}
                              </div>
                              <div className={styles.detailField}>
                                <span className={styles.detailLabel}>Emotion Before</span>
                                <span className={styles.detailVal}>{t.emotionBefore || 'N/A'}</span>
                              </div>
                              <div className={styles.detailField}>
                                <span className={styles.detailLabel}>Emotion After</span>
                                <span className={styles.detailVal}>{t.emotionAfter || 'N/A'}</span>
                              </div>
                            </div>

                            <div>
                              <span className={styles.detailLabel}>Levels Played:</span>
                              <div className={styles.chipGroup}>
                                {t.levelsPlayed.map(l => <span key={l} className={styles.tagChip}>{l}</span>)}
                                {t.levelsPlayed.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>None</span>}
                              </div>
                            </div>

                            <div>
                              <span className={styles.detailLabel}>Confirmations Used:</span>
                              <div className={styles.chipGroup}>
                                {t.confirmations.map(c => <span key={c} className={styles.tagChip}>{c}</span>)}
                                {t.confirmations.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>None</span>}
                              </div>
                            </div>

                            <div>
                              <span className={styles.detailLabel}>Mistakes Made:</span>
                              <div className={styles.chipGroup}>
                                {t.mistakes.map(m => <span key={m} className={styles.tagChip} style={{ borderColor: 'rgba(239, 68, 68, 0.3)', color: '#f87171' }}>{m}</span>)}
                                {t.mistakes.length === 0 && <span style={{ color: '#10b981', fontSize: '0.85rem', fontWeight: '500' }}>None! Perfect Execution</span>}
                              </div>
                            </div>

                            {t.notes && (
                              <div>
                                <span className={styles.detailLabel}>Notes:</span>
                                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.4', marginTop: '0.25rem' }}>{t.notes}</p>
                              </div>
                            )}

                            {t.lessons && (
                              <div>
                                <span className={styles.detailLabel}>Lessons Learned:</span>
                                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.4', marginTop: '0.25rem' }}>{t.lessons}</p>
                              </div>
                            )}

                            {/* Extra links */}
                            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem' }}>
                              {t.tvLink && (
                                <a href={t.tvLink} target="_blank" rel="noreferrer" style={{ color: '#c084fc' }}>
                                  View TradingView Chart
                                </a>
                              )}
                              {t.replayLink && (
                                <a href={t.replayLink} target="_blank" rel="noreferrer" style={{ color: '#c084fc' }}>
                                  View Replay Link
                                </a>
                              )}
                            </div>

                            {/* Action Buttons */}
                            <div className={styles.entryActionsRow}>
                              <button className={styles.entryActionBtn} onClick={() => handleOpenEditForm(t)}>
                                Edit Details
                              </button>
                              <button className={styles.entryActionBtn} onClick={() => handleDuplicateTrade(t.id)}>
                                Duplicate
                              </button>
                              <button className={`${styles.entryActionBtn} ${styles.entryActionDelete}`} onClick={() => handleDeleteTrade(t.id)}>
                                Delete Entry
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            ANALYTICS TAB
            ======================================================== */}
        {activeTab === 'analytics' && (
          <div>
            <h1 className={styles.tabTitle}>Advanced Analytics</h1>
            {!stats ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyTitle}>No Analytics Data</div>
                <p className={styles.emptyDesc}>Log trades to view setups, mistake metrics, and session parameters win-rate curves.</p>
              </div>
            ) : (
              <div className={styles.chartsRow}>
                <div className={styles.chartCard}>
                  <h3 className={styles.chartTitle}>Setup Performance & Win Rate</h3>
                  {renderSetupPerformanceSvg()}
                </div>
                <div className={styles.chartCard}>
                  <h3 className={styles.chartTitle}>Mistake Occurrence Details</h3>
                  {renderMistakesSvg()}
                </div>
                <div className={styles.chartCard}>
                  <h3 className={styles.chartTitle}>Equity Curve (R-multiple Trend)</h3>
                  {renderEquitySvg()}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            AI PERFORMANCE COACH TAB
            ======================================================== */}
        {activeTab === 'coach' && (
          <div>
            <h1 className={styles.tabTitle}>AI Performance Coach</h1>
            
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
                      <span className={styles.loadingSpinner} style={{ width: '15px', height: '15px', borderWidth: '2px', margin: '0' }} />
                      Analyzing trading data...
                    </div>
                  </div>
                )}
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
        )}

        {/* ========================================================
            SETTINGS TAB
            ======================================================== */}
        {activeTab === 'settings' && (
          <div>
            <h1 className={styles.tabTitle}>Record Settings</h1>
            
            <div className={styles.settingsCard}>
              <div className={styles.settingsSection}>
                <h3 className={styles.sectionTitle}>API Configurations</h3>
                <div className={styles.formGroup}>
                  <label htmlFor="googleApiKeyInput">Google AI Pro API Key</label>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0' }}>
                    Used for Gemini Vision OCR screenshot parsing and Performance Coaching. Saved privately to local storage.
                  </p>
                  <div className={styles.apiKeyInputRow}>
                    <input
                      id="googleApiKeyInput"
                      type="password"
                      placeholder={isApiKeySet ? '••••••••••••••••••••••••' : 'Enter API Key (AIzaSy...)'}
                      className={styles.input}
                      style={{ flex: 1 }}
                      value={apiKey}
                      onChange={e => setApiKey(e.target.value)}
                    />
                    <button className={styles.addEntryBtn} onClick={handleSaveApiKey}>
                      Save Key
                    </button>
                  </div>
                </div>
              </div>

              <form className={styles.settingsSection} onSubmit={handleUpdateRecordSettings}>
                <h3 className={styles.sectionTitle}>General Configurations</h3>
                <div className={styles.formGroup}>
                  <label htmlFor="settingsName">Record/Folder Name</label>
                  <input
                    id="settingsName"
                    type="text"
                    className={styles.input}
                    value={record.name}
                    onChange={e => setRecord(prev => prev ? { ...prev, name: e.target.value } : null)}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="settingsDesc">Description</label>
                  <textarea
                    id="settingsDesc"
                    className={styles.textarea}
                    value={record.description || ''}
                    onChange={e => setRecord(prev => prev ? { ...prev, description: e.target.value } : null)}
                  />
                </div>
                <button type="submit" className={styles.saveSettingsBtn}>
                  Save Changes
                </button>
              </form>

              <div className={styles.dangerZone}>
                <div className={styles.dangerTitle}>Danger Zone</div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0' }}>
                  Deleting this backtest record will permanently remove all associated trade statistics, screenshots, and AI logs.
                </p>
                <button className={styles.dangerBtn} onClick={handleDeleteRecord}>
                  Delete Record Project
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================
          ADD / EDIT ENTRY FORM MODAL
          ======================================================== */}
      {isFormOpen && (
        <div className={styles.modalOverlay}>
          <form className={`${styles.modal} ${styles.formModal}`} onSubmit={handleFormSubmit}>
            <h2 className={styles.modalTitle}>
              {formMode === 'add' ? 'Add Trade Entry' : 'Edit Trade Entry'}
            </h2>
            
            <div className={styles.modalScrollArea}>
              {/* Image Upload Area */}
              <div className={styles.formGroup}>
                <label>TradingView Position Screenshot</label>
                <div className={styles.uploadArea} onClick={() => fileInputRef.current?.click()}>
                  {formScreenshot ? (
                    <img src={formScreenshot} alt="Upload Preview" className={styles.previewThumb} />
                  ) : (
                    <>
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21 15 16 10 5 21"/>
                      </svg>
                      <div>
                        <strong style={{ color: '#c084fc' }}>Click to Upload Screenshot</strong> or Drag & Drop
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Supports PNG, JPG (Position tool values detected by AI)</span>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleImageUpload}
                />
              </div>

              {analyzingScreenshot && (
                <div className={styles.analyzingOverlay}>
                  <span className={styles.loadingSpinner} style={{ margin: '0' }} />
                  <span style={{ fontWeight: '600', color: '#c084fc' }}>Analyzing Screenshot with Gemini Vision...</span>
                </div>
              )}

              {confidenceScore !== null && (
                <div className={`${styles.confidenceDisplay} ${confidenceScore < 0.7 ? styles.confidenceLow : ''}`}>
                  <span>
                    🤖 AI Auto-Extraction: <strong>{(confidenceScore * 100).toFixed(0)}% Confidence</strong>
                  </span>
                  <span style={{ fontSize: '0.75rem' }}>Review all fields before saving.</span>
                </div>
              )}

              <div className={styles.formTitle}>Primary Trade Parameters</div>
              
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label htmlFor="formTradeNameInput">Trade Name (Optional)</label>
                  <input
                    id="formTradeNameInput"
                    type="text"
                    placeholder="e.g. London Sweep Buy"
                    className={styles.input}
                    value={formTradeName}
                    onChange={e => setFormTradeName(e.target.value)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="formPairSelect">Currency Pair</label>
                  <input
                    id="formPairSelect"
                    type="text"
                    placeholder="e.g. XAUUSD, EURUSD"
                    className={styles.input}
                    value={formPair}
                    onChange={e => setFormPair(e.target.value.toUpperCase())}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="formDirectionSelect">Direction</label>
                  <select
                    id="formDirectionSelect"
                    className={styles.input}
                    value={formDirection}
                    onChange={e => setFormDirection(e.target.value as any)}
                  >
                    <option value="LONG">LONG (Buy)</option>
                    <option value="SHORT">SHORT (Sell)</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="formTimeframeInput">Timeframe</label>
                  <input
                    id="formTimeframeInput"
                    type="text"
                    placeholder="e.g. 15m, 1h, 4h"
                    className={styles.input}
                    value={formTimeframe}
                    onChange={e => setFormTimeframe(e.target.value)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="formEntryPriceInput">Entry Price</label>
                  <input
                    id="formEntryPriceInput"
                    type="number"
                    step="any"
                    placeholder="0.00"
                    className={styles.input}
                    value={formEntryPrice}
                    onChange={e => setFormEntryPrice(e.target.value)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="formStopLossInput">Stop Loss</label>
                  <input
                    id="formStopLossInput"
                    type="number"
                    step="any"
                    placeholder="0.00"
                    className={styles.input}
                    value={formStopLoss}
                    onChange={e => setFormStopLoss(e.target.value)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="formTakeProfitInput">Take Profit</label>
                  <input
                    id="formTakeProfitInput"
                    type="number"
                    step="any"
                    placeholder="0.00"
                    className={styles.input}
                    value={formTakeProfit}
                    onChange={e => setFormTakeProfit(e.target.value)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="formRiskRewardInput">Risk Reward Ratio (RR)</label>
                  <input
                    id="formRiskRewardInput"
                    type="number"
                    step="any"
                    placeholder="e.g. 2.5"
                    className={styles.input}
                    value={formRiskReward}
                    onChange={e => setFormRiskReward(e.target.value)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="formPipsInput">Pips Won/Lost</label>
                  <input
                    id="formPipsInput"
                    type="number"
                    step="any"
                    placeholder="e.g. 35"
                    className={styles.input}
                    value={formPips}
                    onChange={e => setFormPips(e.target.value)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="formPnlInput">PnL (R-multiple)</label>
                  <input
                    id="formPnlInput"
                    type="number"
                    step="any"
                    placeholder="e.g. +2.5 or -1.0"
                    className={styles.input}
                    value={formPnl}
                    onChange={e => setFormPnl(e.target.value)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="formOutcomeSelect">Outcome</label>
                  <select
                    id="formOutcomeSelect"
                    className={styles.input}
                    value={formOutcome}
                    onChange={e => setFormOutcome(e.target.value as any)}
                  >
                    <option value="WIN">WIN</option>
                    <option value="LOSS">LOSS</option>
                    <option value="BREAKEVEN">BREAKEVEN</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="formDateInput">Trade Date</label>
                  <input
                    id="formDateInput"
                    type="date"
                    className={styles.input}
                    value={formDate}
                    onChange={e => setFormDate(e.target.value)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="formTimeInput">Trade Time</label>
                  <input
                    id="formTimeInput"
                    type="time"
                    className={styles.input}
                    value={formTime}
                    onChange={e => setFormTime(e.target.value)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="formSessionSelect">Session</label>
                  <select
                    id="formSessionSelect"
                    className={styles.input}
                    value={formSession}
                    onChange={e => setFormSession(e.target.value)}
                  >
                    <option value="Asian">Asian</option>
                    <option value="London">London</option>
                    <option value="New York">New York</option>
                    <option value="Unknown">Unknown</option>
                  </select>
                </div>
              </div>

              <div className={styles.formTitle}>Levels & Confirmations</div>
              
              <div className={styles.formGroup}>
                <label>Levels Played (Select all that apply)</label>
                <div className={styles.checkGrid}>
                  {LEVELS_OPTIONS.map(l => (
                    <label key={l} className={styles.checkItem}>
                      <input
                        type="checkbox"
                        checked={formLevels.includes(l)}
                        onChange={e => {
                          if (e.target.checked) setFormLevels([...formLevels, l]);
                          else setFormLevels(formLevels.filter(x => x !== l));
                        }}
                      />
                      {l}
                    </label>
                  ))}
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Confirmations Used (Select all that apply)</label>
                <div className={styles.checkGrid}>
                  {CONFIRMATIONS_OPTIONS.map(c => (
                    <label key={c} className={styles.checkItem}>
                      <input
                        type="checkbox"
                        checked={formConfirmations.includes(c)}
                        onChange={e => {
                          if (e.target.checked) setFormConfirmations([...formConfirmations, c]);
                          else setFormConfirmations(formConfirmations.filter(x => x !== c));
                        }}
                      />
                      {c}
                    </label>
                  ))}
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Mistakes Committed (Select all that apply)</label>
                <div className={styles.checkGrid}>
                  {MISTAKES_OPTIONS.map(m => (
                    <label key={m} className={styles.checkItem}>
                      <input
                        type="checkbox"
                        checked={formMistakes.includes(m)}
                        onChange={e => {
                          if (e.target.checked) setFormMistakes([...formMistakes, m]);
                          else setFormMistakes(formMistakes.filter(x => x !== m));
                        }}
                      />
                      {m}
                    </label>
                  ))}
                </div>
              </div>

              <div className={styles.formTitle}>Psychology, Category & Ratings</div>
              
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>Execution Quality Rating</label>
                  {renderRatingStars(formExecutionRating, setFormExecutionRating)}
                </div>
                <div className={styles.formGroup}>
                  <label>Discipline Rating</label>
                  {renderRatingStars(formDisciplineRating, setFormDisciplineRating)}
                </div>
                <div className={styles.formGroup}>
                  <label>Patience Rating</label>
                  {renderRatingStars(formPatienceRating, setFormPatienceRating)}
                </div>
                <div className={styles.formGroup}>
                  <label>Psychology Rating</label>
                  {renderRatingStars(formPsychologyRating, setFormPsychologyRating)}
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="formEmotionBeforeSelect">Emotion Before Trade</label>
                  <select
                    id="formEmotionBeforeSelect"
                    className={styles.input}
                    value={formEmotionBefore}
                    onChange={e => setFormEmotionBefore(e.target.value)}
                  >
                    {EMOTIONS_OPTIONS.map(emo => <option key={emo} value={emo}>{emo}</option>)}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="formEmotionAfterSelect">Emotion After Trade</label>
                  <select
                    id="formEmotionAfterSelect"
                    className={styles.input}
                    value={formEmotionAfter}
                    onChange={e => setFormEmotionAfter(e.target.value)}
                  >
                    {EMOTIONS_OPTIONS.map(emo => <option key={emo} value={emo}>{emo}</option>)}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="formCategorySelect">Trade Category Grade</label>
                  <select
                    id="formCategorySelect"
                    className={styles.input}
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value)}
                  >
                    <option value="A+">A+ Setup</option>
                    <option value="A">A Setup</option>
                    <option value="B">B Setup</option>
                    <option value="C">C Setup</option>
                    <option value="D">D Setup</option>
                  </select>
                </div>
              </div>

              <div className={styles.formTitle}>Extra Resources</div>
              
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label htmlFor="formTvLinkInput">TradingView Interactive Link</label>
                  <input
                    id="formTvLinkInput"
                    type="url"
                    placeholder="https://tradingview.com/chart/..."
                    className={styles.input}
                    value={formTvLink}
                    onChange={e => setFormTvLink(e.target.value)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="formReplayLinkInput">Chart Replay Video Link</label>
                  <input
                    id="formReplayLinkInput"
                    type="url"
                    placeholder="https://loom.com/share/..."
                    className={styles.input}
                    value={formReplayLink}
                    onChange={e => setFormReplayLink(e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.formTitle}>Notes & Lessons</div>
              <div className={styles.formGroup}>
                <label htmlFor="formNotesInput">Trade Notes / Context</label>
                <textarea
                  id="formNotesInput"
                  placeholder="Market structure state, liquidity pools, higher timeframe bias..."
                  className={styles.textarea}
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="formLessonsInput">Lessons / Reminders</label>
                <textarea
                  id="formLessonsInput"
                  placeholder="What would you do differently? Any checklist items missed?"
                  className={styles.textarea}
                  value={formLessons}
                  onChange={e => setFormLessons(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.modalActions} style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '1rem', marginTop: '1rem' }}>
              <button type="button" className={styles.cancelBtn} onClick={() => setIsFormOpen(false)}>
                Cancel
              </button>
              <button type="submit" className={styles.submitBtn}>
                {formMode === 'add' ? 'Save Trade' : 'Update Trade'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
