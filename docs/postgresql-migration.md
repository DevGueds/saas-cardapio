# PostgreSQL e transferência de dados

## Instalação atual

PostgreSQL **18.6**, Prisma **7.10**, `@prisma/adapter-pg` **7.10** e `pg` **8.23.1**. O Compose fixa a imagem oficial por digest e guarda o cluster em `cardapio_postgres`, montado em `/var/lib/postgresql`, conforme o layout das imagens 18+. O PostgreSQL 15 do Evolution é independente e mantém seu volume.

```sh
pnpm install --frozen-lockfile
pnpm setup:local
pnpm db:up
pnpm db:migrate
pnpm docker:up
```

Frontend: http://localhost:8080. PostgreSQL local: `127.0.0.1:5433`; Redis: `127.0.0.1:6380`. Banco e APIs não são publicados para a rede local. Para desenvolver sem recompilar imagens, use `pnpm dev:full` após preparar os bancos.

`postgres` inicializa roles e bancos. `cardapio_migrator` é proprietário de `cardapio` e `cardapio_test`, sem superusuário, criação de roles ou criação de bancos. `cardapio` possui somente conexão, uso do schema e SELECT/INSERT/UPDATE/DELETE das tabelas da aplicação. Não cria tabelas, não executa TRUNCATE e não modifica o histórico de migrations. Credenciais de superusuário e migrations não entram nas APIs.

As senhas geradas são diferentes e persistem em `backend/.env`, ignorado pelo Git. Alterar uma senha nesse arquivo não altera a senha dentro de um volume já inicializado. Para rotacionar, altere a role no banco e atualize os consumidores de forma coordenada, sem remover volumes.

## Organização e integridade

- `backend/prisma/schema.prisma`: provider PostgreSQL; UUIDs nativos, JSONB, `timestamptz(3)` e centavos em INTEGER.
- `backend/prisma/migrations`: baseline PostgreSQL transacional e migrations futuras. Mantém chaves compostas por tenant/restaurante e checks de dinheiro, revisões e reversões.
- `backend/src/shared/infrastructure/postgres-config.ts`: pooling, TLS, prazos e UTC.
- `backend/src/shared/infrastructure/database.ts`: tradução segura de falhas, comandos serializáveis e snapshots somente leitura em REPEATABLE READ.
- `backend/src/shared/infrastructure/row-locks.ts`: bloqueios parametrizados, com tenant e casts UUID explícitos.
- `backend/tools/mysql-import` (`@cardapio/mysql-import`): workspace operacional separado do runtime, com leitura, conversão, cópia e verificação independentes.
- `backend/prisma/legacy-mysql`: schema e histórico MySQL preservados. Nunca são executados no PostgreSQL.

O cliente da API não recebe mudanças de contrato. MFA, senhas Argon2id, configurações de impressão, pedidos, pagamentos e tokens continuam usando as mesmas regras de negócio. E-mails mantêm unicidade sem distinguir maiúsculas/minúsculas; categorias continuam usando a normalização do domínio.

## Transferir uma instalação MySQL existente

O setup local detecta URLs MySQL, preserva `backend/.env.mysql-backup`, mantém segredos de sessão/MFA e registra as URLs antigas como `LEGACY_*`. Prepara credenciais PostgreSQL novas e define `DATABASE_MIGRATION_PENDING=true`. A API do banco principal permanece bloqueada até a conferência e ativação explícitas.

Execute em manutenção, sem APIs ou outros processos gravando na origem. Não use `down -v` nem `--remove-orphans`: o volume antigo precisa ser preservado.

```sh
pnpm setup:local
docker compose --env-file backend/.env --profile app stop web api api-replica
docker compose --env-file backend/.env -f compose.mysql-legacy.yaml up -d --wait mysql
pnpm db:backup:mysql
pnpm --filter @cardapio/api db:legacy:migrate
pnpm db:up
pnpm db:migrate
pnpm db:import:mysql --check
pnpm db:import:mysql --apply --maintenance-confirmed --activate-local
pnpm db:import:mysql --verify
pnpm docker:up
docker compose --env-file backend/.env -f compose.mysql-legacy.yaml stop mysql
```

O backup local em Docker só aceita origem loopback na porta 3307; para origem remota use o backup validado do provedor. O backup SQL é gravado como arquivo privado em `.cache/migrations`, sem passar pela codificação do PowerShell. O sufixo `.partial` só é removido após concluir a gravação e confirmar o processo de dump. Guarde uma cópia segura fora da máquina e valide a restauração antes de descartar a origem. `db:legacy:migrate` aplica somente as migrations aditivas conhecidas que ainda faltam na origem local; produção deve atualizar a origem pelo processo já validado desse ambiente.

