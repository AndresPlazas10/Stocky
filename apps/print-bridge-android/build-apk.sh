#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
SDK_DIR="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
JAVA_HOME_DEFAULT="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
if [[ -z "${JAVA_HOME:-}" && -x "$JAVA_HOME_DEFAULT/bin/java" ]]; then
  export JAVA_HOME="$JAVA_HOME_DEFAULT"
fi
export PATH="${JAVA_HOME:-}/bin:$PATH"
PLATFORM_DIR="$SDK_DIR/platforms/android-36.1"
BUILD_TOOLS_DIR="$SDK_DIR/build-tools/36.1.0"

AAPT2="$BUILD_TOOLS_DIR/aapt2"
D8="$BUILD_TOOLS_DIR/d8"
ZIPALIGN="$BUILD_TOOLS_DIR/zipalign"
APKSIGNER="$BUILD_TOOLS_DIR/apksigner"
ANDROID_JAR="$PLATFORM_DIR/android.jar"

BUILD_DIR="$ROOT_DIR/build"
DIST_DIR="$ROOT_DIR/dist"
GEN_DIR="$BUILD_DIR/gen"
CLASSES_DIR="$BUILD_DIR/classes"
DEX_DIR="$BUILD_DIR/dex"
RES_ZIP="$BUILD_DIR/resources.zip"
UNSIGNED_APK="$BUILD_DIR/stocky-print-bridge-unsigned.apk"
ALIGNED_APK="$BUILD_DIR/stocky-print-bridge-aligned.apk"
KEYSTORE="$ROOT_DIR/debug.keystore"
FINAL_APK="$DIST_DIR/stocky-print-bridge-debug.apk"

rm -rf "$BUILD_DIR" "$DIST_DIR"
mkdir -p "$GEN_DIR" "$CLASSES_DIR" "$DEX_DIR" "$DIST_DIR"

"$AAPT2" compile --dir "$ROOT_DIR/res" -o "$RES_ZIP"
"$AAPT2" link \
  -I "$ANDROID_JAR" \
  --manifest "$ROOT_DIR/AndroidManifest.xml" \
  --java "$GEN_DIR" \
  --min-sdk-version 23 \
  --target-sdk-version 36 \
  -o "$UNSIGNED_APK" \
  "$RES_ZIP"

"${JAVA_HOME:-}/bin/javac" \
  -encoding UTF-8 \
  -source 8 \
  -target 8 \
  -bootclasspath "$ANDROID_JAR" \
  -d "$CLASSES_DIR" \
  $(find "$GEN_DIR" "$ROOT_DIR/src" -name '*.java' | sort)

"$D8" \
  --lib "$ANDROID_JAR" \
  --min-api 23 \
  --output "$DEX_DIR" \
  $(find "$CLASSES_DIR" -name '*.class' | sort)

cd "$DEX_DIR"
zip -q "$UNSIGNED_APK" classes.dex
cd "$ROOT_DIR"

"$ZIPALIGN" -f 4 "$UNSIGNED_APK" "$ALIGNED_APK"

if [[ ! -f "$KEYSTORE" ]]; then
  "${JAVA_HOME:-}/bin/keytool" -genkeypair \
    -keystore "$KEYSTORE" \
    -storepass android \
    -keypass android \
    -alias androiddebugkey \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -dname "CN=Android Debug,O=Stocky,C=CO" >/dev/null
fi

"$APKSIGNER" sign \
  --ks "$KEYSTORE" \
  --ks-pass pass:android \
  --key-pass pass:android \
  --out "$FINAL_APK" \
  "$ALIGNED_APK"

"$APKSIGNER" verify "$FINAL_APK"
echo "$FINAL_APK"
