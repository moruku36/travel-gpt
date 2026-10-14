/**
 * CoVoyager Phase 1 Screen Mock - Fixed Fictional Data
 *
 * DESIGN.md Section 5/7 compliant data models.
 * Strictly fictional places, coordinates, and evidence.
 * No real URLs, no live API keys, no personal or medical information.
 */

export interface Evidence {
  id: string;
  sourceUrl: string | null; // Never fabricate URLs; null for fictional
  provider: string;
  retrievedAt: string;
  validForDate: string;
  confidence: '架空サンプル / Mock' | '確認済み' | '未確認';
  uncertainty: string[];
  storageRights: 'mock_fixture_allowlist';
}

export interface Place {
  id: string; // Stable shared ID
  userLabel: string;
  localName?: string;
  category: 'station' | 'sight' | 'cafe' | 'museum' | 'market' | 'park' | 'rest';
  coordinates: [number, number]; // [longitude, latitude]
  mapSvgCoords: { x: number; y: number }; // Relative coordinates for stylized SVG map (0-100%)
  countryCode: string;
  city: string;
  addressFictional: string;
  evidence: Evidence;
  suggestedDurationMinutes: number;
}

export interface Stop {
  id: string; // Stable shared ID
  placeId?: string;
  userLabel: string;
  kind: 'visit' | 'rest' | 'transfer';
  startLocal: string; // "HH:MM"
  durationMinutes: number;
  note?: string;
  locked?: boolean;
}

export interface TripPreferences {
  walkingLimit: 'modest' | 'standard' | 'active'; // 非医療的な移動目安
  walkingLimitLabel: string;
  quietRestPreferred: boolean; // 静かな休憩希望
  note: string;
}

export interface TripScenario {
  id: string;
  key: 'domestic' | 'international';
  title: string;
  city: string;
  country: string;
  countryCode: string;
  localDate: string;
  timeZone: string; // IANA timezone
  timeZoneLabel: string;
  currency: string;
  currencySymbol: string;
  places: Record<string, Place>;
  initialStops: Stop[];
  candidatePlaceIds: string[];
  preferences: TripPreferences;
  description: string;
}

