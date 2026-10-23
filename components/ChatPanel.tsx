import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { ChatMessage, Participant, Trip } from '@/lib/types';
import { describeOp, STATUS_LABEL } from '@/lib/format';

export type ChatMode = 'plan' | 'recommend' | 'replan';

const DISRUPTIONS = ['雨が降ってきた', '予定より 1 時間遅れている', '施設が閉まっていた', '疲れたので休みたい', '混みすぎている'];

interface Props {
  trip: Trip;
  messages: ChatMessage[];
  me: Participant | undefined;
  busy: boolean;
  error: string | null;
  llm: 'openai' | 'demo' | null;
  needsAccessCode: boolean;
  onAccessCode: (code: string) => void;
  onSend: (text: string, mode: ChatMode, disruption?: string) => void;
  onApply: (messageId: string) => void;
  onReject: (messageId: string) => void;
  onSelectSuggestion: (messageId: string, ref: string) => void;
  onClear: () => void;
}

export default function ChatPanel(props: Props) {
  const { trip, messages, me, busy, error, llm } = props;
  const [text, setText] = useState('');
  const [mode, setMode] = useState<ChatMode>(trip.destination ? 'plan' : 'recommend');
  const [code, setCode] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, busy]);

  const send = (value = text, disruption?: string) => {
    const v = value.trim();
    if (!v || busy) return;
    props.onSend(v, mode, disruption);
    setText('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Japanese IME: Enter while composing confirms the conversion, it must not send.
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
      e.preventDefault();
      send();
    }
  };

  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');

  return (
    <section className="chat" aria-label="チャット">
      <div className="chat-head">
        <div className="segmented" role="tablist" aria-label="相談の種類">
          {(
            [
              ['plan', '旅程を相談'],
              ['recommend', '行き先探し'],
              ['replan', '現地で再計画'],
            ] as const
          ).map(([m, label]) => (
            <button key={m} role="tab" aria-selected={mode === m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>
              {label}
            </button>
          ))}
        </div>
        <span className={`llm-badge ${llm ?? ''}`} title={llm === 'demo' ? 'OPENAI_API_KEY 未設定: 固定データで応答します' : 'OpenAI API で応答します'}>
          {llm === 'openai' ? 'AI' : llm === 'demo' ? 'デモ' : '…'}
        </span>
      </div>

      <div className="chat-list" ref={listRef} aria-live="polite">
        {messages.length === 0 && (
          <div className="chat-empty">
            <p>
              <strong>ふたりで地図を見ながら決めよう。</strong>
            </p>
            <p>行き先・日付・やりたいことを話しかけると、候補が地図に出ます。「適用」を押すまで旅程は変わりません。</p>
            <div className="chips">
              {(mode === 'recommend'
                ? ['3連休で行ける海外は？', '紅葉がきれいな国内の街', 'のんびり温泉旅']
                : ['京都で紅葉と寺を巡りたい', 'ソウルでカフェと食べ歩き', '雨でも楽しめる所は？']
              ).map((s) => (
                <button key={s} className="chip" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => {
          const author = m.authorId ? trip.participants.find((p) => p.id === m.authorId) : undefined;
          return (
            <article key={m.id} className={`msg msg-${m.role}`}>
              {m.role === 'user' ? (
                <>
                  <span className="msg-author" style={{ color: author?.color }}>
                    {author?.name ?? 'わたし'}
                  </span>
                  <p className="msg-text">{m.text}</p>
                </>
              ) : (
                <>
                  <p className="msg-text">{m.text}</p>
                  {m.reply && m.reply.places.length > 0 && (
                    <ul className="place-chips">
                      {m.reply.places.map((p) => (
                        <li key={p.ref}>
                          <button className="place-chip" onClick={() => props.onSelectSuggestion(m.id, p.ref)} title={STATUS_LABEL[p.status].hint}>
                            <span className={`dot status-${p.status}`} aria-hidden />
                            {p.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {m.reply?.warnings.length ? (
                    <ul className="warnings">
                      {m.reply.warnings.map((w, i) => (
                        <li key={i}>⚠ {w}</li>
                      ))}
                    </ul>
                  ) : null}
                  {m.reply?.proposal && (
                    <div className={`proposal state-${m.proposalState ?? 'pending'}`}>
                      <div className="proposal-title">変更案: {m.reply.proposal.summary}</div>
                      <ul>
                        {m.reply.proposal.ops.map((op, i) => (
                          <li key={i}>{describeOp(op, trip, m.reply!.places)}</li>
                        ))}
                      </ul>
                      {(m.proposalState ?? 'pending') === 'pending' ? (
                        <div className="row">
                          <button className="btn primary" onClick={() => props.onApply(m.id)}>
                            旅程に適用
                          </button>
                          <button className="btn" onClick={() => props.onReject(m.id)}>
                            見送る
                          </button>
                        </div>
                      ) : (
                        <div className="proposal-done">{m.proposalState === 'applied' ? '✓ 適用済み（元に戻すは ↶）' : '見送りました'}</div>
                      )}
                    </div>
                  )}
                  {m === lastAssistant && m.reply?.followUps.length ? (
                    <div className="chips">
                      {m.reply.followUps.map((f) => (
                        <button key={f} className="chip" onClick={() => send(f)} disabled={busy}>
                          {f}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </>
              )}
            </article>
          );
        })}
        {busy && (
          <div className="msg msg-assistant typing" aria-label="考え中">
            <span />
            <span />
            <span />
          </div>
        )}
        {error && (
          <div className="msg-error" role="alert">
            {error}
          </div>
        )}
      </div>

      {props.needsAccessCode ? (
        <form
          className="chat-input"
          onSubmit={(e) => {
            e.preventDefault();
            props.onAccessCode(code);
          }}
        >
          <input className="input" type="password" value={code} onChange={(e) => setCode(e.target.value)} placeholder="アクセスコード" autoComplete="off" />
          <button className="btn primary">保存</button>
        </form>
      ) : (
        <div className="chat-input-wrap">
          {mode === 'replan' && (
            <div className="chips compact">
              {DISRUPTIONS.map((d) => (
                <button key={d} className="chip" disabled={busy} onClick={() => send(`${d}。今日の予定を調整して`, d)}>
                  {d}
                </button>
              ))}
            </div>
          )}
          <div className="chat-input">
            <textarea
              className="input"
              rows={2}
              value={text}
              maxLength={4000}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={`${me?.name ?? 'わたし'}として送信（Enter で送信 / Shift+Enter で改行）`}
              aria-label="メッセージ"
            />
            <button className="btn primary send" onClick={() => send()} disabled={busy || !text.trim()} aria-label="送信">
              ➤
            </button>
          </div>
          {messages.length > 0 && (
            <button className="link small" onClick={props.onClear}>
              会話をクリア
            </button>
          )}
        </div>
      )}
    </section>
  );
}
