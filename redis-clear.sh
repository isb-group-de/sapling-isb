#!/usr/bin/env bash

set -Eeuo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly PM2_PROCESS_NAME="Sapling"
readonly CLEANER_PATH="$SCRIPT_DIR/backend/dist/maintenance/clear-failed-queue-jobs.js"

cd "$SCRIPT_DIR"

backend_was_running=false

die() {
  echo "Fehler: $*" >&2
  exit 1
}

confirm() {
  local prompt="$1"
  local answer

  while true; do
    read -r -p "$prompt [j/n] " answer
    case "$answer" in
      j|J|ja|JA|Ja)
        return 0
        ;;
      n|N|nein|NEIN|Nein|"")
        return 1
        ;;
      *)
        echo "Bitte mit j oder n antworten."
        ;;
    esac
  done
}

restart_backend_on_exit() {
  local exit_code=$?
  trap - EXIT

  if [[ "$backend_was_running" == true ]]; then
    echo
    echo "Starte $PM2_PROCESS_NAME wieder ..."
    if ! pm2 restart "$PM2_PROCESS_NAME"; then
      echo "Fehler: $PM2_PROCESS_NAME konnte nicht neu gestartet werden." >&2
      exit_code=1
    elif ! pm2 save --force; then
      echo "Fehler: Der neue PM2-Status konnte nicht gespeichert werden." >&2
      exit_code=1
    fi
  fi

  exit "$exit_code"
}

command -v npm >/dev/null 2>&1 || die "npm wurde nicht gefunden."
command -v pm2 >/dev/null 2>&1 || die "pm2 wurde nicht gefunden."
command -v grep >/dev/null 2>&1 || die "grep wurde nicht gefunden."

[[ -f "$CLEANER_PATH" ]] || die \
  "Der Queue-Cleaner wurde noch nicht gebaut. Bitte zuerst das aktuelle Deployment ausfuehren."

pm2 describe "$PM2_PROCESS_NAME" >/dev/null 2>&1 || die \
  "Der PM2-Prozess '$PM2_PROCESS_NAME' wurde fuer den aktuellen Benutzer nicht gefunden. Fuehre das Skript als derselbe Benutzer aus, dem der Sapling-PM2-Prozess gehoert."

echo "Sapling Redis-Wartung in: $SCRIPT_DIR"
echo
echo "Vorschau der fehlgeschlagenen Queue-Jobs:"
npm run queues:clear-failed --prefix backend

echo
echo "Es werden ausschliesslich fehlgeschlagene Jobs der bekannten Sapling-Queues geloescht."
echo "Wartende, aktive, verzoegerte und abgeschlossene Jobs sowie andere Redis-Daten bleiben erhalten."
echo "Redis selbst muss waehrend der Wartung erreichbar bleiben."

if ! confirm "Backend kurz anhalten und die angezeigten fehlgeschlagenen Jobs loeschen?"; then
  echo "Abgebrochen. Es wurden keine Daten veraendert."
  exit 0
fi

trap restart_backend_on_exit EXIT

if pm2 pid "$PM2_PROCESS_NAME" | grep -Eq '^[1-9][0-9]*$'; then
  echo
  echo "Stoppe $PM2_PROCESS_NAME ..."
  pm2 stop "$PM2_PROCESS_NAME"
  backend_was_running=true
else
  echo
  echo "$PM2_PROCESS_NAME ist bereits gestoppt und wird nach der Wartung nicht automatisch gestartet."
fi

echo
echo "Loesche fehlgeschlagene Sapling-Queue-Jobs ..."
npm run queues:clear-failed --prefix backend -- --confirm

echo
echo "Redis-Wartung erfolgreich abgeschlossen."
