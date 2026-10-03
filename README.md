# Continuity Studio

Continuity Studio is a continuity-first production workspace for long-form faceless YouTube and documentary creators.

## Production workflow

```text
Project
  -> Script
  -> Style / Master Reference
  -> Cast
  -> World
  -> Voiceover
  -> Scene Breakdown
  -> Human Scene Review
  -> Storyboard
  -> Google Flow Generation
  -> Captions
  -> Review
  -> Export
```

Scene breakdown never auto-starts image generation. The creator reviews and approves scenes first.

## Free local mode

The default local setup does not require Clerk, Neon, Cloudflare R2, or hosted Inngest.

It uses:

- PostgreSQL in Docker
- MinIO for private S3-compatible storage
- Inngest Dev Server in Docker
- one explicit local workspace user
- a zero-cost local script splitter when no Gemini key is configured
- your own signed-in `flow.google.com` browser session for image generation

Google controls Flow model availability and any Flow credits on your Google account. Continuity Studio does not create or bypass those credits.

### Quick start

Requirements:

- Node.js 24+
- pnpm 10+
- Docker Desktop, or Docker Engine + Docker Compose
- Brave, Chrome, or Edge

Install:

```bash
git clone git@github.com:Alriii/YTAutomationEditor.git
cd YTAutomationEditor
corepack enable
pnpm install
```

Start the complete free local app with one command:

```bash
pnpm local:dev
```

On Windows, you can instead double-click:

```text
START_CONTINUITY.cmd
```

It checks Node/Docker, installs dependencies when needed, then launches the same free local stack. macOS/Linux users can run `./start-continuity.sh`.

On the first run it prepares the local infrastructure automatically. On later runs it reuses the saved database/storage volumes and starts only missing app processes. It waits for Studio, Flow, FFmpeg, Inngest, and MinIO health checks before reporting Ready, then opens the Studio in your default browser.

The launcher starts or reuses:

- Continuity Studio
- Google Flow bridge
- FFmpeg render bridge
- PostgreSQL
- MinIO
- Inngest Dev Server

Under the hood, `pnpm local:start` performs the infrastructure preparation:

1. creates `apps/web/.env.local`
2. creates `packages/db/.env`
3. generates a fresh local encryption key
4. starts PostgreSQL
5. starts MinIO
6. creates the private `continuity` bucket
7. starts the Inngest Dev Server
8. generates Prisma
9. builds the local FFmpeg renderer image
10. pushes the development database schema

Once `pnpm local:dev` reports Ready, open:

```text
http://localhost:3000
```

Local mode has no sign-in screen. It uses a single local creator workspace.

The Flow bridge starts automatically. It first tries an installed Brave, Chrome, or Edge browser. If none is available:

```bash
pnpm flow:install
pnpm flow:bridge
```

On first use, sign into Google in the browser opened by the bridge and select or create the Flow project you want Continuity Studio to use.

The render bridge also starts automatically. The Export screen can render the reviewed project locally with Docker + FFmpeg and upload the finished MP4 back into the project's private storage.

Stop local infrastructure with:

```bash
pnpm local:down
```

PostgreSQL and MinIO use Docker volumes, so stopping containers does not erase project data.

### Local service addresses

| Service | Address |
| --- | --- |
| Continuity Studio | `http://localhost:3000` |
| Flow bridge | `http://127.0.0.1:4317` |
| Render bridge | `http://127.0.0.1:4318` |
| Inngest Dev UI | `http://127.0.0.1:8288` |
| MinIO API | `http://127.0.0.1:9000` |
| MinIO Console | `http://127.0.0.1:9001` |
| PostgreSQL | `127.0.0.1:5432` |

## Google Flow generation

The local Flow bridge drives the creator's own signed-in `flow.google.com` browser session.

The Flow stage exposes:

- Nano Banana 2 Lite
- Nano Banana 2
- Nano Banana Pro

For each approved scene, Continuity Studio:

1. compiles the STRICT continuity package
2. prioritizes character references, then location references, then master/style references
3. creates short-lived signed reference URLs
4. sends prompt, aspect ratio, model label, and references to the local bridge
5. uploads the references into Flow
6. submits the prompt
7. captures the resulting image
8. stores the image back in that scene's immutable render history

The Google session stays in `.flow-browser-profile/`, which is gitignored. Google credentials/cookies are not copied into the application database.

Flow is a web product, so its UI can change. The bridge is isolated so selector maintenance does not alter project/continuity data.

## Free script breakdown

In local mode, scene breakdown works with no AI API key.

The deterministic local splitter:

- preserves exact narration text
- divides narration into editable visual scenes
- estimates scene duration
- detects known characters by name
- detects known locations by name
- clearly marks scenes for human visual/factual review

If a Gemini key is configured, the richer Gemini breakdown can be used instead.

Both paths end at Human Scene Review. Neither path starts image generation.

## Creator-owned media

Creators can provide their own:

- master/style reference images
- character reference images
- location reference images
- script by paste, TXT, or Markdown
- voiceover via MP3, WAV, or M4A
- subtitles via SRT or WebVTT
- scene images

Manual scene images enter the same scene render history as Flow-generated images and can be selected/locked.

## Voiceover

The Voiceover stage keeps one active master narration track. Replacing the active track does not delete older media assets.

