# SaaS Cardápio

SaaS multitenant de cardápio digital, com frontend React 19/TypeScript/Vite/Tailwind e API NestJS/Fastify/TypeScript. Persistência MySQL 8.4 com Prisma 7. Domínio e validações compartilhados, arquitetura DDD/hexagonal e falhas explícitas, sem fallback para dados fictícios.

## Começar com Docker

Requisitos: Node.js 24, pnpm 11.23.0 e Docker com Compose. Execute nesta pasta, onde está o `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm setup:local
pnpm docker:up
```

Abra **http://localhost:8080**. Crie sua conta com senha de **no mínimo 8 caracteres**, escolha a loja, cadastre produtos e configure a entrega. A loja começa **fechada e vazia**. Abra-a quando estiver pronta. O link público será `/menu/<slug-escolhido>`.

`setup:local` gera `backend/.env` com segredos aleatórios, sem sobrescrever arquivos existentes. Esse arquivo não vai para o Git. O MySQL escuta apenas em `127.0.0.1:3307`; os dados ficam em volume Docker. Frontend e API ficam na mesma origem: Caddy encaminha `/api/` internamente, sem publicar a porta da API. `pnpm docker:down` para os serviços e preserva o volume. Não há senha padrão compartilhada entre instalações.

O comando `docker:up` aplica migrations explicitamente e aguarda os healthchecks de MySQL, API e frontend. As imagens são fixadas por digest. API e frontend executam sem root, sem capabilities e com filesystem somente leitura. O Compose usa configuração **local de desenvolvimento**, acessível apenas neste computador.

### Desenvolvimento com recarga automática

Com o Docker instalado, use `pnpm db:up`, `pnpm db:migrate` e `pnpm dev:full`. Abra **http://localhost:8443**; a API escuta em `localhost:3001`. Para executar os processos em terminais separados: `pnpm api:dev` e `pnpm dev:api`. Use o mesmo hostname no frontend e na API para que o cookie de sessão funcione; a configuração local usa `localhost`.

## O que funciona

- Cadastro, login, logout, alteração de senha e seleção/criação de lojas. Um usuário pode participar de vários tenants; cada tenant pode ter várias lojas.
- Catálogo com categorias criadas dentro do produto, preço em centavos, imagens, disponibilidade e destaque.
- Configurações da loja, taxa, pedido mínimo, prazo e abertura/fechamento.
- Cardápio público pelo slug, carrinho isolado por loja e atualização explícita de itens removidos/preços alterados.
- **Enviar pedido para a loja** registra um pedido real no MySQL, com validação dos valores atuais e proteção contra repetição da tentativa.
- Painel de pedidos: novos → em preparo → em entrega → concluídos; cancelamento de pedidos novos/em preparo, detalhes e paginação. Atualização a cada 15 segundos.
- WhatsApp opcional após o envio. Registrar o pedido não confirma aceitação pelo restaurante nem pagamento. A API não envia mensagens automaticamente.

## Demonstração independente

```sh
pnpm dev
```

Esse comando seleciona explicitamente `.env.demo`. `/`, `/menu` e `/menu/burger-house` abrem a loja demonstrativa, com armazenamento local e quadro de pedidos simulado. Não chama a API. O checkout demonstrativo apenas prepara o WhatsApp.

O modo API usa `.env.api` e nunca importa automaticamente os dados de demonstração. Sem configuração válida, as operações ficam bloqueadas. No modo API, `/` e `/menu` levam ao acesso da conta; lojas públicas exigem slug explícito.

## Comandos

| Comando                               | Finalidade                                                                       |
| ------------------------------------- | -------------------------------------------------------------------------------- |
| `pnpm docker:up` / `pnpm docker:down` | Iniciar/parar frontend, API e MySQL em containers, preservando dados             |
| `pnpm docker:migrate`                 | Aplicar migrations pelo container de ferramentas                                 |
| `pnpm dev:full`                       | Frontend em modo API + backend com recarga                                       |
| `pnpm setup:local`                    | Gerar segredos locais, preservando configuração existente                        |
| `pnpm db:up` / `pnpm db:down`         | Iniciar/parar MySQL local, preservando dados                                     |
| `pnpm db:migrate`                     | Aplicar migrations explicitamente                                                |
| `pnpm api:build`                      | Gerar Prisma Client e compilar API                                               |
| `pnpm build:api`                      | Compilar frontend conectado à API                                                |
| `pnpm build:demo`                     | Compilar demonstração local explícita                                            |
| `pnpm dev:restricted` / `pnpm build`  | Executar/compilar com acesso bloqueado por falta de modo válido                  |
| `pnpm check:all`                      | Tipagem, lint, fronteiras arquiteturais, UTF-8, testes unitários e builds        |
| `pnpm api:test:db`                    | Migrations e testes de integração exclusivamente no banco `_test`                |
| `pnpm test:e2e`                       | Regressões da demonstração no Chromium                                           |
| `pnpm test:e2e:api`                   | Fluxo completo React → API → MySQL no Chromium                                   |
| `pnpm test:e2e:docker`                | Validar bundle, proxy, headers e bloqueios de acesso com os containers iniciados |
| `pnpm test:e2e:api:cleanup`           | Limpar somente as contas criadas na última execução de testes do navegador       |
| `pnpm format:check`                   | Conferir formatação                                                              |
| `pnpm audit --prod`                   | Auditar dependências de produção                                                 |

Instale o navegador antes dos testes: `pnpm exec playwright install chromium`. Os testes da API usam portas 3002/4176 e o banco `cardapio_test`. Os testes da demonstração usam 4173/4174. Screenshots e traces ficam em diretórios ignorados pelo Git.

## Mapa do projeto

- `src/`: frontend e adaptadores HTTP/localStorage.
- `backend/src/`: API modular, casos de uso, autorização e adaptadores Prisma/HTTP.
- `backend/prisma/`: esquema e migrations versionadas.
- `docker/` e `compose.yaml`: builds separados, proxy e ambiente local completo.
- `packages/domain/`: dinheiro, catálogo, restaurante, carrinho e checkout, sem dependências externas.
- `packages/contracts/`: schemas e tipos de entrada/saída compartilhados.
- `.agents/skills/ux-ui-design-principles/`: skill de revisão de interface, referenciada no `AGENTS.md`.

Leia [Arquitetura](docs/architecture.md), [Backend, segurança e desenvolvimento](docs/backend.md), [Diagnóstico](docs/diagnostics.md) e [UI/UX](docs/ui-ux.md).

## Limites desta etapa

É uma base de desenvolvimento com persistência e autorização no servidor. Ainda não inclui verificação de e-mail, recuperação de senha por e-mail, MFA, cobrança de assinaturas, gateway de pagamento, notificações, upload em object storage ou publicação em produção. O cadastro público pode ser desabilitado por configuração. Permissões de equipe já existem na API; a administração de membros ainda não tem tela.

Os arquivos usam UTF-8. No PowerShell, configure `$OutputEncoding = [System.Text.UTF8Encoding]::new($false)` antes de enviar texto acentuado por pipe. `pnpm check:text` verifica os textos do frontend, backend e domínio. Não há Supabase nem conexão do navegador com banco de dados.
