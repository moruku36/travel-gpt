import React from 'react';
import { Place, Stop } from '../../lib/mockData';

interface MockMapProps {
  scenarioKey: 'domestic' | 'international';
  places: Record<string, Place>;
  stops: Stop[];
  candidatePlaceIds: string[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export const MockMap: React.FC<MockMapProps> = ({
  scenarioKey,
  places,
  stops,
  candidatePlaceIds,
  selectedId,
  onSelect,
}) => {
  // Collect itinerary places in order with their stop information
  const itineraryPinData = stops
    .map((stop, index) => {
      const place = stop.placeId ? places[stop.placeId] : null;
      if (!place) return null;
      return {
        stopId: stop.id,
        placeId: place.id,
        label: stop.userLabel,
        kind: stop.kind,
        time: stop.startLocal,
        duration: stop.durationMinutes,
        svgCoords: place.mapSvgCoords,
        index: index + 1,
      };
    })
    .filter(Boolean);

  // Candidate places
  const candidatePinData = candidatePlaceIds
    .map(placeId => {
      const place = places[placeId];
      if (!place) return null;
      return {
        placeId: place.id,
        label: place.userLabel,
        category: place.category,
        svgCoords: place.mapSvgCoords,
        suggestedDuration: place.suggestedDurationMinutes,
      };
    })
    .filter(Boolean);

  // Build SVG polyline points for itinerary route
  const routePoints = itineraryPinData
    .map(p => `${p.svgCoords.x},${p.svgCoords.y}`)
    .join(' ');

  const isDomestic = scenarioKey === 'domestic';
  const cityName = isDomestic ? '青葉市（架空）ローカルマップ' : 'ポルト・ルーナ（架空）ローカルマップ';

  return (
    <div
      role="region"
      aria-label={`${cityName} プレースホルダー`}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: '420px',
        backgroundColor: '#e6f3f0',
        borderRadius: '8px',
        overflow: 'hidden',
        border: '1px solid #cbd5e1',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Top Map Header & Controls */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          right: 10,
          zIndex: 10,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          padding: '6px 12px',
          borderRadius: '6px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
          fontSize: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 'bold', color: '#0f172a' }}>{cityName}</span>
          <span
            style={{
              backgroundColor: '#f1f5f9',
              border: '1px solid #cbd5e1',
              color: '#475569',
              padding: '1px 6px',
              borderRadius: '3px',
              fontSize: '11px',
            }}
          >
            外部タイル非取得 / SVGプレースホルダー
          </span>
        </div>
        <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: '#64748b' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#2563eb', display: 'inline-block' }} />
            旅程スポット ({itineraryPinData.length})
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', border: '2px dashed #d97706', backgroundColor: '#fef3c7', display: 'inline-block' }} />
            候補スポット ({candidatePinData.length})
          </span>
        </div>
      </div>

      {/* Stylized SVG Map Canvas */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{
          width: '100%',
          height: '100%',
          flex: 1,
          userSelect: 'none',
        }}
        aria-hidden="true"
      >
        <defs>
          {/* Subtle grid pattern */}
          <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#d5e8e2" strokeWidth="0.3" />
          </pattern>
          {/* Water body styling */}
          <linearGradient id="waterGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#bae6fd" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#7dd3fc" stopOpacity="0.8" />
          </linearGradient>
        </defs>

        {/* Base background */}
        <rect width="100" height="100" fill="#f4faf7" />
        <rect width="100" height="100" fill="url(#grid)" />

        {/* Stylized natural features (parks / hills) */}
        <path
          d={
            isDomestic
              ? 'M 25 20 Q 40 10, 55 25 T 60 45 Q 45 50, 30 40 Z'
              : 'M 15 15 Q 35 10, 45 30 T 40 50 Q 20 45, 10 35 Z'
          }
          fill="#dcfce7"
          stroke="#bbf7d0"
          strokeWidth="0.5"
        />

        {/* Stylized water feature (river or bay) */}
        <path
          d={
            isDomestic
              ? 'M 0 75 Q 30 70, 50 85 T 100 75 L 100 100 L 0 100 Z'
              : 'M 50 100 Q 60 70, 75 60 T 100 50 L 100 100 Z'
          }
          fill="url(#waterGrad)"
          stroke="#38bdf8"
          strokeWidth="0.6"
        />

        {/* Stylized primary road networks */}
        <path
          d="M 10 55 L 90 55 M 40 10 L 40 90 M 70 15 L 70 85"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d="M 10 55 L 90 55 M 40 10 L 40 90 M 70 15 L 70 85"
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="1.2"
          strokeLinecap="round"
        />

        {/* Route polyline connecting itinerary stops */}
        {routePoints && (
          <>
            <polyline
              points={routePoints}
              fill="none"
              stroke="#93c5fd"
              strokeWidth="1.4"
              strokeDasharray="2, 1"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <polyline
              points={routePoints}
              fill="none"
              stroke="#2563eb"
              strokeWidth="0.8"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </>
        )}
      </svg>

      {/* HTML-based Interactive Pin Overlay for full accessibility & sharp text */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      >
        {/* Candidate Pins */}
        {candidatePinData.map(c => {
          const isSelected = selectedId === c.placeId;
          return (
            <button
              key={`cand-pin-${c.placeId}`}
              type="button"
              onClick={() => onSelect(c.placeId)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(c.placeId);
                }
              }}
              aria-label={`候補スポット: ${c.label} (目安 ${c.suggestedDuration}分)`}
              aria-pressed={isSelected}
              style={{
                position: 'absolute',
                left: `${c.svgCoords.x}%`,
                top: `${c.svgCoords.y}%`,
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'auto',
                cursor: 'pointer',
                background: isSelected ? '#d97706' : '#ffffff',
                border: isSelected ? '2px solid #78350f' : '2px dashed #d97706',
                borderRadius: '50%',
                width: isSelected ? '28px' : '24px',
                height: isSelected ? '28px' : '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: isSelected
                  ? '0 0 0 4px rgba(217, 119, 6, 0.35), 0 2px 6px rgba(0,0,0,0.3)'
                  : '0 1px 3px rgba(0,0,0,0.2)',
                color: isSelected ? '#ffffff' : '#b45309',
                fontSize: '12px',
                fontWeight: 700,
                zIndex: isSelected ? 20 : 5,
                transition: 'all 0.15s ease-in-out',
              }}
              title={`候補: ${c.label}`}
            >
              +
            </button>
          );
        })}

