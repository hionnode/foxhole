# Foxhole — Implementation Plan

## Summary

A brutalist Pomodoro timer for Android that enforces focus by taking over the screen in immersive mode and activating DND, only allowing phone calls to break through. Built with React Native CLI 0.82+ (bare, New Architecture), TypeScript, local-first storage, and a design language rooted in mono typography and warm-on-dark minimalism.

---

## Phase 0: Project Scaffolding (Days 1-2)

**Goal**: Bootable app with correct toolchain, fonts loaded, and theme applied.

**Tasks**:

1. Initialize project: `npx @react-native-community/cli init Foxhole` (TypeScript is now the default)
2. Strip default boilerplate — remove sample screens, default styles
3. Configure `tsconfig.json` with strict mode, path aliases (`@/screens/*`, `@/stores/*`, etc.)
4. Add 0xProto font:
   - Download 0xProto Regular from GitHub (NOT the Nerd Font variant)
   - Place in `assets/fonts/`
   - Configure `react-native.config.js` to link font assets
   - Run `npx react-native-asset` to link
5. Create `src/theme/colors.ts` and `src/theme/typography.ts` with the full palette from CLAUDE.md
6. Create a bare `App.tsx` that renders a centered "foxhole" text in 0xProto on `#282828` background to verify font + colors work
7. Verify debug build runs on physical Android device
8. Set `android:screenOrientation="portrait"` in AndroidManifest.xml
9. Set Min SDK 26, Target SDK 35 in `build.gradle`
10. Add POST_NOTIFICATIONS runtime permission request (required for Android 13+ — without it, foreground service notification is invisible)
11. Write Play Store foreground service justification document now (specialUse type requires manual Google review — do not defer to launch phase)
12. Generate release keystore now — store it outside the repo, document the alias and passwords somewhere safe

**Deliverable**: App boots, shows styled text in 0xProto, portrait locked, Target SDK 35.

---

## Phase 1: Timer Engine + Focus Screen (Days 3-7)

**Goal**: Working countdown timer with full-screen immersive display.

### 1a. Pomodoro State Machine (Days 3-4)

Build `src/utils/pomodoroEngine.ts` as a pure function/state machine. No React, no side effects.

**State shape**:
```typescript
type SessionType = 'work' | 'short_break' | 'long_break';

interface PomodoroState {
  currentSession: SessionType;
  cyclePosition: number;        // 1-4 within a set
  totalWorkCompleted: number;   // sessions completed today
  remainingMs: number;
  isRunning: boolean;
  isPaused: boolean;
}
```

**Transitions**:
- `start(preset)` → initializes state with work session
- `tick(elapsedMs)` → decrements remaining time
- `complete()` → determines next session type based on cycle position
- `skip()` → moves to next session without logging completion
- `abandon()` → stops timer, does not count as completed
- `pause()` / `resume()` → toggle without resetting

**Edge cases to handle**:
- Timer reaches 0 while app is backgrounded (foreground service handles this)
- User skips break — cycle position still advances
- User abandons work session — cycle position resets to where it was

Write unit tests for this module. It's the core logic and must be bulletproof.

### 1b. Immersive Mode Native Module (Day 4)

Build `ImmersiveModeModule.kt` using `WindowInsetsControllerCompat`:

```kotlin
// ~15 lines of Kotlin
fun enable() {
  val controller = WindowInsetsControllerCompat(window, window.decorView)
  controller.hide(WindowInsetsCompat.Type.systemBars())
  controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
  window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
}

fun disable() {
  val controller = WindowInsetsControllerCompat(window, window.decorView)
  controller.show(WindowInsetsCompat.Type.systemBars())
  window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
}
```

This replaces both `react-native-immersive-mode` and `@sayem314/react-native-keep-awake`.

### 1c. Focus Screen UI (Days 4-5)

Build `src/screens/FocusScreen.tsx`:

- Full-screen immersive mode via native ImmersiveMode module
- Timer display: `MM:SS` in 0xProto, 72sp (with `PixelRatio.getFontScale()` responsive scaling), `text_body` color, centered
- Below timer: session type label ("work", "short break", "long break") in `text_muted`, 14sp
- Below label: cycle indicator ("round 2 of 4")
- Bottom: "surface" text button — tap to reveal a confirmation dialog ("abandon this session?")
- Back gesture/button intercepted → shows the same abandon confirmation
- Background: solid `#282828`, nothing else
- Work→break transition: 2-3 second interstitial showing next type + duration, auto-starts, with "skip break" option

