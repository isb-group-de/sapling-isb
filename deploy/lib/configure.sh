#!/usr/bin/env bash

set -Eeuo pipefail

readonly LIB_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$LIB_DIR/common.sh"

require_root
umask 077

existing=false
if [[ -f "$SAPLING_CONFIG_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$SAPLING_CONFIG_FILE"
  existing=true
fi

APP_ROOT="${APP_ROOT:-/var/www/sapling}"
APP_USER="${APP_USER:-sapling}"
APP_GROUP="${APP_GROUP:-$APP_USER}"
APP_HOME="${APP_HOME:-/home/$APP_USER}"
GIT_URL="${GIT_URL:-https://github.com/martin-rosbund/sapling.git}"
GIT_REF="${GIT_REF:-main}"
DOMAIN="${DOMAIN:-}"
ADMIN_EMAIL="${ADMIN_EMAIL:-}"
SEED_MODE="${SEED_MODE:-}"
DATABASE_MODE="${DATABASE_MODE:-local}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-sapling}"
DB_USER="${DB_USER:-sapling}"
DB_PASSWORD="${DB_PASSWORD:-}"
REDIS_MODE="${REDIS_MODE:-local}"
REDIS_HOST="${REDIS_HOST:-127.0.0.1}"
REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_USERNAME="${REDIS_USERNAME:-}"
REDIS_PASSWORD="${REDIS_PASSWORD:-}"
TLS_MODE="${TLS_MODE:-letsencrypt}"
TLS_CERT_SOURCE="${TLS_CERT_SOURCE:-}"
TLS_KEY_SOURCE="${TLS_KEY_SOURCE:-}"
SAPLING_SECRET="${SAPLING_SECRET:-}"
AZURE_ENABLED="${AZURE_ENABLED:-false}"
AZURE_TENANT_ID="${AZURE_TENANT_ID:-}"
AZURE_CLIENT_ID="${AZURE_CLIENT_ID:-}"
AZURE_CLIENT_SECRET="${AZURE_CLIENT_SECRET:-}"
GOOGLE_ENABLED="${GOOGLE_ENABLED:-false}"
GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:-}"
GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET:-}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"
KEEP_BACKUPS="${KEEP_BACKUPS:-7}"

if [[ "$existing" == "true" && "$TLS_MODE" == "custom" ]]; then
  [[ -f "$TLS_CERT_SOURCE" ]] || TLS_CERT_SOURCE=/etc/nginx/ssl/sapling/fullchain.pem
  [[ -f "$TLS_KEY_SOURCE" ]] || TLS_KEY_SOURCE=/etc/nginx/ssl/sapling/privkey.pem
fi

printf '\nSapling-Konfigurationsassistent\n\n'
if [[ "$existing" == "false" ]]; then
  prompt_value APP_ROOT "Anwendungsverzeichnis" "$APP_ROOT"
  prompt_value APP_USER "Systembenutzer" "$APP_USER"
else
  log "Anwendungsverzeichnis und Systembenutzer bleiben unverändert: $APP_ROOT ($APP_USER)"
fi
APP_GROUP="$APP_USER"
APP_HOME="/home/$APP_USER"
prompt_value GIT_URL "Git-Repository" "$GIT_URL"
prompt_value GIT_REF "Git-Branch, Tag oder Commit" "$GIT_REF"
prompt_value DOMAIN "Öffentliche Domain" "$DOMAIN"
prompt_value ADMIN_EMAIL "E-Mail für Zertifikatsmeldungen" "$ADMIN_EMAIL"

