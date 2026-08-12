#!/usr/bin/env bash

set -Eeuo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

confirm() {
  local prompt="$1"
  local answer

  while true; do
    read -r -p "$prompt [j/n]: " answer
    case "${answer,,}" in
      j|ja|y|yes) return 0 ;;
      n|nein|no) return 1 ;;
      *) echo "Bitte mit 'j' oder 'n' antworten." ;;
    esac
  done
}

echo "Sapling-Deployment in: $SCRIPT_DIR"

install_packages=false
deploy_database=false

if confirm "NPM-Pakete mit 'npm ci' installieren?"; then
  install_packages=true
fi

if confirm "Datenbank-Deployment ausführen?"; then
  deploy_database=true
fi

echo
echo "Stoppe PM2-Prozesse ..."
pm2 stop all

echo
echo "Aktualisiere das Git-Repository ..."
git pull

if [[ "$install_packages" == true ]]; then
  echo
  echo "Installiere NPM-Pakete im Root-Verzeichnis ..."
  npm ci

  echo
  echo "Installiere NPM-Pakete im Frontend ..."
  npm ci --prefix frontend

  echo
  echo "Installiere NPM-Pakete im Backend ..."
  npm ci --prefix backend
else
  echo
  echo "Überspringe die Installation der NPM-Pakete."
fi

echo
echo "Baue Backend und Frontend ..."
npm run build

if [[ "$deploy_database" == true ]]; then
  echo
  echo "Führe das Datenbank-Deployment aus ..."
  npm run orm:deploy
else
  echo
  echo "Überspringe das Datenbank-Deployment."
fi

echo
echo "Starte PM2-Prozesse ..."
pm2 start all

echo
echo "Deployment erfolgreich abgeschlossen."