### 1d. Zustand Timer Store (Days 5-6)

Build `src/stores/timerStore.ts`:

- Holds `PomodoroState` + active preset
- Exposes actions: `startSession`, `pauseSession`, `resumeSession`, `abandonSession`, `tickTimer`
- Timer ticking: Use `setInterval` at 1s granularity for UI updates. Actual elapsed time calculated from `Date.now()` deltas (not interval count) to avoid drift.
- On session complete: trigger sound + vibration, then auto-transition to next session type after a 2-3 second interstitial

### 1e. Sound + Vibration (Day 7)

- Bundle 1 short tone file (CC0 license, simple clean tone)
- Sound played from **native FocusService.kt via MediaPlayer** (NOT react-native-sound — JS may be suspended when timer completes in background)
- Vibration via React Native's `Vibration` API: `Vibration.vibrate([0, 500, 200, 500])` (two bursts) — triggered from JS when receiving the completion event

**Deliverable**: Timer counts down accurately, survives pause/resume, displays full-screen immersive, plays sound + vibrates on completion, auto-cycles through Pomodoro stages.

---

## Phase 2: DND + Foreground Service (Days 8-15)

**Goal**: App silences the phone during sessions and timer survives backgrounding.

### 2a. DND Native Module (Days 8-10)

Build in Kotlin at `android/app/src/main/java/com/foxhole/dnd/`:

**DndManagerModule.kt**:
```kotlin
fun requestDndAccess()
// → Opens ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS if not granted

fun enableDnd(allowCalls: Boolean)
// → Save current DND state to SharedPreferences (not memory — survives process death)
// → Set INTERRUPTION_FILTER_PRIORITY
// → Configure priority to allow repeat callers or all calls based on flag

fun disableDnd()
// → Restore previously saved DND state from SharedPreferences
// → (NOT just turn off — user might have had DND on before Foxhole activated)

fun isDndAccessGranted(): Boolean
```

**Critical detail**: Android requires the user to manually grant notification policy access in system settings. The app cannot programmatically grant this. The onboarding screen (Phase 5) handles the explainer flow.

**TS Bridge** at `src/native/DndManager.ts`:
```typescript
import { NativeModules } from 'react-native';
const { DndManager } = NativeModules;

export const requestDndAccess = (): Promise<void> => DndManager.requestDndAccess();
export const enableDnd = (allowCalls = true): Promise<void> => DndManager.enableDnd(allowCalls);
export const disableDnd = (): Promise<void> => DndManager.disableDnd();
export const isDndAccessGranted = (): Promise<boolean> => DndManager.isDndAccessGranted();
```

### 2b. Foreground Service (Days 10-14)

Build in Kotlin at `android/app/src/main/java/com/foxhole/service/`:

**FocusService.kt**:
- Extends `Service`, returns `START_STICKY`
- Creates a notification channel ("Foxhole Timer") at `IMPORTANCE_LOW` (no sound from the notification itself)
- Creates a **separate** notification channel ("Foxhole Alert") with `setBypassDnd(true)` for completion alerts
- Shows a persistent notification: "Foxhole — 18:42 remaining" updated every second
- Runs its own timer using `Handler` + `SystemClock.elapsedRealtime()` for accuracy
- On completion: posts high-priority notification on the bypass-DND channel, triggers sound via MediaPlayer, triggers vibration
- Communicates with JS layer via **NativeEventEmitter** (not deprecated DeviceEventEmitter)
- Exposes `getRemainingTime(): Promise<number>` for JS to resync when returning to foreground
- Persists session state to SharedPreferences for process death recovery
- Registers `AlarmManager.setExactAndAllowWhileIdle()` as fallback completion trigger

**AndroidManifest.xml additions**:
```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_SPECIAL_USE" />
<uses-permission android:name="android.permission.VIBRATE" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.ACCESS_NOTIFICATION_POLICY" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

<service
    android:name=".service.FocusService"
    android:foregroundServiceType="specialUse"
    android:exported="false" />
```

