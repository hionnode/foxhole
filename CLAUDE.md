# CLAUDE.md — Foxhole

## What is this?

Foxhole is an Android-only Pomodoro timer app built with React Native CLI (bare workflow) and TypeScript. It enforces focus by taking over the screen in full immersive mode and activating Do Not Disturb, only allowing phone calls to break through. It tracks sessions, streaks, and history locally.

The name comes from the military concept: you dig into a foxhole, block everything out, and focus on the mission. That's the entire product philosophy.

## Design Philosophy

Foxhole is brutalist, not decorative. Every screen serves exactly one purpose. There are no illustrations, no onboarding carousels, no gamification animations. The app's personality comes from typography, color restraint, and negative space.

**The rule: if it doesn't help someone focus, it doesn't belong in the app.**

## Tech Stack

- **Framework**: React Native CLI (bare), Android only, React Native 0.82+
- **Language**: TypeScript (strict mode)
- **State management**: Zustand
- **Local storage**: MMKV for preferences/presets/streak tracking, op-sqlite for session history
- **Navigation**: React Navigation (minimal — 4-5 screens max)
- **Background timer**: Custom foreground service (Kotlin) with Handler + SystemClock.elapsedRealtime()
- **DND control**: Custom native module (Kotlin) wrapping Android NotificationManager
- **Immersive mode**: Custom native module (Kotlin) using WindowInsetsControllerCompat
- **Sound**: Native MediaPlayer/SoundPool in FocusService (plays even when JS is suspended)
- **Font**: 0xProto (base variant, NOT Nerd Font — avoid glyph bloat)
- **Build**: Gradle, no Expo
- **Architecture**: React Native New Architecture (TurboModules, Fabric)

## Color Palette

Derived from the reference screenshot. Gruvbox-adjacent, warm-on-dark.

```
background_primary:   #282828   -- deep dark, main bg
background_surface:   #3c3836   -- card/modal bg
background_elevated:  #504945   -- pressed states, input bg
text_primary:         #ebdbb2   -- warm cream, headings
text_body:            #d5c4a1   -- body text, timer digits
text_muted:           #a89984   -- secondary labels, metadata
text_bright:          #fbf1c7   -- emphasis, active states
accent:               #d65d0e   -- sparingly — errors, streak fire icon
border:               #504945   -- subtle borders
```

No other colors. No blues, no greens, no purples. If you feel the urge to add color, you're wrong.

## Typography

- **Font family**: 0xProto everywhere. No fallback system fonts except as a loading state.
- **Timer digits**: 72sp minimum on the focus screen (with responsive scaling via PixelRatio.getFontScale() for small/low-DPI screens). Weight: regular. Let the mono spacing do the work.
- **Headings**: 20sp, all lowercase or sentence case. Never ALL CAPS.
- **Body**: 14-16sp.
- **Labels/metadata**: 12sp, text_muted color.
- **Letter spacing**: Default. 0xProto's spacing is already well-designed. Don't touch it.

## Screen Architecture

### 0. Onboarding Screen (first launch only)
- Single screen, not a carousel
- Text: "foxhole takes over your screen and silences your phone. when you dig in, everything else stops."
- If DND permission not granted: brief explanation + "grant access" button → opens system settings
- If DND already granted or user skips: proceed to home
- CTA: "dig in to your first session" → navigates to home and optionally auto-starts

### 1. Home Screen
- Shows current preset name (tappable with chevron affordance to cycle/open picker) and duration
- Big start button (text only, no icon: "dig in")
- Below: daily goal progress ("2 of 4 today"), current streak
- Hide stats for new users (0 sessions) — show "your first session starts here" instead
- Bottom: minimal nav — Home | History | Settings

