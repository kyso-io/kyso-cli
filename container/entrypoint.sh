#!/bin/sh
KYSO_HOME="/kyso"
if [ ! -d "$KYSO_HOME" ]; then
  echo "Mount user home @ '$KYSO_HOME'"
  exit 1
fi
HOME_UID="$(stat -c "%u" "$KYSO_HOME")"
USER_UID="$(id -u)"
if [ "$USER_UID" -eq "0" ]; then
  echo "Execute this container using an UID != 0"
  exit 1
elif [ "$HOME_UID" != "$USER_UID" ]; then
  echo "User id '$USER_UID' is different than '$KYSO_HOME' owner id '$HOME_UID'"
  exit 1
fi
export HOME="$KYSO_HOME"
cd "$HOME"
if [ "$*" ]; then
  exec /bin/sh -c "$@"
else
  exec /bin/sh
fi
