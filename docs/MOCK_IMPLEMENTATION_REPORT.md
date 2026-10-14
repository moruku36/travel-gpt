# CoVoyager Phase 1 固定データ画面モック 実装報告書

作成日: 2026-10-14
対象: Next.js Pages Router `/mock` 固定データ画面モック（Phase 1 MVP プレビュー）
基準設計: [docs/DESIGN.md](DESIGN.md) および [docs/ROADMAP.md](ROADMAP.md)

元実装は Antigravity、設計・コードレビューは Claude、レビュー後の最小修正は Codex が担当しました。以下の9件は元実装時点の結果で、現在の回帰検証は [レビュー対応記録](MOCK_REVIEW_RESOLUTION.md) を参照してください。完成済み Phase 1 MVP ではなく固定データの画面モックです。

---

## 1. 要件と実装ファイルの対応表

| 要件項目 | 実装内容 | 対応ファイル |
|---|---|---|
| **隔離された画面ルート** | 既存ルート (`pages/index.jsx`) を保ちつつ、`/mock` として独立した画面を新設。固定プレビューリンクをルートに設置。追加の外部ランタイム依存なし。 | [`pages/mock.tsx`](../pages/mock.tsx)<br>[`pages/mock.module.css`](../pages/mock.module.css)<br>[`pages/index.jsx`](../pages/index.jsx) |
| **常時表示モックバナー** | 実API・外部LLM・Mapboxへの外部接続がなく、全データが固定架空サンプルであることを明記した警告バナー。 | [`components/mock/MockBanner.tsx`](../components/mock/MockBanner.tsx) |
| **国内・海外架空シナリオ** | 青葉市（国内・JST・JPY）とポルト・ルーナ（海外・CET・EUR）の2都市の架空データ、タイムゾーン、通貨単位、スポット情報。 | [`lib/mockData.ts`](../lib/mockData.ts) |
| **地図プレースホルダー** | 外部タイル/画像取得を行わない軽量SVG製ローカルマップ。旅程ピン・候補ピン・順序経路線の描画、選択連動、キーボード操作対応。 | [`components/mock/MockMap.tsx`](../components/mock/MockMap.tsx) |
| **旅程タイムテーブル編集** | 安定ID共有、候補追加・削除、順序入替（▲/▼）、時刻・所要時間編集、休憩ブロック挿入、時間重複警告の表示。 | [`components/mock/MockItinerary.tsx`](../components/mock/MockItinerary.tsx)<br>[`lib/itineraryOps.ts`](../lib/itineraryOps.ts) |
| **決定論的チャット提案** | 外部APIを呼ばず、旅程を直接書き換えない提案ドラフト（Proposal Preview）を作成。差分・理由・警告表示、手動「適用」「却下」ボタン。 | [`components/mock/MockChat.tsx`](../components/mock/MockChat.tsx) |
| **Revision管理 & Undo** | 提案の baseRevision 競合検証、手動編集を維持するローカル履歴スタックと「元に戻す（Undo）」機能。 | [`lib/itineraryOps.ts`](../lib/itineraryOps.ts) |
| **旅行目安設定（非医療的）** | 歩行ペース目安（控えめ/標準/アクティブ）および静かな休憩希望の設定。健康状態の収集や安全保証を行わない旨を明示。 | [`components/mock/MockItinerary.tsx`](../components/mock/MockItinerary.tsx)<br>[`lib/mockData.ts`](../lib/mockData.ts) |
| **架空根拠（Evidence）表示** | 実在URLを捏造せず、「固定フィクションデータ」としての根拠・不確実性・保存権利を表示。 | [`components/mock/MockItinerary.tsx`](../components/mock/MockItinerary.tsx)<br>[`lib/mockData.ts`](../lib/mockData.ts) |
| **追加依存なしの純粋テスト** | Node.js 組み込みテストランナーと既存 TypeScript dev dependency により、ページと同じ TypeScript の旅程操作を検証。元実装の9件に回帰テストを追加。 | [`test/itineraryOps.test.js`](../test/itineraryOps.test.js)<br>[`scripts/register-mock-ts.cjs`](../scripts/register-mock-ts.cjs)<br>[`package.json`](../package.json) |

---

## 2. 検証結果

### 2.1 自動テスト (`npm run test:mock`)
既存の `npm test`（プレースホルダー）は保持し、新設した `npm run test:mock` (`node --test test/itineraryOps.test.js`) にて以下の9項目を自動検証しました。
- **結果**: 9 tests / 9 passed / 0 failed (所要時間 約108ms)
  1. フィクスチャ初期化と Place / Stop / Candidate の安定共有ID整合性
  2. 候補地の旅程追加および旅程からの削除（候補地リストへの復帰）
  3. 旅程アイテムの上下入れ替え（境界値チェック含む）
  4. 時刻書式バリデーション (HH:MM)、終了時刻計算、重複警告検知
  5. 休憩ブロック（kind: 'rest'）の挿入
  6. 決定論的チャットによる提案生成（自動更新を行わずドラフト留め）
  7. 提案適用と Revision 競合時の却下判定
  8. 手動編集を保持する履歴管理と Undo（元に戻す）操作
  9. 非医療的な旅行目安設定（歩行目安・静かさ希望）の反映

### 2.2 手動確認・ブラウザ検証について
- 自動ブラウザ操作・スクリーンショット取得は環境制約で未実施です。手動の実画面表示は確認済みですが、全操作・IME・モバイルの受入試験ではありません。
- 手動の表示確認と、未実施の操作試験を区別して[検証記録](MOCK_REVIEW_RESOLUTION.md)に記載しています。

---

## 3. 既知の制限事項（Scope & Limitations）

1. **ローカル状態のみ（インメモリ）**:
   - 変更内容はブラウザのメモリ内でのみ保持されます。ページ再読み込みで初期フィクスチャ状態に戻ります。永続化・エクスポート/インポートは全体設計上 Phase 1 MVP の対象ですが、今回の画面モックには含めていません。
2. **架空の座標・プレースホルダー地図**:
   - 地図は純粋なSVG幾何学プレースホルダーであり、実在のMapboxベクトルタイルや道路ネットワーク探索（Directions API）には接続していません。
3. **決定論的モックチャット**:
   - チャット応答はキーワード判別による固定ドラフト生成です。実在のLLMには接続せず、課金やAPIキーは発生しません。
4. **旅行目安の非医療性**:
   - 歩行制限や休憩希望は旅行日程上の計画目安であり、健康・身体状況の監視や移動の安全を保証するものではありません。

---

## 4. `/mock` の実行手順

1. **開発サーバー起動**:
   ```bash
   npm run dev
   ```
2. **ブラウザで開く**:
   - 固定データモック: `http://localhost:3000/mock`
   - （従来のプロトタイプ画面: `http://localhost:3000` 上部リンクからも遷移可能）
3. **ユニットテスト実行**:
   ```bash
   npm run test:mock
   ```
   （ページと同じ TypeScript をテストローダー経由で検証します。）
