# SaaS Cardápio

SaaS multitenant de cardápio digital, com frontend React 19/TypeScript/Vite/Tailwind e API NestJS/Fastify/TypeScript. Persistência MySQL 8.4 com Prisma 7 e Redis para cache e proteção compartilhada. Domínio e validações compartilhados, arquitetura DDD/hexagonal e falhas explícitas, sem fallback para dados fictícios.

## Começar com Docker

Requisitos: Node.js 24, pnpm 11.23.0 e Docker com Compose. Execute nesta pasta, onde está o `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm setup:local
pnpm docker:up
```

Abra **http://localhost:8080**. Crie sua conta com senha de **no mínimo 8 caracteres**, escolha a loja, cadastre produtos e configure a entrega. A loja começa **fechada e vazia**. Abra-a quando estiver pronta. O link público será `/menu/<slug-escolhido>`.

`setup:local` gera `backend/.env` com segredos aleatórios, sem sobrescrever arquivos existentes. Esse arquivo não vai para o Git. MySQL e Redis escutam apenas em `127.0.0.1:3307` e `127.0.0.1:6380`; os dados ficam em volume Docker. Frontend e API ficam na mesma origem: Caddy balanceia `/api/` entre duas instâncias internas da API, sem publicar a porta da API. `pnpm docker:down` para os serviços e preserva o volume. Não há senha padrão compartilhada entre instalações.

O comando `docker:up` aplica migrations explicitamente e aguarda os healthchecks de MySQL, Redis, duas APIs, frontend, Evolution API e PostgreSQL do provedor de WhatsApp. As imagens são fixadas por digest. API e frontend executam sem root, sem capabilities e com filesystem somente leitura. O Compose usa configuração **local de desenvolvimento**. O setup mantém o acesso restrito ao computador. Para testar no celular, configure explicitamente a rede local conforme abaixo; banco, Redis e administração do provedor continuam restritos ao computador.

### Testar no celular pela rede local

No computador, execute (substitua o IP pelo IPv4 da sua rede):

```sh
pnpm setup:lan --host 192.168.1.50
pnpm docker:up
```

No celular conectado à mesma rede, abra `http://192.168.1.50:8080/menu/<slug-da-loja>`. O comando `setup:lan` valida que o IP pertence ao computador, adiciona as origens exatas de Docker (8080) e Vite (8443), e publica apenas o frontend em todas as interfaces. Preserva segredos e dados existentes. Sem `--host`, lista os IPs disponíveis. Se o IP mudar, execute novamente com o endereço atual e recrie os containers. Firewall e isolamento da rede Wi-Fi podem impedir acesso entre aparelhos.

