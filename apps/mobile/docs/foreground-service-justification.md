# Foreground Service Justification

## Service Type
`specialUse` (FOREGROUND_SERVICE_SPECIAL_USE)

## Purpose
Foxhole is a Pomodoro timer that requires accurate countdown timing even when the user switches to another app or the screen turns off. The foreground service:

1. Runs a countdown timer using Handler + SystemClock.elapsedRealtime() for drift-free timing
2. Shows a persistent notification with the remaining time
3. Triggers an alert (sound + vibration) when the timer completes
4. Persists session state for recovery after process death

## Why specialUse
The timer must continue running accurately in the background -- standard background execution is insufficient because:
- WorkManager/AlarmManager alone cannot provide second-by-second countdown updates
- The user needs to see remaining time in the notification shade
- Timer completion must trigger immediately, not on the next system-scheduled wakeup

## User-Facing Behavior
- The notification is visible whenever a focus session is active
- The notification updates every second with "foxhole -- MM:SS remaining"
- The user can always stop the timer (and thus the service) from within the app
- The service stops automatically when the timer completes
