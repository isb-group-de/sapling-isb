#!/usr/bin/env bash

set -Eeuo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
engine="docker"
base_url="http://localhost:3000/api"
token_file="performance-tokens.json"
users="1,5,10,20,50,100"
iterations_per_user="10"
write_mode="none"
ticket_filter=""
backend_mode="unknown"

usage() {
  cat <<'EOF'
Usage: bash ./run-performance-test.sh [options]

Options:
  --engine docker|native
  --base-url URL
  --token-file PATH
  --users LIST                 Default: 1,5,10,20,50,100
  --iterations-per-user COUNT  Default: 10
  --write-mode none|same-value|round-trip
  --ticket-filter JSON
  --backend-mode production|development|unknown
  -h, --help
EOF
}

require_value() {
  if [[ $# -lt 2 || -z "${2-}" ]]; then
    echo "Missing value for $1." >&2
    usage >&2
    exit 2
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --engine)
      require_value "$@"
      engine="$2"
      shift 2
      ;;
    --base-url)
      require_value "$@"
      base_url="$2"
      shift 2
      ;;
    --token-file)
      require_value "$@"
      token_file="$2"
      shift 2
      ;;
    --users)
      require_value "$@"
      users="$2"
      shift 2
      ;;
    --iterations-per-user|--iterations)
      require_value "$@"
      iterations_per_user="$2"
      shift 2
      ;;
    --write-mode)
      require_value "$@"
      write_mode="$2"
      shift 2
      ;;
    --ticket-filter)
      require_value "$@"
      ticket_filter="$2"
      shift 2
      ;;
    --backend-mode)
      require_value "$@"
      backend_mode="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

case "$engine" in
  docker|native) ;;
  *)
    echo "--engine must be docker or native." >&2
    exit 2
    ;;
esac

case "$write_mode" in
  none|same-value|round-trip) ;;
  *)
    echo "--write-mode must be none, same-value, or round-trip." >&2
    exit 2
    ;;
esac

case "$backend_mode" in
  production|development|unknown) ;;
  *)
    echo "--backend-mode must be production, development, or unknown." >&2
    exit 2
    ;;
esac

if ! [[ "$iterations_per_user" =~ ^[0-9]+$ ]] ||
  ((iterations_per_user < 1 || iterations_per_user > 1000)); then
  echo "--iterations-per-user must be an integer between 1 and 1000." >&2
  exit 2
fi

if [[ "$write_mode" == "round-trip" && -z "${ticket_filter//[[:space:]]/}" ]]; then
  echo "round-trip requires --ticket-filter so only dedicated performance-test tickets are modified." >&2
  exit 2
fi

if [[ "$token_file" == /* ]]; then
  resolved_token_file="$token_file"
else
  resolved_token_file="$script_dir/$token_file"
fi

if [[ ! -f "$resolved_token_file" ]]; then
  echo "Token file not found: $resolved_token_file" >&2
  exit 2
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required to validate the token file and run the report builder." >&2
  exit 2
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required to run the performance matrix." >&2
  exit 2
fi
if [[ "$engine" == "docker" ]] && ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required for --engine docker. Install Docker or use --engine native." >&2
  exit 2
fi
if [[ "$engine" == "native" ]] && ! command -v "${SAPLING_K6_BINARY:-k6}" >/dev/null 2>&1; then
  echo "k6 is required for --engine native. Install k6 or use --engine docker." >&2
  exit 2
fi

token_payload="$(
  node - "$resolved_token_file" <<'NODE'
const fs = require("node:fs");

const tokenFile = process.argv[2];
try {
  const parsed = JSON.parse(fs.readFileSync(tokenFile, "utf8"));
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("the token file must contain a non-empty JSON array");
  }
  const tokens = parsed.map((token, index) => {
    if (typeof token !== "string" || !token.trim()) {
      throw new Error(`token ${index + 1} must be a non-empty string`);
    }
    return token.trim();
  });
  process.stdout.write(`${tokens.length}\n${JSON.stringify(tokens)}`);
} catch (error) {
  console.error(`Could not read tokens from '${tokenFile}': ${error.message}`);
  process.exit(1);
}
NODE
)"
token_count="${token_payload%%$'\n'*}"
tokens_json="${token_payload#*$'\n'}"

unset SAPLING_TOKEN
export SAPLING_TOKENS_JSON="$tokens_json"
export SAPLING_BASE_URL="${base_url%/}"
export SAPLING_WRITE_MODE="$write_mode"
if [[ -n "${ticket_filter//[[:space:]]/}" ]]; then
  export SAPLING_TICKET_FILTER="$ticket_filter"
else
  unset SAPLING_TICKET_FILTER || true
fi

printf '\nSapling performance test\n'
printf '  Backend:      %s\n' "$SAPLING_BASE_URL"
printf '  Engine:       %s\n' "$engine"
printf '  Tokens:       %s identities\n' "$token_count"
printf '  Users:        %s\n' "$users"
printf '  Iterations:   %s per user\n' "$iterations_per_user"
printf '  Write mode:   %s\n' "$write_mode"
printf '  Backend mode: %s\n\n' "$backend_mode"

cd -- "$script_dir"
set +e
npm run test:performance -- \
  --engine "$engine" \
  --users "$users" \
  --iterations "$iterations_per_user" \
  --backend-mode "$backend_mode"
exit_code=$?
set -e

if ((exit_code != 0)); then
  echo "The performance test finished with exit code $exit_code. Check the generated matrix report for threshold or infrastructure failures." >&2
fi
exit "$exit_code"
