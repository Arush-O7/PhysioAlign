# PhysioAlign - Physical Therapy & Yoga Evaluation App

PhysioAlign is a browser-based application designed to help users track and improve their physical therapy and yoga movements. It uses real-time computer vision in the browser to measure joint angles and provides automated feedback to guide alignment adjustments.

---

## Key Features

1. **Local Computer Vision**: Uses MediaPipe Pose Landmarker to run pose tracking entirely in the browser. This means no video or motion data is sent to a server, keeping it fast and private.
2. **Angle Calculation**: Measures joint angles in 3D using vector math, comparing current positioning against target ranges for selected poses.
3. **Structured AI Coaching**: Generates a detailed evaluation of joint alignment, giving specific tips for adjustment and safety precautions.
4. **Clean Neobrutalist UI**: Built with a clean, high-contrast neobrutalist aesthetic featuring clear visual feedback, smooth transitions, and simple styling.
5. **Interactive Progress Charts**: Visualizes practice sessions with real-time accuracy scoring over time using Recharts.

---

## Tech Stack

- **Frontend**: React 18.3, TypeScript, Vite
- **Styling**: Pure CSS (using custom neobrutalist styling rules)
- **Computer Vision**: `@mediapipe/tasks-vision` (running Pose Landmarker via WebAssembly)
- **AI Core**: `@google/generative-ai` (client-side generation for session debriefs)
- **Charts**: `recharts` for tracking hold consistency
- **State Management**: Lightweight state store using `useSyncExternalStore` for reactive UI updates without extra dependencies

---

## Project Structure

```
PhysioAlign/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── styles/
│   │   └── global.css          # Neobrutalist theme definitions & utility classes
│   ├── game/
│   │   ├── store.ts            # Application router, logs, and local storage state
│   │   └── types.ts            # TypeScript interfaces
│   ├── data/
│   │   └── poses.ts            # Target angles and criteria for each pose
│   ├── utils/
│   │   ├── angleCalculations.ts # 3D vector math for joint angles
│   │   ├── audioFeedback.ts     # Audio tones and Speech Synthesis API integration
│   │   └── geminiService.ts     # Client-side AI feedback generator
│   └── components/
│       ├── primitives.tsx      # Reusable UI primitives (buttons, layout cards, etc.)
│       ├── AIEngine.tsx        # Camera loader, MediaPipe worker, and canvas rendering
│       ├── SplashScreen.tsx    # Welcome screen
│       ├── OnboardingScreen.tsx # Setup user profiles
│       ├── HomeScreen.tsx      # Dashboard containing activity logs and streaks
│       ├── PoseLibraryScreen.tsx# Pose selection list
│       ├── SessionScreen.tsx   # Active camera calibration and real-time feedback meters
│       └── DebriefScreen.tsx   # Visual breakdown of session metrics and AI critique
```

---

## Setup & Running Locally

### 1. Install Dependencies
```bash
npm install
```

### 2. Add API Key
Create a `.env` file in the root folder:
```env
VITE_GEMINI_API_KEY=your_api_key_here
```

### 3. Start Development Server
```bash
npm run dev
```
Open `http://localhost:5173` in your browser, allow camera access, and select a pose to begin.
