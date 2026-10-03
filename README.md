# Continuity Studio

Continuity Studio is a continuity-first production workspace for long-form faceless YouTube and documentary creators.

Its main job is not merely generating images. It keeps a project moving through a staged workflow while preserving visual identity across dozens of scenes.

## Current workflow

```text
Project
  -> Script (paste or import TXT/Markdown)
  -> Style / Master Reference
  -> Cast
  -> World
  -> Voiceover (upload MP3/WAV/M4A)
  -> Scene Breakdown
  -> Human Scene Review
  -> Storyboard
  -> Google Flow Generation
  -> Captions (import SRT/VTT or auto-build from narration)
  -> Review Player
  -> Export
```

Scene breakdown never starts image generation automatically.

The creator must review and approve scenes first. Google Flow generation is a separate explicit stage.

## Google Flow generation

Continuity Studio now includes a local Flow bridge for `flow.google.com`.

The bridge runs only on the creator's computer and drives a persistent Playwright browser profile. Google sign-in remains inside that local browser profile. Continuity Studio does not ask for or store the creator's Google password or Flow cookies in the database.

The Flow screen currently exposes:

- Nano Banana 2 Lite
- Nano Banana 2
- Nano Banana Pro

The model labels are the Flow product labels, not Gemini API IDs.

For each approved scene, Continuity Studio:

1. Compiles the STRICT continuity package.
2. Prioritizes character references, then location references, then style/master references.
3. Creates temporary signed reference URLs.
4. Sends the prompt, aspect ratio, model choice, and references to the local Flow bridge.
5. The bridge opens the creator's existing Flow project.
6. It selects Image mode and the selected Nano Banana model.
7. It uploads reference ingredients.
8. It submits the image prompt.
9. It captures the generated image.
10. Continuity Studio stores that image in the matching scene's immutable render history.

### Start the local Flow bridge

Install Playwright Chromium once:

```bash
pnpm flow:install
```

Then run the bridge in a second terminal:

```bash
pnpm flow:bridge
```

The bridge listens only on:

```text
http://127.0.0.1:4317
```

The default allowed web origin is:

```text
http://localhost:3000
```

The persistent browser profile is stored in:

```text
.flow-browser-profile/
```

That folder is intentionally gitignored because it may contain the creator's Google session.

Flow's UI can change over time. The bridge therefore uses resilient visible-text/role selectors, but it remains a browser integration rather than a public Google API and may occasionally need selector maintenance.

## Creator-owned inputs

The project does not force creators to use generated material.

Creators can provide their own:

- Master/style reference images
- Character reference images
- Location reference images
- Script
- Voiceover
- Subtitle file
- Scene images

Uploaded scene images join the same scene asset history as generated Flow images and can become the selected/locked render.

## Voiceover

The Voiceover stage accepts:

- MP3
- WAV
- M4A

The active voiceover is stored as a project track and is available in the Review player.

Uploading a replacement changes the active track while older media remains in asset history.

## Captions

The Captions stage supports:

- SRT import
- WebVTT import
- Editable start/end times
- Editable text
- Adding/removing cues
- SRT download
- Free first-pass caption generation from storyboard narration and scene durations

The free auto-caption pass is timing-based, not speech recognition. It is intended as an editable starting point and should be checked against the voiceover.

## Review player

The Review stage combines:

- Selected scene images
- Scene timing
- Master voiceover
- Subtitle cues

It provides:

- Play/pause
- Seeking
- Scene switching
- Subtitle overlay
- Timeline thumbnails
- Current narration/caption inspector

This is a lightweight rough-cut review surface, not a full NLE.

## Workspace

```text
apps/
  web/          Next.js application, APIs, review UI, Inngest jobs

packages/
  ai/           Continuity compiler and structured scene planning
  db/           Prisma schema and PostgreSQL client
  shared/       Zod schemas, subtitle parser/exporter, domain types

scripts/
  flow-bridge.mjs
```

