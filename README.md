# Echotron (vocal-text-bridge)

Diarized voice-note transcription. Drop in an audio file, get back a
speaker-labeled transcript with auto-suggested speaker names, then save it,
browse past transcriptions, and see an estimated cost breakdown — as a web
app or as a standalone Windows desktop app ("Echotron").

## Overview

- **Frontend:** React 18 + Vite + TypeScript, shadcn/ui, Tailwind CSS.
- **Backend:** Node/Express server (`server/`) that talks to
  [Sarvam AI](https://www.sarvam.ai/):
  - `saaras:v3` (batch speech-to-text API) for transcription + speaker
    diarization — tuned for Indian languages and Hindi/English code-switching.
  - `sarvam-105b` (chat completions) to suggest human-readable names/roles for
    the raw speaker labels the diarization step produces.
- **Desktop app:** an Electron shell (`electron/`) around the same
  frontend/backend, packaged with `electron-builder`.

Transcripts, saved-file history, and app settings are stored locally
(`server/data/` in dev, `%APPDATA%\Echotron\` when running as the packaged
desktop app) — nothing is sent anywhere except the Sarvam API calls needed to
transcribe and name speakers.

## Prerequisites

- Node.js v18+
- A [Sarvam AI](https://dashboard.sarvam.ai) API key

## Setup

1. Clone the repository:
   ```sh
   git clone https://github.com/mohitshukla02/vocal-text-bridge.git
   cd vocal-text-bridge
   ```
2. Install frontend dependencies:
   ```sh
   npm install
   ```
3. Install backend dependencies:
   ```sh
   cd server && npm install && cd ..
   ```
4. Configure your API key — copy `.env.example` to `.env` in the project
   root and fill in `SARVAM_API_KEY`:
   ```sh
   cp .env.example .env
   ```

## Running it

**As a web app** (two terminals):
```sh
npm run dev              # frontend, http://localhost:8080
```
```sh
cd server && npm run dev # backend, http://localhost:5075 (proxied by Vite)
```

**As a desktop app**, in dev mode (runs both of the above plus an Electron
window pointed at them):
```sh
npm run electron:dev
```

## Building a desktop installer

```sh
npm run dist
```
Produces a Windows installer (NSIS) under `release/` via `electron-builder`.
The packaged app reads its config from `%APPDATA%\Echotron\.env`, created
automatically (with a placeholder key) on first launch — edit that file to
add your real `SARVAM_API_KEY` before transcribing.

## Environment variables

See `.env.example` for the full list. The only required one is
`SARVAM_API_KEY`; everything else (model names, host, language, port) has a
sensible default.

## License

**All rights reserved.** This project and its contents are strictly private.
Unauthorized copying, modification, distribution, or use of this project, via
any medium, is strictly prohibited.
