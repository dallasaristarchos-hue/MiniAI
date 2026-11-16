plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val uploadKeystorePath = System.getenv("MINIAI_UPLOAD_KEYSTORE_PATH")

android {
    namespace = "com.miniai.app"
    compileSdk = 36
    defaultConfig {
        applicationId = "com.miniai.app"
        minSdk = 23
        targetSdk = 36
        versionCode = 6
        versionName = "2.4"
    }
    signingConfigs {
        create("release") {
            if (!uploadKeystorePath.isNullOrBlank()) {
                storeFile = file(uploadKeystorePath)
                storePassword = System.getenv("MINIAI_UPLOAD_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("MINIAI_UPLOAD_KEY_ALIAS")
                keyPassword = System.getenv("MINIAI_UPLOAD_KEY_PASSWORD")
            }
        }
    }
    buildTypes {
        getByName("release") {
            isMinifyEnabled = false
            if (!uploadKeystorePath.isNullOrBlank()) signingConfig = signingConfigs.getByName("release")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}
