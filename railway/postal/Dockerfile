# Postal control plane. Delivery is deliberately opt-in and independent of app auth.
FROM ghcr.io/postalserver/postal:3.3.7@sha256:e54b4a7eb106ee15eda5664311c4b9415546d4196f5c4336d23a78d6ce57b819
COPY --chown=postal:postal entrypoint.sh bootstrap.rb disabled.rb /opt/pedeaqui/
COPY --chown=postal:postal railway.rb /opt/postal/app/config/initializers/pedeaqui_railway.rb
ENV PORT=5000 BIND_ADDRESS=0.0.0.0 POSTAL_ENABLED=false POSTAL_DELIVERY_ENABLED=false
ENV EMAIL_SEND_ENABLED=false
ENV POSTAL_CONFIG_FILE_PATH=/tmp/pedeaqui-postal/postal.yml POSTAL_SIGNING_KEY_PATH=/tmp/pedeaqui-postal/signing.key
ENV LOGGING_ENABLED=false LOGGING_RAILS_LOG_ENABLED=false RAILS_ENVIRONMENT=production
ENTRYPOINT ["/bin/bash", "/opt/pedeaqui/entrypoint.sh"]
