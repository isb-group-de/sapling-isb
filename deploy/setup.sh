#!/usr/bin/env bash

set -Eeuo pipefail

readonly DEPLOY_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$DEPLOY_DIR/lib/common.sh"

require_root
require_command flock
acquire_lock

if [[ ! -r /etc/os-release ]]; then
  die "Ubuntu konnte nicht erkannt werden."
fi
# shellcheck disable=SC1091
source /etc/os-release
[[ "${ID:-}" == "ubuntu" ]] || die "Dieses Setup unterstützt ausschließlich Ubuntu."
if [[ "${VERSION_ID:-}" != "$SAPLING_TESTED_UBUNTU" ]]; then
  warn "Getestet ist Ubuntu $SAPLING_TESTED_UBUNTU; erkannt wurde ${VERSION_ID:-unbekannt}."
  confirm "Auf dieser nicht getesteten Ubuntu-Version fortfahren?" n \
    || die "Setup auf Wunsch abgebrochen."
fi

case "$(dpkg --print-architecture)" in
  amd64|arm64) ;;
  *) die "Unterstützt werden nur Ubuntu amd64 und arm64." ;;
esac

if ! phase_done system-updated; then
  log "Ubuntu wird vollständig aktualisiert."
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get -y full-upgrade
  apt-get install -y --no-install-recommends unattended-upgrades
  dpkg-reconfigure -f noninteractive unattended-upgrades
  mark_phase system-updated
fi

if [[ -f /var/run/reboot-required ]]; then
  log "Ein Neustart ist erforderlich. Bitte 'sudo reboot' ausführen und danach dieses Setup erneut starten."
  exit 20
fi

install_base_packages() {
  log "Basispakete werden installiert."
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    ca-certificates curl dnsutils git gnupg nginx openssl postgresql-client redis-tools \
    rsync software-properties-common tar ufw certbot python3-certbot-nginx
}

install_node() {
  if command -v node >/dev/null 2>&1 && [[ "$(node --version)" =~ ^v${SAPLING_NODE_MAJOR}\. ]]; then
    return
  fi
  log "Node.js ${SAPLING_NODE_MAJOR} LTS wird installiert."
  install -d -m 0755 /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
    | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
  printf 'deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_%s.x nodistro main\n' \
    "$SAPLING_NODE_MAJOR" > /etc/apt/sources.list.d/nodesource.list
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
  [[ "$(node --version)" =~ ^v${SAPLING_NODE_MAJOR}\. ]] \
    || die "Unerwartete Node.js-Version: $(node --version)"
}

install_docker() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    systemctl enable --now docker
    return
  fi
  log "Docker Engine und Compose werden installiert."
  install -d -m 0755 /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor --yes -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  architecture="$(dpkg --print-architecture)"
  codename="$(. /etc/os-release && printf '%s' "$VERSION_CODENAME")"
  printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu %s stable\n' \
    "$architecture" "$codename" > /etc/apt/sources.list.d/docker.list
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
}

runtime_phase="runtime-node${SAPLING_NODE_MAJOR}-pm2-${SAPLING_PM2_VERSION//./-}"
if ! phase_done "$runtime_phase"; then
  install_base_packages
  install_node
  install_docker
  npm install --global "pm2@$SAPLING_PM2_VERSION"
  [[ "$(pm2 --version)" == "$SAPLING_PM2_VERSION" ]] \
    || die "Unerwartete PM2-Version: $(pm2 --version)"
  mark_phase "$runtime_phase"
fi

