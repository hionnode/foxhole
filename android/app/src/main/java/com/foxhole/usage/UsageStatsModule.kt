package com.foxhole.usage

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Process
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray

class UsageStatsModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName() = "UsageStats"

    @ReactMethod
    fun isUsageAccessGranted(promise: Promise) {
        try {
            val appOps = reactApplicationContext.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
            val mode = appOps.checkOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                Process.myUid(),
                reactApplicationContext.packageName
            )
            promise.resolve(mode == AppOpsManager.MODE_ALLOWED)
        } catch (e: Exception) {
            promise.reject("USAGE_ERROR", "Failed to check usage access", e)
        }
    }

    @ReactMethod
    fun requestUsageAccess(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            try {
                reactApplicationContext.startActivity(intent)
            } catch (_: Exception) {
                // Samsung fallback: open generic settings
                val fallback = Intent(Settings.ACTION_SETTINGS)
                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                reactApplicationContext.startActivity(fallback)
            }
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("USAGE_ERROR", "Failed to open usage access settings", e)
        }
    }

    @ReactMethod
    fun getUsageStats(packageNames: ReadableArray, startTime: Double, endTime: Double, promise: Promise) {
        Thread {
            try {
                val usm = reactApplicationContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
                val start = startTime.toLong()
                val end = endTime.toLong()

                // Build set of requested package names
                val requested = mutableSetOf<String>()
                for (i in 0 until packageNames.size()) {
                    requested.add(packageNames.getString(i))
                }

                // Query foreground time (aggregate per package)
                val foregroundMap = mutableMapOf<String, Long>()
                val stats = usm.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, start, end)
                for (stat in stats) {
                    if (stat.packageName in requested && stat.totalTimeInForeground > 0) {
                        foregroundMap[stat.packageName] =
                            (foregroundMap[stat.packageName] ?: 0) + stat.totalTimeInForeground
                    }
                }

                // Query events for open counts (MOVE_TO_FOREGROUND)
                val openCountMap = mutableMapOf<String, Int>()
                val events = usm.queryEvents(start, end)
                val event = UsageEvents.Event()
                while (events.hasNextEvent()) {
                    events.getNextEvent(event)
                    if (event.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND &&
                        event.packageName in requested
                    ) {
                        openCountMap[event.packageName] =
                            (openCountMap[event.packageName] ?: 0) + 1
                    }
                }

                // Build result array
                val result = Arguments.createArray()
                for (pkg in requested) {
                    val foregroundMs = foregroundMap[pkg] ?: 0
                    val opens = openCountMap[pkg] ?: 0
                    if (foregroundMs > 0 || opens > 0) {
                        val item = Arguments.createMap()
                        item.putString("packageName", pkg)
                        item.putDouble("foregroundTimeMs", foregroundMs.toDouble())
                        item.putInt("openCount", opens)
                        result.pushMap(item)
                    }
                }

                promise.resolve(result)
            } catch (e: Exception) {
                promise.reject("USAGE_ERROR", "Failed to query usage stats", e)
            }
        }.start()
    }

    @ReactMethod
    fun getInstalledApps(promise: Promise) {
        Thread {
            try {
                val pm = reactApplicationContext.packageManager
                val intent = Intent(Intent.ACTION_MAIN, null)
                intent.addCategory(Intent.CATEGORY_LAUNCHER)

                val activities = pm.queryIntentActivities(intent, PackageManager.MATCH_DEFAULT_ONLY)
                val result = Arguments.createArray()
                val seen = mutableSetOf<String>()

                for (resolveInfo in activities) {
                    val pkg = resolveInfo.activityInfo.packageName
                    // Skip own package and duplicates
                    if (pkg == reactApplicationContext.packageName || pkg in seen) {
                        continue
                    }
                    seen.add(pkg)

                    val item = Arguments.createMap()
                    item.putString("packageName", pkg)
                    item.putString("label", resolveInfo.loadLabel(pm).toString())
                    result.pushMap(item)
                }

                promise.resolve(result)
            } catch (e: Exception) {
                promise.reject("USAGE_ERROR", "Failed to get installed apps", e)
            }
        }.start()
    }
}