        {/* Itinerary Stops Pins */}
        {itineraryPinData.map(p => {
          const isSelected = selectedId === p.stopId || selectedId === p.placeId;
          const isRest = p.kind === 'rest';

          return (
            <div
              key={`itin-pin-${p.stopId}`}
              style={{
                position: 'absolute',
                left: `${p.svgCoords.x}%`,
                top: `${p.svgCoords.y}%`,
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'auto',
                zIndex: isSelected ? 25 : 10,
              }}
            >
              <button
                type="button"
                onClick={() => onSelect(p.stopId)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(p.stopId);
                  }
                }}
                aria-label={`旅程 ${p.index}: ${p.label} (${p.time}〜 ${p.duration}分)`}
                aria-pressed={isSelected}
                style={{
                  cursor: 'pointer',
                  backgroundColor: isSelected
                    ? (isRest ? '#047857' : '#1d4ed8')
                    : (isRest ? '#059669' : '#2563eb'),
                  border: isSelected ? '2px solid #ffffff' : '2px solid #ffffff',
                  borderRadius: '50%',
                  width: isSelected ? '32px' : '28px',
                  height: isSelected ? '32px' : '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: isSelected
                    ? '0 0 0 4px rgba(37, 99, 235, 0.45), 0 3px 8px rgba(0,0,0,0.35)'
                    : '0 2px 5px rgba(0,0,0,0.2)',
                  color: '#ffffff',
                  fontSize: isRest ? '13px' : '12px',
                  fontWeight: 700,
                  transition: 'all 0.15s ease-in-out',
                }}
                title={`${p.index}. ${p.label} (${p.time})`}
              >
                {isRest ? '☕' : p.index}
              </button>

              {/* Pin Label Tooltip when selected */}
              {isSelected && (
                <div
                  style={{
                    position: 'absolute',
                    top: '34px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    backgroundColor: '#1e293b',
                    color: '#ffffff',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                    pointerEvents: 'none',
                    zIndex: 30,
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{p.label}</div>
                  <div style={{ fontSize: '10px', color: '#cbd5e1' }}>
                    {p.time} ({p.duration}分)
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Map Footer Note */}
      <div
        style={{
          position: 'absolute',
          bottom: 6,
          left: 10,
          right: 10,
          fontSize: '10px',
          color: '#64748b',
          backgroundColor: 'rgba(255, 255, 255, 0.85)',
          padding: '2px 8px',
          borderRadius: '4px',
          textAlign: 'center',
          pointerEvents: 'none',
        }}
      >
        ※ ピンをクリックすると旅程/候補と連動して選択されます。直線は位置関係の目安であり実経路道路データではありません。
      </div>
    </div>
  );
};

export default MockMap;
