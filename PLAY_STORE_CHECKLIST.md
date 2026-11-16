# MiniAI — Google Play release checklist

## Current release state

- [x] Android app targets API 36 (required for new Google Play apps from 31 August 2026).
- [x] Android 2.2 debug APK builds successfully in GitHub Actions.
- [x] Android assistant invocation opens MiniAI and focuses the chat composer; it does not implement an always-listening wake word or all Gemini system features.
- [x] WebView navigation is restricted to the MiniAI origin; external HTTPS links open outside the app; Safe Browsing is enabled where supported.
- [x] Camera permission removed because the current app does not use camera capture.
- [x] Public privacy policy: https://miniai-ai.pages.dev/privacy.html
- [x] External account-deletion page: https://miniai-ai.pages.dev/delete-account.html
- [x] In-app account deletion removes the account, sessions, rating, and feedback.
- [x] In-app report control submits an AI response excerpt for review.
- [x] Worker and D1 migration deployed; AI and D1 bindings verified.
- [ ] Signed release AAB. The current CI run produced a debug APK only because the upload keystore secrets are not configured.
- [ ] Install and test on physical Android devices, including the assistant shortcut, keyboard resizing, voice permission, file picker, media tools, reporting, and account deletion.
- [ ] Test AI safety and moderation thoroughly. The system prompt is a safeguard, not a guarantee; report handling needs a real review process.
- [ ] Complete Play Console Data safety, content rating, target audience, app access, and privacy declarations.
- [ ] Prepare store assets: 512×512 app icon, 1024×500 feature graphic, and current phone screenshots.
- [ ] Submit to an appropriate testing track before production.

## Draft Play Store listing

**Suggested title:** MiniAI - AI Chat & Create

**Short description:** Chat, ask questions, write, search and create images with MiniAI.

**Full description:**

MiniAI is a free AI assistant for everyday questions and creative work.

- Chat with an AI assistant for explanations, writing, brainstorming, and coding help.
- Look up current information when web search is used.
- Generate images and edit images with AI.
- Use built-in media tools for basic video editing and motion effects.
- Dictate messages with voice input where your device and browser support it.
- Keep conversation history on your device and customize the assistant.

MiniAI requires an internet connection for AI chat and online tools. Some features depend on provider availability and usage limits. AI responses can be inaccurate or incomplete; verify important information. MiniAI is not intended for emergencies or as a replacement for professional advice.

## Signing the Play release

Google Play expects a signed Android App Bundle (`.aab`). The CI workflow is configured to build it when the following GitHub repository secrets are present:

- `MINIAI_UPLOAD_KEYSTORE_BASE64`
- `MINIAI_UPLOAD_KEYSTORE_PASSWORD`
- `MINIAI_UPLOAD_KEY_ALIAS`
- `MINIAI_UPLOAD_KEY_PASSWORD`

Keep the keystore and passwords private. Never commit them to the repository or send them in chat. The APK published by the current CI workflow is debug-signed and intended for testing, not Play Store upload.

## Account and testing requirements

A Google Play Console developer account holder must be at least 18 years old. The current one-time registration fee is US$25. A parent or guardian would need to own and manage the developer account; do not enter a false age or identity. For new personal developer accounts created after 13 November 2023, Google requires a closed test with at least 12 testers opted in continuously for 14 days before production access can be requested.

## Privacy and Data safety review notes

The app stores local chat history and preferences on the device. Chat prompts, recent conversation context, and user-selected attachments are sent to MiniAI's Cloudflare Worker and Cloudflare Workers AI to generate answers. Search requests may involve external search providers. Optional accounts store account names, salted password hashes, hashed session tokens, ratings, and optional feedback in Cloudflare D1. AI response reports store the selected response excerpt and category. Voice input relies on browser/OS speech-recognition services and must be described accurately in the Data safety form. Review the actual providers and their current terms before submission.

## Physical-device test checklist

- [ ] Fresh install and upgrade from the current public APK.
- [ ] Chat send, streaming response, scrolling, keyboard resize, and rotation.
- [ ] Android assistant selection and long-press power-button invocation.
- [ ] Voice input permission is requested only after the user starts voice input; text chat works without it.
- [ ] Image generation, image editing, file selection, and supported media exports.
- [ ] Report button stores a report and shows a success/failure message.
- [ ] Account creation, sign-in, sign-out, in-app deletion, and external deletion.
- [ ] Privacy policy and account-deletion pages open correctly.
- [ ] Offline state, slow network, provider errors, and API rate limits show understandable errors.
- [ ] Accessibility checks, including screen reader labels, contrast, and large text.
