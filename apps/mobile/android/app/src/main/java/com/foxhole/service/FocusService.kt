package com.foxhole.service

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.NotificationCompat
import com.foxhole.MainActivity

class FocusService : Service() {
    companion object {
        const val CHANNEL_TIMER = "foxhole_timer"
        const val CHANNEL_ALERT = "foxhole_alert"
        const val NOTIFICATION_ID = 1001
        const val ALERT_NOTIFICATION_ID = 1002
        const val ALARM_REQUEST_CODE = 2001

        const val TICK_INTERVAL_MS = 1000L
        const val WAKELOCK_BUFFER_MS = 60_000L
        val VIBRATION_PATTERN = longArrayOf(0, 500, 200, 500)

        const val ACTION_START = "com.foxhole.service.ACTION_START"
        const val ACTION_STOP = "com.foxhole.service.ACTION_STOP"
        const val ACTION_ALARM_FIRED = "com.foxhole.service.ACTION_ALARM_FIRED"

        const val EXTRA_DURATION_MS = "duration_ms"
        const val EXTRA_SESSION_TYPE = "session_type"

        const val PREFS_NAME = "foxhole_prefs"
        const val KEY_START_TIME = "service_start_time"
        const val KEY_DURATION_MS = "service_duration_ms"
        const val KEY_SESSION_TYPE = "service_session_type"
        const val KEY_SERVICE_ACTIVE = "service_active"

        @Volatile
        var isRunning = false
            private set

        @Volatile
        var startElapsedRealtime: Long = 0
            private set

        @Volatile
        var durationMs: Long = 0
            private set

        @Volatile
        var sessionType: String = "work"
            private set

        fun getRemainingMs(): Long {
            if (!isRunning) return 0
            val elapsed = SystemClock.elapsedRealtime() - startElapsedRealtime
            return Math.max(0, durationMs - elapsed)
        }
    }

    private val handler = Handler(Looper.getMainLooper())
    private var wakeLock: PowerManager.WakeLock? = null
    private var timerNotificationBuilder: NotificationCompat.Builder? = null
    private var notificationManager: NotificationManager? = null

    private val tickRunnable = object : Runnable {
        override fun run() {
            val remaining = getRemainingMs()
            if (remaining <= 0) {
                onTimerComplete()
                return
            }
            updateNotification(remaining)
            // Send tick event via the module's event emitter
            FocusServiceModule.sendTickEvent(remaining)
            handler.postDelayed(this, TICK_INTERVAL_MS)
        }
    }

    override fun onCreate() {
        super.onCreate()
        notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        createNotificationChannels()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                val duration = intent.getLongExtra(EXTRA_DURATION_MS, 0)
                val type = intent.getStringExtra(EXTRA_SESSION_TYPE) ?: "work"
                startTimer(duration, type)
            }
            ACTION_STOP -> {
                stopTimer()
            }
            ACTION_ALARM_FIRED -> {
                // Fallback alarm fired — check if timer should have completed
                if (isRunning && getRemainingMs() <= 0) {
                    onTimerComplete()
                }
            }
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createNotificationChannels() {
        val nm = notificationManager ?: return

        // Timer channel — low importance, no sound
        val timerChannel = NotificationChannel(
            CHANNEL_TIMER,
            "Foxhole Timer",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Ongoing focus session countdown"
            setShowBadge(false)
        }
        nm.createNotificationChannel(timerChannel)

        // Alert channel — high importance, bypasses DND
        val alertChannel = NotificationChannel(
            CHANNEL_ALERT,
            "Foxhole Alert",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Focus session completion alert"
            setBypassDnd(true)
            setShowBadge(true)
        }
        nm.createNotificationChannel(alertChannel)
    }

    private fun startTimer(duration: Long, type: String) {
        // Set static state
        durationMs = duration
        sessionType = type
        startElapsedRealtime = SystemClock.elapsedRealtime()
        isRunning = true

        // Persist to SharedPreferences for process death recovery
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit()
            .putLong(KEY_START_TIME, startElapsedRealtime)
            .putLong(KEY_DURATION_MS, duration)
            .putString(KEY_SESSION_TYPE, type)
            .putBoolean(KEY_SERVICE_ACTIVE, true)
            .commit()

        // Acquire partial wake lock to keep the handler running
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "foxhole:focus_timer"
        ).apply {
            acquire(duration + WAKELOCK_BUFFER_MS)
        }

