#!/bin/sh
set -eu
# The mount root is prepared as root; application and both child processes run as node.
if [ "$(id -u)" = "0" ]; then
  mkdir -p "${DATA_DIR:-/data/im-status-local}"
  chown node:node "${DATA_DIR:-/data/im-status-local}"
  chmod 700 "${DATA_DIR:-/data/im-status-local}"
  exec gosu node "$@"
fi
exec "$@"
