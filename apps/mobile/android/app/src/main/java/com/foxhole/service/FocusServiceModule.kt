package com.foxhole.service

import android.content.Intent
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

class FocusServiceModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName() = "FocusServiceModule"

    companion object {
        private var reactContext: ReactApplicationContext? = null

        fun sendTickEvent(remainingMs: Long) {
            val ctx = reactContext ?: return
            try {
                val params = Arguments.createMap().apply {
                    putDouble("remainingMs", remainingMs.toDouble())
                }
                ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit("onTick", params)
            } catch (_: Exception) {
                // JS bridge may not be ready
            }
        }

        fun sendCompleteEvent() {
            val ctx = reactContext ?: return
            try {
                ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit("onComplete", null)
            } catch (_: Exception) {
                // JS bridge may not be ready
            }
        }
    }

    init {
        Companion.reactContext = reactContext
    }

    @ReactMethod
    fun start(durationMs: Double, sessionType: String, promise: Promise) {
        try {
            val context = reactApplicationContext
            val intent = Intent(context, FocusService::class.java).apply {
                action = FocusService.ACTION_START
                putExtra(FocusService.EXTRA_DURATION_MS, durationMs.toLong())
                putExtra(FocusService.EXTRA_SESSION_TYPE, sessionType)
            }
            context.startForegroundService(intent)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("SERVICE_ERROR", "Failed to start focus service", e)
        }
    }

    @ReactMethod
    fun stop(promise: Promise) {
        try {
            val context = reactApplicationContext
            val intent = Intent(context, FocusService::class.java).apply {
                action = FocusService.ACTION_STOP
            }
            context.startService(intent)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("SERVICE_ERROR", "Failed to stop focus service", e)
        }
    }

    @ReactMethod
    fun getRemainingTime(promise: Promise) {
        try {
            val remaining = FocusService.getRemainingMs()
            promise.resolve(remaining.toDouble())
        } catch (e: Exception) {
            promise.reject("SERVICE_ERROR", "Failed to get remaining time", e)
        }
    }

    @ReactMethod
    fun isRunning(promise: Promise) {
        try {
            promise.resolve(FocusService.isRunning)
        } catch (e: Exception) {
            promise.reject("SERVICE_ERROR", "Failed to check service status", e)
        }
    }

    // Required for NativeEventEmitter
    @ReactMethod
    fun addListener(eventName: String) {
        // No-op: required for NativeEventEmitter
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // No-op: required for NativeEventEmitter
    }
}
