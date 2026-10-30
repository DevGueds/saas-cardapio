# Railway health probes use their own Host. Keep Postal's normal host allowlist.
Rails.application.config.hosts << "healthcheck.railway.app"
Rails.application.config.action_mailer.perform_deliveries = ENV.fetch("EMAIL_SEND_ENABLED", "false") == "true"
