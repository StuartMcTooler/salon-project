# Android Build Guide for Collaborators

This guide walks you through setting up your development environment and building the Android app from this project.

## Prerequisites

### 1. Required Software

| Tool | Version | Download |
|------|---------|----------|
| **Node.js** | 18+ | [nodejs.org](https://nodejs.org/) |
| **Android Studio** | Latest | [developer.android.com/studio](https://developer.android.com/studio) |
| **Git** | Latest | [git-scm.com](https://git-scm.com/) |

### 2. Android Studio Setup

After installing Android Studio:

1. Open Android Studio → **More Actions** → **SDK Manager**
2. Install the following:
   - **SDK Platforms**: Android 14 (API 34) or latest
   - **SDK Tools**: 
     - Android SDK Build-Tools
     - Android SDK Command-line Tools
     - Android Emulator
     - Android SDK Platform-Tools

3. Set up environment variables (add to your shell profile):
   ```bash
   # macOS/Linux (~/.zshrc or ~/.bashrc)
   export ANDROID_HOME=$HOME/Library/Android/sdk
   export PATH=$PATH:$ANDROID_HOME/emulator
   export PATH=$PATH:$ANDROID_HOME/platform-tools
   
   # Windows (System Environment Variables)
   # ANDROID_HOME = C:\Users\<username>\AppData\Local\Android\Sdk
   ```

---

## Step-by-Step Build Process

### Step 1: Export Project to Your GitHub

1. In Lovable, go to **Project Settings** → **GitHub**
2. Click **Connect to GitHub** and authorize
3. Click **Create Repository** to export to your GitHub account

### Step 2: Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
cd YOUR_REPO_NAME
```

### Step 3: Install Dependencies

```bash
npm install
```

### Step 4: Add Android Platform

```bash
npx cap add android
```

This creates the `android/` folder with native project files.

### Step 5: Configure Android for Stripe Terminal (CRITICAL)

After adding Android, you **MUST** make these changes for Stripe Terminal (Tap to Pay) to work:

#### 5a. Update `android/variables.gradle`

Open `android/variables.gradle` and update to these values:

```gradle
ext {
    minSdkVersion = 30
    compileSdkVersion = 34
    targetSdkVersion = 34
    androidxActivityVersion = '1.8.0'
    androidxAppCompatVersion = '1.6.1'
    androidxCoordinatorLayoutVersion = '1.2.0'
    androidxCoreVersion = '1.12.0'
    androidxFragmentVersion = '1.6.2'
    coreSplashScreenVersion = '1.0.1'
    androidxWebkitVersion = '1.9.0'
    junitVersion = '4.13.2'
    androidxJunitVersion = '1.1.5'
    androidxEspressoCoreVersion = '3.5.1'
    cordovaAndroidVersion = '10.1.1'
    kotlin_version = '1.9.22'
}
```

**Important:** `minSdkVersion = 30` is required by Stripe Terminal SDK.

#### 5b. Update `android/app/build.gradle`

Add `packagingOptions` inside the `android { }` block:

```gradle
android {
    // ... existing configuration ...

    packagingOptions {
        resources.excludes.add("org/bouncycastle/x509/*")
    }
}
```

#### 5c. Add Permissions to `android/app/src/main/AndroidManifest.xml`

Add these permissions inside the `<manifest>` tag (before `<application>`):

```xml
<uses-permission android:name="android.permission.NFC" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
<uses-permission android:name="android.permission.BLUETOOTH_ADVERTISE" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />

<!-- Required for Tap to Pay - declares NFC hardware dependency -->
<uses-feature android:name="android.hardware.nfc" android:required="true" />
```

**Important:** The NFC permission AND feature tag are **required** for Tap to Pay functionality.

#### 5d. Enable Live Mode on Debug Builds (Optional)

If you need to test **Live Mode** Tap to Pay on a debug build, Stripe's SDK will block NFC transactions for security reasons. To bypass this, you must mark the debug build as non-debuggable:

Open `android/app/build.gradle` and add inside the `android { }` block:

```gradle
android {
    // ... existing configuration ...

    buildTypes {
        debug {
            debuggable false  // Required for Stripe Tap to Pay in Live Mode
        }
    }
}
```

⚠️ **Note:** This disables Android Studio's debugger for this build variant. For development debugging, you may want to create a separate build variant or only apply this when testing live payments.

### Step 6: Build the Web App

```bash
npm run build
```

This compiles your React app into the `dist/` folder.

### Step 7: Sync to Native Platform

```bash
npx cap sync android
```

This copies the web build to the Android project and updates native dependencies.

### Step 8: Open in Android Studio

```bash
npx cap open android
```

This opens the Android project in Android Studio.

### Step 9: Run the App

**Option A: Run on Emulator**
1. In Android Studio, click **Device Manager** (phone icon in toolbar)
2. Create a new Virtual Device (Pixel 7 recommended, **API 30+**)
3. Click the **Run** button (green play icon)

**Option B: Run on Physical Device**
1. Enable **Developer Options** on your Android phone:
   - Go to Settings → About Phone → Tap "Build Number" 7 times
2. Enable **USB Debugging** in Developer Options
3. Connect phone via USB
4. Click **Run** in Android Studio

---

## Common Commands Reference

| Command | Description |
|---------|-------------|
| `npm run build` | Build the web app |
| `npx cap sync android` | Sync web build to Android |
| `npx cap open android` | Open in Android Studio |
| `npx cap run android` | Build and run on connected device/emulator |
| `npx cap copy android` | Copy web assets only (faster, no native dependency update) |

---

## Development Workflow

### Hot Reload (During Development)

The app is configured for hot reload from the Lovable sandbox. When running on a device:
- Make changes in Lovable
- Changes appear instantly on device (no rebuild needed)

### Building for Production

When ready to build a release APK:

1. In Android Studio: **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
2. Find APK at: `android/app/build/outputs/apk/debug/app-debug.apk`

For release builds (Play Store):
1. **Build** → **Generate Signed Bundle / APK**
2. Follow the wizard to create a signing key

---

## Troubleshooting

### "SDK location not found"
- Ensure `ANDROID_HOME` environment variable is set correctly
- Create `android/local.properties` file with: `sdk.dir=/path/to/Android/sdk`

### "License not accepted"
```bash
$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager --licenses
# Accept all licenses
```

### Build fails with Gradle errors
```bash
cd android
./gradlew clean
cd ..
npx cap sync android
```

### Stripe Terminal / Tap to Pay build errors

If you get errors related to Stripe Terminal:

1. **Verify minSdkVersion is 30** in `android/variables.gradle`
2. **Verify compileSdkVersion is 34** in `android/variables.gradle`
3. **Verify packagingOptions** is added to `android/app/build.gradle`
4. **Verify Kotlin version** is `1.9.22` or higher
5. Clean and rebuild:
   ```bash
   cd android
   ./gradlew clean
   cd ..
   npx cap sync android
   ```

### App crashes on launch
- Check Android Studio's **Logcat** for error messages
- Ensure all environment variables are set
- Try: `npx cap sync android` again

---

## Stripe Terminal Requirements Summary

| Setting | Required Value | File |
|---------|----------------|------|
| minSdkVersion | 30 | `android/variables.gradle` |
| compileSdkVersion | 34 | `android/variables.gradle` |
| targetSdkVersion | 34 | `android/variables.gradle` |
| kotlin_version | 1.9.22+ | `android/variables.gradle` |
| packagingOptions | See above | `android/app/build.gradle` |
| Permissions | NFC + Location + Bluetooth | `AndroidManifest.xml` |

---

## Need Help?

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Android Studio User Guide](https://developer.android.com/studio/intro)
- [Stripe Terminal Android Docs](https://stripe.com/docs/terminal/payments/setup-integration?terminal-sdk-platform=android)
- Ask in the project Lovable chat
