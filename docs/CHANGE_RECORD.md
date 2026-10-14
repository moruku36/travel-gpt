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
- `.env.local`、`.next`、`node_modules` が既に追跡されている。値や生成物を新しい差分へ転載せず、キー対処/追跡解除は別変更へ。公開 LLM キー参照は P1 準備で server に移す。
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

1. P1 準備: 既存キーの影響判断、生成物追跡整理、依存/API 更新、保存許諾付き provider、mock test/費用 guard。
2. P1〜P3 のすべての機能実装と受入検証。
3. 具体予算、運用担当、対応都市/交通、LLM/DB/認証、P3 同意/保持条件。
4. 外部連携の URL 更新は担当者へ引継ぎ。ダッシュボードは別担当が管理。

main への反映は履歴を保持した追加 commit で行い、force push・history rewrite をしない。コード rollback は revert、改名 rollback は外部リンク影響を見て管理者判断とする。
