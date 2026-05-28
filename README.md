# RoadSoS - Emergency Response App

An emergency response application built with React Native (Expo) that helps users in critical situations.

## Features

- **Drive Monitoring** - Real-time speed tracking and road risk detection
- **Emergency SOS** - Quick 3-second hold to activate emergency response
- **Voice Recognition** - Wake-word detection for hands-free SOS activation
- **Emergency Broadcast** - Multi-channel alerts via WhatsApp, SMS, and more
- **Hospital Routing** - AI-powered hospital selection based on severity and proximity
- **Incident Reports** - Detailed incident documentation with automatic export

## Installation

```bash
npm install
```

## Running

```bash
npm start
```

Then open in:
- Expo Go app (scan QR code)
- Android emulator: `a`
- iOS simulator: `i`
- Web browser: `w`

## Building

```bash
npm run build:web          # Web build
npm run build:ios          # iOS build
npm run build:android      # Android build
npm run build:all          # All platforms
```

## Deployment

```bash
npm run deploy:web:vercel  # Deploy web to Vercel
npm run deploy:ios         # Deploy to App Store
npm run deploy:android     # Deploy to Play Store
```

## Project Structure

```
src/
├── app/           - Routes (Expo Router)
├── screens/       - Screen implementations
├── components/    - Reusable UI components
├── services/      - Business logic
├── context/       - Global state
├── hooks/         - Custom hooks
├── utils/         - Utilities
└── data/          - Mock data
```

## Technologies

- React Native with Expo
- TypeScript
- Expo Router for navigation
- Web Speech API for voice recognition
- React Context for state management
- AsyncStorage for persistence

## License

MIT

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
