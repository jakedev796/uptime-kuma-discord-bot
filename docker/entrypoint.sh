#!/bin/sh
set -e

# Defaults (can be overridden via env)
PUID="${PUID:-1001}"
PGID="${PGID:-1001}"
DATA_DIR="${DATA_DIR:-/app/data}"

# Create group/user if they don't exist yet
# -S: system user/group (no home), -H: no home dir
if ! getent group "${PGID}" >/dev/null 2>&1; then
  addgroup -g "${PGID}" -S appgroup || true
else
  # If group with that GID exists, reuse its name
  appgroup="$(getent group "${PGID}" | cut -d: -f1)"
  [ -n "$appgroup" ] || appgroup="appgroup"
fi

if ! getent passwd "${PUID}" >/dev/null 2>&1; then
  adduser -u "${PUID}" -S appuser -G appgroup -H || true
else
  appuser="$(getent passwd "${PUID}" | cut -d: -f1)"
  [ -n "$appuser" ] || appuser="appuser"
fi

# Ensure data dir exists
mkdir -p "${DATA_DIR}"

# Try to chown when needed (bind mounts included). If it fails (e.g., read-only), keep going but warn.
if [ -n "${CHOWN_DATA_DIR:-1}" ]; then
  if ! chown -R "${PUID}:${PGID}" "${DATA_DIR}" 2>/dev/null; then
    echo "[WARN] Could not chown ${DATA_DIR} to ${PUID}:${PGID}. If you see EACCES, fix host perms."
  fi
fi

# Sanity: is it writable now?
if ! su-exec "${PUID}:${PGID}" sh -c "test -w '${DATA_DIR}'"; then
  echo "[ERROR] ${DATA_DIR} is not writable by ${PUID}:${PGID}. Check your bind-mount ownership/ACLs."
  exit 13
fi

# Run the app as the requested UID/GID
exec su-exec "${PUID}:${PGID}" "$@"
