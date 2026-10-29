# Infraestrutura Railway

Entrada oficial: `railway.ts`; SDK TypeScript `railway` 3.16.0 e CLI 5.71.0 fixados neste diretório. Não há `railway.json`/`railway.toml` ativos. O pacote é isolado do pnpm da aplicação e não entra nas imagens.

Leia [o guia de deploy completo](../docs/railway.md) antes de aplicar. A definição gerencia o ambiente inteiro: oito serviços e quatro volumes persistentes. Use um projeto novo para o primeiro deploy. Um plano que remova recursos existentes exige revisão do destino.

```sh
npm ci --prefix .railway
pnpm railway:prepare --environment production
pnpm railway:check
pnpm railway:plan
```

`prepare` gera senhas independentes e um par VAPID válido em `local/production.json`, ignorado pelo Git e pelo Docker. Repetir preserva os segredos. O CLI lê o arquivo correspondente ao nome do ambiente selecionado. Cada ambiente precisa de seu próprio arquivo. Não use o mesmo arquivo em instalações independentes e não exponha planos salvos: eles podem conter segredos.

O plano remoto exige login e vínculo com o projeto/ambiente. A validação local testa tipos, recursos, referências, credenciais e volumes sem autenticação. A definição não cria recursos na avaliação e não muda segredos a cada plano. `config apply` só é executado pelo operador após revisar o plano.

Para o domínio gratuito, crie o serviço vazio `web` e gere seu domínio antes de aplicar; os comandos exatos estão no guia. Depois, o frontend usa `/api/v1` na própria origem e a API é privada. O domínio gratuito oferece HTTPS: `SESSION_COOKIE_SECURE=auto` é o padrão.

O template reutilizável é esta definição IaC. Para gerar também um template do catálogo/composer, aplique em um projeto de teste, valide o stack e execute `railway templates create`. Antes de compartilhá-lo, aplique as substituições de [variáveis do template](../railway/template/variables.json), evitando copiar as credenciais da instalação original.