export const DOMESTIC_SCENARIO: TripScenario = {
  id: 'trip-dom-aoba-001',
  key: 'domestic',
  title: '国内日帰り散策プラン（青葉市・架空）',
  city: '青葉市（架空都市）',
  country: '日本',
  countryCode: 'JP',
  localDate: '2026-11-03',
  timeZone: 'Asia/Tokyo',
  timeZoneLabel: 'JST (UTC+9)',
  currency: 'JPY',
  currencySymbol: '¥',
  description: '木々の多い緑地と歴史的建造物を巡る、歩行控えめ・定期休憩重視の架空モデルコース。',
  preferences: {
    walkingLimit: 'modest',
    walkingLimitLabel: '歩行控えめ（約3,000〜4,000歩目安）',
    quietRestPreferred: true,
    note: '旅行計画上の手動目安（非医療的設定）です。健康状態の収集や自動的な安全保証は行いません。',
  },
  places: {
    'place-dom-station': {
      id: 'place-dom-station',
      userLabel: '青葉中央駅（西口広場）',
      category: 'station',
      coordinates: [139.5501, 35.6801],
      mapSvgCoords: { x: 18, y: 55 },
      countryCode: 'JP',
      city: '青葉市',
      addressFictional: '青葉市中央通 1-1（架空）',
      suggestedDurationMinutes: 15,
      evidence: {
        id: 'ev-dom-st',
        sourceUrl: null,
        provider: 'CoVoyager 固定フィクションデータ (Phase 1 Mock)',
        retrievedAt: '2026-10-14T00:00:00Z',
        validForDate: '2026-11-03',
        confidence: '架空サンプル / Mock',
        uncertainty: ['実在しない架空の駅です', '路線時刻表は未計算'],
        storageRights: 'mock_fixture_allowlist',
      },
    },
    'place-dom-garden': {
      id: 'place-dom-garden',
      userLabel: '青葉緑地庭園',
      category: 'park',
      coordinates: [139.558, 35.686],
      mapSvgCoords: { x: 40, y: 32 },
      countryCode: 'JP',
      city: '青葉市',
      addressFictional: '青葉市緑地公園 3-5（架空）',
      suggestedDurationMinutes: 60,
      evidence: {
        id: 'ev-dom-gdn',
        sourceUrl: null,
        provider: 'CoVoyager 固定フィクションデータ (Phase 1 Mock)',
        retrievedAt: '2026-10-14T00:00:00Z',
        validForDate: '2026-11-03',
        confidence: '架空サンプル / Mock',
        uncertainty: ['平坦な舗装散策路あり（架空情報）', '入園料は現地掲示参照'],
        storageRights: 'mock_fixture_allowlist',
      },
    },
    'place-dom-cafe': {
      id: 'place-dom-cafe',
      userLabel: '欅坂レトロ喫茶（静かな休憩所）',
      category: 'cafe',
      coordinates: [139.562, 35.684],
      mapSvgCoords: { x: 55, y: 45 },
      countryCode: 'JP',
      city: '青葉市',
      addressFictional: '青葉市欅坂 2-12（架空）',
      suggestedDurationMinutes: 45,
      evidence: {
        id: 'ev-dom-cafe',
        sourceUrl: null,
        provider: 'CoVoyager 固定フィクションデータ (Phase 1 Mock)',
        retrievedAt: '2026-10-14T00:00:00Z',
        validForDate: '2026-11-03',
        confidence: '架空サンプル / Mock',
        uncertainty: ['静かで座席間隔が広い喫茶店（架空設定）', '営業時間は目安'],
        storageRights: 'mock_fixture_allowlist',
      },
    },
    'place-dom-museum': {
      id: 'place-dom-museum',
      userLabel: '青葉市立工芸館（屋内展示）',
      category: 'museum',
      coordinates: [139.569, 35.681],
      mapSvgCoords: { x: 75, y: 60 },
      countryCode: 'JP',
      city: '青葉市',
      addressFictional: '青葉市文化町 4-1（架空）',
      suggestedDurationMinutes: 75,
      evidence: {
        id: 'ev-dom-mus',
        sourceUrl: null,
        provider: 'CoVoyager 固定フィクションデータ (Phase 1 Mock)',
        retrievedAt: '2026-10-14T00:00:00Z',
        validForDate: '2026-11-03',
        confidence: '架空サンプル / Mock',
        uncertainty: ['全館バリアフリー・エレベーター有（架空設定）'],
        storageRights: 'mock_fixture_allowlist',
      },
    },
    'place-dom-market': {
      id: 'place-dom-market',
      userLabel: '水辺のクラフト広場（候補地）',
      category: 'market',
      coordinates: [139.564, 35.676],
      mapSvgCoords: { x: 62, y: 80 },
      countryCode: 'JP',
      city: '青葉市',
      addressFictional: '青葉市水辺通 1-8（架空）',
      suggestedDurationMinutes: 45,
      evidence: {
        id: 'ev-dom-mkt',
        sourceUrl: null,
        provider: 'CoVoyager 固定フィクションデータ (Phase 1 Mock)',
        retrievedAt: '2026-10-14T00:00:00Z',
        validForDate: '2026-11-03',
        confidence: '架空サンプル / Mock',
        uncertainty: ['週末中心にクラフト出店（架空設定）'],
        storageRights: 'mock_fixture_allowlist',
      },
    },
    'place-dom-observatory': {
      id: 'place-dom-observatory',
      userLabel: '星見の丘展望テラス（候補地）',
      category: 'sight',
      coordinates: [139.574, 35.692],
      mapSvgCoords: { x: 88, y: 25 },
      countryCode: 'JP',
      city: '青葉市',
      addressFictional: '青葉市星見台 5-2（架空）',
      suggestedDurationMinutes: 40,
      evidence: {
        id: 'ev-dom-obs',
        sourceUrl: null,
        provider: 'CoVoyager 固定フィクションデータ (Phase 1 Mock)',
        retrievedAt: '2026-10-14T00:00:00Z',
        validForDate: '2026-11-03',
        confidence: '架空サンプル / Mock',
        uncertainty: ['見晴らし良好だが坂道あり（架空設定）'],
        storageRights: 'mock_fixture_allowlist',
      },
    },
  },
  initialStops: [
    {
      id: 'stop-dom-1',
      placeId: 'place-dom-garden',
      userLabel: '青葉緑地庭園（散策）',
      kind: 'visit',
      startLocal: '10:00',
      durationMinutes: 60,
      note: '緑道沿いの平坦な小道をのんびり散策。',
    },
    {
      id: 'stop-dom-2',
      placeId: 'place-dom-cafe',
      userLabel: '欅坂レトロ喫茶（静かな休憩）',
      kind: 'rest',
      startLocal: '11:15',
      durationMinutes: 45,
      note: '混雑を避けた早めのティータイム・座って足を休める。',
    },
    {
      id: 'stop-dom-3',
      placeId: 'place-dom-museum',
      userLabel: '青葉市立工芸館（屋内展示）',
      kind: 'visit',
      startLocal: '12:15',
      durationMinutes: 75,
      note: '地元の染物や陶芸品の常設展示を鑑賞。',
    },
  ],
  candidatePlaceIds: ['place-dom-market', 'place-dom-observatory'],
};

