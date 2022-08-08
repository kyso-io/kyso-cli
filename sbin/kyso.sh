#!/bin/sh
set -e
docker run --rm -ti -v "$HOME:$HOME" -e "HOME=$HOME" -w "$(pwd)" \
  -u "$(id -u):$(id -g)" --name kyso kyso/kyso kyso "$@"