validate_absolute_path "$APP_ROOT"
validate_simple_name "$APP_USER"
validate_domain "$DOMAIN"
validate_email "$ADMIN_EMAIL"
[[ "$GIT_URL" =~ ^(https?://|ssh://|git@) ]] || die "Git-URL muss HTTPS oder SSH verwenden."
validate_no_newline "$GIT_REF"
ensure_app_identity "$APP_USER" "$APP_GROUP" "$APP_HOME"

while [[ "$SEED_MODE" != "production" && "$SEED_MODE" != "demonstration" ]]; do
  prompt_value SEED_MODE "Seed-Datensatz (production/demonstration)" "$SEED_MODE"
done

prompt_value DATABASE_MODE "PostgreSQL-Modus (local/external)" "$DATABASE_MODE"
[[ "$DATABASE_MODE" == "local" || "$DATABASE_MODE" == "external" ]] \
  || die "PostgreSQL-Modus muss local oder external sein."
if [[ "$DATABASE_MODE" == "external" ]]; then
  prompt_value DB_HOST "PostgreSQL-Host" "$DB_HOST"
  prompt_value DB_PORT "PostgreSQL-Port" "$DB_PORT"
else
  DB_HOST="127.0.0.1"
  DB_PORT="5432"
fi
prompt_value DB_NAME "Datenbankname" "$DB_NAME"
prompt_value DB_USER "Datenbankbenutzer" "$DB_USER"
validate_port "$DB_PORT"
validate_no_newline "$DB_NAME"
validate_no_newline "$DB_USER"
new_secret=''
prompt_secret new_secret "Datenbankkennwort" "$existing"
if [[ -n "$new_secret" ]]; then
  DB_PASSWORD="$new_secret"
elif [[ -z "$DB_PASSWORD" ]]; then
  DB_PASSWORD="$(random_secret 24)"
  log "Ein zufälliges Datenbankkennwort wurde erzeugt."
fi

prompt_value REDIS_MODE "Redis-Modus (local/external/disabled)" "$REDIS_MODE"
[[ "$REDIS_MODE" =~ ^(local|external|disabled)$ ]] || die "Ungültiger Redis-Modus."
if [[ "$REDIS_MODE" == "external" ]]; then
  prompt_value REDIS_HOST "Redis-Host" "$REDIS_HOST"
  prompt_value REDIS_PORT "Redis-Port" "$REDIS_PORT"
  prompt_value REDIS_USERNAME "Redis-Benutzer (optional)" "$REDIS_USERNAME"
  new_secret=''
  prompt_secret new_secret "Redis-Kennwort" "$existing"
  [[ -n "$new_secret" ]] && REDIS_PASSWORD="$new_secret"
elif [[ "$REDIS_MODE" == "local" ]]; then
  REDIS_HOST="127.0.0.1"
  REDIS_PORT="6379"
  REDIS_USERNAME=''
  [[ -n "$REDIS_PASSWORD" ]] || REDIS_PASSWORD="$(random_secret 24)"
else
  REDIS_USERNAME=''
  REDIS_PASSWORD=''
fi
validate_port "$REDIS_PORT"

prompt_value TLS_MODE "TLS-Modus (letsencrypt/custom)" "$TLS_MODE"
[[ "$TLS_MODE" == "letsencrypt" || "$TLS_MODE" == "custom" ]] || die "Ungültiger TLS-Modus."
if [[ "$TLS_MODE" == "custom" ]]; then
  prompt_value TLS_CERT_SOURCE "Pfad zum Zertifikat/Fullchain" "$TLS_CERT_SOURCE"
  prompt_value TLS_KEY_SOURCE "Pfad zum privaten Schlüssel" "$TLS_KEY_SOURCE"
  [[ -f "$TLS_CERT_SOURCE" && -f "$TLS_KEY_SOURCE" ]] || die "Zertifikat oder Schlüssel nicht gefunden."
  validate_absolute_path "$TLS_CERT_SOURCE"
  validate_absolute_path "$TLS_KEY_SOURCE"
fi

if confirm "Azure-Anmeldung konfigurieren?" "$([[ "$AZURE_ENABLED" == "true" ]] && echo j || echo n)"; then
  AZURE_ENABLED=true
  prompt_value AZURE_TENANT_ID "Azure Tenant-ID" "$AZURE_TENANT_ID"
  prompt_value AZURE_CLIENT_ID "Azure Client-ID" "$AZURE_CLIENT_ID"
  new_secret=''
  prompt_secret new_secret "Azure Client-Secret" "$existing"
  [[ -n "$new_secret" ]] && AZURE_CLIENT_SECRET="$new_secret"
  [[ -n "$AZURE_TENANT_ID" && -n "$AZURE_CLIENT_ID" && -n "$AZURE_CLIENT_SECRET" ]] \
    || die "Azure benötigt Tenant-ID, Client-ID und Client-Secret."
else
  AZURE_ENABLED=false
fi

if confirm "Google-Anmeldung konfigurieren?" "$([[ "$GOOGLE_ENABLED" == "true" ]] && echo j || echo n)"; then
  GOOGLE_ENABLED=true
  prompt_value GOOGLE_CLIENT_ID "Google Client-ID" "$GOOGLE_CLIENT_ID"
  new_secret=''
  prompt_secret new_secret "Google Client-Secret" "$existing"
  [[ -n "$new_secret" ]] && GOOGLE_CLIENT_SECRET="$new_secret"
  [[ -n "$GOOGLE_CLIENT_ID" && -n "$GOOGLE_CLIENT_SECRET" ]] \
    || die "Google benötigt Client-ID und Client-Secret."
else
  GOOGLE_ENABLED=false
fi

[[ -n "$SAPLING_SECRET" ]] || SAPLING_SECRET="$(random_secret 48)"

temp_config="$(mktemp)"
for setting in APP_ROOT APP_USER APP_GROUP APP_HOME GIT_URL GIT_REF DOMAIN ADMIN_EMAIL SEED_MODE \
  DATABASE_MODE DB_HOST DB_PORT DB_NAME DB_USER DB_PASSWORD REDIS_MODE REDIS_HOST REDIS_PORT \
  REDIS_USERNAME REDIS_PASSWORD TLS_MODE TLS_CERT_SOURCE TLS_KEY_SOURCE SAPLING_SECRET \
  AZURE_ENABLED AZURE_TENANT_ID AZURE_CLIENT_ID AZURE_CLIENT_SECRET GOOGLE_ENABLED \
  GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET KEEP_RELEASES KEEP_BACKUPS; do
  write_shell_setting "$temp_config" "$setting" "${!setting}"
done

if [[ -f "$SAPLING_CONFIG_FILE" ]]; then
  backup_name="${SAPLING_CONFIG_FILE}.$(date -u +%Y%m%d%H%M%S).bak"
  install -m 0600 "$SAPLING_CONFIG_FILE" "$backup_name"
  log "Vorherige Konfiguration gesichert: $backup_name"
fi
atomic_install "$temp_config" "$SAPLING_CONFIG_FILE" 0600 root root
rm -f "$temp_config"
log "Konfiguration gespeichert: $SAPLING_CONFIG_FILE"

admin_file="$APP_ROOT/shared/deployment/initial-admin.input"
if [[ "$existing" == "false" || ( ! -e "$APP_ROOT/current" && ! -f "$admin_file" ) ]]; then
  admin_login=''
  admin_password=''
  admin_confirm=''
  prompt_value admin_login "Loginname des ersten Administrators" "admin"
  [[ "$admin_login" =~ ^[A-Za-z0-9._@-]{3,64}$ ]] || die "Ungültiger Administrator-Loginname."
  prompt_secret admin_password "Kennwort des ersten Administrators"
  prompt_secret admin_confirm "Kennwort bestätigen"
  [[ "$admin_password" == "$admin_confirm" ]] || die "Die Kennwörter stimmen nicht überein."
  validate_strong_password "$admin_password"
  install -d -m 0750 -o "$APP_USER" -g "$APP_GROUP" "$APP_ROOT/shared/deployment"
  {
    printf '%s' "$admin_login" | base64 -w 0
    printf '\n'
    printf '%s' "$admin_password" | base64 -w 0
    printf '\n'
  } > "$admin_file"
  chown "$APP_USER:$APP_GROUP" "$admin_file"
  chmod 0600 "$admin_file"
  unset admin_password admin_confirm
fi
