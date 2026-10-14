/**
 * Dependency-free tests for CoVoyager Phase 1 pure itinerary operations.
 *
 * Verifies:
 * 1. Stable shared IDs across Place, Stop, Proposal
 * 2. Candidate addition and removal
 * 3. Up/Down reordering
 * 4. Time validation, calculation, and overlap warnings
 * 5. Rest block insertion
 * 6. Chat proposal generation (draft only, no auto-mutation)
 * 7. Proposal revision comparison (stale revision rejection vs clean apply)
 * 8. Undo history and manual-edit preservation
 * 9. Non-medical trip preference handling
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DOMESTIC_SCENARIO,
  INTERNATIONAL_SCENARIO,
} = require('../lib/mockData.ts');

const {
  initializeTripState,
  validateTimeFormat,
  parseMinutesFromMidnight,
  formatMinutesToTime,
  calculateEndTime,
  getTimeWarnings,
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
} = require('../lib/itineraryOps.ts');

const { shouldSubmitChat } = require('../lib/chatKeys.ts');

test('The first draft never adds malformed proposals to ordinary messages', () => {
  const ordinary = [{ text: '架空の案内' }, { text: '架空の入力', proposal: null }];
  assert.equal(expireDraftProposals(ordinary, undefined), ordinary);
  const { proposal } = generateChatProposal(initializeTripState('domestic'), '休憩');
  const mixed = [...ordinary, { text: '架空の提案', proposal }];
  const expired = expireDraftProposals(mixed, proposal.id);
  assert.equal(Object.hasOwn(expired[0], 'proposal'), false);
  assert.equal(expired[1].proposal, null);
  assert.equal(expired[2].proposal.status, 'expired');
  assert.equal(expired[2].proposal.id, proposal.id);
  assert.deepEqual(expired[2].proposal.patches, proposal.patches);
  assert.equal(proposal.status, 'draft');
});

test('Update proposal keeps current selection and added stops select their new ID', () => {
  const state = initializeTripState('domestic');
  const update = generateChatProposal(state, '時間を短縮').proposal;
  const updated = applyProposal(state, update).state;
  const selected = state.candidatePlaceIds[0];
  assert.equal(selectionAfterProposal(updated, update, selected), selected);
  const add = generateChatProposal(state, '候補を追加').proposal;
  const added = applyProposal(state, add).state;
  assert.equal(selectionAfterProposal(added, add, selected), add.patches[0].stop.id);
  assert.equal(selectionAfterProposal(updated, update, 'deleted-stop'), updated.stops[0].id);
});

test('IME confirmation and Shift+Enter never submit; ordinary Enter does', () => {
  assert.equal(shouldSubmitChat({ key: 'Enter', shiftKey: false, nativeEvent: { isComposing: true } }), false);
  assert.equal(shouldSubmitChat({ key: 'Enter', shiftKey: false, nativeEvent: { keyCode: 229 } }), false);
  assert.equal(shouldSubmitChat({ key: 'Enter', shiftKey: true }), false);
  assert.equal(shouldSubmitChat({ key: 'Enter', shiftKey: false }), true);
});

test('IDs stay unique when the clock does not advance', () => {
  const originalNow = Date.now;
  try {
    Date.now = () => 10000;
    const ids = Array.from({ length: 1000 }, () => nextMockId('stop-rest'));
    assert.equal(new Set(ids).size, ids.length);
    const state = initializeTripState('domestic');
    const first = insertRestBlock(state);
    const second = insertRestBlock(first);
    assert.equal(new Set(second.stops.map(stop => stop.id)).size, second.stops.length);
  } finally { Date.now = originalNow; }
});

test('Rest proposal is after current last stop, location-unspecified and preserves prior edits', () => {
  const state = initializeTripState('domestic');
  const edited = updateStop(state, state.stops[0].id, { note: '架空の手動編集' });
  const { proposal } = generateChatProposal(edited, '午後に休憩');
  const result = applyProposal(edited, proposal);
  assert.equal(result.success, true);
  assert.deepEqual(result.state.stops.slice(0, -1), edited.stops);
  const rest = result.state.stops.at(-1);
  const previous = result.state.stops.at(-2);
  assert.equal(rest.placeId, undefined);
  assert.ok(parseMinutesFromMidnight(rest.startLocal) > parseMinutesFromMidnight(previous.startLocal) + previous.durationMinutes);
  assert.deepEqual(getTimeWarnings(result.state.stops), []);
});

test('Candidate proposals apply once without duplicate places', () => {
  const initial = initializeTripState('domestic');
  const { proposal } = generateChatProposal(initial, '市場の候補を追加');
  const applied = applyProposal(initial, proposal);
  assert.equal(applied.success, true);
  const placeId = proposal.patches[0].placeId;
  assert.equal(applied.state.stops.filter(stop => stop.placeId === placeId).length, 1);
  assert.equal(applied.state.candidatePlaceIds.includes(placeId), false);
  assert.equal(generateChatProposal(applied.state, '市場の候補を追加').proposal, null);
  assert.equal(addCandidateToItinerary(applied.state, placeId), applied.state);
});

test('Update proposal changes duration and keeps the other manual fields', () => {
  const initial = initializeTripState('international');
  const edited = updateStop(initial, initial.stops[0].id, { note: '架空のメモ', startLocal: '09:30' });
  const { proposal } = generateChatProposal(edited, '時間を短縮');
  const applied = applyProposal(edited, proposal);
  assert.equal(applied.success, true);
  const before = edited.stops.find(stop => stop.id === proposal.patches[0].stopId);
  const after = applied.state.stops.find(stop => stop.id === before.id);
  assert.equal(after.note, before.note);
  assert.equal(after.startLocal, before.startLocal);
  assert.equal(after.durationMinutes, Math.max(30, before.durationMinutes - 15));
});

test('Malformed, cross-trip and duplicate-ID proposals never partially mutate the trip', () => {
  const initial = initializeTripState('domestic');
  const { proposal } = generateChatProposal(initial, '休憩');
  const copy = JSON.stringify(initial);
  const variants = [
    { ...proposal, tripId: 'another-trip' },
    { ...proposal, patches: [] },
    { ...proposal, patches: [{ ...proposal.patches[0], stop: { ...proposal.patches[0].stop, id: initial.stops[0].id } }] },
    { ...proposal, patches: [{ ...proposal.patches[0], stop: { ...proposal.patches[0].stop, startLocal: '25:00' } }] },
    { ...proposal, patches: [{ ...proposal.patches[0], stop: { ...proposal.patches[0].stop, placeId: 'unknown-place' } }] },
    { ...proposal, patches: [...proposal.patches, proposal.patches[0]] },
  ];
  for (const candidate of variants) {
    const result = applyProposal(initial, candidate);
    assert.equal(result.success, false);
    assert.equal(result.state, initial);
    assert.equal(JSON.stringify(initial), copy);
  }
});

test('Invalid or unchanged manual edits do not consume revision or Undo', () => {
  const state = initializeTripState('domestic');
  const id = state.stops[0].id;
  for (const update of [{ startLocal: '25:00' }, { durationMinutes: 0 }, { durationMinutes: 481 }, { startLocal: state.stops[0].startLocal }]) {
    assert.equal(updateStop(state, id, update), state);
  }
  const history = createHistory(state);
  assert.equal(pushHistory(history, state), history);
  assert.equal(updateStop(state, 'unknown', { durationMinutes: 20 }), state);
});

test('Changing plan preferences invalidates an earlier draft', () => {
  const state = initializeTripState('domestic');
  const { proposal } = generateChatProposal(state, '休憩');
  const changed = updateTripPreferences(state, { quietRestPreferred: !state.preferences.quietRestPreferred });
  assert.equal(applyProposal(changed, proposal).success, false);
});

test('A proposal honors an explicit insertion index without retiming the other stops', () => {
  const state = initializeTripState('domestic');
  const { proposal } = generateChatProposal(state, '休憩');
  const stop = { ...proposal.patches[0].stop, startLocal: '08:00', durationMinutes: 30 };
  const candidate = { ...proposal, patches: [{ ...proposal.patches[0], insertIndex: 0, stop }] };
  const applied = applyProposal(state, candidate);
  assert.equal(applied.success, true);
  assert.equal(applied.state.stops[0].id, stop.id);
  assert.deepEqual(applied.state.stops.slice(1), state.stops);
});

test('1. Fixture initialization and stable shared IDs', () => {
  const domState = initializeTripState('domestic');
  assert.equal(domState.scenarioKey, 'domestic');
  assert.equal(domState.currency, 'JPY');
  assert.equal(domState.timeZone, 'Asia/Tokyo');
  assert.equal(domState.revision, 1);
  assert.ok(domState.stops.length >= 3);

  // Verify stable IDs between stops and places
  for (const stop of domState.stops) {
    if (stop.placeId) {
      assert.ok(domState.places[stop.placeId], `Place with ID ${stop.placeId} should exist in places`);
      assert.equal(domState.places[stop.placeId].id, stop.placeId);
    }
  }

  // Verify candidates exist in places
  for (const candidateId of domState.candidatePlaceIds) {
    assert.ok(domState.places[candidateId], `Candidate place ${candidateId} must exist`);
  }

  // International fixture
  const intState = initializeTripState('international');
  assert.equal(intState.scenarioKey, 'international');
  assert.equal(intState.currency, 'EUR');
  assert.equal(intState.timeZone, 'Europe/Paris');
  assert.ok(intState.stops.length >= 3);
});

test('2. Candidate addition and removal', () => {
  const state = initializeTripState('domestic');
  const initialStopCount = state.stops.length;
  const initialCandidateCount = state.candidatePlaceIds.length;
  const targetCandidateId = state.candidatePlaceIds[0];

  // Add candidate
  const addedState = addCandidateToItinerary(state, targetCandidateId);
  assert.equal(addedState.stops.length, initialStopCount + 1);
  assert.equal(addedState.candidatePlaceIds.length, initialCandidateCount - 1);
  assert.ok(!addedState.candidatePlaceIds.includes(targetCandidateId));
  assert.equal(addedState.revision, 2);

  const newlyAddedStop = addedState.stops[addedState.stops.length - 1];
  assert.equal(newlyAddedStop.placeId, targetCandidateId);

  // Remove stop
  const removedState = removeStopFromItinerary(addedState, newlyAddedStop.id);
  assert.equal(removedState.stops.length, initialStopCount);
  assert.equal(removedState.candidatePlaceIds.length, initialCandidateCount);
  assert.ok(removedState.candidatePlaceIds.includes(targetCandidateId));
  assert.equal(removedState.revision, 3);
});

test('3. Up/Down stop reordering', () => {
  const state = initializeTripState('domestic');
  const firstId = state.stops[0].id;
  const secondId = state.stops[1].id;

  // Move first down
  const reorderedDown = reorderStop(state, firstId, 'down');
  assert.equal(reorderedDown.stops[0].id, secondId);
  assert.equal(reorderedDown.stops[1].id, firstId);
  assert.equal(reorderedDown.revision, 2);

  // Move it back up
  const reorderedUp = reorderStop(reorderedDown, firstId, 'up');
  assert.equal(reorderedUp.stops[0].id, firstId);
  assert.equal(reorderedUp.stops[1].id, secondId);
  assert.equal(reorderedUp.revision, 3);

  // Out of bounds checks
  const noopUp = reorderStop(reorderedUp, firstId, 'up');
  assert.equal(noopUp.stops[0].id, firstId, 'Moving top stop up is a no-op');

  const lastId = state.stops[state.stops.length - 1].id;
  const noopDown = reorderStop(reorderedUp, lastId, 'down');
  assert.equal(noopDown.stops[noopDown.stops.length - 1].id, lastId, 'Moving bottom stop down is a no-op');
});

test('4. Time validation, calculation, and overlap warnings', () => {
  assert.equal(validateTimeFormat('10:00'), true);
  assert.equal(validateTimeFormat('09:45'), true);
  assert.equal(validateTimeFormat('23:59'), true);
  assert.equal(validateTimeFormat('24:00'), false);
  assert.equal(validateTimeFormat('9:00'), false);
  assert.equal(validateTimeFormat('invalid'), false);

  assert.equal(parseMinutesFromMidnight('10:30'), 630);
  assert.equal(formatMinutesToTime(630), '10:30');
  assert.equal(calculateEndTime('10:00', 90), '11:30');

  // Overlap warning detection
  const state = initializeTripState('domestic');
  const overlappingStops = [
    { ...state.stops[0], startLocal: '10:00', durationMinutes: 90 }, // ends 11:30
    { ...state.stops[1], startLocal: '11:15', durationMinutes: 45 }, // starts 11:15
  ];
  const warnings = getTimeWarnings(overlappingStops);
  assert.ok(warnings.length > 0);
  assert.ok(warnings[0].includes('重複警告'));
});

test('5. Rest block insertion', () => {
  const state = initializeTripState('domestic');
  const initialCount = state.stops.length;

  const withRest = insertRestBlock(state, state.stops[0].id, 45, '足休め休憩');
  assert.equal(withRest.stops.length, initialCount + 1);
  assert.equal(withRest.stops[1].kind, 'rest');
  assert.equal(withRest.stops[1].durationMinutes, 45);
  assert.equal(withRest.revision, 2);
});

test('6. Chat deterministic proposal generation (no auto-mutation)', () => {
  const state = initializeTripState('domestic');
  const initialRevision = state.revision;

  // Ask for rest
  const { replyText, proposal } = generateChatProposal(state, '午後に休憩を追加したい');
  assert.ok(replyText.length > 0);
  assert.ok(proposal !== null);
  assert.equal(proposal.status, 'draft');
  assert.equal(proposal.baseRevision, initialRevision);
  assert.ok(proposal.patches.length > 0);
  assert.ok(proposal.patches[0].action === 'insert_rest');

  // State must remain UNMUTATED after chat response
  assert.equal(state.revision, initialRevision);
  assert.equal(state.stops.length, 3);
});

test('7. Proposal apply and revision conflict rejection', () => {
  const state = initializeTripState('domestic');
  const { proposal } = generateChatProposal(state, '休憩を追加');
  assert.ok(proposal !== null);

  // Clean apply
  const applyRes = applyProposal(state, proposal);
  assert.equal(applyRes.success, true);
  assert.equal(applyRes.state.revision, state.revision + 1);
  assert.ok(applyRes.state.stops.some(s => s.id === proposal.patches[0].stop?.id));

  // Revision conflict: if manual edit occurs first
  const manuallyEditedState = updateStop(state, state.stops[0].id, { durationMinutes: 90 });
  assert.equal(manuallyEditedState.revision, state.revision + 1);

  // Applying stale proposal should fail
  const conflictRes = applyProposal(manuallyEditedState, proposal);
  assert.equal(conflictRes.success, false);
  assert.ok(conflictRes.error?.includes('Revision競合'));

  // Reject proposal
  const rejected = rejectProposal(proposal);
  assert.equal(rejected.status, 'rejected');
});

test('8. History and undo preserving manual edits', () => {
  const initial = initializeTripState('domestic');
  let history = createHistory(initial);

  // Edit 1: Reorder stops
  const state1 = reorderStop(initial, initial.stops[0].id, 'down');
  history = pushHistory(history, state1);

  // Edit 2: Insert rest block
  const state2 = insertRestBlock(state1);
  history = pushHistory(history, state2);
  assert.equal(history.present.stops.length, initial.stops.length + 1);

  // Undo edit 2
  const undo1 = undo(history);
  assert.equal(undo1.canUndo, true);
  history = undo1.history;
  assert.equal(history.present.stops.length, initial.stops.length);
  assert.equal(history.present.stops[0].id, state1.stops[0].id);

  // Undo edit 1
  const undo2 = undo(history);
  assert.equal(undo2.canUndo, false);
  history = undo2.history;
  assert.equal(history.present.stops[0].id, initial.stops[0].id);
});

test('9. Trip preferences updates (non-medical)', () => {
  const state = initializeTripState('domestic');
  const updated = updateTripPreferences(state, {
    walkingLimit: 'active',
    walkingLimitLabel: 'たくさん歩ける（約8,000歩目安）',
    quietRestPreferred: false,
  });

  assert.equal(updated.preferences.walkingLimit, 'active');
  assert.equal(updated.preferences.quietRestPreferred, false);
  assert.ok(updated.preferences.note.includes('非医療'));
});
