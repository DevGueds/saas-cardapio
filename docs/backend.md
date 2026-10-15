# API, segurança e desenvolvimento

## Stack e execução

NestJS 11 com Fastify 5, TypeScript estrito, Prisma **7.10** e MySQL **8.4 LTS**. Prisma 7 foi fixado porque esta implementação usa seu adaptador MySQL/MariaDB. Não atualizar automaticamente para Prisma 8 RC, cuja compatibilidade precisa de nova avaliação.

```sh
pnpm install --frozen-lockfile
pnpm setup:local
pnpm db:up
pnpm db:migrate
pnpm dev:full
```

A API inicia somente com configuração válida e banco acessível. Não executa migrations nem seeds automaticamente ao iniciar. O cadastro cria conta, tenant, membership OWNER, loja fechada/vazia e sessão numa transação. Não há conta administrativa ou senha padrão.

`pnpm api:build` gera o Prisma Client e `backend/dist`. Para executar o build: `pnpm --filter @cardapio/api start`, com ambiente configurado. Os pacotes `@cardapio/domain` e `@cardapio/contracts` são compilados no postinstall; após editar seus fontes execute `pnpm build:shared` ou reinicie o fluxo de desenvolvimento. Os pacotes de workspace precisam acompanhar a API no artefato de deploy.

## Aplicação completa em Docker

Depois de `pnpm setup:local`, execute `pnpm docker:up` e abra http://localhost:8080. O comando inicia o banco, executa o container temporário de migrations e aguarda os serviços. `pnpm docker:down` preserva os dados. Não use `down -v` para corrigir falhas: isso remove o volume.

`docker/Dockerfile` compila os workspaces e cria imagens separadas: API apenas com dependências de execução, frontend estático com Caddy. As imagens base estão fixadas por digest; atualizações exigem nova validação. A API e o frontend usam usuários sem root, filesystem somente leitura, tmpfs limitado, nenhuma capability Linux e `no-new-privileges`. Segredos e artefatos locais ficam fora do contexto de build pelo `.dockerignore`.

Somente o frontend publica 8080 e o MySQL publica 3307, ambos em loopback. A API fica na rede interna. Caddy entrega a SPA e encaminha `/api/*` para a API; não registra access logs. O navegador usa `VITE_API_BASE_URL=/api/v1`. O proxy fornece CSP, proteção contra iframes, nosniff e política de referrer. A API continua verificando sessão, origem, CSRF e escopo.

O perfil `tools` entrega a credencial DDL somente ao processo de migrations. O perfil `app` recebe somente a credencial DML da aplicação. O Compose é de desenvolvimento: HTTP local, cadastro habilitado e TLS do banco desabilitado. Publicação em produção precisa de HTTPS, MySQL com TLS verificado, gestão de segredos e configuração de origens e proxy próprias. Não exponha este Compose diretamente à internet.

## Ambiente

| Variável                                           | Regra                                                                         |
| -------------------------------------------------- | ----------------------------------------------------------------------------- |
| `NODE_ENV`                                         | Obrigatória: development, test ou production                                  |
| `HOST`, `PORT`                                     | Padrões 127.0.0.1:3001; configure bind de container explicitamente            |
| `DATABASE_URL`                                     | URL mysql com usuário/senha e banco; sem query parameters                     |
| `DATABASE_TLS`                                     | Obrigatória: true/false; produção exige true                                  |
| `DATABASE_CA_FILE`                                 | CA opcional para verificação TLS do banco                                     |
| `MIGRATION_DATABASE_URL`                           | Credencial separada para DDL, usada somente pelo CLI Prisma                   |
| `SESSION_SECRET`                                   | 64–128 caracteres hexadecimais aleatórios                                     |
| `SESSION_TTL_SECONDS`                              | 300–86400; padrão 28800 (8 horas), expiração absoluta                         |
| `CORS_ORIGINS`                                     | Lista exata de origens separadas por vírgula; produção exige HTTPS            |
| `SIGNUP_ENABLED`                                   | false por padrão; setup local define true                                     |
| `DOCS_ENABLED`                                     | false por padrão; true somente fora de produção                               |
| `TEST_DATABASE_URL`, `TEST_MIGRATION_DATABASE_URL` | Bancos exclusivos com nome terminado em `_test`                               |
| `VITE_APP_MODE`                                    | `api` para integrar ou `demo` explícito para demonstração                     |
| `VITE_API_BASE_URL`                                | URL HTTPS terminada em `/api/v1`, loopback local ou `/api/v1` na mesma origem |

