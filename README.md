# CoVoyager Travel Chat

[English](README.md) | [日本語](README.ja.md)

A travel planner for two (or a small group) where the chat and the map work as one. It covers both domestic and international trips. Ask the assistant something and the globe beside the chat flies to the suggestions. You mark places with each other ("crowded here", "let's skip this one"), then turn them into an itinerary you can edit.

## Features

- **Chat × map**: assistant suggestions appear as purple pins (A, B, C…). Each place is checked against OpenStreetMap and labelled *verified* or *AI estimate*.
- **Modes**: plan the itinerary, find a destination (worldwide candidates on the globe), and replan on the spot (rain, delays, closures; only that day changes, and locked stops stay).
- **Itinerary editing**: day tabs, drag to reorder, fixed start times, durations, rests, costs, notes, moving stops between days, lock, and undo/redo.
- **Routing**: walking, cycling and driving legs via OSRM. Transit is a labelled estimate.
- **Together**: want / either way / skip reactions, shared place notes, an agreement board, and per-person conditions (walking limit, rest interval, daily budget, avoid crowds or heat…). Conditions are checked in code, never relaxed by the AI.
- **Privacy**: each condition is either shared or private. Private conditions never appear on the partner's screen, in share links or in exports. They reach the AI only with the owner's consent, and without the owner's name.
- **Sharing**: live sync between two devices through an invite link, or a snapshot link. JSON export/import, and wiping everything stored on the device.
- **Split plans**: pick who joins each stop. That stretch is scheduled per person in parallel, and the next shared stop is marked as the meeting point.
- **Booklet**: a printable trip booklet (print or save as PDF).
- **Weather**: Open-Meteo forecast for the trip days (from 16 days before).
- **Responsive**: 3 columns on desktop, 2 on tablet, map plus tabs on phones.

See [docs/RESEARCH.md](docs/RESEARCH.md) for the competitor survey. It also explains why the map uses MapLibre instead of Globus: Globus is a native iOS/Android SDK with no web support.

## Getting started

```sh
npm install
cp .env.example .env.local   # set OPENAI_API_KEY (empty = demo responder)
npm run dev
```

Maps, search, routing and weather need no keys. Without `OPENAI_API_KEY` the app answers with fixed demo data at no cost. Configuration options are listed in [.env.example](.env.example) and the Japanese README. Set `APP_ACCESS_CODE` on any public deployment so strangers cannot spend your API credit.

`npm run typecheck`, `npm test` (Vitest, fictional fixtures, no network), `npm run build` and `npm run e2e` (Playwright, desktop and mobile, demo mode) run in CI on every push.
