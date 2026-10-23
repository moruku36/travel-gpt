// Deterministic responder used when no OPENAI_API_KEY is configured, and in tests.
// Fixture places are well-known public landmarks; coordinates are approximate.
import type { ChatRequest, LlmOutput } from '@/lib/schema';

type P = [name: string, lng: number, lat: number, category: string, minutes: number, crowd: 'low' | 'medium' | 'high', crowdNote: string];

interface City {
  keys: string[];
  label: string;
  country: string;
  currency: string;
  center: [number, number];
  places: P[];
}

const CITIES: City[] = [
  {
    keys: ['東京', 'tokyo', '浅草', '渋谷'],
    label: '東京',
    country: 'JP',
    currency: 'JPY',
    center: [139.767, 35.681],
    places: [
      ['浅草寺', 139.7966, 35.7148, 'temple', 60, 'high', '朝 8 時前か夕方が比較的空いています'],
      ['東京スカイツリー', 139.8107, 35.7101, 'viewpoint', 90, 'high', '平日の開館直後が狙い目'],
      ['上野恩賜公園', 139.7714, 35.7156, 'park', 60, 'medium', '桜の時期は大変混みます'],
      ['明治神宮', 139.6993, 35.6764, 'shrine', 60, 'medium', '初詣期間以外は朝が静か'],
      ['渋谷スカイ', 139.7022, 35.6585, 'viewpoint', 60, 'high', '夕日の時間帯は要予約'],
      ['清澄庭園', 139.7983, 35.6806, 'garden', 45, 'low', '静かに過ごしたい人向け'],
    ],
  },
  {
    keys: ['京都', 'kyoto'],
    label: '京都',
    country: 'JP',
    currency: 'JPY',
    center: [135.768, 35.011],
    places: [
      ['伏見稲荷大社', 135.7727, 34.9671, 'shrine', 90, 'high', '早朝 7 時前は人が少なめ'],
      ['清水寺', 135.785, 34.9949, 'temple', 75, 'high', '開門直後がおすすめ'],
      ['嵐山 竹林の小径', 135.6717, 35.017, 'nature', 45, 'high', '8 時前なら写真が撮りやすい'],
      ['南禅寺', 135.7944, 35.0113, 'temple', 60, 'medium', '紅葉期は混雑'],
      ['錦市場', 135.7649, 35.005, 'market', 60, 'high', '昼前後は混むので 10 時台に'],
      ['哲学の道', 135.7944, 35.0213, 'walk', 45, 'low', '平日の午後は比較的静か'],
    ],
  },
  {
    keys: ['大阪', 'osaka'],
    label: '大阪',
    country: 'JP',
    currency: 'JPY',
    center: [135.502, 34.694],
    places: [
      ['大阪城', 135.5262, 34.6873, 'castle', 90, 'medium', '天守閣は午前が空きやすい'],
      ['道頓堀', 135.5013, 34.6687, 'food', 90, 'high', '夜は特に賑やか'],
      ['海遊館', 135.4291, 34.6545, 'aquarium', 120, 'high', '雨の日の候補に'],
      ['新世界', 135.5063, 34.6525, 'food', 60, 'medium', '串カツの食べ歩き'],
    ],
  },
  {
    keys: ['ソウル', 'seoul', '韓国'],
    label: 'ソウル',
    country: 'KR',
    currency: 'KRW',
    center: [126.978, 37.566],
    places: [
      ['景福宮', 126.977, 37.5796, 'palace', 90, 'high', '火曜休み。朝が空いています'],
      ['北村韓屋村', 126.985, 37.5826, 'neighborhood', 60, 'medium', '住宅地なので静かに'],
      ['広蔵市場', 126.9996, 37.5701, 'market', 60, 'high', '昼食時は混雑'],
      ['Nソウルタワー', 126.9882, 37.5512, 'viewpoint', 90, 'medium', '夜景の時間帯は混みます'],
      ['益善洞', 126.9897, 37.5741, 'neighborhood', 60, 'high', '週末午後は混雑'],
    ],
  },
  {
    keys: ['台北', 'taipei', '台湾'],
    label: '台北',
    country: 'TW',
    currency: 'TWD',
    center: [121.565, 25.033],
    places: [
      ['台北101', 121.5645, 25.034, 'viewpoint', 90, 'high', '平日の午前が狙い目'],
      ['国立故宮博物院', 121.5485, 25.1024, 'museum', 150, 'high', '開館直後か夕方'],
      ['士林夜市', 121.5244, 25.0878, 'market', 90, 'high', '19-21 時がピーク'],
      ['龍山寺', 121.4999, 25.0372, 'temple', 45, 'medium', '朝の参拝が落ち着いています'],
      ['九份老街', 121.8443, 25.1093, 'town', 180, 'high', '夕方は非常に混雑、平日推奨'],
    ],
  },
  {
    keys: ['パリ', 'paris', 'フランス'],
    label: 'パリ',
    country: 'FR',
    currency: 'EUR',
    center: [2.3522, 48.8566],
    places: [
      ['エッフェル塔', 2.2945, 48.8584, 'landmark', 120, 'high', 'オンライン予約で待ち時間短縮'],
      ['ルーヴル美術館', 2.3376, 48.8606, 'museum', 180, 'high', '要時間指定予約、水金は夜間開館'],
      ['モンマルトル', 2.3431, 48.8867, 'neighborhood', 120, 'medium', '朝は落ち着いています'],
      ['オルセー美術館', 2.3266, 48.86, 'museum', 150, 'high', '月曜休館'],
      ['セーヌ川クルーズ', 2.3002, 48.8628, 'cruise', 60, 'medium', '日没前後が人気'],
    ],
  },
  {
    keys: ['バンコク', 'bangkok', 'タイ'],
    label: 'バンコク',
    country: 'TH',
    currency: 'THB',
    center: [100.5018, 13.7563],
    places: [
      ['ワット・ポー', 100.4931, 13.7465, 'temple', 60, 'high', '暑さを避け朝に'],
      ['王宮', 100.4913, 13.75, 'palace', 120, 'high', '服装規定あり'],
      ['ワット・アルン', 100.4889, 13.7437, 'temple', 45, 'medium', '夕景がきれい'],
      ['チャトゥチャック・ウィークエンドマーケット', 100.5498, 13.7999, 'market', 150, 'high', '週末のみ、午前が涼しい'],
    ],
  },
  {
    keys: ['ホノルル', 'honolulu', 'ハワイ', 'hawaii'],
    label: 'ホノルル',
    country: 'US',
    currency: 'USD',
    center: [-157.8583, 21.3069],
    places: [
      ['ダイヤモンドヘッド', -157.8049, 21.2614, 'hike', 120, 'high', '要予約、朝の涼しい時間に'],
      ['ワイキキビーチ', -157.8278, 21.2767, 'beach', 120, 'high', '朝は人が少なめ'],
      ['ハナウマ湾', -157.6939, 21.2694, 'beach', 180, 'high', '要予約・火曜休み'],
      ['アラモアナセンター', -157.8434, 21.2913, 'shopping', 120, 'medium', '雨の日の候補'],
    ],
  },
];

