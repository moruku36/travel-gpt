/**
 * CoVoyager Phase 1 Pure Itinerary Operations
 *
 * Conforms to docs/DESIGN.md:
 * - Revision tracking & immutable patches
 * - Deterministic proposals (draft -> validate baseRevision -> apply/reject)
 * - Rest block insertion, up/down reorder, time validation
 * - Manual edit preservation via history stack
 */

import { Stop, Place, TripScenario, DOMESTIC_SCENARIO, INTERNATIONAL_SCENARIO, TripPreferences } from './mockData';

export interface ItineraryPatch {
  action: 'add_stop' | 'remove_stop' | 'update_stop' | 'insert_rest' | 'reorder';
  stopId?: string;
  placeId?: string;
  stop?: Stop;
  fromIndex?: number;
  toIndex?: number;
  insertIndex?: number;
  details: string;
}

export interface Proposal {
  id: string;
  tripId: string;
  baseRevision: number;
  rationale: string;
  warnings: string[];
  evidenceIds: string[];
  patches: ItineraryPatch[];
  status: 'draft' | 'applied' | 'rejected' | 'expired';
  createdAt: string;
}

export interface TripState {
  scenarioKey: 'domestic' | 'international';
  tripId: string;
  title: string;
  city: string;
  country: string;
  countryCode: string;
  localDate: string;
  timeZone: string;
  timeZoneLabel: string;
  currency: string;
  currencySymbol: string;
  revision: number;
  places: Record<string, Place>;
  stops: Stop[];
  candidatePlaceIds: string[];
  preferences: TripPreferences;
  selectedPlaceOrStopId: string | null;
}

export interface HistoryState {
  past: TripState[];
  present: TripState;
}

