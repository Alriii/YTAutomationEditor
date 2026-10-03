# Continuity Studio

Continuity Studio is a continuity-first SaaS for long-form faceless documentary and YouTube creators. It turns a versioned script into human-reviewed scenes, compiles locked style/cast/world constraints into each scene, estimates generation cost, runs durable image jobs, preserves render history, and exports portable scene assets.

## MVP pipeline

```text
Script
  -> Scene Breakdown
  -> Human Scene Review
  -> STRICT Continuity Compilation
  -> Cost Estimate
  -> Explicit Generate Action
  -> Per-scene Image Jobs
  -> Storyboard
  -> ZIP Export
```

Breakdown never starts image generation. Any edit to scene continuity after approval invalidates the previous estimate because the generate endpoint recomputes the continuity fingerprints and compares the estimate hash.

## Workspace

```text
apps/
  web/          Next.js 16 application, route handlers, Inngest functions

packages/
  ai/           Continuity compiler, pricing, OpenAI/fal adapters
  db/           Prisma schema and PostgreSQL client
  shared/       Zod schemas and shared domain types
```

The project intentionally starts with four workspace units. Storage and job code remain inside the web application until a separate deployment boundary is actually needed.

## Requirements

- Node.js 24+
- pnpm 10+
- PostgreSQL (Neon works well)
- Clerk application
- Cloudflare R2 bucket with S3-compatible credentials
- Inngest account or local Inngest dev server
- OpenAI and/or fal.ai API key, supplied either by the platform or by the user through BYOK

## Local setup

1. Clone the repository.

```bash
git clone git@github.com:Alriii/YTAutomationEditor.git
cd YTAutomationEditor
```

2. Install dependencies.

```bash
corepack enable
pnpm install
```

3. Create local environment variables.

```bash
cp .env.example .env
```

Generate the BYOK encryption key with:

```bash
openssl rand -base64 32
```

Do not rotate `ENCRYPTION_KEY_BASE64` without a credential migration. Existing BYOK secrets are AES-256-GCM encrypted with this key.

4. Generate the Prisma client and create the development schema.

```bash
pnpm db:generate
pnpm db:push
```

For production, create and review a Prisma migration before deployment instead of relying on `db push`.

5. Run the app.

```bash
pnpm dev
```

The web app is available at `http://localhost:3000`.

6. Run Inngest locally if you are not using the hosted dev connection.

The application exposes the Inngest handler at:

```text
/api/inngest
```

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | yes | Application origin |
| `ENCRYPTION_KEY_BASE64` | yes | 32-byte AES key for BYOK credentials |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | yes | Clerk browser key |
| `CLERK_SECRET_KEY` | yes | Clerk server key |
| `DATABASE_URL` | yes | PostgreSQL connection |
| `R2_ACCOUNT_ID` | yes | Cloudflare account |
| `R2_ACCESS_KEY_ID` | yes | R2 S3 key |
| `R2_SECRET_ACCESS_KEY` | yes | R2 S3 secret |
| `R2_BUCKET` | yes | Private object bucket |
| `INNGEST_EVENT_KEY` | production | Inngest event key |
| `INNGEST_SIGNING_KEY` | production | Inngest signing key |
| `OPENAI_API_KEY` | optional | Platform OpenAI fallback |
| `FAL_KEY` | optional | Platform fal.ai fallback |

If a creator stores a BYOK key, that encrypted user credential takes precedence over the platform fallback.

## Security model

- All project reads and mutations are owner-scoped on the server.
- R2 remains private. Upload and preview access use short-lived signed URLs.
- BYOK credentials are AES-256-GCM encrypted and never returned after save.
- Generation jobs use deterministic continuity fingerprints and idempotency keys.
- The cost estimate is recomputed before generation. A stale estimate is rejected.
- Platform credits use an append-only reservation/release/capture ledger.
- Failed jobs release reserved credits.
- Scene assets are immutable. Selecting a new render changes only the selection pointer.
- Locked scenes are skipped by batch generation.

## Continuity Compiler

The compiler assembles a generation package from:

1. Output contract and aspect ratio
2. Versioned Style Bible
3. Exact CharacterVersion rows attached to the scene
4. Exact LocationVersion attached to the scene
5. Scene visual intent and camera/lighting notes
6. Global negative constraints
7. Private reference asset metadata
8. Provider/model information used for the fingerprint

GenerationJob stores the resulting continuity snapshot, so a running job is not affected by later edits.

## Credits

Internally, 100 credits represent roughly USD 1.00 of metered platform usage. Provider pricing is an estimate until the provider reports actual usage.

BYOK image generations reserve zero platform inference credits in the MVP. Platform-managed generations require sufficient cached balance and settle through the append-only UsageLedger.

## Export format

A completed export ZIP contains:

```text
SCENE_001.jpg
SCENE_002.jpg
...
manifest.json
```

Images are normalized to JPEG during export. The manifest contains scene order, narration, start time, duration hint, and lock state.

## Verification

```bash
pnpm db:generate
pnpm typecheck
pnpm test
pnpm build
```

GitHub Actions runs generation, type checking, and tests on pushes to `main` and pull requests.

## Deliberately not implemented yet

- Voiceover UI
- Video/motion models
- CapCut/Premiere exporters
- Full NLE timeline
- Team collaboration
- Marketplace
- Google Flow browser automation
- FREE/BALANCED continuity modes

These remain outside the first shippable vertical slice.
