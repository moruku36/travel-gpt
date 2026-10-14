import React, { useState, useCallback } from 'react';
import Head from 'next/head';
import styles from './mock.module.css';

import {
  TripState,
  Proposal,
  HistoryState,
  initializeTripState,
  addCandidateToItinerary,
  removeStopFromItinerary,
  reorderStop,
  updateStop,
  insertRestBlock,
  updateTripPreferences,
  generateChatProposal,
  applyProposal,
  rejectProposal,
  createHistory,
  pushHistory,
  undo,
  nextMockId,
  expireDraftProposals,
  selectionAfterProposal,
} from '../lib/itineraryOps';

import MockBanner from '../components/mock/MockBanner';
import MockMap from '../components/mock/MockMap';
import MockItinerary from '../components/mock/MockItinerary';
import MockChat, { ChatMessage } from '../components/mock/MockChat';

export default function MockPage() {
  const [history, setHistory] = useState<HistoryState>(() =>
    createHistory(initializeTripState('domestic'))
  );
  const trip = history.present;
  const [selectedId, setSelectedId] = useState<string | null>(trip.selectedPlaceOrStopId);

  const [activeTab, setActiveTab] = useState<'itinerary' | 'map' | 'chat'>('itinerary');
  const [pendingProposal, setPendingProposal] = useState<Proposal | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-init-1',
      sender: 'assistant',
      text: 'こんにちは！CoVoyager Phase 1 固定データプレビューへようこそ。実APIや外部LLMへの接続はなく、すべてのスポット・時刻・候補データは架空のものです。チャットから相談するか、画面のカードから直接旅程を編集できます。',
      timestamp: '10:00',
    },
  ]);

  // Helper to commit new state with undo history
  const commitState = useCallback(
    (newState: TripState, invalidateDraft = true) => {
      setHistory((prev) => pushHistory(prev, newState));
      if (invalidateDraft && pendingProposal && pendingProposal.baseRevision !== newState.revision) {
        const oldId = pendingProposal.id;
        setPendingProposal(null);
        setMessages(prev => [
          ...prev.map(message => message.proposal?.id === oldId
            ? { ...message, proposal: { ...message.proposal, status: 'expired' as const } } : message),
          { id: nextMockId('msg-expired'), sender: 'assistant',
            text: '旅程または目安を編集したため、前のドラフトは失効しました。必要なら新しい提案を作成してください。',
            timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) },
        ]);
      }
    },
    [pendingProposal]
  );

  // Scenario Switcher
  const handleSwitchScenario = (key: 'domestic' | 'international') => {
    if (key === trip.scenarioKey) return;
    const initial = initializeTripState(key);
    setHistory(createHistory(initial));
    setSelectedId(initial.selectedPlaceOrStopId);
    setPendingProposal(null);
    setMessages([
      {
        id: nextMockId('msg-switch'),
        sender: 'assistant',
        text: `シナリオを「${initial.title}」に切り替えました。通貨: ${initial.currencySymbol} (${initial.currency})、タイムゾーン: ${initial.timeZoneLabel} です。`,
        timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  // Undo Action
  const handleUndo = () => {
    const { history: newHistory } = undo(history);
    if (history.past.length > 0) {
      setHistory(newHistory);
      setPendingProposal(null);
      setMessages(prev => prev.map(message => message.proposal?.status === 'draft'
        ? { ...message, proposal: { ...message.proposal, status: 'expired' } } : message));
      if (!newHistory.present.stops.some(stop => stop.id === selectedId) &&
          !newHistory.present.places[selectedId || '']) {
        setSelectedId(newHistory.present.stops[0]?.id || null);
      }
    }
  };

  // Selection Handler
  const handleSelect = (id: string) => {
    setSelectedId(id);
  };

  // Itinerary Handlers
  const handleUpdateStop = (stopId: string, updates: any) => {
    commitState(updateStop(trip, stopId, updates));
  };

  const handleReorder = (stopId: string, direction: 'up' | 'down') => {
    commitState(reorderStop(trip, stopId, direction));
  };

  const handleRemoveStop = (stopId: string) => {
    const next = removeStopFromItinerary(trip, stopId);
    commitState(next);
    if (selectedId === stopId) setSelectedId(next.stops[0]?.id || null);
  };

  const handleAddCandidate = (placeId: string) => {
    const next = addCandidateToItinerary(trip, placeId);
    commitState(next);
    setSelectedId(next.selectedPlaceOrStopId);
  };

  const handleInsertRest = (afterStopId?: string) => {
    const next = insertRestBlock(trip, afterStopId);
    commitState(next);
    setSelectedId(next.selectedPlaceOrStopId);
  };

  const handleUpdatePreferences = (prefs: any) => {
    commitState(updateTripPreferences(trip, prefs));
  };

  // Chat Handlers
  const handleSendMessage = (text: string) => {
    const timeNow = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMessage = {
      id: nextMockId('msg-u'),
      sender: 'user',
      text,
      timestamp: timeNow,
    };

    const { replyText, proposal } = generateChatProposal(trip, text);
    const assistantMsg: ChatMessage = {
      id: nextMockId('msg-a'),
      sender: 'assistant',
      text: replyText,
      proposal,
      timestamp: timeNow,
    };

    setMessages((prev) => [
      ...(proposal ? expireDraftProposals(prev, pendingProposal?.id) : prev),
      userMsg, assistantMsg,
    ]);
    if (proposal) {
      setPendingProposal(proposal);
    }
  };

  const handleApplyProposal = (proposal: Proposal) => {
    const res = applyProposal(trip, proposal);
    if (res.success) {
      commitState(res.state, false);
      setSelectedId(selectionAfterProposal(res.state, proposal, selectedId));
      setPendingProposal(null);
      setMessages((prev) => [
        ...prev.map(message => message.proposal?.id === proposal.id
          ? { ...message, proposal: { ...message.proposal, status: 'applied' as const } } : message),
        {
          id: nextMockId('msg-apply'),
          sender: 'assistant',
          text: `✓ 提案を適用しました（旅程を Revision ${res.state.revision} に更新）。`,
          timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } else {
      setPendingProposal(null);
      setMessages(prev => [
        ...prev.map(message => message.proposal?.id === proposal.id
          ? { ...message, proposal: { ...message.proposal, status: 'expired' as const } } : message),
        { id: nextMockId('msg-conflict'), sender: 'assistant',
          text: `${res.error || '提案の適用に失敗しました。'} 再度提案を作成してください。`,
          timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) },
      ]);
    }
  };

  const handleRejectProposal = (proposal: Proposal) => {
    const rejected = rejectProposal(proposal);
    setPendingProposal(null);
    setMessages((prev) => [
      ...prev.map(message => message.proposal?.id === proposal.id
        ? { ...message, proposal: rejected } : message),
      {
        id: nextMockId('msg-reject'),
        sender: 'assistant',
        text: '提案ドラフトを却下しました。旅程は変更されません。',
        timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const canUndo = history.past.length > 0;

  return (
    <div className={styles.mockContainer}>
      <Head>
        <title>CoVoyager Phase 1 固定データ画面モック</title>
        <meta name="description" content="CoVoyager Travel Chat Phase 1 固定データ画面モック（外部非接続・架空サンプル）" />
      </Head>

      {/* Top Banner */}
      <MockBanner scenarioTitle={trip.title} revision={trip.revision} />

      {/* Sub Header: Scenario switch and Undo */}
      <div className={styles.subHeader}>
        <div className={styles.scenarioControls}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>架空シナリオ切替:</span>
          <button
            type="button"
            className={`${styles.scenarioButton} ${trip.scenarioKey === 'domestic' ? styles.scenarioButtonActive : ''}`}
            onClick={() => handleSwitchScenario('domestic')}
            aria-pressed={trip.scenarioKey === 'domestic'}
          >
            国内（青葉市・JST・¥）
          </button>
          <button
            type="button"
            className={`${styles.scenarioButton} ${trip.scenarioKey === 'international' ? styles.scenarioButtonActive : ''}`}
            onClick={() => handleSwitchScenario('international')}
            aria-pressed={trip.scenarioKey === 'international'}
          >
            海外（ポルト・ルーナ・CET・€）
          </button>
        </div>

        <div className={styles.actionControls}>
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            都市: <strong>{trip.city}</strong> ({trip.currencySymbol})
          </span>
          <button
            type="button"
            className={styles.undoButton}
            onClick={handleUndo}
            disabled={!canUndo}
            title={canUndo ? `直前の操作を取り消す (残り${history.past.length}回)` : '元に戻す操作はありません'}
            aria-label="直前の編集を元に戻す"
          >
            ↶ 元に戻す (Undo {history.past.length})
          </button>
        </div>
      </div>

      {/* Mobile Tab Switcher */}
      <div className={styles.mobileTabBar}>
        <button
          type="button"
          className={`${styles.mobileTabButton} ${activeTab === 'itinerary' ? styles.mobileTabButtonActive : ''}`}
          onClick={() => setActiveTab('itinerary')}
        >
          旅程・候補 ({trip.stops.length})
        </button>
        <button
          type="button"
          className={`${styles.mobileTabButton} ${activeTab === 'map' ? styles.mobileTabButtonActive : ''}`}
          onClick={() => setActiveTab('map')}
        >
          地図プレースホルダー
        </button>
        <button
          type="button"
          className={`${styles.mobileTabButton} ${activeTab === 'chat' ? styles.mobileTabButtonActive : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          チャット相談 {pendingProposal ? '●' : ''}
        </button>
      </div>

      {/* Main Multi-Column Content */}
      <main className={styles.mainLayout}>
        {/* Chat Column */}
        <section
          className={`${styles.chatColumn} ${activeTab !== 'chat' ? styles.hiddenOnMobile : ''}`}
          aria-label="チャット提案カラム"
        >
          <MockChat
            messages={messages}
            pendingProposal={pendingProposal}
            currentRevision={trip.revision}
            onSendMessage={handleSendMessage}
            onApplyProposal={handleApplyProposal}
            onRejectProposal={handleRejectProposal}
          />
        </section>

        {/* Map Column */}
        <section
          className={`${styles.mapColumn} ${activeTab !== 'map' ? styles.hiddenOnMobile : ''}`}
          aria-label="地図表示カラム"
        >
          <MockMap
            scenarioKey={trip.scenarioKey}
            places={trip.places}
            stops={trip.stops}
            candidatePlaceIds={trip.candidatePlaceIds}
            selectedId={selectedId}
            onSelect={handleSelect}
          />
        </section>

        {/* Itinerary Column */}
        <section
          className={`${styles.itineraryColumn} ${activeTab !== 'itinerary' ? styles.hiddenOnMobile : ''}`}
          aria-label="旅程編集カラム"
        >
          <MockItinerary
            stops={trip.stops}
            places={trip.places}
            candidatePlaceIds={trip.candidatePlaceIds}
            selectedId={selectedId}
            preferences={trip.preferences}
            timeZoneLabel={trip.timeZoneLabel}
            currencySymbol={trip.currencySymbol}
            onSelect={handleSelect}
            onUpdateStop={handleUpdateStop}
            onReorder={handleReorder}
            onRemoveStop={handleRemoveStop}
            onAddCandidate={handleAddCandidate}
            onInsertRest={handleInsertRest}
            onUpdatePreferences={handleUpdatePreferences}
          />
        </section>
      </main>
    </div>
  );
}