### 2. Focus Screen (full screen, immersive)
- Activated when session starts
- Hides status bar and navigation bar (immersive sticky mode via native WindowInsetsControllerCompat)
- Shows ONLY: timer countdown (large mono digits), session type label (work/short break/long break), cycle indicator ("round 2 of 4"), and a subtle "surface" button to exit early
- Background: background_primary, nothing else
- DND is activated on entry, deactivated on exit
- Screen stays on (FLAG_KEEP_SCREEN_ON via native module)
- Back gesture/button intercepted → shows abandon confirmation
- If a call comes in, Android's call UI takes over naturally; timer continues in foreground service
- Work→break transition: brief 2-3 second interstitial showing next session type + duration, auto-starts, with "skip break" option

### 3. History Screen
- Scrollable list of past sessions grouped by date
- Each entry: date, start time, duration completed, session type
- Abandoned sessions shown in text_muted with "abandoned" label (not strikethrough)
- Streak counter at the top
- Empty state: "no sessions yet. dig in." centered, text_muted

### 4. Settings Screen
- Preset management (create/edit/delete)
- Each preset: name, work duration, short break, long break, cycles before long break
- Duration inputs: stepper controls (minus/plus flanking a number), not text fields
- Delete presets: long-press or visible delete icon (not swipe-to-delete)
- Default preset: "classic" — 25/5/15/4
- Max 5 presets
- Daily session goal (default: 4)
- Timer end sound: 1 bundled tone
- Vibration toggle
- About/version

## Pomodoro Cycle Logic

```
1. WORK (default 25 min)
2. SHORT BREAK (default 5 min)
3. WORK
4. SHORT BREAK
5. WORK
6. SHORT BREAK
7. WORK
8. LONG BREAK (default 15 min)
→ Repeat
```

