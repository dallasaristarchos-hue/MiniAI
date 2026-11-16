# MiniAI 2.0

## What's new
- Anonymous 1–5 star ratings with an optional short feedback note.
- Live community rating summary. Ratings can be updated from the same browser installation.
- Persistent ratings stored in a Cloudflare D1 database in the EU region. No names or email addresses are requested.
- Refreshed installable PWA cache version and app assets.
- Android app build updated to version 2.0 with Kotlin compilation configured.
- Android WebView now supports file selection and asks for microphone/camera permission only when a web feature requests it.

## Privacy
The rating feature stores a random browser-generated ID, the selected star value, optional feedback, and a timestamp. It does not ask for a name or email. Users should not include personal information in feedback.

## Release checks
JavaScript syntax, required rating UI elements, and Worker route wiring are checked before deployment. The Android APK must still pass its GitHub Actions build before its download can be marked ready.