if [[ -f "$SAPLING_CONFIG_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$SAPLING_CONFIG_FILE"
  if phase_done application-deployed && [[ -e "$APP_ROOT/current" ]]; then
    log "Das Setup ist bereits vollständig abgeschlossen. Änderungen erfolgen mit 'sudo saplingctl configure'."
    if [[ -x /usr/local/sbin/saplingctl ]]; then
      /usr/local/sbin/saplingctl status
    fi
    exit 0
  fi
fi

memory_kib="$(awk '/MemTotal/ { print $2 }' /proc/meminfo)"
if (( memory_kib < 4194304 )) && ! swapon --show=NAME --noheadings | grep -q .; then
  warn "Weniger als 4 GiB RAM und kein Swap wurden erkannt; der Build kann fehlschlagen."
  if confirm "Eine 4-GiB-Swapdatei unter /swapfile anlegen?" j; then
    [[ ! -e /swapfile ]] || die "/swapfile existiert bereits und wird nicht überschrieben."
    fallocate -l 4G /swapfile
    chmod 0600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    printf '/swapfile none swap sw 0 0\n' >> /etc/fstab
  fi
fi

install_toolkit "$DEPLOY_DIR"
config_was_present=false
if [[ ! -f "$SAPLING_CONFIG_FILE" ]]; then
  /usr/local/lib/sapling-deployment/configure.sh
else
  config_was_present=true
  # shellcheck disable=SC1090
  source "$SAPLING_CONFIG_FILE"
  if [[ ! -e "$APP_ROOT/current" && ! -f "$APP_ROOT/shared/deployment/initial-admin.input" ]]; then
    warn "Die Erstinstallation besitzt noch keine Administrator-Eingabe und wird erneut konfiguriert."
    /usr/local/lib/sapling-deployment/configure.sh
  else
    log "Vorhandene Konfiguration wird unverändert weiterverwendet. Änderungen erfolgen mit 'saplingctl configure'."
  fi
fi
load_config

if [[ "$config_was_present" == "false" ]] && {
  [[ -e "$APP_ROOT/current" ]] ||
  [[ -f "$APP_ROOT/shared/backend/.env" ]] ||
  [[ -d "$APP_ROOT/shared/infrastructure/postgres-data" ]]
}; then
  die "Unter $APP_ROOT wurde ein bestehendes Deployment erkannt. Eine automatische Übernahme ist absichtlich nicht vorgesehen."
fi

ensure_app_identity "$APP_USER" "$APP_GROUP" "$APP_HOME"
install -d -m 0755 -o "$APP_USER" -g "$APP_GROUP" "$APP_ROOT" "$APP_ROOT/releases"
install -d -m 0750 -o "$APP_USER" -g "$APP_GROUP" \
  "$APP_ROOT/shared" "$APP_ROOT/shared/backend" "$APP_ROOT/shared/frontend" \
  "$APP_ROOT/shared/storage" "$APP_ROOT/shared/log" "$APP_ROOT/shared/backups/database" \
  "$APP_ROOT/shared/deployment" "$APP_ROOT/shared/infrastructure"

available_kib="$(df -Pk "$APP_ROOT" | awk 'NR == 2 { print $4 }')"
(( available_kib >= 10485760 )) || die "Mindestens 10 GiB freier Speicher werden für Erstinstallation und Releases benötigt."

if ! getent ahosts "$DOMAIN" >/dev/null 2>&1; then
  warn "Die Domain $DOMAIN lässt sich auf diesem Server noch nicht auflösen."
  confirm "Trotzdem fortfahren? Let's Encrypt kann dabei fehlschlagen." n || exit 1
fi

if [[ ! -d "$APP_ROOT/repository.git" ]]; then
  log "Git-Spiegel wird erstellt."
  run_as_app git clone --mirror "$GIT_URL" "$APP_ROOT/repository.git"
else
  run_as_app git --git-dir="$APP_ROOT/repository.git" remote set-url origin "$GIT_URL"
  run_as_app git --git-dir="$APP_ROOT/repository.git" ls-remote origin >/dev/null
fi

/usr/local/sbin/saplingctl _apply-configuration

ssh_port="$(sshd -T 2>/dev/null | awk '$1 == "port" { print $2; exit }')"
ssh_port="${ssh_port:-22}"
ufw allow "$ssh_port/tcp"
ufw allow 'Nginx Full'
ufw --force enable

env PATH="$PATH" pm2 startup systemd -u "$APP_USER" --hp "$APP_HOME"
run_as_app pm2 save --force

update_args=(--force)
[[ ! -e "$APP_ROOT/current" ]] && update_args+=(--initial)
/usr/local/sbin/saplingctl update "${update_args[@]}"
mark_phase application-deployed

log "Sapling wurde erfolgreich eingerichtet: https://$DOMAIN"
log "Status: sudo saplingctl status"