**Session lifecycle**:
```
User taps "dig in"
  → JS calls DndManager.enableDnd(allowCalls: true)
  → JS calls FocusService.start(durationMs)
  → Navigate to FocusScreen (immersive)
  → FocusService ticks natively, sends events to JS via NativeEventEmitter
  → JS updates UI

Timer completes:
  → FocusService triggers sound (MediaPlayer) + vibration natively
  → FocusService sends "complete" event to JS
  → JS logs session to DB
  → JS shows 2-3 second interstitial with next session type
  → If break: auto-start break timer (user can skip)
  → If work: wait for user to start

User abandons / exits:
  → JS calls FocusService.stop()
  → JS calls DndManager.disableDnd()
  → Navigate back to HomeScreen
  → Session logged as abandoned (not counted)
```

### 2c. Multi-Device Testing (Day 15)

- Test on Samsung (aggressive battery optimization), Xiaomi (MIUI restrictions), OnePlus
- Verify foreground service survives on each
- Document any per-OEM user guidance needed (reference dontkillmyapp.com)

**Deliverable**: Phone goes silent when session starts, timer runs in background, notification shows countdown, DND restored on exit, sound plays through DND.

---

## Phase 3: Presets + Home Screen (Days 16-19)

**Goal**: User can create/manage presets and launch sessions from a clean home screen.

### 3a. Preset Store + MMKV (Day 16)

- Install `react-native-mmkv`
- Build `src/stores/presetStore.ts`:
  - Default preset: `{ name: 'classic', work: 25, shortBreak: 5, longBreak: 15, cyclesBeforeLong: 4 }`
  - CRUD operations for presets
  - Active preset selection persisted in MMKV
  - Max 5 presets
  - Daily session goal stored in MMKV (default: 4)

### 3b. Preset Management UI (Days 17-18)

In Settings screen:
- List of presets, each showing name + work/break durations
- Tap to edit: inline editing with **stepper controls** (minus/plus buttons flanking a number — not text fields, not sliders)
- **Long-press to delete** or visible delete icon (not swipe-to-delete — that's an iOS convention Android users don't discover)
- "classic" preset cannot be deleted
- "Add preset" at the bottom
- Duration inputs: minutes only, whole numbers, 1-120 range for work, 1-60 for breaks
- Daily goal stepper (1-12 range)
- Vibration toggle
- About/version

### 3c. Home Screen (Days 18-19)

Build `src/screens/HomeScreen.tsx`:
- Top third: today's date in `text_muted`, 12sp
- Center: active preset name (tappable with **chevron/arrow affordance** to open picker), work duration below it in large mono digits
- Below: "dig in" — the start button. Plain text, `text_primary` color, tappable area generous (48dp minimum touch target)
- Bottom section:
  - For new users (0 sessions ever): "your first session starts here" in `text_muted`
  - For returning users: daily goal progress ("2 of 4 today"), current streak ("12 days"), both in `text_muted`
- Navigation: bottom bar with three text labels — "home", "history", "settings" — no icons, 0xProto, `text_muted` color, active = `text_primary`

**Deliverable**: User can manage presets, select one, and launch a session from a clean home screen.

---

## Phase 4: Session History + Streaks (Days 20-25)

**Goal**: Completed sessions are persisted, queryable, and streaks are tracked.

### 4a. op-sqlite Setup (Days 20-21)

- Install `op-sqlite` (JSI-based, New Arch compatible, lightweight)
- Database initialization in `src/db/index.ts`
- Schema definition in `src/db/schema.ts`:

```sql
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_type TEXT NOT NULL,         -- work | short_break | long_break
  preset_name TEXT NOT NULL,
  planned_duration_ms INTEGER NOT NULL,
  actual_duration_ms INTEGER NOT NULL,
  started_at INTEGER NOT NULL,        -- timestamp ms
  completed_at INTEGER NOT NULL,      -- timestamp ms
  was_completed INTEGER NOT NULL,     -- 0 or 1
  was_skipped INTEGER NOT NULL        -- 0 or 1
);

CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_sessions_was_completed ON sessions(was_completed);
```

- Query helpers in `src/db/queries.ts`:
  - `insertSession(session)` — create record
  - `getSessionsByDate(date)` — for history screen grouping
  - `getCompletedWorkSessionsForDate(date)` — for daily count
  - `getAllCompletedWorkSessions()` — for full streak recalculation (edge case only)

**Why op-sqlite over WatermelonDB**: WatermelonDB has unresolved New Architecture compatibility issues, requires decorators + Babel plugins + JSI adapter config, and adds significant bundle size — all for a single table with basic queries. op-sqlite is JSI-based, New Arch native, and ~100 lines of wrapper code covers everything needed.

