#!/bin/sh
# vim:ts=2:sw=2:et:ai:sts=2

set -e

# Relative PATH to the workdir from this script (usually . or .., empty means .)
RELPATH_TO_WORKDIR=".."

# Variables
IMAGE_NAME=""
CONTAINER_NAME="kyso-cli-builder"
NPMRC_KYSO=".npmrc.kyso"
NPMRC_DOCKER=".npmrc.docker"

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

docker_setup() {
  if [ ! -f "$NPMRC_KYSO" ]; then
    PACKAGE_READER_TOKEN=""
    echo "Please, create a personal access token with read_api scope"
    echo "URL: https://gitlab.kyso.io/-/profile/personal_access_tokens"
    while [ -z "$PACKAGE_READER_TOKEN" ]; do
      printf "Token value: "
      read -r PACKAGE_READER_TOKEN
    done
    cat >"$NPMRC_KYSO" <<EOF

@kyso-io:registry=https://gitlab.kyso.io/api/v4/packages/npm/
//gitlab.kyso.io/api/v4/packages/npm/:_authToken=${PACKAGE_READER_TOKEN}
EOF
  fi
  # Prepare .npmrc.docker
  if [ -f ".npmrc" ]; then
    cat ".npmrc" "$NPMRC_KYSO" >"$NPMRC_DOCKER"
  else
    cat "$NPMRC_KYSO" >"$NPMRC_DOCKER"
  fi
}

docker_rm() {
  docker rm "$CONTAINER_NAME"
}

docker_run() {
  if [ "$(docker_status)" ]; then
    docker rm "$CONTAINER_NAME"
  fi
  DOCKER_COMMAND="$(
    printf "%s" \
      "docker run -ti --rm --name '$CONTAINER_NAME' " \
      " --workdir /root" \
      " -v $(pwd):/src -v $(pwd)/.npmrc.docker:/root/.npmrc:ro" \
      " $IMAGE_NAME $*"
  )"
  eval "$DOCKER_COMMAND"
}

docker_status() {
  docker ps -a -f name="${CONTAINER_NAME}" --format '{{.Status}}' 2>/dev/null ||
    true
}

docker_stop() {
  docker stop "$CONTAINER_NAME"
  docker rm "$CONTAINER_NAME"
}

usage() {
  cat <<EOF
Usage: $0 CMND [ARGS]

Where CMND can be one of:
- binst: build installer tgz
- setup: prepare local files (.npmrc.kyso & .env.docker)
- run: run shell in container with the right settings
- stop|status|rm|logs: operations on the container
EOF
}

# ----
# MAIN
# ----

cd_to_workdir
echo "WORKING DIRECTORY = '$(pwd)'"
echo ""

IMAGE_NAME="$(sed -ne '/builder-v/ { s/^.*image: //p; q }' .gitlab-ci.yml)"

case "$1" in
binst) docker_run /src/sbin/build-installer.sh "$2" ;;
rm) docker_rm ;;
setup) docker_setup ;;
run) docker_run /bin/sh ;;
status) docker_status ;;
stop) docker_stop ;;
*) usage ;;
esac
