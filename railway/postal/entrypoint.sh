#!/bin/bash
set -euo pipefail
umask 077

if [[ "${POSTAL_ENABLED:-false}" != "true" ]]; then
  exec ruby /opt/pedeaqui/disabled.rb
fi
export POSTAL_WEB_HOSTNAME="${POSTAL_WEB_HOSTNAME:-${RAILWAY_PUBLIC_DOMAIN:-localhost}}"
export POSTAL_WEB_PROTOCOL="${POSTAL_WEB_PROTOCOL:-https}"
export MESSAGE_DB_HOST="${MESSAGE_DB_HOST:-${MAIN_DB_HOST:?}}"
export MESSAGE_DB_USERNAME="${MESSAGE_DB_USERNAME:-${MAIN_DB_USERNAME:?}}"
export MESSAGE_DB_PASSWORD="${MESSAGE_DB_PASSWORD:-${MAIN_DB_PASSWORD:?}}"

mkdir -p /tmp/pedeaqui-postal
ruby -rbase64 -ropenssl -e '
  key = OpenSSL::PKey::RSA.new(Base64.strict_decode64(ENV.fetch("POSTAL_SIGNING_KEY_BASE64")))
  abort "postal_signing_key_invalid" unless key.private? && key.n.num_bits >= 2048
  abort "postal_session_secret_invalid" unless ENV.fetch("RAILS_SECRET_KEY").match?(/\A[a-f0-9]{128}\z/)
  File.write(ENV.fetch("POSTAL_SIGNING_KEY_PATH"), key.to_pem, perm: 0600)
  File.write(ENV.fetch("POSTAL_CONFIG_FILE_PATH"), "version: 2\n", perm: 0600)
'

ready=false
for attempt in {1..60}; do
  if ruby -rsocket -e 'TCPSocket.new(ENV.fetch("MAIN_DB_HOST"), Integer(ENV.fetch("MAIN_DB_PORT", "3306"))).close' >/dev/null 2>&1; then ready=true; break; fi
  sleep 2
done
[[ "$ready" == true ]] || { echo postal_database_unreachable >&2; exit 1; }
postal initialize >/tmp/pedeaqui-postal/initialize.log 2>&1 || { echo postal_initialization_failed >&2; exit 1; }
bundle exec rails runner /opt/pedeaqui/bootstrap.rb >/tmp/pedeaqui-postal/bootstrap.log 2>&1 || { echo postal_bootstrap_failed >&2; exit 1; }

pids=()
shutdown() { kill "${pids[@]}" 2>/dev/null || true; wait "${pids[@]}" 2>/dev/null || true; }
trap shutdown TERM INT EXIT
postal web-server & pids+=("$!")
if [[ "${EMAIL_SEND_ENABLED:-false}" == "true" && "${POSTAL_DELIVERY_ENABLED:-false}" == "true" ]]; then
  [[ -n "${POSTAL_SMTP_HOSTNAME:-}" && "${POSTAL_SMTP_HOSTNAME}" != *.invalid && "${POSTAL_SMTP_HOSTNAME}" != *.railway.app ]] || { echo postal_verified_smtp_domain_required >&2; exit 1; }
  postal worker & pids+=("$!")
fi
set +e
wait -n "${pids[@]}"
code=$?
exit "$code"
