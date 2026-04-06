# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# ============================================================================
# React Native Core
# ============================================================================

# Hermes engine
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }

# React Native internals
-keep,allowobfuscation @interface com.facebook.proguard.annotations.DoNotStrip
-keep,allowobfuscation @interface com.facebook.proguard.annotations.KeepGettersAndSetters
-keep @com.facebook.proguard.annotations.DoNotStrip class *
-keepclassmembers class * {
    @com.facebook.proguard.annotations.DoNotStrip *;
    @com.facebook.proguard.annotations.KeepGettersAndSetters *;
}
-keepclassmembers @com.facebook.proguard.annotations.KeepGettersAndSetters class * {
  void set*(***);
  *** get*();
}

# JSI / TurboModules (New Architecture)
-keep class com.facebook.react.turbomodule.** { *; }
-keep class com.facebook.react.bridge.** { *; }
-keep class com.facebook.react.uimanager.** { *; }

# Fabric renderer
-keep class com.facebook.react.fabric.** { *; }

# Soloader (used by React Native to load native libs)
-keep class com.facebook.soloader.** { *; }

# ============================================================================
# react-native-mmkv / Nitro Modules
# ============================================================================

# MMKV native storage (JSI-based)
-keep class com.tencent.mmkv.** { *; }
-keep class com.mrousavy.mmkv.** { *; }

# Nitro Modules (JSI bridge layer used by MMKV v4+)
-keep class com.margelo.nitro.** { *; }
-keepclassmembers class com.margelo.nitro.** {
    native <methods>;
    *;
}

# ============================================================================
# op-sqlite (JSI-based)
# ============================================================================

-keep class com.op.sqlite.** { *; }
-keepclassmembers class com.op.sqlite.** {
    native <methods>;
    *;
}

# ============================================================================
# Foxhole Custom Native Modules
# ============================================================================

# DndManager
-keep class com.foxhole.dnd.DndManagerModule { *; }
-keep class com.foxhole.dnd.DndManagerPackage { *; }

# FocusService (foreground service + module)
-keep class com.foxhole.service.FocusService { *; }
-keep class com.foxhole.service.FocusServiceModule { *; }
-keep class com.foxhole.service.FocusServicePackage { *; }

# ImmersiveMode
-keep class com.foxhole.immersive.ImmersiveModeModule { *; }
-keep class com.foxhole.immersive.ImmersiveModePackage { *; }

# ============================================================================
# General
# ============================================================================

# Keep native methods across all classes
-keepclasseswithmembernames,includedescriptorclasses class * {
    native <methods>;
}

# Keep enums (used by various serialization)
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# Keep Parcelables
-keep class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator *;
}

# Keep annotations
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes InnerClasses
-keepattributes EnclosingMethod

# Suppress warnings for common React Native dependencies
-dontwarn com.facebook.react.**
-dontwarn com.facebook.hermes.**
-dontwarn com.facebook.jni.**