let mockIdSequence = 0;
export function nextMockId(prefix: string): string {
  mockIdSequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${mockIdSequence.toString(36)}`;
}

function validStop(stop: Stop): boolean {
  return validateTimeFormat(stop.startLocal) &&
    Number.isInteger(stop.durationMinutes) && stop.durationMinutes >= 5 &&
    stop.durationMinutes <= 480 &&
    parseMinutesFromMidnight(stop.startLocal) + stop.durationMinutes <= 1440;
}

export function initializeTripState(scenarioKey: 'domestic' | 'international'): TripState {
  const scenario: TripScenario = scenarioKey === 'domestic' ? DOMESTIC_SCENARIO : INTERNATIONAL_SCENARIO;
  return {
    scenarioKey: scenario.key,
    tripId: scenario.id,
    title: scenario.title,
    city: scenario.city,
    country: scenario.country,
    countryCode: scenario.countryCode,
    localDate: scenario.localDate,
    timeZone: scenario.timeZone,
    timeZoneLabel: scenario.timeZoneLabel,
    currency: scenario.currency,
    currencySymbol: scenario.currencySymbol,
    revision: 1,
    places: { ...scenario.places },
    stops: scenario.initialStops.map(s => ({ ...s })),
    candidatePlaceIds: [...scenario.candidatePlaceIds],
    preferences: { ...scenario.preferences },
    selectedPlaceOrStopId: scenario.initialStops[0]?.id || null,
  };
}

// Time calculation helpers
export function validateTimeFormat(timeStr: string): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(timeStr);
}

export function parseMinutesFromMidnight(timeStr: string): number {
  if (!validateTimeFormat(timeStr)) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

export function formatMinutesToTime(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function calculateEndTime(startLocal: string, durationMinutes: number): string {
  if (!validateTimeFormat(startLocal)) return startLocal;
  const startMins = parseMinutesFromMidnight(startLocal);
  return formatMinutesToTime(startMins + (durationMinutes || 0));
}

// Re-timing helper to ensure sequential scheduling
export function recalculateSchedule(stops: Stop[]): Stop[] {
  let currentStartMinutes = stops.length > 0 && validateTimeFormat(stops[0].startLocal)
    ? parseMinutesFromMidnight(stops[0].startLocal)
    : 600; // 10:00 default

  return stops.map((stop, idx) => {
    if (idx === 0) {
      currentStartMinutes = validateTimeFormat(stop.startLocal)
        ? parseMinutesFromMidnight(stop.startLocal)
        : currentStartMinutes;
      const endMins = currentStartMinutes + stop.durationMinutes;
      currentStartMinutes = endMins + 15; // default 15 min transfer
      return { ...stop };
    }
    const newStart = formatMinutesToTime(currentStartMinutes);
    const endMins = currentStartMinutes + stop.durationMinutes;
    currentStartMinutes = endMins + 15;
    return {
      ...stop,
      startLocal: newStart,
    };
  });
}

// Check time warnings
export function getTimeWarnings(stops: Stop[]): string[] {
  const warnings: string[] = [];
  for (let i = 0; i < stops.length; i++) {
    const current = stops[i];
    if (!validateTimeFormat(current.startLocal)) {
      warnings.push(`「${current.userLabel}」の開始時刻 (${current.startLocal}) は有効な HH:MM 形式ではありません。`);
      continue;
    }
    if (i < stops.length - 1) {
      const next = stops[i + 1];
      if (validateTimeFormat(next.startLocal)) {
        const curEnd = parseMinutesFromMidnight(current.startLocal) + current.durationMinutes;
        const nextStart = parseMinutesFromMidnight(next.startLocal);
        if (curEnd > nextStart) {
          warnings.push(`重複警告: 「${current.userLabel}」の終了時刻 (${formatMinutesToTime(curEnd)}) が「${next.userLabel}」の開始時刻 (${next.startLocal}) を超過しています。`);
        } else if (curEnd === nextStart) {
          warnings.push(`移動時間なし: 「${current.userLabel}」終了直後に「${next.userLabel}」が設定されています（移動時間0分）。`);
        }
      }
    }
  }
  return warnings;
}

// Itinerary Operations
export function addCandidateToItinerary(
  state: TripState,
  placeId: string,
  targetIndex?: number
): TripState {
  const place = state.places[placeId];
  if (!place || state.stops.some(stop => stop.placeId === placeId)) return state;

  const newStopId = nextMockId(`stop-${placeId}`);

  // Calculate start time based on preceding stop
  let startLocal = '14:00';
  if (state.stops.length > 0) {
    const lastStop = state.stops[state.stops.length - 1];
    startLocal = calculateEndTime(lastStop.startLocal, lastStop.durationMinutes + 15);
  }

  const newStop: Stop = {
    id: newStopId,
    placeId: place.id,
    userLabel: place.userLabel,
    kind: place.category === 'rest' ? 'rest' : 'visit',
    startLocal,
    durationMinutes: place.suggestedDurationMinutes || 45,
    note: `${place.addressFictional} を訪問。`,
  };

  const newStops = [...state.stops];
  if (typeof targetIndex === 'number' && targetIndex >= 0 && targetIndex <= newStops.length) {
    newStops.splice(targetIndex, 0, newStop);
  } else {
    newStops.push(newStop);
  }

  // Remove place from candidate list
  const newCandidates = state.candidatePlaceIds.filter(id => id !== placeId);

  return {
    ...state,
    revision: state.revision + 1,
    stops: newStops,
    candidatePlaceIds: newCandidates,
    selectedPlaceOrStopId: newStopId,
  };
}

export function removeStopFromItinerary(
  state: TripState,
  stopId: string
): TripState {
  const targetStop = state.stops.find(s => s.id === stopId);
  if (!targetStop) return state;

  const newStops = state.stops.filter(s => s.id !== stopId);

  // Return associated place back to candidates if applicable and not already in candidate list
  let newCandidates = [...state.candidatePlaceIds];
  if (targetStop.placeId && state.places[targetStop.placeId] && !newCandidates.includes(targetStop.placeId)) {
    newCandidates.push(targetStop.placeId);
  }

  return {
    ...state,
    revision: state.revision + 1,
    stops: newStops,
    candidatePlaceIds: newCandidates,
    selectedPlaceOrStopId: newStops[0]?.id || null,
  };
}

export function reorderStop(
  state: TripState,
  stopId: string,
  direction: 'up' | 'down'
): TripState {
  const index = state.stops.findIndex(s => s.id === stopId);
  if (index === -1) return state;

  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= state.stops.length) return state;

  const newStops = [...state.stops];
  const [removed] = newStops.splice(index, 1);
  newStops.splice(targetIndex, 0, removed);

  return {
    ...state,
    revision: state.revision + 1,
    stops: newStops,
    selectedPlaceOrStopId: stopId,
  };
}

export function updateStop(
  state: TripState,
  stopId: string,
  updates: Partial<Pick<Stop, 'startLocal' | 'durationMinutes' | 'note' | 'userLabel'>>
): TripState {
  const existing = state.stops.find(stop => stop.id === stopId);
  if (!existing || !validStop({ ...existing, ...updates })) return state;
  if (Object.entries(updates).every(([key, value]) => existing[key] === value)) return state;
  const newStops = state.stops.map(stop => {
    if (stop.id !== stopId) return stop;
    return {
      ...stop,
      ...updates,
    };
  });

  return {
    ...state,
    revision: state.revision + 1,
    stops: newStops,
  };
}

export function insertRestBlock(
  state: TripState,
  afterStopId?: string,
  durationMinutes = 45,
  note = '静かなカフェまたはベンチで水分補給と足休め。'
): TripState {
  const restStopId = nextMockId('stop-rest');
  let insertIndex = state.stops.length;
  let startLocal = '13:30';

  if (afterStopId) {
    const idx = state.stops.findIndex(s => s.id === afterStopId);
    if (idx !== -1) {
      insertIndex = idx + 1;
      const prev = state.stops[idx];
      startLocal = calculateEndTime(prev.startLocal, prev.durationMinutes + 10);
    }
  } else if (state.stops.length > 0) {
    const last = state.stops[state.stops.length - 1];
    startLocal = calculateEndTime(last.startLocal, last.durationMinutes + 10);
  }

  const restStop: Stop = {
    id: restStopId,
    userLabel: '【休憩】足休め・水分補給ブロック',
    kind: 'rest',
    startLocal,
    durationMinutes,
    note,
  };

  if (!validStop(restStop)) return state;

  const newStops = [...state.stops];
  newStops.splice(insertIndex, 0, restStop);

  return {
    ...state,
    revision: state.revision + 1,
    stops: newStops,
    selectedPlaceOrStopId: restStopId,
  };
}

export function updateTripPreferences(
  state: TripState,
  preferences: Partial<TripPreferences>
): TripState {
  if (Object.entries(preferences).every(([key, value]) => state.preferences[key] === value)) return state;
  return {
    ...state,
    revision: state.revision + 1,
    preferences: {
      ...state.preferences,
      ...preferences,
    },
  };
}

// Chat Proposals: Deterministic proposal generation based on input
export function generateChatProposal(
  state: TripState,
  promptKeyword: string
): { replyText: string; proposal: Proposal | null } {
  const baseRev = state.revision;
  const isDomestic = state.scenarioKey === 'domestic';

  if (promptKeyword.includes('休憩') || promptKeyword.includes('rest')) {
    const restStopId = nextMockId('prop-rest');
    const lastStop = state.stops[state.stops.length - 1];
    const restTime = lastStop
      ? calculateEndTime(lastStop.startLocal, lastStop.durationMinutes + 10)
      : '13:30';
    const patch: ItineraryPatch = {
      action: 'insert_rest',
      stopId: restStopId,
      insertIndex: state.stops.length,
      stop: {
        id: restStopId,
        userLabel: state.preferences.quietRestPreferred ? '【休憩】静かな休憩ブロック' : '【休憩】休息ブロック',
        kind: 'rest',
        startLocal: restTime,
        durationMinutes: 45,
        note: '歩行負荷軽減のための静かな休憩。手動で適用可能です。',
      },
      details: `${restTime} に45分の休憩ブロックを旅程末尾へ追加します。場所は未指定です。`,
    };

    const proposal: Proposal = {
      id: nextMockId('prop'),
      tripId: state.tripId,
      baseRevision: baseRev,
      rationale: '歩行の合間に静かな休憩枠を設けることで、ゆとりのあるスケジュールにします。',
      warnings: ['旅程の自動書き換えは行いません。変更プレビューを確認後、「適用する」を押してください。'],
      evidenceIds: [],
      patches: [patch],
      status: 'draft',
      createdAt: new Date().toISOString(),
    };

    return {
      replyText: '午後の移動負荷を抑えるため、45分の静かな休憩枠を追加する提案ドラフトを作成しました。右側のプレビューを確認し、「適用」または「却下」を選択してください。',
      proposal,
    };
  }

  if (promptKeyword.includes('候補') || promptKeyword.includes('追加') || promptKeyword.includes('市場')) {
    const candidateId = isDomestic ? 'place-dom-market' : 'place-int-market';
    const place = state.places[candidateId];
    if (place && state.candidatePlaceIds.includes(candidateId) &&
        !state.stops.some(stop => stop.placeId === candidateId)) {
      const newStopId = nextMockId('prop-add');
      const lastStop = state.stops[state.stops.length - 1];
      const patch: ItineraryPatch = {
        action: 'add_stop',
        placeId: candidateId,
        stopId: newStopId,
        stop: {
          id: newStopId,
          placeId: candidateId,
          userLabel: place.userLabel,
          kind: 'visit',
          startLocal: lastStop ? calculateEndTime(lastStop.startLocal, lastStop.durationMinutes + 15) : '10:00',
          durationMinutes: place.suggestedDurationMinutes,
          note: `${place.addressFictional} を訪問。`,
        },
        details: `候補地「${place.userLabel}」を旅程末尾に追加します。`,
      };

      const proposal: Proposal = {
        id: nextMockId('prop'),
        tripId: state.tripId,
        baseRevision: baseRev,
        rationale: `候補地リストから人気の「${place.userLabel}」を組み込み、旅程の充実を図ります。`,
        warnings: ['この変更はドラフトです。現在の旅程に自動反映はされません。'],
        evidenceIds: [place.evidence.id],
        patches: [patch],
        status: 'draft',
        createdAt: new Date().toISOString(),
      };

      return {
        replyText: `候補地「${place.userLabel}」を旅程に追加する提案ドラフトを作成しました。変更内容を確認してください。`,
        proposal,
      };
    }
  }

  if (promptKeyword.includes('短縮') || promptKeyword.includes('時間')) {
    const firstVisit = state.stops.find(s => s.kind === 'visit');
    if (firstVisit) {
      const newDuration = Math.max(30, firstVisit.durationMinutes - 15);
      const patch: ItineraryPatch = {
        action: 'update_stop',
        stopId: firstVisit.id,
        stop: {
          ...firstVisit,
          durationMinutes: newDuration,
        },
        details: `「${firstVisit.userLabel}」の滞在時間を ${firstVisit.durationMinutes}分 から ${newDuration}分 に15分短縮します。`,
      };

      const proposal: Proposal = {
        id: nextMockId('prop'),
        tripId: state.tripId,
        baseRevision: baseRev,
        rationale: '滞在時間を短縮し、全体のタイムテーブルに余裕を持たせます。',
        warnings: ['他の訪問先の開始時刻は自動で再調整されません。必要に応じて時刻を手動編集してください。'],
        evidenceIds: [],
        patches: [patch],
        status: 'draft',
        createdAt: new Date().toISOString(),
      };

      return {
        replyText: `「${firstVisit.userLabel}」の滞在時間を15分短縮する提案ドラフトを作成しました。よろしければ適用してください。`,
        proposal,
      };
    }
  }

  // Fallback informative response without mutation
  return {
    replyText: `ご質問ありがとうございます。「${promptKeyword}」について承りました。固定モック環境のため外部LLM呼出は行わず、確定提案は作られていません。画面上部の提案チップ（「休憩を追加」「候補を追加」「時間を短縮」）をお試しいただくか、直接カードから手動編集・追加を行えます。`,
    proposal: null,
  };
}

// Applying proposal with revision check
export function applyProposal(
  state: TripState,
  proposal: Proposal
): { success: boolean; state: TripState; error?: string } {
  if (proposal.status !== 'draft') {
    return { success: false, state, error: `この提案は既に ${proposal.status} されています。` };
  }

  if (proposal.tripId !== state.tripId || proposal.patches.length === 0) {
    return { success: false, state, error: 'この旅程に適用できる変更がありません。' };
  }

  if (proposal.baseRevision !== state.revision) {
    return {
      success: false,
      state,
      error: `Revision競合: 提案作成時のRevision(${proposal.baseRevision})と現在のRevision(${state.revision})が異なります。手動編集が行われたため再確認が必要です。`,
    };
  }

  let workingState = { ...state };
  for (const patch of proposal.patches) {
    if ((patch.action === 'insert_rest' || patch.action === 'add_stop') && patch.stop) {
      const stop = patch.stop;
      const index = patch.insertIndex ?? workingState.stops.length;
      if (!validStop(stop) || workingState.stops.some(existing => existing.id === stop.id) ||
          (stop.placeId && (!workingState.places[stop.placeId] ||
            workingState.stops.some(existing => existing.placeId === stop.placeId))) ||
          (patch.placeId && patch.placeId !== stop.placeId) ||
          !Number.isInteger(index) || index < 0 || index > workingState.stops.length) {
        return { success: false, state, error: '重複または不正な地点・時刻・挿入位置の提案です。' };
      }
      const previous = workingState.stops[index - 1];
      const following = workingState.stops[index];
      const start = parseMinutesFromMidnight(stop.startLocal);
      if ((previous && start <= parseMinutesFromMidnight(previous.startLocal) + previous.durationMinutes) ||
          (following && start + stop.durationMinutes >= parseMinutesFromMidnight(following.startLocal))) {
        return { success: false, state, error: '同日の旅程順序・時刻または移動の余白を確認してください。' };
      }
      const newStops = [...workingState.stops];
      newStops.splice(index, 0, { ...stop });
      const newCandidates = workingState.candidatePlaceIds.filter(id => id !== stop.placeId);
      workingState = {
        ...workingState,
        stops: newStops,
        candidatePlaceIds: newCandidates,
        selectedPlaceOrStopId: patch.stop.id,
      };
    } else if (patch.action === 'update_stop' && patch.stop) {
      if (!workingState.stops.some(stop => stop.id === patch.stop.id) || !validStop(patch.stop)) {
        return { success: false, state, error: '更新対象または時刻・滞在時間が不正です。' };
      }
      const newStops = workingState.stops.map(s => (s.id === patch.stop?.id ? { ...patch.stop } : s));
      workingState = {
        ...workingState,
        stops: newStops,
      };
    } else {
      return { success: false, state, error: 'このモックでは未対応の変更です。' };
    }
  }

  return {
    success: true,
    state: {
      ...workingState,
      revision: workingState.revision + 1,
    },
  };
}

export function rejectProposal(proposal: Proposal): Proposal {
  return {
    ...proposal,
    status: 'rejected',
  };
}

export function expireDraftProposals<T extends { proposal?: Proposal | null }>(
  messages: T[], proposalId?: string
): T[] {
  if (!proposalId) return messages;
  return messages.map(message => message.proposal?.id === proposalId && message.proposal.status === 'draft'
    ? { ...message, proposal: { ...message.proposal, status: 'expired' as const } } : message);
}

export function selectionAfterProposal(state: TripState, proposal: Proposal, currentId: string | null): string | null {
  const added = proposal.patches.filter(patch =>
    (patch.action === 'add_stop' || patch.action === 'insert_rest') && patch.stop).slice(-1)[0];
  if (added?.stop && state.stops.some(stop => stop.id === added.stop.id)) return added.stop.id;
  if (currentId && (state.places[currentId] || state.stops.some(stop => stop.id === currentId))) return currentId;
  return state.stops[0]?.id || null;
}

// Undo Manager
export function createHistory(initialState: TripState): HistoryState {
  return {
    past: [],
    present: initialState,
  };
}

export function pushHistory(history: HistoryState, newState: TripState): HistoryState {
  if (newState === history.present) return history;
  return {
    past: [...history.past, history.present],
    present: newState,
  };
}

export function undo(history: HistoryState): { history: HistoryState; canUndo: boolean } {
  if (history.past.length === 0) {
    return { history, canUndo: false };
  }
  const previous = history.past[history.past.length - 1];
  const newPast = history.past.slice(0, history.past.length - 1);
  return {
    history: {
      past: newPast,
      present: previous,
    },
    canUndo: newPast.length > 0,
  };
}