A ferramenta exige schema e checksums do histórico MySQL conhecidos. A leitura usa transação consistente, UTC e somente leitura. O destino precisa ter a baseline aplicada e todas as tabelas de negócio vazias; a ferramenta não apaga nem mescla dados. A cópia bloqueia essas tabelas, segue a ordem das dependências e insere lotes de cinco linhas para limitar memória com imagens inline. Preserva SQL NULL versus JSON null, Unicode, bigint, datas, IDs e conteúdo JSON.

Contagens e SHA-256 de todas as linhas normalizadas são comparados dentro da transação de destino antes do commit. Erro de leitura, conversão, constraints, permissão ou divergência provoca rollback. Logs mostram somente fase/código, SQLSTATE sanitizado, referência e contagens; nunca mostram registros, hashes de senha, imagens ou credenciais. `_prisma_migrations` do MySQL não é copiado para o PostgreSQL.

`--activate-local` somente altera a configuração de desenvolvimento correspondente ao destino conferido. A gravação do `.env` é atômica e detecta alterações concorrentes. Se a transferência terminou mas a ativação falhou, mantenha a manutenção e execute:

```sh
pnpm db:import:mysql --verify --maintenance-confirmed --activate-local
```

Repetir `--apply` em um destino ocupado falha; `--verify` confere a cópia sem escrever dados. Preserve os contadores e dados de segurança do Redis. O cache público tem TTL de cinco segundos; não use FLUSHALL para concluir a migração.

## Produção e recuperação

O importador aceita origem e destino explicitamente configurados, exige TLS nos dois em produção e verifica certificados/CA. Use uma URL direta de migrations, sem pooler em modo transacional. A aplicação usa `DATABASE_TLS=true`, verificação de certificado e `DATABASE_CA_FILE` quando necessário; a CLI Prisma também exige TLS estrito, sem permitir downgrade por query parameters nas URLs fornecidas.

Antes de liberar tráfego, confira contagens, login/MFA, cardápio, um pedido de teste, caixa e impressão. Depois de novas gravações no PostgreSQL, a origem MySQL fica desatualizada. Retornar à versão anterior exige reconciliar essas gravações; não há sincronização ou reversão automática. Antes dessa liberação, é possível manter o serviço parado e recuperar a versão anterior em um checkout separado com a configuração/backup antigos.

## Desempenho e verificações

`DATABASE_POOL_MAX=10` limita conexões por réplica (2–50). Duas réplicas consomem até 20 conexões da aplicação; reserve capacidade para migrations, importação, manutenção e outras aplicações. O Compose configura `max_connections=100`; não multiplique réplicas sem revisar esse orçamento.

Conexão aguarda até 5 s por padrão, com `DATABASE_CONNECTION_TIMEOUT_MS` configurável. Consultas têm limite de 12 s, locks de 5 s e transações da API de 15 s. Apenas serialization failures/deadlocks com rollback confirmado são repetidos, em até três tentativas. Falhas de rede, timeout ou resultado incerto nunca são reenviados automaticamente. Callbacks de transação não devem realizar chamadas externas.

Snapshots somente leitura mantêm relatórios/saldos coerentes sem conflitos de predicado serializável. Índices cobrem chaves estrangeiras, paginação, categorias, estados dos pedidos e notificações. Não há GIN em todo JSONB: índices adicionais devem acompanhar consultas e medições reais.

```sh
pnpm check:all
pnpm --filter @cardapio/api db:check-schema
pnpm api:test:db
pnpm test:e2e:api
pnpm test:e2e:docker
pnpm test:docker:security
pnpm test:docker:resilience
```

Integração e navegador usam exclusivamente bancos `_test`. Testes cobrem permissões PostgreSQL, tipos nativos, snapshots que recusam gravações, concorrência, MFA, pagamentos, impressão e comportamento fail-closed. O benchmark existente utiliza o PostgreSQL `_test` com limites específicos; execute `benchmark:restore` depois e não interprete o teste de leitura em cache como capacidade de checkout.

Referências: [Prisma PostgreSQL](https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/postgresql), [pooling pg](https://node-postgres.com/features/pooling), [TLS pg](https://node-postgres.com/features/ssl), [imagem oficial PostgreSQL](https://hub.docker.com/_/postgres).