### 4b. Session Logging (Day 21)

- On work session complete: insert session with `was_completed: 1`
- On session abandoned: insert session with `was_completed: 0`
- On break skipped: insert session with `was_skipped: 1`
- Logging happens in timer store after state transition

### 4c. Streak Calculator (Day 22)

Build `src/utils/streakCalculator.ts`:

**Incremental approach (O(1) for common case)**:
- Store `currentStreak` and `lastActiveDate` in MMKV
- On work session complete:
  - If `lastActiveDate` is today → no change to streak
  - If `lastActiveDate` is yesterday → increment streak, update date
  - If `lastActiveDate` is older → reset streak to 1, update date
- Handle timezone correctly: use user's local date, not UTC
- Full recalculation (query all completed work sessions) only for:
  - First app launch after install
  - Data integrity check in settings (hidden debug action)

### 4d. History Screen (Days 23-25)

Build `src/screens/HistoryScreen.tsx`:

- Top: current streak with "days" label, today's session count / daily goal
- Main list: SectionList grouped by date
  - Section header: date string ("today", "yesterday", "apr 3", etc.)
  - Each row: start time, duration, session type, completion status
  - Abandoned sessions shown in `text_muted` with "abandoned" label (NOT strikethrough — don't shame users)
- Empty state: "no sessions yet. dig in." centered, `text_muted`
- No weekly summary bars in V1 (premature; add in V1.1 once users have weeks of data)

**Deliverable**: All sessions logged to local DB, streak calculated efficiently, history screen shows grouped sessions.

---

## Phase 5: Onboarding + Polish + Edge Cases (Days 26-31)

**Goal**: First-run experience, permission flows, and production-readiness.

### 5a. Onboarding Screen (Day 26)

Build `src/screens/OnboardingScreen.tsx`:
- Shown only on first launch (flag in MMKV)
- Text: "foxhole takes over your screen and silences your phone. when you dig in, everything else stops."
- Check `isDndAccessGranted()`:
  - If not granted: "foxhole needs do not disturb access to silence notifications during focus sessions. phone calls will still come through." + "grant access" button → opens system settings
  - If granted: skip straight to CTA
- CTA: "dig in to your first session" → navigate to home
- On return from settings: re-check permission, update UI accordingly
- If user skips DND: proceed to home, show subtle `text_muted` note: "dnd not enabled — notifications won't be silenced"

### 5b. Phone Call Interruption (Day 27)
- When a call comes in during a session, Android's call UI overlays naturally
- Timer keeps running in foreground service (correct behavior)
- When call ends, FocusScreen needs to regain immersive mode
- Add listener for `TelephonyManager.CALL_STATE_IDLE` in native module to re-trigger immersive

### 5c. App Kill / Process Death (Day 28)
- FocusService stores session state (start time, duration, session type) in SharedPreferences
- On app restart: check for orphaned session, offer to resume or mark as abandoned
- DND state also in SharedPreferences, so disableDnd() can restore even after process death
- Test on low-memory conditions with `adb shell am kill`

### 5d. Midnight Rollover (Day 28)
- If a session spans midnight, it counts toward the day it STARTED on
- Streak calculation handles this — don't double-count

### 5e. Visual Polish (Days 29-30)
- Screen transition animations: simple fade, 200ms
- Touch feedback: subtle opacity change on pressable elements (0.7 opacity on press)
- Font responsive scaling: test on small/low-DPI screens, apply PixelRatio adjustments
- Loading states: none needed — everything is local, everything is instant
- Error states: only for DND permission — handled in 5a

### 5f. Analytics Integration (Day 31)
- Opt-in anonymous analytics (prompt on first launch or in settings)
- Track key events only: first session completion, DND permission granted/denied, daily active
- No PII, no device fingerprinting
- Use a privacy-respecting solution (Plausible, PostHog self-hosted, or simple custom event endpoint)

**Deliverable**: Complete first-run experience, all edge cases handled, production-ready polish.

---

## Phase 6: Play Store Release (Days 32-35)

### 6a. Build Prep (Day 32)
- ProGuard/R8 configuration for release build
- Generate signed AAB (App Bundle for Play Store)
- Test release build on physical device — verify fonts, sound, DND, foreground service all work
- Verify APK size (target: under 15MB)

### 6b. Store Assets (Day 33)
- App icon: simple geometric mark in the warm palette on dark background
- Feature graphic: 1024x500, dark background, "foxhole" in 0xProto, tagline below
- Screenshots: 3-4 screenshots — home screen, focus screen, history screen
- Use `adb shell screencap` on a clean device
- Short description: "Pomodoro focus timer. Activates Do Not Disturb. No distractions."
- Full description lead: "dig in. silence everything. focus." — then factual feature list, under 200 words, no emoji, no hype

### 6c. Store Listing (Day 34)
- Privacy policy: static page on GitHub Pages stating the app collects no PII, requires DND permission for core functionality, all data stored locally, optional anonymous analytics
- Content rating questionnaire: no violence, no ads, no user-generated content → "Everyone"
- Category: Productivity
- Tags: pomodoro, focus, timer, do not disturb, productivity

### 6d. Testing + Launch (Day 35)
- Upload to Play Console internal testing track
- Test on 3-4 Android versions (8, 12, 14, 15)
- Fix any device-specific issues
- Promote to production, 100% rollout

**Deliverable**: App live on Play Store.

---

## Post-Launch

### Stability monitoring
- Monitor Play Console's Android Vitals for ANRs and crashes
- If crash rate > 1%, add Sentry (privacy-respecting, self-hostable)

### Distribution
- Show HN post (opinionated description, link to Play Store)
- Reddit posts: r/productivity, r/androidapps, r/ADHD
- Twitter/X: developer and productivity circles
- These channels matter more than Play Store ASO for the target audience

### V1.1 roadmap (after user feedback)
- Home screen widget (design already specified in CLAUDE.md)
- Weekly summary bars in history
- Additional bundled sound options
- Play Store feedback-driven fixes

### Future (not soon)
- Cloud sync via Supabase or Appwrite
- iOS port (evaluate after Android is stable)
- Wear OS companion (just shows timer)
- Custom themes (user-defined color palettes)

---

## Dependency List

| Package | Purpose |
|---|---|
| react-native (0.82+) | Framework (New Architecture) |
| typescript | Language (dev dep) |
| zustand | State management |
| react-native-mmkv | Preferences, presets, streak tracking |
| op-sqlite | Session history DB (JSI-based, New Arch compatible) |
| @react-navigation/native | Navigation |
| @react-navigation/bottom-tabs | Bottom tab nav |
| react-native-screens | Native screen containers |
| react-native-safe-area-context | Safe area handling |

**Runtime JS deps: 8.** Native modules: 4 (DndManager, FocusService, ImmersiveMode, WidgetProvider). Sound handled natively via MediaPlayer in FocusService.

---

## Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| Android OEM kills foreground service | Timer stops silently | Test on Samsung, Xiaomi, OnePlus. AlarmManager fallback for completion trigger. Add user-facing guidance to disable battery optimization (dontkillmyapp.com). |
| DND permission UX is confusing | Users don't grant access, enhancement broken | Onboarding screen with clear explanation. App works without DND (core value is screen takeover). Subtle home screen note if DND denied. |
| Play Store rejects specialUse foreground service | Can't publish | Write justification in Phase 0, submit early. Have plan B: timer app category justification with alarm service approach. |
| POST_NOTIFICATIONS denied on Android 13+ | Foreground notification invisible | Request at runtime with explanation. Timer still works; notification is informational only. |
| 0xProto renders poorly at small sizes on low-DPI | Readability issues | Test on budget device. Responsive scaling via PixelRatio.getFontScale(). Min text size 14sp. |
| op-sqlite migration complexity | Schema changes break existing data | Design schema for forward compatibility. Include version column. Write migration helpers from day 1. |

---

## Timeline Summary

| Phase | Days | What |
|---|---|---|
| 0 | 1-2 | Scaffolding, fonts, theme, SDK 35, permissions |
| 1 | 3-7 | Timer engine, focus screen, immersive mode, sound |
| 2 | 8-15 | DND native module, foreground service, multi-device testing |
| 3 | 16-19 | Presets, home screen, daily goal |
| 4 | 20-25 | Session history (op-sqlite), streaks, history UI |
| 5 | 26-31 | Onboarding, edge cases, polish, analytics |
| 6 | 32-35 | Play Store release |

**Total: ~35 working days to production.**

Phases 1 and 2 are the hardest. If the immersive mode, foreground service, and DND module work reliably, everything else is UI and data.