## Requirements

- Node.js 24+
- pnpm 10+
- PostgreSQL
- Clerk
- Cloudflare R2 or compatible S3 storage
- Inngest for durable server jobs
- Chromium for the local Flow bridge

A Gemini API key is optional for script-breakdown assistance. Image generation through the visible product workflow uses the local Flow bridge.

## Local setup

Clone and install:

```bash
git clone git@github.com:Alriii/YTAutomationEditor.git
cd YTAutomationEditor

corepack enable
pnpm install
```

Create local environment variables:

```bash
cp .env.example .env
```

Generate the credential-encryption key:

```bash
openssl rand -base64 32
```

Generate Prisma and create the development schema:

```bash
pnpm db:generate
pnpm db:push
```

Run the web app:

```bash
pnpm dev
```

For Flow generation, in another terminal:

```bash
pnpm flow:install
pnpm flow:bridge
```

Open:

```text
http://localhost:3000
```

On first Flow use, the bridge opens a browser. Sign into Google there and create/select the Flow project you want Continuity Studio to use.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | yes | Application origin |
| `ENCRYPTION_KEY_BASE64` | yes | 32-byte AES key for stored BYOK credentials |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | yes | Clerk browser key |
| `CLERK_SECRET_KEY` | yes | Clerk server key |
| `DATABASE_URL` | yes | PostgreSQL connection |
| `R2_ACCOUNT_ID` | yes | Cloudflare account |
| `R2_ACCESS_KEY_ID` | yes | R2 S3 key |
| `R2_SECRET_ACCESS_KEY` | yes | R2 S3 secret |
| `R2_BUCKET` | yes | Private object bucket |
| `INNGEST_EVENT_KEY` | hosted Inngest | Inngest event key |
| `INNGEST_SIGNING_KEY` | hosted Inngest | Inngest signing key |
| `GEMINI_API_KEY` | optional | Structured script-breakdown assistance |
| `FLOW_BRIDGE_PORT` | optional | Local bridge port, defaults to 4317 |
| `FLOW_ALLOWED_ORIGIN` | optional | Web origin allowed to call the bridge |
| `FLOW_PROFILE_DIR` | optional | Custom local browser-profile folder |

## Security model

- Project queries are owner-scoped on the server.
- R2 assets remain private and use short-lived signed URLs.
- Provider credentials are encrypted with AES-256-GCM.
- Google Flow login stays in the local Playwright profile.
- The Flow profile is gitignored.
- Flow reference URLs expire.
- Scene assets are immutable.
- Selecting a new image changes only the selection pointer.
- Locked scenes are skipped by automated generation passes.
- Continuity fingerprints include provider/model/reference identity.

## Continuity Compiler

The STRICT compiler assembles each scene from:

1. Output contract and aspect ratio
2. Versioned Style Bible
3. Exact CharacterVersion rows
4. Exact LocationVersion
5. Scene visual intent
6. Shot/camera/lighting notes
7. Negative constraints
8. Master/style/character/location references
9. Provider/model identity

Reference ordering is intentional:

```text
Characters
  -> Location
  -> Master / Style
```

If a generation surface limits ingredient count, identity continuity wins first.

## Export

The current ZIP export contains normalized scene images and a manifest:

```text
SCENE_001.jpg
SCENE_002.jpg
...
manifest.json
```

The in-app Review player already combines voiceover and subtitles for review. A final rendered MP4 exporter remains a later step.

## Verification

```bash
pnpm db:generate
pnpm typecheck
pnpm test
pnpm build
```

GitHub Actions runs all four checks on `main`.

## Not built yet

- Full professional NLE timeline
- Final MP4 rendering
- CapCut/Premiere project exporters
- Team collaboration
- Marketplace
- Video/motion generation
- FREE/BALANCED continuity modes

The current target remains the staged Framesail-like production workflow with Continuity Studio's own continuity compiler and Google Flow as the image-generation surface.