Pedidos, combos, adicionais, pagamentos e rascunhos funcionam em HTTP local. Web Push exige HTTPS em aparelhos externos e permanece opcional. Produção continua exigindo HTTPS, cookies seguros e origens explícitas. Para restringir novamente o Docker ao computador, defina `WEB_BIND_ADDRESS=127.0.0.1` em `backend/.env`, remova as origens de rede que não utiliza e execute `pnpm docker:up`. Veja [diagnóstico de acesso pelo IP](docs/diagnostics.md#acesso-pelo-ip-no-celular).

### Desenvolvimento com recarga automática

Com o Docker instalado, use `pnpm db:up`, `pnpm db:migrate` e `pnpm dev:full`. Abra **http://localhost:8443**; a API escuta em `localhost:3001`. Para executar os processos em terminais separados: `pnpm api:dev` e `pnpm dev:api`. O navegador usa `/api/v1` na mesma origem; Vite encaminha para `127.0.0.1:3001`, mantendo cookies e validação de origem. Para testar pelo IP na porta 8443, execute `setup:lan` e reinicie `dev:full`. `API_PROXY_TARGET` permite alterar o destino interno do proxy de desenvolvimento; nunca é enviado ao bundle.

## O que funciona

Novidades: **adicionais reutilizáveis, três modelos de cardápio, QR Codes com logo, painel público TV/celular ao vivo, caixa manual, reversões e relatórios PDF reais**. Notificações React-Toastify, Web Push e integração WhatsApp com consentimento; falhas isoladas por área e logs Pino com rotação. Consulte [operação financeira](docs/finance.md), [cardápio e canais](docs/menu-and-channels.md) e [entregas](docs/evolution-plan.md).

- Cadastro, login, logout, alteração de senha e seleção/criação de lojas. Um usuário pode participar de vários tenants; cada tenant pode ter várias lojas.
- Catálogo com categorias criadas dentro do produto, preço em centavos, imagens, disponibilidade e destaque.
- Configurações da loja, taxa, pedido mínimo, prazo e abertura/fechamento.
- Cardápio público pelo slug, carrinho isolado por loja e atualização explícita de itens removidos/preços alterados.
- **Enviar pedido para a loja** registra um pedido real no MySQL, com validação dos valores atuais e proteção contra repetição da tentativa.
- Painel de pedidos: novos → em preparo → prontos → em entrega → concluídos; cancelamento antes da saída, detalhes e paginação. Atualização a cada 15 segundos.
- Combos com produtos fixos, grupos de escolha e adicionais; promoções automáticas/cupons com período, teto, mínimo e limite de usos.
- Entrega por taxa única, cidade/bairro ou raio, retirada, atribuição de entregador e acompanhamento por link privado. Endereço com campos validados, autocomplete e busca assistida de CEP pela BrasilAPI com alternativa ViaCEP; Leaflet/OpenStreetMap auxilia a confirmação do ponto.
- Equipe com proprietário, gerente, caixa, cozinha, entregador e consulta. Cadastro de equipe separado da criação de loja.
- Rascunhos Redux persistidos: carrinho, checkout e formulários administrativos; isolamento por loja/usuário, expiração e aviso de conflito entre abas.
- WhatsApp opcional após o envio e mensagens automáticas por Evolution API, após parear o número da loja e ativar o canal. Cada cliente precisa autorizar; a preferência é revogável. Registrar o pedido não confirma aceitação pelo restaurante nem pagamento.
- Painel público com SSE, deltas por pedido, reconexão e link revogável. Gerente escolhe TV/celular e compartilha link ou QR Code. Dados pessoais ficam fora do painel.
- Sino de notificações com permissões por perfil, alertas animados e Web Push consentido. Chaves geradas localmente; push em aparelhos externos requer HTTPS. No iPhone/iPad, abra pela Tela de Início.

## Demonstração independente

```sh
pnpm dev
```

Esse comando seleciona explicitamente `.env.demo`. `/`, `/menu` e `/menu/burger-house` abrem a loja demonstrativa, com armazenamento local e quadro de pedidos simulado. Não chama a API. O checkout demonstrativo apenas prepara o WhatsApp.

O modo API usa `.env.api` e nunca importa automaticamente os dados de demonstração. Sem configuração válida, as operações ficam bloqueadas. No modo API, `/` e `/menu` levam ao acesso da conta; lojas públicas exigem slug explícito.

## Comandos

| Comando                               | Finalidade                                                                        |
| ------------------------------------- | --------------------------------------------------------------------------------- |
| `pnpm docker:up` / `pnpm docker:down` | Iniciar/parar frontend, duas APIs, Redis e MySQL em containers, preservando dados |
| `pnpm docker:migrate`                 | Aplicar migrations pelo container de ferramentas                                  |
| `pnpm dev:full`                       | Frontend em modo API + backend com recarga                                        |
| `pnpm setup:lan --host <IP>`          | Configurar explicitamente acesso pela rede local, sem alterar segredos            |
| `pnpm setup:local`                    | Gerar segredos locais, preservando configuração existente                         |
| `pnpm db:up` / `pnpm db:down`         | Iniciar/parar MySQL e Redis locais, preservando dados                             |
| `pnpm db:migrate`                     | Aplicar migrations explicitamente                                                 |
| `pnpm api:build`                      | Gerar Prisma Client e compilar API                                                |
| `pnpm build:api`                      | Compilar frontend conectado à API                                                 |
| `pnpm build:demo`                     | Compilar demonstração local explícita                                             |
| `pnpm dev:restricted` / `pnpm build`  | Executar/compilar com acesso bloqueado por falta de modo válido                   |
| `pnpm check:all`                      | Tipagem, lint, fronteiras arquiteturais, UTF-8, testes unitários e builds         |
| `pnpm api:test:db`                    | Migrations e testes de integração exclusivamente no banco `_test`                 |
| `pnpm test:e2e`                       | Regressões da demonstração no Chromium                                            |
| `pnpm test:e2e:api`                   | Fluxo completo React → API → MySQL em HTTP por IP, incluindo celular              |
| `pnpm test:e2e:docker`                | Validar bundle, proxy, headers e bloqueios de acesso com os containers iniciados  |
| `pnpm test:e2e:api:cleanup`           | Limpar somente as contas criadas na última execução de testes do navegador        |
| `pnpm format:check`                   | Conferir formatação                                                               |
| `pnpm audit --prod`                   | Auditar dependências de produção                                                  |

Instale o navegador antes dos testes: `pnpm exec playwright install chromium`. Os testes da API usam portas 3002/4176 e o banco `cardapio_test`. Selecionam um IPv4 local para exercitar uma origem HTTP sem contexto seguro; `E2E_LAN_HOST` permite escolher a interface. Os testes da demonstração usam 4173/4174. Para verificar o bundle Docker pelo IP configurado, defina `DOCKER_E2E_ORIGIN=http://<IP>:8080` ao executar `pnpm test:e2e:docker`; o padrão é localhost. Screenshots e traces ficam em diretórios ignorados pelo Git.

## Mapa do projeto

- `src/`: frontend e adaptadores HTTP/localStorage.
- `backend/src/`: API modular, casos de uso, autorização e adaptadores Prisma/HTTP.
- `backend/prisma/`: esquema e migrations versionadas.
- `docker/` e `compose.yaml`: builds separados, proxy e ambiente local completo.
- `packages/domain/`: dinheiro, catálogo, restaurante, carrinho e checkout; geolib calcula distâncias sem depender de navegador ou servidor.
- `packages/contracts/`: schemas e tipos de entrada/saída compartilhados.
- `.agents/skills/ux-ui-design-principles/`: skill de revisão de interface, referenciada no `AGENTS.md`.

Leia [Arquitetura](docs/architecture.md), [Backend, segurança e desenvolvimento](docs/backend.md), [Diagnóstico](docs/diagnostics.md), [UI/UX](docs/ui-ux.md), [Combos, entrega, equipe e rascunhos](docs/mvp-expansion.md), [Entrega por bairro e raio](docs/delivery-radius.md), [Endereço e preenchimento assistido](docs/delivery-address.md), [Desempenho e organização financeira](docs/frontend-performance.md) e [Resiliência e benchmark](docs/resilience.md).

## Limites desta etapa

É uma base de desenvolvimento com persistência e autorização no servidor. Ainda não inclui verificação de e-mail, recuperação de senha por e-mail, MFA, cobrança de assinaturas, gateway de pagamento, upload em object storage ou publicação em produção. Pagamentos são registros manuais; não movimentam dinheiro em bancos. WhatsApp exige pareamento do telefone e Web Push em celulares externos exige HTTPS. O cadastro público pode ser desabilitado por configuração. A gestão de equipe já tem tela; convites por e-mail continuam fora do escopo. A entrega por raio usa distância em linha reta; não há rastreio de entregador nem cálculo de trajeto por ruas.

Os arquivos usam UTF-8. No PowerShell, configure `$OutputEncoding = [System.Text.UTF8Encoding]::new($false)` antes de enviar texto acentuado por pipe. `pnpm check:text` verifica os textos do frontend, backend e domínio. Não há Supabase nem conexão do navegador com banco de dados.

Formulários: consulte [formatação e validação com Zod](docs/form-validation.md) para contratos, mensagens por campo e preservação de rascunhos.