export const INTERNATIONAL_SCENARIO: TripScenario = {
  id: 'trip-int-luna-002',
  key: 'international',
  title: '海外半日港町プラン（ポルト・ルーナ・架空）',
  city: 'ポルト・ルーナ (Porto Luna, 架空)',
  country: 'ガリシア連邦（架空国家）',
  countryCode: 'XG',
  localDate: '2026-12-05',
  timeZone: 'Europe/Paris',
  timeZoneLabel: 'CET (UTC+1)',
  currency: 'EUR',
  currencySymbol: '€',
  description: '歴史ある旧市街と静かな港湾テラスを巡る、標準歩行・カフェ休憩重視の架空モデルコース。',
  preferences: {
    walkingLimit: 'standard',
    walkingLimitLabel: '標準歩行（約6,000歩目安）',
    quietRestPreferred: true,
    note: '旅行計画上の手動目安です。健康状態の収集や自動的な安全保証は行いません。',
  },
  places: {
    'place-int-station': {
      id: 'place-int-station',
      userLabel: 'ルーナ中央駅 (Estación Central)',
      localName: 'Estación Central de Porto Luna',
      category: 'station',
      coordinates: [-8.6105, 41.1496],
      mapSvgCoords: { x: 20, y: 65 },
      countryCode: 'XG',
      city: 'Porto Luna',
      addressFictional: 'Avenida del Puerto 12 (架空)',
      suggestedDurationMinutes: 20,
      evidence: {
        id: 'ev-int-st',
        sourceUrl: null,
        provider: 'CoVoyager 固定フィクションデータ (Phase 1 Mock)',
        retrievedAt: '2026-10-14T00:00:00Z',
        validForDate: '2026-12-05',
        confidence: '架空サンプル / Mock',
        uncertainty: ['実在しない架空の国際駅です'],
        storageRights: 'mock_fixture_allowlist',
      },
    },
    'place-int-tower': {
      id: 'place-int-tower',
      userLabel: 'サン・マルコ旧展望塔 (Torre Vieja)',
      localName: 'Torre Vieja de San Marco',
      category: 'sight',
      coordinates: [-8.6142, 41.1458],
      mapSvgCoords: { x: 38, y: 35 },
      countryCode: 'XG',
      city: 'Porto Luna',
      addressFictional: 'Plaza del Mirador 4 (架空)',
      suggestedDurationMinutes: 60,
      evidence: {
        id: 'ev-int-twr',
        sourceUrl: null,
        provider: 'CoVoyager 固定フィクションデータ (Phase 1 Mock)',
        retrievedAt: '2026-10-14T00:00:00Z',
        validForDate: '2026-12-05',
        confidence: '架空サンプル / Mock',
        uncertainty: ['旧港と大西洋を一望できる石造塔（架空設定）'],
        storageRights: 'mock_fixture_allowlist',
      },
    },
    'place-int-cafe': {
      id: 'place-int-cafe',
      userLabel: 'カフェ・デル・ポエタ (Café del Poeta)',
      localName: 'Café del Poeta y Jardín',
      category: 'cafe',
      coordinates: [-8.6165, 41.1432],
      mapSvgCoords: { x: 52, y: 48 },
      countryCode: 'XG',
      city: 'Porto Luna',
      addressFictional: 'Rúa das Flores 28 (架空)',
      suggestedDurationMinutes: 50,
      evidence: {
        id: 'ev-int-cafe',
        sourceUrl: null,
        provider: 'CoVoyager 固定フィクションデータ (Phase 1 Mock)',
        retrievedAt: '2026-10-14T00:00:00Z',
        validForDate: '2026-12-05',
        confidence: '架空サンプル / Mock',
        uncertainty: ['中庭テラス席あり、静穏なカフェ（架空設定）'],
        storageRights: 'mock_fixture_allowlist',
      },
    },
    'place-int-museum': {
      id: 'place-int-museum',
      userLabel: '星の小道海洋美術館 (Museo de Mar)',
      localName: 'Museo Marítimo de las Estrellas',
      category: 'museum',
      coordinates: [-8.621, 41.1405],
      mapSvgCoords: { x: 74, y: 58 },
      countryCode: 'XG',
      city: 'Porto Luna',
      addressFictional: 'Cais de San Pedro 8 (架空)',
      suggestedDurationMinutes: 80,
      evidence: {
        id: 'ev-int-mus',
        sourceUrl: null,
        provider: 'CoVoyager 固定フィクションデータ (Phase 1 Mock)',
        retrievedAt: '2026-10-14T00:00:00Z',
        validForDate: '2026-12-05',
        confidence: '架空サンプル / Mock',
        uncertainty: ['大航海時代の天球図・模型展示（架空設定）'],
        storageRights: 'mock_fixture_allowlist',
      },
    },
    'place-int-market': {
      id: 'place-int-market',
      userLabel: '海峡の回廊市場 (Mercado del Corredor - 候補地)',
      localName: 'Mercado Cubierto del Corredor',
      category: 'market',
      coordinates: [-8.618, 41.148],
      mapSvgCoords: { x: 60, y: 22 },
      countryCode: 'XG',
      city: 'Porto Luna',
      addressFictional: 'Alameda Central 15 (架空)',
      suggestedDurationMinutes: 45,
      evidence: {
        id: 'ev-int-mkt',
        sourceUrl: null,
        provider: 'CoVoyager 固定フィクションデータ (Phase 1 Mock)',
        retrievedAt: '2026-10-14T00:00:00Z',
        validForDate: '2026-12-05',
        confidence: '架空サンプル / Mock',
        uncertainty: ['地元オリーブオイルや焼き菓子の屋台街（架空設定）'],
        storageRights: 'mock_fixture_allowlist',
      },
    },
    'place-int-pier': {
      id: 'place-int-pier',
      userLabel: '夕陽の埠頭遊歩道 (Paseo del Muelle - 候補地)',
      localName: 'Paseo del Muelle Viejo',
      category: 'sight',
      coordinates: [-8.625, 41.138],
      mapSvgCoords: { x: 86, y: 78 },
      countryCode: 'XG',
      city: 'Porto Luna',
      addressFictional: 'Muelle Antiguo s/n (架空)',
      suggestedDurationMinutes: 40,
      evidence: {
        id: 'ev-int-pier',
        sourceUrl: null,
        provider: 'CoVoyager 固定フィクションデータ (Phase 1 Mock)',
        retrievedAt: '2026-10-14T00:00:00Z',
        validForDate: '2026-12-05',
        confidence: '架空サンプル / Mock',
        uncertainty: ['夕方の落日が美しい石畳桟橋（架空設定）'],
        storageRights: 'mock_fixture_allowlist',
      },
    },
  },
  initialStops: [
    {
      id: 'stop-int-1',
      placeId: 'place-int-tower',
      userLabel: 'サン・マルコ旧展望塔（見学）',
      kind: 'visit',
      startLocal: '10:00',
      durationMinutes: 60,
      note: '旧市街の坂を登り、旧港のパノラマを一望。',
    },
    {
      id: 'stop-int-2',
      placeId: 'place-int-cafe',
      userLabel: 'カフェ・デル・ポエタ（静かな休憩）',
      kind: 'rest',
      startLocal: '11:15',
      durationMinutes: 50,
      note: '石造の中庭で特製ハーブティーと焼き菓子で休憩。',
    },
    {
      id: 'stop-int-3',
      placeId: 'place-int-museum',
      userLabel: '星の小道海洋美術館（屋内鑑賞）',
      kind: 'visit',
      startLocal: '12:20',
      durationMinutes: 80,
      note: '古い海図や航海用天球儀の静かな展示室を見学。',
    },
  ],
  candidatePlaceIds: ['place-int-market', 'place-int-pier'],
};
