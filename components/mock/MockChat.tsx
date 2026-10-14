import React, { useState, useRef, useEffect } from 'react';
import { Proposal } from '../../lib/itineraryOps';
import { shouldSubmitChat } from '../../lib/chatKeys';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  proposal?: Proposal | null;
  timestamp: string;
}

interface MockChatProps {
  messages: ChatMessage[];
  pendingProposal: Proposal | null;
  currentRevision: number;
  onSendMessage: (text: string) => void;
  onApplyProposal: (proposal: Proposal) => void;
  onRejectProposal: (proposal: Proposal) => void;
}

const PRESET_PROMPTS = [
  '午後に休憩を追加したい',
  '候補スポット（市場）を追加したい',
  '滞在時間を15分短縮したい',
];

export const MockChat: React.FC<MockChatProps> = ({
  messages,
  pendingProposal,
  currentRevision,
  onSendMessage,
  onApplyProposal,
  onRejectProposal,
}) => {
  const [inputText, setInputText] = useState('');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingProposal]);

  const handleSend = () => {
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (shouldSubmitChat(e)) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      role="region"
      aria-label="チャット提案アシスタント"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        border: '1px solid #cbd5e1',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 14px',
          backgroundColor: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <h2 style={{ fontSize: '13px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
            チャット相談（決定論的モック）
          </h2>
          <span style={{ fontSize: '10px', color: '#64748b' }}>
            外部LLM非接続 • 提案はドラフト作成のみ（自動更新なし）
          </span>
        </div>
        <span
          style={{
            fontSize: '11px',
            backgroundColor: '#f1f5f9',
            border: '1px solid #cbd5e1',
            borderRadius: '4px',
            padding: '2px 6px',
            color: '#475569',
          }}
        >
          Base Rev: {currentRevision}
        </span>
      </div>

      {/* Suggestion Chips */}
      <div
        style={{
          padding: '8px 12px',
          backgroundColor: '#fafafa',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: '11px', color: '#64748b' }}>お試し入力:</span>
        {PRESET_PROMPTS.map((prompt, i) => (
          <button
            key={`prompt-${i}`}
            type="button"
            onClick={() => onSendMessage(prompt)}
            style={{
              fontSize: '11px',
              padding: '3px 8px',
              backgroundColor: '#eff6ff',
              color: '#1d4ed8',
              border: '1px solid #bfdbfe',
              borderRadius: '12px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Message History & Active Proposals */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div
              style={{
                fontSize: '10px',
                color: '#64748b',
                marginBottom: '2px',
              }}
            >
              {msg.sender === 'user' ? 'あなた' : 'CoVoyager アシスタント (Mock)'} • {msg.timestamp}
            </div>
            <div
              style={{
                maxWidth: '88%',
                padding: '8px 12px',
                borderRadius: msg.sender === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                backgroundColor: msg.sender === 'user' ? '#2563eb' : '#f1f5f9',
                color: msg.sender === 'user' ? '#ffffff' : '#1e293b',
                fontSize: '13px',
                lineHeight: 1.5,
                wordBreak: 'break-word',
              }}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {/* Pending Proposal Preview Card */}
        {pendingProposal && pendingProposal.status === 'draft' && (
          <div
            role="region"
            aria-label="提案ドラフトのプレビュー"
            style={{
              margin: '8px 0',
              padding: '12px',
              backgroundColor: '#fffbeb',
              border: '2px solid #f59e0b',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  backgroundColor: '#d97706',
                  color: '#ffffff',
                  padding: '1px 6px',
                  borderRadius: '3px',
                }}
              >
                提案ドラフト (Proposal Preview)
              </span>
              <span style={{ fontSize: '10px', color: '#b45309' }}>
                Base Revision: {pendingProposal.baseRevision}
              </span>
            </div>

            <div style={{ fontSize: '12px', fontWeight: 600, color: '#78350f', marginBottom: '4px' }}>
              💡 理由: {pendingProposal.rationale}
            </div>

            {/* Patches list */}
            <div style={{ fontSize: '12px', color: '#451a03', margin: '6px 0' }}>
              <strong>変更予定内容:</strong>
              <ul style={{ margin: '4px 0 0', paddingLeft: '18px' }}>
                {pendingProposal.patches.map((p, idx) => (
                  <li key={`patch-${idx}`}>{p.details}</li>
                ))}
              </ul>
            </div>

            {/* Warnings */}
            {pendingProposal.warnings.length > 0 && (
              <div style={{ fontSize: '11px', color: '#b45309', margin: '6px 0' }}>
                {pendingProposal.warnings.map((w, idx) => (
                  <div key={`warn-${idx}`}>⚠️ {w}</div>
                ))}
              </div>
            )}

            {/* Explicit Actions: Apply vs Reject */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => onApplyProposal(pendingProposal)}
                style={{
                  flex: 1,
                  padding: '6px 12px',
                  backgroundColor: '#059669',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '4px',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                }}
              >
                ✓ この提案を旅程に適用する
              </button>
              <button
                type="button"
                onClick={() => onRejectProposal(pendingProposal)}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                却下する
              </button>
            </div>
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        style={{
          padding: '10px 12px',
          borderTop: '1px solid #e2e8f0',
          backgroundColor: '#ffffff',
        }}
      >
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <label htmlFor="mock-chat-input" style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden' }}>
            チャットメッセージ入力
          </label>
          <textarea
            id="mock-chat-input"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="旅程に関する要望を入力（Enterで送信、例: 休憩を追加したい）..."
            rows={2}
            style={{
              flex: 1,
              resize: 'none',
              padding: '8px 10px',
              fontSize: '13px',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontFamily: 'inherit',
            }}
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            style={{
              height: '38px',
              padding: '0 16px',
              backgroundColor: inputText.trim() ? '#2563eb' : '#94a3b8',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: inputText.trim() ? 'pointer' : 'not-allowed',
              whiteSpace: 'nowrap',
            }}
          >
            送信
          </button>
        </div>
      </form>
    </div>
  );
};

export default MockChat;
