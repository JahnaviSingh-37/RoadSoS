# RoadSoS

Emergency response app built with React Native. Handles drive monitoring, SOS alerts, voice activation, hospital routing, and incident reporting.

## Setup

```bash
npm install
npm start
```

Scan the QR code in Expo Go, or press `w` for web.

## Build & Deploy

```bash
npm run build:web
npm run deploy:web:vercel

# Or for native
npm run build:ios
npm run build:android
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
