plugins {
    alias(libs.plugins.android.application)
}

android {
    namespace = "com.laestacion.grill"
    compileSdk {
        version = release(37)
    }

    defaultConfig {
        minSdk = 24
        targetSdk = 37
        versionCode = 5
        versionName = "1.2.3"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    flavorDimensions += "tipo"
    productFlavors {
        create("restaurante") {
            dimension = "tipo"
            applicationId = "com.laestacion.grill"
            versionCode = 5
            versionName = "1.2.3"
            manifestPlaceholders["appName"] = "La Estación Grill"
        }
        create("terminal") {
            dimension = "tipo"
            applicationId = "com.laestacion.terminal"
            versionCode = 1
            versionName = "1.0.0"
            manifestPlaceholders["appName"] = "Terminal Auditoría"
        }
    }

    buildTypes {
        release {
            optimization {
                enable = false
            }
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
}

dependencies {
    implementation(libs.androidx.appcompat)
    implementation(libs.androidx.core.ktx)
    implementation(libs.material)
    implementation(libs.androidx.webkit)
    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(libs.androidx.junit)
}