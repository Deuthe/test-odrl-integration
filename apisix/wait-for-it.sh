#!/bin/sh
# wait-for-it.sh

set -e

hostport="$1"
shift
cmd="$@"

# Extract host and port
host=$(echo "$hostport" | cut -d: -f1)
port=$(echo "$hostport" | cut -d: -f2)

until (echo > /dev/tcp/$host/$port) >/dev/null 2>&1; do
  >&2 echo "etcd is unavailable - sleeping"
  sleep 1
done

>&2 echo "etcd is up - executing command"
exec $cmd