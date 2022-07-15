#!/bin/sh
# vim:ts=2:sw=2:et:ai:sts=2

set -e

# Relative PATH to the workdir from this script (usually . or .., empty means .)
RELPATH_TO_WORKDIR=".."

# Branch for updates
BRANCH="develop"

# Files to check
PACKAGE_JSON="package.json"
VERSION_FILE="version.txt"

# Regex to remove Kyso packages
KYSO_PACKAGES='^[[:blank:]]*"@kyso'

# Terminal related vars
bold="$(tput bold)"
normal="$(tput sgr0)"
yes_no="(${bold}Y${normal}es/${bold}N${normal}o)"

# ---------
# FUNCTIONS
# ---------

# POSIX compliant version of readlinkf (MacOS does not have coreutils) copied
# from https://github.com/ko1nksm/readlinkf/blob/master/readlinkf.sh
_readlinkf_posix() {
  [ "${1:-}" ] || return 1
  max_symlinks=40
  CDPATH='' # to avoid changing to an unexpected directory
  target=$1
  [ -e "${target%/}" ] || target=${1%"${1##*[!/]}"} # trim trailing slashes
  [ -d "${target:-/}" ] && target="$target/"
  cd -P . 2>/dev/null || return 1
  while [ "$max_symlinks" -ge 0 ] && max_symlinks=$((max_symlinks - 1)); do
    if [ ! "$target" = "${target%/*}" ]; then
      case $target in
      /*) cd -P "${target%/*}/" 2>/dev/null || break ;;
      *) cd -P "./${target%/*}" 2>/dev/null || break ;;
      esac
      target=${target##*/}
    fi
    if [ ! -L "$target" ]; then
      target="${PWD%/}${target:+/}${target}"
      printf '%s\n' "${target:-/}"
      return 0
    fi
    # `ls -dl` format: "%s %u %s %s %u %s %s -> %s\n",
    #   <file mode>, <number of links>, <owner name>, <group name>,
    #   <size>, <date and time>, <pathname of link>, <contents of link>
    # https://pubs.opengroup.org/onlinepubs/9699919799/utilities/ls.html
    link=$(ls -dl -- "$target" 2>/dev/null) || break
    target=${link#*" $target -> "}
  done
  return 1
}

# Change to working directory (script dir + the value of RELPATH_TO_WORKDIR)
cd_to_workdir() {
  _script="$(_readlinkf_posix "$0")"
  _script_dir="${_script%/*}"
  if [ "$RELPATH_TO_WORKDIR" ]; then
    cd "$(_readlinkf_posix "$_script_dir/$RELPATH_TO_WORKDIR")"
  else
    cd "$_script_dir"
  fi
}

# $1 text to show - $2 default value
read_value() {
  printf "%s" "${1} [${bold}${2}${normal}]: "
  read -r READ_VALUE
  if [ "${READ_VALUE}" = "" ]; then
    READ_VALUE=$2
  fi
}

isSelected() {
  if [ "${1}" = "Yes" ] || [ "${1}" = "yes" ] || [ "${1}" = "Y" ] ||
    [ "${1}" = "y" ]; then
    echo 1
  else
    echo 0
  fi
}

# ----
# MAIN
# ----

cd_to_workdir
echo "WORKING DIRECTORY = '$(pwd)'"
echo ""

FILE_TO_SHOW="$BRANCH:$PACKAGE_JSON"
UPDATED_FILE="$PACKAGE_JSON-$BRANCH"

git show "$FILE_TO_SHOW" | grep -v "$KYSO_PACKAGES" >"$UPDATED_FILE"
FILE_CHANGES="$(diff -u "$UPDATED_FILE" "$PACKAGE_JSON")" || true
if [ "$FILE_CHANGES" ]; then
  echo "File '$UPDATED_FILE' is different than '$PACKAGE_JSON':"
  echo "$FILE_CHANGES"
  read_value "Update builder? ${yes_no}" "No"
  if [ "$(isSelected "${READ_VALUE}")" = 0 ]; then
    rm -f "$UPDATED_FILE"
    exit 0
  fi
  # Update package-json and version.txt
  cat "$UPDATED_FILE" >"$PACKAGE_JSON"
  rm -f "$UPDATED_FILE"
  CURRENT_VERSION="$(cat $VERSION_FILE)"
  UPDATED_VERSION="${CURRENT_VERSION%.*}.$((${CURRENT_VERSION##*.} + 1))" ||
    (git checkout "$PACKAGE_JSON" && exit 1)
  read_value "Updated version (was '$CURRENT_VERSION')" "$UPDATED_VERSION"
  UPDATED_VERSION="$READ_VALUE"
  read_value "Commit and tag version '$UPDATED_VERSION'? ${yes_no}" "No"
  if [ "$(isSelected "${READ_VALUE}")" = 0 ]; then
    git checkout "$PACKAGE_JSON" && exit 0
  fi
  echo "$UPDATED_VERSION" >"$VERSION_FILE"
  (git commit "$PACKAGE_JSON" "$VERSION_FILE" \
    -m "Updated builder image to $UPDATED_VERSION" && git push &&
    git tag "$UPDATED_VERSION" && git push origin "$UPDATED_VERSION") ||
    (echo "$CURRENT_VERSION" >"$VERSION_FILE" && git checkout "$PACKAGE_JSON")
else
  echo "File '$UPDATED_FILE' is the same as '$PACKAGE_JSON'"
  rm -f "$UPDATED_FILE"
fi
