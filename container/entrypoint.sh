#!/bin/sh
USER_NAME="user"
USER_SHELL="/bin/sh"
USER_HOME="/home"
KYSO_DIR="$USER_HOME/.kyso"
if [ ! -d "$KYSO_DIR" ]; then
  KYSO_DIR="$HOME/.kyso"
  [ -d "$KYSO_DIR" ] || mkdir "$KYSO_DIR"
fi
USER_UID="$(stat -c "%u" "$KYSO_DIR")"
USER_GID="$(stat -c "%g" "$KYSO_DIR")"
if [ "$USER_UID" -eq "0" ] && [ "$USER_GID" -eq "0" ]; then
  if [ "$*" ]; then
    exec /bin/sh -c "$@"
  else
    exec su -
  fi
fi
adduser -D -h "$USER_HOME" -u "$USER_UID" -s "$USER_SHELL" "$USER_NAME" \
  "$USER_GID" >/dev/null 2>&1
chown -R "$USER_UID:$USER_GID" "$USER_HOME" 2>/dev/null
if [ "$*" ]; then
  exec su user -- /bin/sh -c "$@"
else
  exec su - user
fi
