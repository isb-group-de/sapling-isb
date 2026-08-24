#!/usr/bin/env bash

set -Eeuo pipefail

readonly SAPLING_CONFIG_FILE="${SAPLING_CONFIG_FILE:-/etc/sapling/deployment.conf}"
readonly SAPLING_PHASE_DIR="${SAPLING_PHASE_DIR:-/var/lib/sapling-deployment/phases}"
readonly SAPLING_LOCK_FILE="${SAPLING_LOCK_FILE:-/run/lock/sapling-deployment.lock}"
readonly SAPLING_TESTED_UBUNTU="26.04"
readonly SAPLING_NODE_MAJOR="24"
readonly SAPLING_PM2_VERSION="7.0.3"

log() {
  printf '[%s] %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*"
}

warn() {
  printf 'WARNUNG: %s\n' "$*" >&2
}

die() {
  printf 'FEHLER: %s\n' "$*" >&2
  exit 1
}

require_root() {
  [[ "${EUID}" -eq 0 ]] || die "Dieser Befehl muss mit sudo beziehungsweise als root ausgeführt werden."
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "Benötigter Befehl fehlt: $1"
}

confirm() {
  local prompt="$1"
  local default_answer="${2:-n}"
  local suffix='[j/N]'
  local answer

  [[ "$default_answer" == "j" ]] && suffix='[J/n]'
  while true; do
    read -r -p "$prompt $suffix: " answer
    answer="${answer:-$default_answer}"
    case "${answer,,}" in
      j|ja|y|yes) return 0 ;;
      n|nein|no) return 1 ;;
      *) printf "Bitte mit 'j' oder 'n' antworten.\n" ;;
    esac
  done
}

prompt_value() {
  local target_name="$1"
  local prompt="$2"
  local default_value="${3:-}"
  local value
  local suffix=''

  [[ -n "$default_value" ]] && suffix=" [$default_value]"
  read -r -p "$prompt$suffix: " value
  printf -v "$target_name" '%s' "${value:-$default_value}"
}

prompt_secret() {
  local target_name="$1"
  local prompt="$2"
  local allow_existing="${3:-false}"
  local value

  if [[ "$allow_existing" == "true" ]]; then
    read -r -s -p "$prompt (leer = vorhandenen Wert behalten): " value
  else
    read -r -s -p "$prompt: " value
  fi
  printf '\n'
  printf -v "$target_name" '%s' "$value"
}

validate_simple_name() {
  [[ "$1" =~ ^[a-z_][a-z0-9_-]*$ ]] || die "Ungültiger Name: $1"
}

validate_domain() {
  [[ "$1" =~ ^([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$ ]] \
    || die "Ungültiger vollqualifizierter Domainname: $1"
}

validate_email() {
  [[ "$1" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] \
    || die "Ungültige E-Mail-Adresse: $1"
}

validate_absolute_path() {
  [[ "$1" =~ ^/[A-Za-z0-9._/-]+$ && "$1" != "/" ]] \
    || die "Es wird ein einfacher absoluter, nicht-root Pfad benötigt: $1"
}

validate_port() {
  [[ "$1" =~ ^[0-9]+$ ]] || die "Ungültiger Port: $1"
  (( 10#$1 >= 1 && 10#$1 <= 65535 )) || die "Port außerhalb des gültigen Bereichs: $1"
}

validate_no_newline() {
  [[ "$1" != *$'\n'* && "$1" != *$'\r'* ]] || die "Mehrzeilige Werte werden nicht unterstützt."
}

validate_strong_password() {
  local password="$1"
  local classes=0
  (( ${#password} >= 12 )) || die "Das Kennwort muss mindestens 12 Zeichen lang sein."
  [[ "$password" =~ [a-z] ]] && classes=$((classes + 1))
  [[ "$password" =~ [A-Z] ]] && classes=$((classes + 1))
  [[ "$password" =~ [0-9] ]] && classes=$((classes + 1))
  [[ "$password" =~ [^A-Za-z0-9] ]] && classes=$((classes + 1))
  (( classes >= 3 )) || die "Das Kennwort muss Zeichen aus mindestens drei Klassen enthalten."
}

random_secret() {
  openssl rand -hex "${1:-32}"
}

dotenv_value() {
  local value="$1"
  validate_no_newline "$value"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  printf '"%s"' "$value"
}

compose_env_value() {
  local value="$1"
  validate_no_newline "$value"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//\$/\$\$}"
  printf '"%s"' "$value"
}

write_shell_setting() {
  local file="$1"
  local name="$2"
  local value="$3"
  printf '%s=%q\n' "$name" "$value" >> "$file"
}

atomic_install() {
  local source="$1"
  local target="$2"
  local mode="${3:-0640}"
  local owner="${4:-root}"
  local group="${5:-root}"
  local target_dir
  local temp

  target_dir="$(dirname "$target")"
  install -d -m 0755 "$target_dir"
  temp="$(mktemp "$target_dir/.sapling.XXXXXX")"
  install -m "$mode" -o "$owner" -g "$group" "$source" "$temp"
  mv -f "$temp" "$target"
}

load_config() {
  [[ -f "$SAPLING_CONFIG_FILE" ]] || die "Deployment-Konfiguration fehlt: $SAPLING_CONFIG_FILE"
  # shellcheck disable=SC1090
  source "$SAPLING_CONFIG_FILE"
}

run_as_app() {
  runuser -u "$APP_USER" -- "$@"
}

phase_done() {
  [[ -f "$SAPLING_PHASE_DIR/$1" ]]
}

mark_phase() {
  install -d -m 0755 "$SAPLING_PHASE_DIR"
  touch "$SAPLING_PHASE_DIR/$1"
}

acquire_lock() {
  if [[ "${SAPLING_LOCK_ACQUIRED:-false}" == "true" ]]; then
    return
  fi
  install -d -m 0755 "$(dirname "$SAPLING_LOCK_FILE")"
  exec 9>"$SAPLING_LOCK_FILE"
  flock -n 9 || die "Ein anderer Sapling-Setup- oder Deployment-Prozess läuft bereits."
  SAPLING_LOCK_ACQUIRED=true
  export SAPLING_LOCK_ACQUIRED
}

ensure_app_identity() {
  local user="$1"
  local group="$2"
  local home="$3"

  validate_simple_name "$user"
  validate_simple_name "$group"
  getent group "$group" >/dev/null || groupadd --system "$group"
  if ! id -u "$user" >/dev/null 2>&1; then
    useradd --system --gid "$group" --create-home --home-dir "$home" --shell /bin/bash "$user"
  fi
}

current_release_target() {
  readlink -f "$APP_ROOT/current" 2>/dev/null || true
}

current_release_commit() {
  local target
  target="$(current_release_target)"
  [[ -f "$target/.sapling-release" ]] || return 0
  sed -n 's/^commit=//p; /^commit=/q' "$target/.sapling-release"
}

install_toolkit() {
  local source_dir="$1"

  install -d -m 0755 /usr/local/lib/sapling-deployment /usr/local/share/sapling-deployment/templates
  install -m 0755 "$source_dir/saplingctl" /usr/local/sbin/saplingctl
  install -m 0755 "$source_dir/setup.sh" /usr/local/lib/sapling-deployment/setup.sh
  install -m 0644 "$source_dir/lib/common.sh" /usr/local/lib/sapling-deployment/common.sh
  install -m 0755 "$source_dir/lib/configure.sh" /usr/local/lib/sapling-deployment/configure.sh
  install -m 0644 "$source_dir/templates/"* /usr/local/share/sapling-deployment/templates/
}