As variáveis `VITE_*` são públicas e incorporadas ao bundle. Nunca contêm senha, segredo de sessão ou URL do banco. `backend/.env` é ignorado pelo Git; `.env.example` contém somente placeholders. Em produção forneça segredos pelo ambiente/gerenciador de segredos. Frontend e API devem compartilhar o mesmo site para cookies SameSite=Lax (ex.: `app.exemplo.com` e `api.exemplo.com`).

O Compose é **local**, com porta vinculada a loopback, volume persistente e healthcheck. O init cria `cardapio`/`cardapio_test` e dá ao usuário da aplicação apenas SELECT/INSERT/UPDATE/DELETE. O root é utilizado exclusivamente nas migrations locais. Em produção, crie um usuário de migrations com DDL no banco específico, um usuário de execução com DML e configure TLS/backup/restore no MySQL gerenciado.

## Autenticação e autorização

- Senhas: mínimo **8** e máximo 128 caracteres Unicode, sem trim, truncamento ou regras artificiais de composição. Hash Argon2id com 19 MiB, duas iterações e paralelismo 1; salt por senha. Conta inexistente também executa verificação de hash para reduzir diferença temporal.
- Sessão opaca de 256 bits, nova a cada autenticação. O banco guarda somente SHA-256 do token. Cookie HttpOnly, SameSite=Lax, Path=/; produção usa Secure e prefixo `__Host-`.
- Token CSRF derivado por HMAC e validado com comparação constante. Fica em memória no React; operações privadas de escrita exigem `X-CSRF-Token`. Não há JWT/token de sessão em localStorage.
- Mutações públicas e privadas exigem `Origin` exato permitido e JSON. Clientes de CLI precisam enviar Origin explicitamente. GET com Origin não permitido também é negado. CORS não substitui autenticação nem autorização.
- Rotas privadas por padrão. Somente handlers marcados `@Public()` dispensam sessão; checkout público ainda valida loja/produtos e aplica rate limiting.
- Sessão/usuário/tenant/membership ativos são revalidados. As mesmas políticas são chamadas nos casos de uso, inclusive fora de HTTP. Logout revoga sessão; alteração de senha revoga todas as sessões.
- OWNER administra catálogo, pedidos e membros. MANAGER administra catálogo e pedidos. STAFF consulta catálogo e movimenta pedidos. Vínculo OWNER não pode ser removido nem alterado pelos endpoints de equipe desta etapa.

O Fastify usa `trustProxy: false`. Headers `X-Forwarded-*` enviados pelo cliente não mudam sua identidade de IP. Antes de colocar atrás de um proxy, configure e teste uma política restrita aos proxies confiáveis; sem isso, o limite considera o IP do proxy. Evite simplesmente habilitar `trustProxy: true` em servidor exposto.

## Persistência, pedidos e concorrência

