#!/bin/sh
# vim:ts=2:sw=2:et:ai:sts=2

set -e

# Relative PATH to the workdir from this script (usually . or .., empty means .)
RELPATH_TO_WORKDIR=".."

# Variables
IMAGE_NAME="k3d-registry.lo.kyso.io:5000/kyso-cli"
CONTAINER_NAME="kyso-cli"
BUILD_ARGS=""
BUILD_SECRETS=""
CONTAINER_VARS="-v $HOME:/kyso -u $(id -u):$(id -g)"

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

docker_build() {
  PACKAGE_VERSION="$1"
  if [ -z "$PACKAGE_VERSION" ]; then
    PACKAGE_VERSION="$(
      git ls-remote -tq --sort=v:refname\
        | sed -ne 's%^.*refs/tags/\([0-9.]*\)$%\1%p' | tail -1
    )"
  fi
  # Compute build args
  if [ -f "./.build-args" ]; then
    BUILD_ARGS="$(
      awk '!/^#/ { printf(" --build-arg \"%s\"", $0); }' "./.build-args"
    )"
  fi
  # Compute build secrets if there is a .build_secrets file
  if [ -f "./.build-secrets" ]; then
    BUILD_SECRETS="$(
      awk -f- "./.build-secrets" <<EOF
!/^#/{
  sub("src=.npmrc","src=$NPMRC_DOCKER",\$0);
  printf(" --secret \"%s\"", \$0);
}
EOF
    )"
  fi
  BUILD_TAG="$IMAGE_NAME:$PACKAGE_VERSION"
  DOCKER_COMMAND="$(
    printf "%s" \
      "DOCKER_BUILDKIT=1 docker build${BUILD_ARGS}${BUILD_SECRETS}" \
      " --build-arg 'UPDATED_PACKAGE_VERSION=$PACKAGE_VERSION'" \
      " --tag '$BUILD_TAG' ."
  )"
  eval "$DOCKER_COMMAND"
}

docker_build_prune() {
  DOCKER_BUILDKIT=1 docker builder prune -af
}

docker_rm() {
  docker rm "$CONTAINER_NAME"
}

docker_run() {
  PACKAGE_VERSION="$1"
  if [ -z "$PACKAGE_VERSION" ]; then
    PACKAGE_VERSION="$(
      git ls-remote -tq --sort=v:refname\
        | sed -ne 's%^.*refs/tags/\([0-9.]*\)$%\1%p' | tail -1
    )"
  fi
  if [ "$(docker_status)" ]; then
    docker rm "$CONTAINER_NAME"
  fi
  BUILD_TAG="$IMAGE_NAME:$PACKAGE_VERSION"
  DOCKER_COMMAND="$(
    printf "%s" \
      "docker run -ti --rm --name '$CONTAINER_NAME' $CONTAINER_VARS" \
      " '$BUILD_TAG'"
  )"
  eval "$DOCKER_COMMAND"
}

docker_sh() {
  docker exec -ti "$CONTAINER_NAME" /bin/sh
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
- setup: prepare local files (.npmrc.kyso & .env.docker)
- build: create container using the passed package version
- build-prune: cleanup builder caché
- run: run container in daemon mode with the right settings
- stop|status|rm|logs: operations on the container
- sh: execute interactive shell (/bin/sh) on the running container
EOF
}

# ----
# MAIN
# ----

cd_to_workdir
echo "WORKING DIRECTORY = '$(pwd)'"
echo ""

case "$1" in
build) shift && docker_build "$@";;
build-prune) docker_build_prune ;;
logs) shift && docker_logs "$@" ;;
rm) docker_rm ;;
setup) docker_setup ;;
sh) docker_sh ;;
run) shift && docker_run "$@";;
status) docker_status ;;
stop) docker_stop ;;
*) usage ;;
esac
