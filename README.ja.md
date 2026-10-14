# CoVoyager Travel Chat

[English](README.md) | [日本語](README.ja.md)

地図を見ながらチャットで相談し、国内・海外の編集可能な旅程を作るサービスを目指します。
リポジトリ: [moruku36/covoyager-travel-chat](https://github.com/moruku36/covoyager-travel-chat)。

## 現状

Next.js Pages Router / React の初期試作です。Mapbox 地図とチャット画面はありますが、相互連動、構造化された旅程編集、永続化、同行者との合意調整、リアルタイム情報、Azure 連携は未実装です。チャットは旧 OpenAI completion エンドポイントを参照しています。Phase 1 MVP の完成や本番利用可能性を意味しません。

今回の変更はコードと Git 履歴を保持した名称変更と設計文書追加です。フル実装、新規デプロイ、課金、認証変更は行いません。

## 設計

- [全体設計](docs/DESIGN.md): 構成図、データモデル、API、鮮度・根拠・不確実性、費用上限、セキュリティ、テスト、移行、未決事項。
- [Phase 1〜3 ロードマップ](docs/ROADMAP.md): 各 Phase の対象・非対象・受入基準。
- [名称変更と検証記録](docs/CHANGE_RECORD.md): 現状調査、影響範囲、残件。

Phase 1 は地図＋チャット＋編集可能な旅程。Phase 2 は同行者それぞれの必須・希望条件、休息、別行動・別室、予算や条件衝突の合意調整。Phase 3 は同意ベースの任意の高度な個別配慮と現地での代替案・再計画です。
健康関連情報は任意・最小収集・非公開を基本に、各自の同意で扱い、同行者へ自動共有しません。診断や安全保証はしません。公開サンプルは架空です。

## 開発

```sh
git clone https://github.com/moruku36/covoyager-travel-chat.git
cd covoyager-travel-chat
npm ci
npm run dev
```

既存の開発コマンドであり、旧チャットの動作を保証しません。実データや新しいキーを使う前に[セキュリティ移行](docs/DESIGN.md#8-セキュリティとプライバシー)を実施してください。旧 OpenAI キーは本人申告で失効済みです。`.env.local` と `.next` は現行 Git ツリーから除去しましたが、過去履歴は残ります。値のない [.env.example](.env.example) をローカル用にコピーし、server 移行までは既存の公開 LLM 変数を空にしてください。ブラウザ公開用キー参照自体は残っているため、LLM 秘密キーを `NEXT_PUBLIC_` へ設定しないでください。地図には最小権限・URL 制限付きの公開 Mapbox トークンだけを使います。

`npm run build` は既存のビルドコマンド、`npm test` は未設定で終了するプレースホルダーです。依存更新、キー対処、生成物整理、提供者選定は別途実装します。
