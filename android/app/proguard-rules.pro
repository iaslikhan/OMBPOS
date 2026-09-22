# ProGuard / R8 Rules for Original Modi Bags POS Release
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod

# Keep Room Entities and DAOs
-keep class com.originalmodibags.businessmanager.data.local.entity.** { *; }
-keep class com.originalmodibags.businessmanager.data.local.dao.** { *; }
-keep class com.originalmodibags.businessmanager.data.local.** { *; }

# Keep Firebase Models
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**

# Coroutines & Serialization
-keepclassmembers class * extends kotlinx.coroutines.internal.MainDispatcherFactory {
    public <init>();
}