- Repositórios usam Prisma e parâmetros vinculados; não há interpolação SQL de valores em strings. As consultas SQL tagged-template são para rate limiting e lock de checkout.
- Chaves estrangeiras compostas garantem categoria/produto no mesmo tenant/restaurante. Normalização de nomes remove acentos/case/espaços redundantes para evitar duplicatas.
- Alterações exigem `expectedRevision`. Categoria + produto são atômicos. Revisão obsoleta e transação concorrente retornam CONFLICT; nenhuma confirmação é exibida antes do commit.
- Checkout revalida loja aberta, loja do carrinho, itens, disponibilidade, quantidade, preço, mínimo, total, telefone e troco. O servidor calcula os valores. Não confia no preço recebido como total autorizado.
- Criar pedido exige `Idempotency-Key` UUID. Mesma chave e conteúdo retornam o mesmo pedido; conteúdo diferente retorna CONFLICT. A unicidade inclui tenant/restaurante. O cliente preserva a chave da tentativa em memória quando a rede falha. Recarregar a página perde esse estado; confira com a loja se houve dúvida de envio.
- Pedidos possuem snapshot de cliente/itens, revisão e estados: NEW → PREPARING → OUT_FOR_DELIVERY → COMPLETED. NEW/PREPARING podem ir para CANCELLED. Fim de fluxo não pode ser reaberto nesta etapa.
- A listagem privada usa cursor validado no mesmo restaurante, 50 itens por página. O painel faz polling; não há WebSocket nem promessa de entrega instantânea.
- `checkout/prepare` somente prepara WhatsApp. `orders` registra no painel. WhatsApp não processa pagamento nem confirma recebimento.

Imagens continuam como referência HTTPS ou data URL PNG/JPEG/WebP; o navegador valida decodificação e limite de 5 MB. O domínio também verifica tamanho decodificado, padding base64 e assinatura PNG/JPEG/WebP; isso não substitui decodificação completa de mídia no servidor. O servidor não baixa URLs fornecidas pelo usuário (evita SSRF) nem aceita SVG. Para escalar, extraia imagens para armazenamento de objetos com uma porta dedicada e uma política de mídia; evitar manter catálogos grandes com imagens base64 é uma evolução prevista.

## Proteções e diagnóstico

Helmet configura headers de segurança na API. `Cache-Control: no-store` protege respostas autenticadas. O corpo é limitado a 32 KiB, exceto produto/configurações com imagens (15 MiB). Há limites de tempo de conexão/requisição, paginação, schemas estritos e limites de tamanho/quantidade. Exceções e erros do parser são convertidos para mensagens seguras em português.

Rate limiting usa MySQL e chaves HMAC, sem IP/e-mail bruto persistido: limite global de 300/minuto/IP, login 20/15min/IP e 10/15min/conta, cadastro 5/15min/IP, pedidos 20/15min/IP, preparação 30/minuto/IP e senha 5/15min/conta. Falha no armazenamento do limitador impede a operação; não há fallback em memória. Planeje proteção de borda/limites por rede para tráfego público maior.

Cada falha gera diagnosticId, módulo, operação, código, horário e causa técnica controlada. Não são registrados corpo, cookies, tokens, senha, e-mail, nome, endereço, imagem ou mensagem do pedido. Não habilite logs de query Prisma ou logging bruto de requisições Fastify. Eventos podem ser enviados a outro sink implementando `DiagnosticLogger`.

| Código                                             | HTTP | Recuperação                                                  |
| -------------------------------------------------- | ---- | ------------------------------------------------------------ |
| VALIDATION                                         | 422  | Corrigir campos e reenviar                                   |
| UNAUTHENTICATED                                    | 401  | Entrar novamente                                             |
| ACCESS_DENIED / CSRF_INVALID                       | 403  | Verificar permissão ou atualizar sessão                      |
| NOT_FOUND                                          | 404  | Conferir loja/recurso; não revela recurso de outro tenant    |
| CONFLICT / ACCOUNT_UNAVAILABLE                     | 409  | Atualizar revisão ou revisar cadastro                        |
| RATE_LIMITED                                       | 429  | Aguardar a janela do limite                                  |
| STORAGE_UNAVAILABLE / CORRUPT_DATA / CONFIGURATION | 503  | Recuperar dependência/dados; informar diagnóstico ao suporte |
| UNEXPECTED                                         | 500  | Investigar diagnóstico sem expor detalhes internos           |

Em uma falha de conexão durante envio, não afirme que o pedido não foi criado: repita a mesma tentativa/chave. Não apague dados ou gere exemplos para recuperar erro de armazenamento.

## Endpoints

