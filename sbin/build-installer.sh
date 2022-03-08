#!/bin/sh

set -e

PKG_VERS="$1"
if [ -z "$PKG_VERS" ]; then
  echo "Please, pass a package version number!!!" >/dev/stderr
  exit 1
fi

cp -a /src/. . 2>/dev/null || true

npm install
npm version --allow-same --no-commit-hooks --no-git-tag-version "$PKG_VERS"
npm pack || true

TOKEN="$(sed -ne 's/^.*_authToken=//p' .npmrc | tail -1)"
PKG_NAME="kyso-cli-installer"
PKGS_DIR="$PKG_NAME-$PKG_VERS"
PKGS_TGZ="$PKG_NAME.tgz"

TGZ_URLS=""
while read -r pkg_ref; do
  TGZ_URLS="$TGZ_URLS $(npm view "$pkg_ref" dist.tarball)"
done << EOF
$(sed -n -e 's%^.*"\(@kyso-io/.*\)": "\(.*\)".*$%\1@\2%p' package.json)
EOF
mkdir "$PKGS_DIR"
cd "$PKGS_DIR" || true
mv "../kyso-io-kyso-cli-${PKG_VERS}.tgz" "kyso-cli-${PKG_VERS}.tgz"
HEADER="Authorization: Bearer ${TOKEN}"
for tgz_url in $TGZ_URLS; do
  curl -s -H "$HEADER" "$tgz_url" -O
done
echo '#!/bin/sh' > install.sh
echo 'npm install -g *.tgz' >> install.sh
chmod +x install.sh
cd ..
tar czvf "$PKGS_TGZ" "$PKGS_DIR"
rm -rf "$PKGS_DIR"
chown "$(stat /src/ -c "%u:%g")" "$PKGS_TGZ"
mv "$PKGS_TGZ" /src/
