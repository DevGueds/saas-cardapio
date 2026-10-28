# Certificados para a API (Railway)

Este diretório é copiado para `/app/certs/` no container da API na Railway.

Se você estiver utilizando PostgreSQL no Supabase com validação estrita de CA (`DATABASE_TLS=true` e `DATABASE_CA_FILE=/app/certs/supabase-ca.crt`):

1. Baixe o certificado CA do seu projeto no painel do Supabase (Project Settings > Database > SSL Configuration).
2. Salve o arquivo neste diretório com o nome `supabase-ca.crt`.
3. Ao realizar o deploy ou commit, o certificado será incluído na imagem e verificado na conexão.

Caso utilize um banco PostgreSQL gerenciado diretamente na Railway ou sem arquivo de CA customizado, deixe `DATABASE_CA_FILE=` vazio no `.env.prod`.
