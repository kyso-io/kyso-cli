#!/bin/sh
set -e
docker run --rm -ti -v "$HOME:$HOME" -v "$HOME:/kyso" -w "$HOME" \
  -u "$(id -u):$(id -g)" --name kyso kyso/kyso "$@"
