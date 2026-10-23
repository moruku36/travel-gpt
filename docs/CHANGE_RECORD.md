# 名称変更・設計の変更記録

日付: 2026-10-14。基準: main `80556a15d6ee1e2ea8f329180756a9592e7723d9`。

## 変更範囲

- 表示名: CoVoyager Travel Chat。旧 README の Co-Voyageur 表記と画面見出しを統一。
- GitHub slug: `travel-gpt` → `covoyager-travel-chat`。
- 正式 URL: https://github.com/moruku36/covoyager-travel-chat
- README 英語/日本語、clone URL、package name/description/repository/homepage、lock root name、画面見出し・browser title を更新。
- [全体設計](DESIGN.md)、[Phase 1〜3 ロードマップ](ROADMAP.md)を追加。現状と将来機能を区別し、一般化した要件と架空例のみ使用。
- 依存 version、実行ロジック、LICENSE、過去 commit、既存環境/生成物は保持。フル実装、デプロイ、課金、認証変更、ダッシュボード操作は対象外。

## 調査・影響

- 地図と chat は未連動、旅程モデル・編集・永続化なし。API ファイルは正規 handler ではない。README の Azure/ライブ情報は実装根拠なし。
- 基準 commit では `.env.local`、`.next`、`node_modules` が追跡されていた。下記の追加対処で `.env.local`/`.next` を現行ツリーから除去した。`node_modules` は今回の対象外。公開 LLM キー参照は P1 準備で server に移す。
- ソース・metadata の名称参照を調査。生成物と依存の内部 name は改名対象外。リポジトリ内の Actions workflow/旧 repo を使う action 参照は検出されず、dependabot 設定のみ。Pages API は 404 を返し、有効な Pages サイトを確認できなかった。
- GitHub main は調査時点で protected=false。rename API は repository ID `672184279`、新 name/URL、default branch `main` を返し成功。履歴を別リポジトリにコピーしていない。
- GitHub の通常 URL/Git redirect は旧名を再利用すると失われる。各利用者は `git remote set-url origin https://github.com/moruku36/covoyager-travel-chat.git` を実行。外部 webhook/hosting/CI/ダッシュボードのリンクは担当者確認が必要で、この変更で操作しない。
- Mapbox 公式の対応地域・保存条件・経路制限を設計へ反映。国内 POI と永続保存は provider 選定が必要。
- GitHub hooks 読取りは空配列、deployments 読取りは 0 件。外部アプリ内の設定を網羅的に保証するものではない。

## 公開前検証の記録

公開差分を 8 ファイルに限定し、以下を確認した。commit と main 読戻し結果は完了報告で示す。

| 点検 | 結果 |
| --- | --- |
| package/lock JSON の parse と root name 一致 | PASS |
| 依存・devDependencies・scripts・version、lock dependency subtree の baseline 比較 | 変更なし |
| README/doc の相対ファイルリンクと UTF-8 replacement 文字 | PASS |
| 画面見出し、browser title、JSX parser | PASS |
| `git diff --check` | 空白エラーなし |
| 追加内容のキー形式・既存環境値との照合（値は出力しない） | 検出なし |
| 文書/差分の目視点検 | 一般化要件と架空例のみ、実人物の健康/交際事情なし |
| `npm test` | exit 1、既存の `no test specified`。suite 未設定 |

構成図は Mermaid とテキストで表す。実 API 呼出、live 機能、build の成功は主張しない。生成物への環境値の再混入を避け、今回 build は実行しない。名称/文書変更の検証と将来機能のテストを区別する。既存ファイル/履歴全体が秘密を含まないという保証はしていない。

## 残件

1. P1 準備: 履歴残存と再混入防止の維持、server 専用キーへの移行、依存/API 更新、保存許諾付き provider、mock test/費用 guard。旧キーは本人申告で失効済み、現行ツリー除去済みとして区別する。
2. P1〜P3 のすべての機能実装と受入検証。
3. 具体予算、運用担当、対応都市/交通、LLM/DB/認証、P3 同意/保持条件。
4. 外部連携の URL 更新は担当者へ引継ぎ。ダッシュボードは別担当が管理。

main への反映は履歴を保持した追加 commit で行い、force push・history rewrite をしない。コード rollback は revert、改名 rollback は外部リンク影響を見て管理者判断とする。

## 追加対処: 失効済みキーの現行ツリー除去

2026-10-14、本人が旧 OpenAI キーは失効済みと申告し、削除を依頼した。失効状態を実 API に送って試してはいない。

- `.env.local` 1 ファイルと `.next` の生成物/cache 60 ファイル、計61ファイルを Git 追跡解除。秘密を含む削除差分はログやチャットへ表示しない。
- ローカル環境の OpenAI 値を空にし、Mapbox 公開トークンの設定は維持。元の環境ファイルと生成物は repository の外に復元用として保持し、不可逆消去をしない。バックアップを Git へ追加しない。
- `.env.*` を ignore し、値のない `.env.example` だけ例外。既存の `.next` ignore と合わせて再混入を防ぐ。サンプルは server 移行が未実装であることを明記。
- 今回、Mapbox トークンの失効/変更、依存更新、API 実装、課金、認証変更、履歴書換えはしない。
- 値を表示しない照合で、ステージ済みツリー全体に旧 OpenAI 値がないこと、61対象ファイルの追跡解除、現行 `.next` の不在、ローカル旧 LLM 値が空、Mapbox 設定の不変を確認した。空サンプル、ignore、秘密を含まない追加内容、空白検査も PASS。公開 main の tree/blob 読戻しと commit は完了報告で示す。
- 過去履歴と非公開の復元用コピーには値が残る。除去前 commit を単純 revert すると再露出するため、環境/生成物を復活させずに必要な変更だけ戻す。失効済みという本人申告と、今回の現行ツリー除去という検証結果は別の事実として記録する。

## 2026-10-24: Phase 1〜2 の実装と P3 の一部

- 旧試作（`pages/index.jsx`、`components/Chat.tsx`、空の `TravelForm`、未接続の `generatePlan.ts`、`public/styles.css`）を置き換え。ブラウザから OpenAI を直接呼ぶ経路と `NEXT_PUBLIC_OPENAI_API_KEY` 参照を削除し、キーは server の `OPENAI_API_KEY` だけで扱う。
- 依存: `mapbox-gl` `axios` `dotenv` を削除、`maplibre-gl` `zod` `@dnd-kit/*` `vitest` を追加。dependabot を npm / github-actions で有効化。
- 地図 provider を Mapbox から MapLibre + OpenFreeMap + OSM 系 API に変更（Mapbox トークン不要）。Globus は Web 非対応のため不採用（[調査メモ](RESEARCH.md)）。
- テストは架空 fixture のみ。外部 API は CI で呼ばない（geocode / LLM はテストで差し替え）。
- 開発環境の制約: 作業端末から npm registry へ TLS 接続できなかったため、依存解決・型チェック・ビルドは GitHub Actions 上で実施し、lockfile は CI の成果物から取り込んだ。
