# Backend

NestJS/Fastify, Prisma e PostgreSQL. Consulte ../docs/backend.md.

- Domínio e aplicação não importam NestJS, Prisma, Fastify ou implementações de infraestrutura.
- Injetar portas via composição. Controllers traduzem HTTP; casos de uso validam e autorizam também quando chamados diretamente.
- Todo acesso de negócio exige escopo de tenant/restaurante validado. Não criar métodos de repositório que ignorem esse escopo.
- Rotas são privadas por padrão; acesso público exige declaração explícita.
- Não registrar corpo, cookies, tokens, senhas, e-mail, nomes, endereços ou mensagens nos logs.
- Falha de autorização, configuração, sessão ou banco bloqueia a operação. Não usar memória ou dados de exemplo como fallback.
- Mutação de catálogo/configuração exige revisão. Gravações compostas e registro de pedido são transacionais.
- Senhas: mínimo 8 caracteres, máximo 128; não truncar nem aplicar trim. Hash Argon2id.
- Configuração local é gerada sem sobrescrever arquivos existentes. Migrations em produção são explícitas, nunca automáticas ao iniciar.
- Execute pnpm api:check e pnpm api:test:db da raiz. Testes de banco usam exclusivamente banco com sufixo _test e identificadores gerados por execução.
