import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

fun prop(name: String, default: String): String = (project.findProperty(name) as String?) ?: default
val keystoreFile = rootProject.file("keystore.properties")

android {
    namespace = "br.com.vilasossego.ninguemdorme"
    compileSdk = 36

    defaultConfig {
        applicationId = "br.com.vilasossego.ninguemdorme"
        minSdk = 24
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"
        buildConfigField("String", "GAME_URL", "\"${prop("GAME_URL", "https://SEU-SERVIDOR.onrender.com/")}\"")
        buildConfigField("String", "INTERSTITIAL_ID", "\"${prop("INTERSTITIAL_ID", "ca-app-pub-3940256099942544/1033173712")}\"")
        buildConfigField("String", "REWARDED_ID", "\"${prop("REWARDED_ID", "ca-app-pub-3940256099942544/5224354917")}\"")
        manifestPlaceholders["ADMOB_APP_ID"] = prop("ADMOB_APP_ID", "ca-app-pub-3940256099942544~3347511713")
    }

    buildFeatures { buildConfig = true }

    signingConfigs {
        if (keystoreFile.exists()) {
            create("release") {
                val p = Properties().apply { keystoreFile.inputStream().use { load(it) } }
                storeFile = file(p["storeFile"] as String)
                storePassword = p["storePassword"] as String
                keyAlias = p["keyAlias"] as String
                keyPassword = p["keyPassword"] as String
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (keystoreFile.exists()) signingConfig = signingConfigs.getByName("release")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.gms:play-services-ads:23.5.0")
    implementation("com.android.billingclient:billing-ktx:8.3.0")
}
