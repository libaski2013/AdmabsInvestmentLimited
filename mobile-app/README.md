# ADMABS Mobile

Mobile-first ADMABS client using the same production API, MongoDB records, JWT roles, branch/outlet scope and server timestamps as the web application.

## Development

1. `npm install`
2. Copy `.env.example` to `.env` when using a different API.
3. `npm run dev`

## Native builds

- Android: `npx cap add android`, then `npm run android`
- iOS (requires macOS/Xcode): `npx cap add ios`, then `npm run ios`

Never embed administrator passwords in the app. Users authenticate against the central ADMABS server.
