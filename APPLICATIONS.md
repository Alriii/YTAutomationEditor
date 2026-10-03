# Application separation

Continuity Studio is maintained as two separate applications.

## Desktop

The desktop/local application is the existing pnpm/Turborepo workspace.

It owns:

- Next.js UI and API
- PostgreSQL project data
- MinIO object storage
- Inngest background jobs
- Google Flow browser automation
- FFmpeg rendering
- local LAN server used by the Android client

Desktop commands remain at the repository root.

## Android

The Android application lives only in `android-client/`.

It has:

- its own Gradle project
- package ID `com.continuitystudio.mobile`
- its own Android CI workflow
- Android file picker support
- Android DownloadManager integration
- downloads written to `Downloads/Continuity Studio/`

The Android APK does not package PostgreSQL, MinIO, Docker, Playwright, Flow automation, or FFmpeg.

When the Android app needs image generation or final rendering, it connects to the creator's desktop Continuity Studio server over the local network. The desktop machine performs those heavy operations.

The two applications therefore stay independently buildable and independently releasable while sharing the same project data when connected.
