#!/bin/sh
# Check types for the provided files only
# See https://stackoverflow.com/a/60950355/17357241
set -e
TMP=".tsconfig-lint.json"
cat >"$TMP" <<EOF
{
  "extends": "./tsconfig.json",
  "include": [
EOF
for file in "$@"; do
  echo "    \"$file\","
done >>"$TMP"
cat >>"$TMP" <<EOF
    "**/*.d.ts"
  ]
}
EOF
tsc --project "$TMP" --skipLibCheck --noEmit
rm -f "$TMP"
