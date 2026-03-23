#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/start_site_preview_server.sh --start [--port 8000] [--site-root .]
  scripts/start_site_preview_server.sh --stop  [--site-root .]
  scripts/start_site_preview_server.sh --status [--site-root .]

Environment:
  SITE_PREVIEW_HOST   If set, printed as the LAN base URL (e.g. 192.168.1.5 from ipconfig getifaddr en0).
                      The server always binds 0.0.0.0 so devices on your network can connect.

Default --site-root is the GitHub Pages repo root (parent of this scripts/ directory).
EOF
}

ACTION=""
PORT="8000"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PAGES_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SITE_ROOT_REL="."

while [[ $# -gt 0 ]]; do
  case "$1" in
    --start|--stop|--status)
      ACTION="$1"
      shift
      ;;
    --port)
      PORT="${2:-}"
      shift 2
      ;;
    --site-root)
      SITE_ROOT_REL="${2:-.}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$ACTION" ]]; then
  usage
  exit 1
fi

ABS_SITE_ROOT="$(cd "$PAGES_ROOT" && cd "$SITE_ROOT_REL" && pwd)"
PID_FILE="${ABS_SITE_ROOT}/.preview_server.pid"
LOG_FILE="${ABS_SITE_ROOT}/.preview_server.log"

mkdir -p "${ABS_SITE_ROOT}"

is_running() {
  if [[ ! -f "$PID_FILE" ]]; then
    return 1
  fi
  local pid
  pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  [[ -n "$pid" ]] || return 1
  kill -0 "$pid" 2>/dev/null
}

print_urls() {
  echo "Local: http://127.0.0.1:${PORT}/"
  if [[ -n "${SITE_PREVIEW_HOST:-}" ]]; then
    echo "LAN:   http://${SITE_PREVIEW_HOST}:${PORT}/"
  else
    echo "LAN:   set SITE_PREVIEW_HOST (e.g. your Wi-Fi IP) to print a phone-friendly URL."
  fi
}

start_server() {
  if is_running; then
    local pid
    pid="$(cat "$PID_FILE")"
    echo "Site preview server already running (pid: $pid) on port ${PORT}."
    print_urls
    exit 0
  fi
  (
    cd "$ABS_SITE_ROOT"
    nohup python3 -m http.server "$PORT" --bind 0.0.0.0 >>"$LOG_FILE" 2>&1 &
    echo $! >"$PID_FILE"
  )
  local pid
  pid="$(cat "$PID_FILE")"
  echo "Started site preview server (pid: $pid), serving ${ABS_SITE_ROOT}"
  print_urls
}

stop_server() {
  if ! is_running; then
    rm -f "$PID_FILE"
    echo "Site preview server is not running."
    exit 0
  fi
  local pid
  pid="$(cat "$PID_FILE")"
  kill "$pid" 2>/dev/null || true
  rm -f "$PID_FILE"
  echo "Stopped site preview server (pid: $pid)."
}

status_server() {
  if is_running; then
    local pid
    pid="$(cat "$PID_FILE")"
    echo "RUNNING pid=$pid site_root=${ABS_SITE_ROOT}"
  else
    echo "STOPPED site_root=${ABS_SITE_ROOT}"
  fi
}

case "$ACTION" in
  --start) start_server ;;
  --stop) stop_server ;;
  --status) status_server ;;
esac