The upload step reads the real audio duration. That duration becomes the project timeline target, existing scene durations are proportionally fitted to it, captions can use it, Review follows it, and Export uses the same fitted timing. The Review player uses the active voiceover as its playback clock.

## Captions

Captions support:

- SRT import
- WebVTT import
- editable text
- editable start/end timing
- adding/removing cues
- free first-pass cues from scene narration/timing
- SRT download
- saved subtitle appearance

Appearance controls include:

- Documentary, Shorts/Bold, Minimal, Custom presets
- font size
- text color
- font weight
- top/center/bottom position
- background opacity
- maximum width
- optional black outline

Subtitle appearance is used in the Review player and preserved in export metadata.

The free narration-based caption pass is timing-based, not speech recognition. Review it against the actual voiceover.

## Review player and editing

The Review stage combines:

- selected scene images
- scene timing
- master voiceover
- subtitles
- subtitle styling
- image framing
- simple motion
- simple transitions

Per-scene visual controls include:

- fill frame / fit whole image
- zoom
- X/Y position
- still
- slow zoom in/out
- pan left/right/up/down
- cut
- fade through black
- fade duration

Playback follows the actual audio clock and uses `requestAnimationFrame` for smooth motion.

These edits are non-destructive. The source image is unchanged and the edit settings are stored in `Scene.mediaSettings`.

## Continuity Compiler

STRICT compilation order:

1. output contract and aspect ratio
2. Style Bible
3. historical/world constraints
4. exact CharacterVersion locks
5. exact LocationVersion lock
6. scene intent/action/camera/lighting
7. negative constraints
8. reference assets
9. generation surface/model identity

Reference priority:

```text
Characters
  -> Location
  -> Master / Style
```

## Export

Continuity Studio now has two export paths.

### Final MP4

The Export screen can render a final MP4 locally with the free FFmpeg Docker renderer.

The renderer applies:

- project aspect ratio
- fitted scene durations
- selected scene images
- saved crop/fit/zoom position
- zoom and pan motion
- cut/fade transitions
- active voiceover
- saved SRT captions
- saved subtitle appearance

Rendering happens on the creator's machine. The render bridge uploads the finished MP4 back to private project storage, where the Export screen shows an in-app video player and MP4 download link.

### Portable source ZIP

The ZIP package contains:

```text
SCENE_001.jpg
SCENE_002.jpg
...
voiceover.mp3   # or WAV/M4A when present
subtitles.srt   # when captions exist
manifest.json
```

The manifest preserves:

- scene order
- start time
- duration
- narration
- lock state
- image framing
- motion
- transitions
- voiceover filename
- subtitle filename
- subtitle style/settings

The ZIP and MP4 paths are independent, so creators can keep an editable source package even after rendering the final video.

## Hosted mode

Use `LOCAL_MODE=false` for hosted deployment.

Hosted mode supports:

- Clerk authentication
- PostgreSQL/Neon
- Cloudflare R2 or generic S3-compatible storage
- hosted Inngest
- encrypted Google Gemini BYOK for optional AI-assisted breakdown

If `S3_ENDPOINT` is configured, generic S3 storage is used. Otherwise storage falls back to R2.

## Environment variables

`pnpm local:setup` creates local environment files automatically.

For hosted deployment, use `.env.example` and configure the hosted services you select.

Useful local bridge overrides:

| Variable | Purpose |
| --- | --- |
| `FLOW_BRIDGE_PORT` | bridge port, default 4317 |
| `FLOW_ALLOWED_ORIGIN` | web origin allowed to call bridge |
| `FLOW_PROFILE_DIR` | local persistent browser profile |
| `FLOW_BROWSER_PATH` | explicit Chrome/Edge/Brave path |
| `RENDER_BRIDGE_PORT` | render bridge port, default 4318 |
| `RENDER_ALLOWED_ORIGIN` | web origin allowed to call the render bridge |
| `LOCAL_OPEN_BROWSER=false` | keep the launcher from opening the Studio automatically |

## Security

- hosted project access is server owner-scoped
- local mode uses one explicit local user
- Google Flow login stays in the local browser profile
- Flow browser profile is gitignored
- object storage remains private
- browser object access uses short-lived signed URLs
- BYOK secrets use AES-256-GCM
- scene assets are immutable
- selecting another image changes only the selection pointer
- locked scenes are skipped by automated generation
- continuity fingerprints include model/reference identity

## Verification

CI runs:

```bash
pnpm db:generate
pnpm typecheck
node --check scripts/flow-bridge.mjs
node --check scripts/render-bridge.mjs
node --check scripts/setup-local.mjs
node --check scripts/local-dev.mjs
docker compose -f docker-compose.local.yml config
docker compose -f docker-compose.local.yml build renderer
bash scripts/smoke-render.sh
pnpm test
pnpm build
```

There is intentionally no `actions/setup-node` dependency cache yet because the repository currently has no committed dependency lockfile.

## Still outside the current slice

- full professional NLE timeline
- CapCut/Premiere project exporters
- team collaboration
- marketplace
- AI video/motion generation
- FREE/BALANCED continuity compiler modes

The target is a staged Framesail-like production workflow with Continuity Studio's own continuity compiler and Google Flow as the image-generation surface.