Prefixo `/api/v1`. Respostas de negócio: `{ ok: true, value }` ou `{ ok: false, error: { code, message, fields, diagnosticId } }`. POST conclui com 201; outras operações com 200. `GET /openapi.json` expõe OpenAPI 3.1 somente com DOCS_ENABLED=true. Os schemas de `packages/contracts` são o contrato executável.

| Recurso            | Métodos e caminhos                                                                                          |
| ------------------ | ----------------------------------------------------------------------------------------------------------- |
| Saúde/configuração | GET `/health/live`, `/health/ready`, `/configuration`                                                       |
| Conta              | POST `/auth/register`, `/auth/login`, `/auth/logout`; GET `/auth/session`; PUT `/auth/password`             |
| Lojas autorizadas  | GET `/me/restaurants`                                                                                       |
| Tenants/lojas      | POST `/tenants`; POST `/tenants/:tenantId/restaurants`                                                      |
| Membros            | GET/POST `/tenants/:tenantId/members`; DELETE `/tenants/:tenantId/members/:userId`                          |
| Cardápio público   | GET `/public/restaurants/:slug/menu`                                                                        |
| Checkout           | POST `/public/restaurants/:slug/checkout/prepare`; POST `/public/restaurants/:slug/orders`                  |
| Cardápio privado   | GET `/restaurants/:restaurantId/menu`                                                                       |
| Produtos           | POST `/restaurants/:restaurantId/products`; PUT/DELETE `/restaurants/:restaurantId/products/:productId`     |
| Disponibilidade    | PUT `/restaurants/:restaurantId/products/:productId/availability`                                           |
| Configurações      | PUT `/restaurants/:restaurantId/settings`, `/restaurants/:restaurantId/open`                                |
| Pedidos            | GET `/restaurants/:restaurantId/orders?cursor=...`; PUT `/restaurants/:restaurantId/orders/:orderId/status` |

## Migrations, testes e manutenção

```sh
pnpm --filter @cardapio/api db:migrate:dev --name descricao_da_mudanca
pnpm check:all
pnpm api:test:db
pnpm test:e2e
pnpm test:e2e:api
pnpm test:e2e:api:cleanup
pnpm audit --prod
```

Use o comando `migrate:dev` somente em banco descartável de desenvolvimento com shadow database configurado; produção usa exclusivamente `migrate deploy` (`pnpm db:migrate`). Nunca use `db push` como substituto de migrations versionadas. Faça backup antes de mudanças de schema em ambientes com dados reais.

Testes unitários não dependem do banco. Integração/browser recusam conexão de teste sem sufixo `_test`; a limpeza remove somente IDs gerados pela execução. Nunca fazem truncate nem limpam o banco da aplicação. Dados de clientes dos testes são fictícios. CI executa os mesmos comandos com MySQL real via Compose.

Após `pnpm api:build`, sessões expiradas/revogadas e contadores expirados podem ser limpos com `pnpm api:maintenance` (ou `docker compose --env-file backend/.env exec api node dist/maintenance.js`); pedidos não são apagados por esse comando. Rotina de retenção de pedidos/dados pessoais e backups deve ser definida antes da operação pública.

Overrides de `fastify`, `mariadb`, `mysql2` e `deepmerge-ts` no workspace corrigem advisories de versões transitivas da stack fixada. Mantenha-os até versões upstream incorporarem as correções e reexecute migrations, testes de MySQL e navegação ao atualizar. `pnpm audit` complementa testes; ausência de advisories não constitui auditoria completa da aplicação.

## Próximas etapas delimitadas

Verificação/recuperação de e-mail, MFA, convite de equipe pela interface, auditoria administrativa persistente, cobrança e quotas comerciais, armazenamento de imagens, observabilidade externa, política de retenção e infraestrutura de produção. O checkout atual é entrega com valor fixo: não calcula cobertura geográfica nem distância. Cadastros públicos devem continuar restritos aos ambientes previstos até implementar o ciclo de verificação de conta.

Referências de implementação: [NestJS/Fastify](https://docs.nestjs.com/techniques/performance), [Prisma 7 e MySQL](https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/mysql), [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html), [Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) e [Logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html).
