# CoVoyager Travel Chat

[English](README.md) | [日本語](README.ja.md)

Map-linked conversational planning for editable domestic and international trips.
Repository: [moruku36/covoyager-travel-chat](https://github.com/moruku36/covoyager-travel-chat).

## Current status

This is an early Next.js Pages Router / React prototype with a Mapbox map and a chat panel. Map and chat state are not connected. Structured itinerary editing, persistence, collaboration, live travel data, and Azure integration are not implemented. The chat uses legacy OpenAI completion endpoints. This is not a completed Phase 1 MVP or a production-ready service.

The 2026-10-14 change preserves code and Git history, changes the product/repository name, and adds design documents. It does not implement the roadmap, deploy a service, enable billing, or change authentication.

## Design and roadmap

Local fixed-data screen mock: run `npm run dev` and open `/mock`. It uses fictional fixtures and a local map placeholder, with no Mapbox/LLM connection. `npm run test:mock` checks the canonical TypeScript operations. [Implementation](docs/MOCK_IMPLEMENTATION_REPORT.md) and [review/validation](docs/MOCK_REVIEW_RESOLUTION.md) distinguish this preview from the full MVP. Browser interaction verification remains pending.

- [Overall design (Japanese)](docs/DESIGN.md): architecture, data model, API, freshness, costs, privacy, tests, migration, and open decisions.
- [Phase 1–3 roadmap (Japanese)](docs/ROADMAP.md): scope, exclusions, acceptance criteria, and release gates.
- [Rename and verification record (Japanese)](docs/CHANGE_RECORD.md): baseline, affected references, and remaining work.

Phase 1 connects map, chat, and an editable itinerary. Phase 2 supports each companion's required/preferred conditions, rest, separate activities/rooms, budgets, and explicit agreement on conflicts. Phase 3 adds consent-based optional personal accommodations and replanning during travel. Optional health-related information is minimized, private by default, and never automatically shared with companions. The service does not diagnose or guarantee safety. Public examples are fictional.

## Local development

```sh
git clone https://github.com/moruku36/covoyager-travel-chat.git
cd covoyager-travel-chat
npm ci
npm run dev
```

These are existing development commands, not proof that the legacy chat works. Review [security migration](docs/DESIGN.md#8-セキュリティとプライバシー) before using credentials or personal data: the browser code still references `NEXT_PUBLIC_OPENAI_API_KEY`. The owner reported the old OpenAI key revoked; `.env.local` and `.next` artifacts have been removed from the current Git tree, while prior Git history remains. Copy the empty [.env.example](.env.example) locally and keep the legacy public LLM variable empty until server-side migration. Do not set a new LLM secret in a public environment variable. Only a scoped, URL-restricted public Mapbox token belongs in the browser. No external API call is needed to review the design.

`npm run build` is the existing build command. `npm test` currently exits with “no test specified”; a test suite is planned. Dependency updates, artifact cleanup, credential remediation, and provider selection require separate implementation work.
