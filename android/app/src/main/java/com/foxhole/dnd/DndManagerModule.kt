package com.foxhole.dnd

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class DndManagerModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName() = "DndManager"

    private val PREFS_NAME = "foxhole_prefs"
    private val KEY_PREVIOUS_DND_STATE = "foxhole_previous_dnd_state"
    private val KEY_DND_ACTIVE = "foxhole_dnd_active"

    private fun getNotificationManager(): NotificationManager {
        return reactApplicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    }

    @ReactMethod
    fun requestDndAccess(promise: Promise) {
        try {
            val nm = getNotificationManager()
            if (!nm.isNotificationPolicyAccessGranted) {
                val intent = Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS)
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                reactApplicationContext.startActivity(intent)
            }
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("DND_ERROR", "Failed to open DND settings", e)
        }
    }

    @ReactMethod
    fun enableDnd(allowCalls: Boolean, promise: Promise) {
        try {
            val nm = getNotificationManager()
            if (!nm.isNotificationPolicyAccessGranted) {
                promise.reject("DND_NOT_GRANTED", "DND access not granted")
                return
            }

            // Save current interruption filter to SharedPreferences
            val prefs = reactApplicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val currentFilter = nm.currentInterruptionFilter
            prefs.edit()
                .putInt(KEY_PREVIOUS_DND_STATE, currentFilter)
                .putBoolean(KEY_DND_ACTIVE, true)
                .apply()

            // Set notification policy to allow priority calls if requested
            if (allowCalls) {
                val policy = NotificationManager.Policy(
                    NotificationManager.Policy.PRIORITY_CATEGORY_CALLS or
                    NotificationManager.Policy.PRIORITY_CATEGORY_REPEAT_CALLERS,
                    NotificationManager.Policy.PRIORITY_SENDERS_ANY,
                    NotificationManager.Policy.PRIORITY_SENDERS_ANY
                )
                nm.notificationPolicy = policy
            }

            // Set DND to priority only
            nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_PRIORITY)

            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("DND_ERROR", "Failed to enable DND", e)
        }
    }

    @ReactMethod
    fun disableDnd(promise: Promise) {
        try {
            val nm = getNotificationManager()
            if (!nm.isNotificationPolicyAccessGranted) {
                promise.reject("DND_NOT_GRANTED", "DND access not granted")
                return
            }

            val prefs = reactApplicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val wasActive = prefs.getBoolean(KEY_DND_ACTIVE, false)

            if (!wasActive) {
                // Foxhole didn't enable DND, nothing to restore
                promise.resolve(null)
                return
            }

            // Restore previous interruption filter
            val previousFilter = prefs.getInt(
                KEY_PREVIOUS_DND_STATE,
                NotificationManager.INTERRUPTION_FILTER_ALL
            )
            nm.setInterruptionFilter(previousFilter)

            // Clean up SharedPreferences
            prefs.edit()
                .remove(KEY_PREVIOUS_DND_STATE)
                .remove(KEY_DND_ACTIVE)
                .apply()

            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("DND_ERROR", "Failed to disable DND", e)
        }
    }

    @ReactMethod
    fun isDndAccessGranted(promise: Promise) {
        try {
            val nm = getNotificationManager()
            promise.resolve(nm.isNotificationPolicyAccessGranted)
        } catch (e: Exception) {
            promise.reject("DND_ERROR", "Failed to check DND access", e)
        }
    }
}
