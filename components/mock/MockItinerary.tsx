import React, { useState } from 'react';
import { Place, Stop, TripPreferences } from '../../lib/mockData';
import { calculateEndTime, getTimeWarnings, validateTimeFormat } from '../../lib/itineraryOps';

interface MockItineraryProps {
  stops: Stop[];
  places: Record<string, Place>;
  candidatePlaceIds: string[];
  selectedId: string | null;
  preferences: TripPreferences;
  timeZoneLabel: string;
  currencySymbol: string;
  onSelect: (id: string) => void;
  onUpdateStop: (stopId: string, updates: Partial<Stop>) => void;
  onReorder: (stopId: string, direction: 'up' | 'down') => void;
  onRemoveStop: (stopId: string) => void;
  onAddCandidate: (placeId: string) => void;
  onInsertRest: (afterStopId?: string) => void;
  onUpdatePreferences: (prefs: Partial<TripPreferences>) => void;
}

export const MockItinerary: React.FC<MockItineraryProps> = ({
  stops,
  places,
  candidatePlaceIds,
  selectedId,
  preferences,
  timeZoneLabel,
  currencySymbol,
  onSelect,
  onUpdateStop,
  onReorder,
  onRemoveStop,
  onAddCandidate,
  onInsertRest,
  onUpdatePreferences,
}) => {
  const [expandedEvidenceId, setExpandedEvidenceId] = useState<string | null>(null);
  const timeWarnings = getTimeWarnings(stops);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
      {/* Non-medical Trip Preferences Card */}
      <section
        aria-label="旅行計画上の目安設定"
        style={{
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '12px 14px',
          fontSize: '13px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h2 style={{ fontSize: '13px', fontWeight: 700, margin: 0, color: '#1e293b' }}>
            旅程条件・目安設定（非医療的）
          </h2>
          <span style={{ fontSize: '11px', color: '#64748b' }}>現地時間: {timeZoneLabel}</span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
            <span style={{ color: '#475569', fontWeight: 600 }}>歩行ペース目安:</span>
            <select
              value={preferences.walkingLimit}
              onChange={(e) => {
                const val = e.target.value as TripPreferences['walkingLimit'];
                const labels: Record<string, string> = {
                  modest: '歩行控えめ（約3,000〜4,000歩目安）',
                  standard: '標準歩行（約6,000歩目安）',
                  active: 'たくさん歩ける（約8,000歩目安）',
                };
                onUpdatePreferences({
                  walkingLimit: val,
                  walkingLimitLabel: labels[val] || val,
                });
              }}
              style={{
                padding: '3px 8px',
                borderRadius: '4px',
                border: '1px solid #cbd5e1',
                fontSize: '12px',
                backgroundColor: '#ffffff',
              }}
              aria-label="歩行ペース目安"
            >
              <option value="modest">歩行控えめ（〜4,000歩目安）</option>
              <option value="standard">標準歩行（〜6,000歩目安）</option>
              <option value="active">アクティブ（〜8,000歩目安）</option>
            </select>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={preferences.quietRestPreferred}
              onChange={(e) => onUpdatePreferences({ quietRestPreferred: e.target.checked })}
              style={{ width: '15px', height: '15px', cursor: 'pointer' }}
            />
            <span style={{ color: '#334155' }}>静かな休憩所を重視</span>
          </label>
        </div>

        <p style={{ margin: '8px 0 0', fontSize: '11px', color: '#64748b', lineHeight: 1.4 }}>
          {preferences.note}
        </p>
      </section>

      {/* Time Warnings Alert if any */}
      {timeWarnings.length > 0 && (
        <div
          role="alert"
          style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            padding: '10px 12px',
            fontSize: '12px',
            color: '#991b1b',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: '4px' }}>⚠️ スケジュール確認注意</div>
          <ul style={{ margin: 0, paddingLeft: '18px' }}>
            {timeWarnings.map((warning, i) => (
              <li key={`warn-${i}`}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Main Itinerary Stops List */}
      <section aria-label="確定旅程リスト" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
            旅程タイムテーブル ({stops.length}件)
          </h2>
          <button
            type="button"
            onClick={() => onInsertRest()}
            style={{
              padding: '4px 10px',
              fontSize: '12px',
              backgroundColor: '#ecfdf5',
              border: '1px solid #10b981',
              color: '#065f46',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            + 休憩枠を挿入
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {stops.map((stop, index) => {
            const isSelected = selectedId === stop.id || (stop.placeId && selectedId === stop.placeId);
            const isRest = stop.kind === 'rest';
            const place = stop.placeId ? places[stop.placeId] : null;
            const evidence = place?.evidence;
            const endTime = calculateEndTime(stop.startLocal, stop.durationMinutes);

            return (
              <article
                key={stop.id}
                tabIndex={0}
                onClick={() => onSelect(stop.id)}
                onKeyDown={(e) => {
                  if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    onSelect(stop.id);
                  }
                }}
                aria-current={isSelected ? 'true' : undefined}
                style={{
                  border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                  borderRadius: '6px',
                  backgroundColor: isSelected ? '#eff6ff' : isRest ? '#f0fdf4' : '#ffffff',
                  padding: '10px 12px',
                  boxShadow: isSelected ? '0 0 0 2px rgba(37,99,235,0.2)' : '0 1px 2px rgba(0,0,0,0.04)',
                  transition: 'all 0.15s ease',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        backgroundColor: isRest ? '#059669' : '#2563eb',
                        color: '#ffffff',
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        fontWeight: 700,
                      }}
                    >
                      {isRest ? '☕' : index + 1}
                    </span>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                        {stop.userLabel}
                      </h3>
                      <span style={{ fontSize: '10px', color: '#64748b', fontFamily: 'monospace' }}>
                        [ID: {stop.id}]
                      </span>
                    </div>
                  </div>

                  {/* Reorder and Delete controls */}
                  <div style={{ display: 'flex', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      aria-label={`${stop.userLabel} を1つ上へ移動`}
                      disabled={index === 0}
                      onClick={() => onReorder(stop.id, 'up')}
                      style={{
                        padding: '2px 6px',
                        fontSize: '11px',
                        backgroundColor: index === 0 ? '#f1f5f9' : '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '3px',
                        cursor: index === 0 ? 'not-allowed' : 'pointer',
                        color: index === 0 ? '#94a3b8' : '#334155',
                      }}
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      aria-label={`${stop.userLabel} を1つ下へ移動`}
                      disabled={index === stops.length - 1}
                      onClick={() => onReorder(stop.id, 'down')}
                      style={{
                        padding: '2px 6px',
                        fontSize: '11px',
                        backgroundColor: index === stops.length - 1 ? '#f1f5f9' : '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '3px',
                        cursor: index === stops.length - 1 ? 'not-allowed' : 'pointer',
                        color: index === stops.length - 1 ? '#94a3b8' : '#334155',
                      }}
                    >
                      ▼
                    </button>
                    <button
                      type="button"
                      aria-label={`${stop.userLabel} を旅程から削除`}
                      onClick={() => onRemoveStop(stop.id)}
                      style={{
                        padding: '2px 6px',
                        fontSize: '11px',
                        backgroundColor: '#fee2e2',
                        border: '1px solid #f87171',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        color: '#991b1b',
                      }}
                      title="旅程から削除"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Editable Time & Duration */}
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: '10px',
                    marginTop: '8px',
                    fontSize: '12px',
                    color: '#334155',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ color: '#64748b' }}>開始:</span>
                    <input
                      key={`${stop.id}-time-${stop.startLocal}`}
                      type="time"
                      defaultValue={stop.startLocal}
                      onBlur={(e) => {
                        if (validateTimeFormat(e.target.value) &&
                            Number(e.target.value.slice(0, 2)) * 60 + Number(e.target.value.slice(3)) + stop.durationMinutes <= 1440) {
                          onUpdateStop(stop.id, { startLocal: e.target.value });
                        }
                        else e.target.value = stop.startLocal;
                      }}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                      aria-label={`${stop.userLabel} の開始時刻 (HH:MM)`}
                      style={{
                        width: '56px',
                        padding: '2px 4px',
                        border: validateTimeFormat(stop.startLocal) ? '1px solid #cbd5e1' : '2px solid #ef4444',
                        borderRadius: '4px',
                        fontSize: '12px',
                        textAlign: 'center',
                        fontFamily: 'monospace',
                      }}
                    />
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ color: '#64748b' }}>滞在:</span>
                    <input
                      type="number"
                      min={5}
                      max={480}
                      key={`${stop.id}-duration-${stop.durationMinutes}`}
                      step={1}
                      defaultValue={stop.durationMinutes}
                      onBlur={(e) => {
                        const val = e.target.valueAsNumber;
                        if (Number.isInteger(val) && val >= 5 && val <= 480 &&
                            Number(stop.startLocal.slice(0, 2)) * 60 + Number(stop.startLocal.slice(3)) + val <= 1440) {
                          onUpdateStop(stop.id, { durationMinutes: val });
                        } else e.target.value = String(stop.durationMinutes);
                      }}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                      aria-label={`${stop.userLabel} の滞在分数`}
                      style={{
                        width: '50px',
                        padding: '2px 4px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        fontSize: '12px',
                        textAlign: 'center',
                      }}
                    />
                    <span>分</span>
                  </label>

                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    &rarr; 終了予定: <strong style={{ color: '#0f172a' }}>{endTime}</strong>
                  </span>

                  <button
                    type="button"
                    onClick={() => onInsertRest(stop.id)}
                    style={{
                      marginLeft: 'auto',
                      fontSize: '11px',
                      color: '#059669',
                      backgroundColor: 'transparent',
                      border: 'none',
                      textDecoration: 'underline',
                      cursor: 'pointer',
                      padding: '2px 4px',
                    }}
                  >
                    + 直後に休憩枠
                  </button>
                </div>

                {stop.note && (
                  <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#64748b' }}>
                    {stop.note}
                  </p>
                )}

                {/* Evidence badge & toggle */}
                {evidence && (
                  <div style={{ marginTop: '8px', fontSize: '11px' }} onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => setExpandedEvidenceId(expandedEvidenceId === stop.id ? null : stop.id)}
                      style={{
                        fontSize: '10px',
                        backgroundColor: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        borderRadius: '3px',
                        padding: '1px 6px',
                        color: '#475569',
                        cursor: 'pointer',
                      }}
                    >
                      {expandedEvidenceId === stop.id ? '▼ 根拠情報を閉じる' : '▶ 根拠情報（架空データ表示）'}
                    </button>

                    {expandedEvidenceId === stop.id && (
                      <div
                        style={{
                          marginTop: '4px',
                          padding: '6px 8px',
                          backgroundColor: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '4px',
                          fontSize: '10px',
                          color: '#475569',
                          lineHeight: 1.4,
                        }}
                      >
                        <div><strong>提供者:</strong> {evidence.provider}</div>
                        <div><strong>種別:</strong> {evidence.confidence} (実在URLなし / 捏造防止)</div>
                        <div><strong>保存許諾:</strong> {evidence.storageRights}</div>
                        <div><strong>fixture 作成日時:</strong> {evidence.retrievedAt}</div>
                        <div><strong>架空対象日:</strong> {evidence.validForDate}</div>
                        <div><strong>留意事項:</strong> {evidence.uncertainty.join(' / ')}</div>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {/* Candidate Places Section */}
      <section
        aria-label="候補スポットリスト"
        style={{
          borderTop: '2px dashed #cbd5e1',
          paddingTop: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '13px', fontWeight: 700, margin: 0, color: '#1e293b' }}>
            候補スポット（未追加: {candidatePlaceIds.length}件）
          </h2>
          <span style={{ fontSize: '11px', color: '#64748b' }}>クリックで地図と連動</span>
        </div>

        {candidatePlaceIds.length === 0 ? (
          <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0' }}>
            全ての候補スポットが旅程に追加されています。
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {candidatePlaceIds.map(placeId => {
              const place = places[placeId];
              if (!place) return null;
              const isSelected = selectedId === placeId;

              return (
                <div
                  key={placeId}
                  tabIndex={0}
                  onClick={() => onSelect(placeId)}
                  onKeyDown={(e) => {
                    if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      onSelect(placeId);
                    }
                  }}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: isSelected ? '2px solid #d97706' : '1px solid #e2e8f0',
                    backgroundColor: isSelected ? '#fffbeb' : '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '12px', color: '#1e293b' }}>
                      {place.userLabel}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      {place.addressFictional} • 目安 {place.suggestedDurationMinutes}分
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddCandidate(placeId);
                    }}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      backgroundColor: '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    + 旅程に追加
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default MockItinerary;
