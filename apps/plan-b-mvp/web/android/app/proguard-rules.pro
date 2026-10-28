# R8/ProGuard rules for the Capacitor app. They are NOT active while `minifyEnabled false` in app/build.gradle (the current state).
# Turning R8 on is a release step: see docs/engineering/native-wrapper.md "Enable R8 after a signed release test".

# Capacitor finds plugins and their methods by reflection and calls them from JavaScript by name.
-keep public class * extends com.getcapacitor.Plugin
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * {
    @com.getcapacitor.annotation.PermissionCallback <methods>;
    @com.getcapacitor.annotation.ActivityCallback <methods>;
    @com.getcapacitor.PluginMethod public <methods>;
}
-keep class com.getcapacitor.** { *; }
-keepclassmembers class * { @android.webkit.JavascriptInterface <methods>; }
-keepclassmembers class * { @com.getcapacitor.annotation.PluginMethod <methods>; }

# The app's own classes (MainActivity, plugins registered by name).
-keep class au.reroute.app.** { *; }

# Plugins in use (each also ships consumer rules where marked; kept here so the list is reviewable in one place).
-keep class com.capacitorjs.plugins.** { *; }
-keep class com.aparajita.capacitor.securestorage.** { *; }
-keep class ee.forgr.capacitor.social.login.** { *; }
-keep class com.google.android.libraries.identity.googleid.** { *; }
-keep class androidx.credentials.** { *; }

# Stack traces readable in Play Console (upload the mapping.txt R8 writes with every release).
-keepattributes *Annotation*, Signature, InnerClasses, EnclosingMethod, SourceFile, LineNumberTable
-renamesourcefileattribute SourceFile