- The cycle counter resets after a long break
- User can skip breaks (but it's logged as skipped)
- Abandoning a work session before completion does NOT count toward streak
- Completing a work session = 1 session toward daily count
- Streak = consecutive days with at least 1 completed work session

## Native Modules (Kotlin)

### DndManager
- `requestDndAccess()`: Opens Android notification policy settings if not granted
- `enableDnd(allowCalls: Boolean)`: Saves current DND state to SharedPreferences, then sets DND with priority exception for calls
- `disableDnd()`: Restores previous DND state from SharedPreferences (survives process death)
- `isDndAccessGranted(): Boolean`: Check permission status

### FocusService (Foreground Service)
- Runs the timer natively using Handler + SystemClock.elapsedRealtime()
- Shows a persistent notification with remaining time (on IMPORTANCE_LOW channel)
- Survives app being backgrounded
- Handles timer completion (trigger sound via MediaPlayer + vibration)
- Completion alert on separate notification channel with setBypassDnd(true)
- Exposes `getRemainingTime(): Promise<number>` for JS resync on foreground
- Communicates with JS via NativeEventEmitter (not deprecated DeviceEventEmitter)
- Persists session state to SharedPreferences for process death recovery
- AlarmManager.setExactAndAllowWhileIdle() as fallback completion trigger

### ImmersiveMode
- `enable()`: Uses WindowInsetsControllerCompat to hide system bars (immersive sticky)
- `disable()`: Restores system bars
- Sets FLAG_KEEP_SCREEN_ON on the activity window

### WidgetProvider (V1.1 — not in initial release)
- Simple Android widget showing: current streak, today's sessions count
- Reads from SharedPreferences (written by a thin native bridge after session completion)
- Tapping opens the app

## File Structure

```
foxhole/
├── android/
│   └── app/src/main/java/com/foxhole/
│       ├── dnd/DndManagerModule.kt
│       ├── dnd/DndManagerPackage.kt
│       ├── service/FocusService.kt
│       ├── service/FocusServiceModule.kt
│       ├── service/FocusServicePackage.kt
│       └── immersive/ImmersiveModeModule.kt
│       └── immersive/ImmersiveModePackage.kt
├── src/
│   ├── app/
│   │   └── App.tsx
│   ├── screens/
│   │   ├── OnboardingScreen.tsx
│   │   ├── HomeScreen.tsx
│   │   ├── FocusScreen.tsx
│   │   ├── HistoryScreen.tsx
│   │   └── SettingsScreen.tsx
│   ├── components/
│   │   ├── Timer.tsx
│   │   ├── PresetPicker.tsx
│   │   ├── SessionCard.tsx
│   │   ├── StreakBadge.tsx
│   │   └── Stepper.tsx
│   ├── stores/
│   │   ├── timerStore.ts
│   │   ├── presetStore.ts
│   │   └── sessionStore.ts
│   ├── db/
│   │   ├── index.ts
│   │   ├── schema.ts
│   │   └── queries.ts
│   ├── native/
│   │   ├── DndManager.ts
│   │   ├── FocusService.ts
│   │   └── ImmersiveMode.ts
│   ├── theme/
│   │   ├── colors.ts
│   │   └── typography.ts
│   ├── utils/
│   │   ├── pomodoroEngine.ts
│   │   ├── streakCalculator.ts
│   │   └── formatTime.ts
│   └── types/
│       └── index.ts
├── assets/
│   ├── fonts/
│   │   └── 0xProto-Regular.ttf
│   └── sounds/
│       └── tone.mp3
├── CLAUDE.md
├── implementation-plan.md
├── package.json
├── tsconfig.json
└── react-native.config.js
```

## Code Conventions

- No default exports except screens
- Prefer `const` arrow functions for components
- No inline styles — use StyleSheet.create per component
- Color values ONLY from theme/colors.ts, never hardcoded
- Font family ONLY from theme/typography.ts
- No `any` types. If you don't know the type, figure it out.
- No console.log in committed code — use a debug flag or remove
- Zustand stores: one file per domain, no mega-store
- Native module bridges: thin TS wrappers that handle promise/error, nothing else
- Use NativeEventEmitter for native→JS events (not DeviceEventEmitter)

## What NOT to Build

- No onboarding carousel. One screen, first launch only, context + CTA.
- No account system. No login. No cloud sync (yet).
- No achievements, badges, or XP systems.
- No social features, sharing, or leaderboards.
- No ads. Ever.
- No custom notification sounds — use single bundled tone only.
- No landscape mode. Portrait locked.
- No tablet layout optimization (works in portrait, that's enough).
- No weekly summary charts in V1 history screen.
- No home screen widget in V1 (ship in 1.1).

## Testing Priorities

1. Timer accuracy across backgrounding/foregrounding (verify getRemainingTime resync)
2. DND activation/deactivation (especially: does it restore previous state after process death?)
3. Foreground service survival when Android kills app (verify AlarmManager fallback)
4. Pomodoro cycle state machine (edge cases: skip break, abandon mid-session, phone call interruption)
5. POST_NOTIFICATIONS runtime permission on Android 13+
6. Immersive mode restoration after phone call (TelephonyManager.CALL_STATE_IDLE listener)
7. op-sqlite migration paths for future schema changes
8. Back gesture interception on Focus screen
9. Font rendering on small/low-DPI screens (responsive scaling)

## Play Store Prep

- Package ID: `com.foxhole.app`
- Min SDK: 26 (Android 8.0 — needed for notification channels)
- Target SDK: 35 (required for new apps since Aug 2025)
- Foreground service justification: written early, submitted for review before Phase 7
- Signing: Generate upload keystore early, back it up
- Privacy policy: Required even with no data collection — host on GitHub Pages
- Short description: "Pomodoro focus timer. Activates Do Not Disturb. No distractions."
- Full description lead: "dig in. silence everything. focus."
- Screenshots of focus screen + home screen
- Content rating: Everyone
- Permissions to declare: ACCESS_NOTIFICATION_POLICY, FOREGROUND_SERVICE, FOREGROUND_SERVICE_SPECIAL_USE, VIBRATE, WAKE_LOCK, POST_NOTIFICATIONS
- Distribution: Reddit (r/productivity, r/androidapps), Hacker News (Show HN), Twitter/X dev circles

## Future Scope (Not Now)

- Home screen widget (V1.1 — design already specified above)
- Weekly summary bars in history screen
- Cloud sync via Supabase or Appwrite
- iOS port (evaluate after Android is stable)
- Wear OS companion (just shows timer)
- Custom themes (user-defined color palettes)
- Multiple bundled sound options
