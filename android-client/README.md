# Continuity Studio Android client

This is the native Android shell for Continuity Studio.

It is designed for Android 8+ and specifically tested by CI against the Android 35 SDK. The full production backend still runs on the creator's PC.

## Samsung S23 setup

1. On the PC, start Continuity Studio with `START_CONTINUITY.cmd` or `pnpm local:dev`.
2. Wait for the terminal to show `Phone/APK http://<LAN-IP>:3000`.
3. Keep the phone and PC on the same private Wi-Fi.
4. Open the Android app and enter that Phone/APK URL.
5. File uploads use Android's normal document picker.
6. MP4 and ZIP downloads are sent to:
   `Downloads/Continuity Studio/`

No access to `/Android/data` is required.

Google Flow automation and FFmpeg rendering continue to run on the PC. The Android app talks to them through Continuity Studio's local server proxy.