const RECOMMEND: P[] = [
  ['京都', 135.768, 35.011, 'destination', 1440, 'high', '紅葉と寺社。早朝行動で混雑回避'],
  ['金沢', 136.6562, 36.5613, 'destination', 1440, 'medium', '兼六園と食。新幹線で行きやすい'],
  ['台北', 121.565, 25.033, 'destination', 1440, 'high', '近くて食が充実、週末旅行向き'],
  ['ソウル', 126.978, 37.566, 'destination', 1440, 'high', 'カフェ・買い物・夜景'],
  ['パリ', 2.3522, 48.8566, 'destination', 1440, 'high', '美術館と街歩き、長めの休暇に'],
  ['ホノルル', -157.8583, 21.3069, 'destination', 1440, 'high', '海とのんびり、休息多めの旅に'],
];

function findCity(text: string): City | undefined {
  const t = text.toLowerCase();
  return CITIES.find((c) => c.keys.some((k) => t.includes(k.toLowerCase())));
}

export function demoReply(req: ChatRequest): LlmOutput {
  const last = req.messages[req.messages.length - 1]?.text ?? '';
  const prefix = '（デモモード: OPENAI_API_KEY 未設定のため固定データで応答しています）\n';

  if (req.mode === 'recommend') {
    return {
      reply: `${prefix}おふたりの興味（${req.trip.interests.join('・') || '未設定'}）に合いそうな行き先を地球儀に並べました。気になるピンを選んで「ここに決める」を押してください。`,
      mapFocus: { lng: 135, lat: 30, zoom: 1.6 },
      places: RECOMMEND.map((p, i) => toPlace(p, i, guessCountry(p[0]), null)),
      proposal: null,
      warnings: ['季節・為替・渡航条件は出発前に公式情報で確認してください'],
      followUps: ['国内だけで考えたい', '3 泊 4 日で行ける所は？', '予算 10 万円以内では？'],
    };
  }

  const city = findCity(last) ?? findCity(req.trip.destination) ?? (req.mode === 'replan' ? CITIES[0] : undefined);
  if (!city) {
    return {
      reply: `${prefix}デモデータにある都市（東京・京都・大阪・ソウル・台北・パリ・バンコク・ホノルル）の名前を入れると候補を表示します。「おすすめ」モードでは行き先探しもできます。`,
      mapFocus: null,
      places: [],
      proposal: null,
      warnings: [],
      followUps: ['京都で紅葉を見たい', 'ソウルで食べ歩き', '行き先のおすすめは？'],
    };
  }

  const existing = new Set(req.trip.days.flatMap((d) => d.stops.map((s) => s.name)));
  const fresh = city.places.filter((p) => !existing.has(p[0]));
  const pick = (req.mode === 'replan' ? fresh.filter((p) => p[3] !== 'nature' && p[3] !== 'beach') : fresh).slice(0, req.mode === 'replan' ? 2 : 4);
  const places = pick.map((p, i) => toPlace(p, i, city.country, city.currency));
  const dayIndex = Math.max(0, req.trip.days.findIndex((d) => d.stops.length === 0));
  const proposal =
    req.trip.days.length > 0 && places.length > 0
      ? {
          summary: `${places.map((p) => p.name).join('・')} を ${dayIndex + 1} 日目に追加`,
          ops: places.map((p, i) => ({
            type: 'add_stop' as const,
            placeRef: p.ref,
            stopId: null,
            dayIndex,
            position: null,
            startTime: i === 0 ? '09:30' : null,
            durationMinutes: p.durationMinutes,
          })),
        }
      : null;

  return {
    reply:
      req.mode === 'replan'
        ? `${prefix}状況に合わせて ${city.label} の屋内・近場の代替案を出しました。ロックした予定はそのままです。`
        : `${prefix}${city.label}で${places.length}か所の候補を地図に表示しました。混雑しやすい所は時間帯のメモを付けています。${proposal ? '「適用」で旅程に入ります。' : '旅程を作るには日付を設定してください。'}`,
    mapFocus: { lng: city.center[0], lat: city.center[1], zoom: 11.5 },
    places,
    proposal,
    warnings: ['営業時間・料金・予約要否は公式サイトで確認してください'],
    followUps: ['もっと静かな所がいい', '雨の日の候補は？', '休憩を増やして'],
  };
}

function toPlace(p: P, i: number, country: string, currency: string | null) {
  return {
    ref: `p${i + 1}`,
    name: p[0],
    geocodeQuery: p[0],
    lng: p[1],
    lat: p[2],
    category: p[3],
    countryCode: country,
    why: `${p[0]}は定番の${p[3]}スポットです。`,
    durationMinutes: p[4],
    cost: null,
    currency,
    crowd: p[5],
    crowdNote: p[6],
    bestTime: p[6],
  };
}

function guessCountry(name: string): string {
  return findCity(name)?.country ?? 'JP';
}
