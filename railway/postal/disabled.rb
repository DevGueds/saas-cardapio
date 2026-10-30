# Health endpoint only. No Rails, database, SMTP, workers or network clients.
require "socket"
server = TCPServer.new(ENV.fetch("BIND_ADDRESS", "::"), Integer(ENV.fetch("PORT", "5000")))
trap("TERM") { server.close; exit }
loop do
  connection = server.accept
  connection.write("HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: 15\r\nConnection: close\r\n\r\nPostal disabled")
  connection.close
rescue IOError, Errno::ECONNRESET, Errno::EPIPE
  next
end
