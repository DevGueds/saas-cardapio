# Runs after Postal's idempotent schema initialization. Never resets existing users.
email = ENV.fetch("POSTAL_ADMIN_EMAIL")
password = ENV.fetch("POSTAL_ADMIN_PASSWORD")
abort "postal_admin_password_invalid" unless password.length >= 24
unless User.where(email_address: email).exists?
  User.create!(email_address: email, first_name: "PedeAqui", last_name: "Admin",
               password: password, password_confirmation: password,
               admin: true, email_verified_at: Time.now)
end
