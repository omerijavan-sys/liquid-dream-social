# ---- Primegram release shrink/obfuscation rules ----
-keepattributes Signature,InnerClasses,EnclosingMethod,*Annotation*,Exceptions,SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Capacitor core + every plugin: plugins are found by reflection (@CapacitorPlugin / @PluginMethod / @PermissionCallback / @ActivityCallback).
-keep class com.getcapacitor.** { *; }
-keep class com.capacitorjs.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * { @com.getcapacitor.annotation.PermissionCallback <methods>; @com.getcapacitor.annotation.ActivityCallback <methods>; @com.getcapacitor.PluginMethod public <methods>; }
-dontwarn com.getcapacitor.**

# Our own native plugins, services and receivers.
-keep class com.primegram.app.** { *; }

# Cordova shim bundled with Capacitor.
-keep class org.apache.cordova.** { *; }
-dontwarn org.apache.cordova.**

# JavaScript bridge into the WebView.
-keepclassmembers class * { @android.webkit.JavascriptInterface <methods>; }
-keep class androidx.webkit.** { *; }
-keepclassmembers class * extends android.webkit.WebViewClient { public *; }
-keepclassmembers class * extends android.webkit.WebChromeClient { public *; }

# Firebase Cloud Messaging (also ships consumer rules; these cover the service we subclass).
-keep class com.google.firebase.messaging.** { *; }
-keep class com.google.firebase.iid.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# AndroidX core pieces used by notifications (RemoteInput / DecoratedCustomViewStyle).
-keep class androidx.core.app.** { *; }
-dontwarn kotlin.**
