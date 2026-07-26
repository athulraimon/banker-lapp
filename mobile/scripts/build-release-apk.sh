#!/usr/bin/env bash
# Builds a signed release APK for Banker Lapp and prints the SHA-1 you must
# register with Google Cloud (Android OAuth client).
#
# Prerequisites:
#   - mobile/.env.local has the FINAL EXPO_PUBLIC_API_URL and EXPO_PUBLIC_WEB_CLIENT_ID
#   - android/keystore.properties exists (created once by this script)
set -euo pipefail

cd "$(dirname "$0")/.."
MOBILE_DIR="$(pwd)"
ANDROID_DIR="$MOBILE_DIR/android"
APP_DIR="$ANDROID_DIR/app"
KEYSTORE="$APP_DIR/banker-lapp-release.keystore"
PROPS="$ANDROID_DIR/keystore.properties"

KEYTOOL="${KEYTOOL:-keytool}"

# 1. Create a release keystore + credentials on first run.
if [[ ! -f "$KEYSTORE" ]]; then
  echo "==> No release keystore found. Generating one..."
  # No default password here on purpose: a hardcoded fallback ends up committed,
  # and this signs the APK your friends install. Supply it from the environment.
  if [[ -z "${BANKER_STORE_PASS:-}" ]]; then
    echo "ERROR: set BANKER_STORE_PASS before generating a keystore, e.g." >&2
    echo "  BANKER_STORE_PASS='...' bash scripts/build-release-apk.sh" >&2
    exit 1
  fi
  STORE_PASS="$BANKER_STORE_PASS"
  "$KEYTOOL" -genkeypair -v \
    -keystore "$KEYSTORE" -alias banker-lapp \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$STORE_PASS" -keypass "$STORE_PASS" \
    -dname "CN=Banker Lapp, OU=Mobile, O=Banker Lapp, L=NA, S=NA, C=IN"
  cat > "$PROPS" <<EOF
BANKER_UPLOAD_STORE_FILE=banker-lapp-release.keystore
BANKER_UPLOAD_STORE_PASSWORD=$STORE_PASS
BANKER_UPLOAD_KEY_ALIAS=banker-lapp
BANKER_UPLOAD_KEY_PASSWORD=$STORE_PASS
EOF
  echo "==> Wrote $PROPS (keep it private)."
fi

if [[ ! -f "$PROPS" ]]; then
  echo "ERROR: $PROPS missing but keystore exists. Recreate keystore.properties." >&2
  exit 1
fi

# 2. Load signing credentials.
# shellcheck disable=SC1090
source "$PROPS"

echo "==> Building signed release APK (this can take a few minutes)..."
cd "$ANDROID_DIR"
./gradlew :app:assembleRelease \
  -PBANKER_UPLOAD_STORE_FILE="$BANKER_UPLOAD_STORE_FILE" \
  -PBANKER_UPLOAD_STORE_PASSWORD="$BANKER_UPLOAD_STORE_PASSWORD" \
  -PBANKER_UPLOAD_KEY_ALIAS="$BANKER_UPLOAD_KEY_ALIAS" \
  -PBANKER_UPLOAD_KEY_PASSWORD="$BANKER_UPLOAD_KEY_PASSWORD"

APK="$APP_DIR/build/outputs/apk/release/app-release.apk"
echo
echo "======================================================================"
echo " APK: $APK"
echo
echo " Register this SHA-1 in your Google Android OAuth client"
echo " (package: com.athulraimon.mobile):"
"$KEYTOOL" -list -v -keystore "$KEYSTORE" -alias "$BANKER_UPLOAD_KEY_ALIAS" \
  -storepass "$BANKER_UPLOAD_STORE_PASSWORD" 2>/dev/null | grep "SHA1:" || true
echo "======================================================================"