        // Build notification BEFORE calling startForeground
        val notification = buildTimerNotification(duration)
        startForeground(NOTIFICATION_ID, notification)

        // Schedule AlarmManager fallback
        scheduleAlarmFallback(duration)

        // Start ticking
        handler.removeCallbacks(tickRunnable)
        handler.post(tickRunnable)
    }

    private fun stopTimer() {
        isRunning = false
        handler.removeCallbacks(tickRunnable)
        cancelAlarmFallback()
        releaseWakeLock()
        clearPersistedState()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun onTimerComplete() {
        isRunning = false
        handler.removeCallbacks(tickRunnable)
        cancelAlarmFallback()
        releaseWakeLock()
        clearPersistedState()

        // Play sound
        var mediaPlayer: MediaPlayer? = null
        try {
            val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            mediaPlayer = MediaPlayer.create(this, uri)
            mediaPlayer?.setOnCompletionListener { mp -> mp.release() }
            mediaPlayer?.start()
        } catch (_: Exception) {
            // Sound playback is best-effort; release on failure
            mediaPlayer?.release()
        }

        // Vibrate
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vm = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                val vibrator = vm.defaultVibrator
                vibrator.vibrate(VibrationEffect.createWaveform(VIBRATION_PATTERN, -1))
            } else {
                @Suppress("DEPRECATION")
                val vibrator = getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
                vibrator.vibrate(VibrationEffect.createWaveform(VIBRATION_PATTERN, -1))
            }
        } catch (_: Exception) {
            // Vibration is best-effort
        }

        // Post completion notification on bypass-DND channel
        postCompletionNotification()

        // Send complete event to JS
        FocusServiceModule.sendCompleteEvent()

        // Update ongoing notification to show completion, then stop
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun formatRemaining(remainingMs: Long): String {
        val minutes = (remainingMs / 1000) / 60
        val seconds = (remainingMs / 1000) % 60
        return String.format("%02d:%02d remaining", minutes, seconds)
    }

    private fun buildTimerNotification(remainingMs: Long): Notification {
        val tapIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 0, tapIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = NotificationCompat.Builder(this, CHANNEL_TIMER)
            .setContentTitle("foxhole")
            .setContentText(formatRemaining(remainingMs))
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(pendingIntent)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)

        timerNotificationBuilder = builder
        return builder.build()
    }

    private fun updateNotification(remainingMs: Long) {
        val builder = timerNotificationBuilder ?: return
        builder.setContentText(formatRemaining(remainingMs))
        notificationManager?.notify(NOTIFICATION_ID, builder.build())
    }

    private fun postCompletionNotification() {
        val tapIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 0, tapIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_ALERT)
            .setContentTitle("foxhole")
            .setContentText("session complete")
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        notificationManager?.notify(ALERT_NOTIFICATION_ID, notification)
    }

    private fun scheduleAlarmFallback(durationMs: Long) {
        val alarmManager = getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(this, FocusService::class.java).apply {
            action = ACTION_ALARM_FIRED
        }
        val pendingIntent = PendingIntent.getService(
            this, ALARM_REQUEST_CODE, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val triggerAt = SystemClock.elapsedRealtime() + durationMs
        alarmManager.setExactAndAllowWhileIdle(
            AlarmManager.ELAPSED_REALTIME_WAKEUP,
            triggerAt,
            pendingIntent
        )
    }

    private fun cancelAlarmFallback() {
        val alarmManager = getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(this, FocusService::class.java).apply {
            action = ACTION_ALARM_FIRED
        }
        val pendingIntent = PendingIntent.getService(
            this, ALARM_REQUEST_CODE, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        alarmManager.cancel(pendingIntent)
    }

    private fun releaseWakeLock() {
        try {
            wakeLock?.let {
                if (it.isHeld) {
                    it.release()
                }
            }
            wakeLock = null
        } catch (_: Exception) {
            // Best-effort
        }
    }

    private fun clearPersistedState() {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit()
            .remove(KEY_START_TIME)
            .remove(KEY_DURATION_MS)
            .remove(KEY_SESSION_TYPE)
            .remove(KEY_SERVICE_ACTIVE)
            .apply()
    }

    override fun onDestroy() {
        handler.removeCallbacks(tickRunnable)
        releaseWakeLock()
        timerNotificationBuilder = null
        isRunning = false
        super.onDestroy()
    }
}
