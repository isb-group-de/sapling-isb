#!/usr/bin/env bash

set -Eeuo pipefail

readonly DEPLOY_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"

bash -n \
  "$DEPLOY_DIR/setup.sh" \
  "$DEPLOY_DIR/saplingctl" \
  "$DEPLOY_DIR/lib/common.sh" \
  "$DEPLOY_DIR/lib/configure.sh"

# shellcheck source=../lib/common.sh
source "$DEPLOY_DIR/lib/common.sh"

[[ "$(dotenv_value '$2b$')" == '"$2b$"' ]]
[[ "$(compose_env_value 'secret$value')" == '"secret$$value"' ]]
validate_port 5432
validate_strong_password 'A secure password 42!'
if (validate_port 70000) >/dev/null 2>&1; then
  printf 'validate_port accepted an invalid port.\n' >&2
  exit 1
fi
if (validate_strong_password 'onlylowercasepassword') >/dev/null 2>&1; then
  printf 'validate_strong_password accepted a weak password.\n' >&2
  exit 1
fi

grep -q "127.0.0.1:\${POSTGRES_PORT}:5432" "$DEPLOY_DIR/templates/docker-compose.yml"
grep -q "127.0.0.1:\${REDIS_PORT}:6379" "$DEPLOY_DIR/templates/docker-compose.yml"
grep -q 'postgres-data:/var/lib/postgresql$' "$DEPLOY_DIR/templates/docker-compose.yml"
grep -q 'proxy_buffering off' "$DEPLOY_DIR/templates/nginx-https.conf"
grep -q 'DB_NAME' "$DEPLOY_DIR/saplingctl"
if grep -qE 'DB_DATABASE|VITE_DEBUG_(USERNAME|PASSWORD)' "$DEPLOY_DIR/saplingctl"; then
  printf 'A deprecated database name or frontend debug credential leaked into saplingctl.\n' >&2
  exit 1
fi

printf 'Deployment static tests passed.\n'
