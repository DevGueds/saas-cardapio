# SaaS Cardápio

React 19, TypeScript, Vite 8 e Tailwind CSS v4. Frontend demo/API e backend NestJS/Fastify/PostgreSQL organizados em DDD e arquitetura hexagonal. Leia `README.md` e `docs/architecture.md` para o mapa de responsabilidades e contratos.

## Entradas

- `src/main.tsx`: montagem React e CSS global.
- `src/app/composition.ts`: injeção manual de dependências e adaptadores.
- `src/app/routes.tsx`: rotas públicas e administrativas.
- `src/modules`: identidade/equipe, restaurante, catálogo, comércio (combos/promoções/entrega), checkout, pedidos reais e demonstrativos.
- `src/shared`: domínio comum, contratos técnicos, infraestrutura de navegador e UI reutilizável.
- `src/index.css`: imports dos estilos separados por responsabilidade e Tailwind v4.

## Desenvolvimento e verificações

- `pnpm dev` seleciona explicitamente a demonstração em `.env.demo`, porta 8443. Verifique se a porta já está em uso antes de iniciar outro servidor.
- `pnpm dev:full` inicia API e frontend conectados; preparação com `pnpm setup:local`, `pnpm db:up` e `pnpm db:migrate`.
- `pnpm check:all`, `pnpm api:test:db` e `pnpm test:e2e:api` verificam também o backend e a integração real.
- `pnpm check` executa tipos, lint, limites arquiteturais, integridade UTF-8, testes e build demonstrativo.
- `pnpm test:e2e` usa Chromium e servidores nas portas 4173 e 4174. Instale o navegador com `pnpm exec playwright install chromium` quando necessário.
- `pnpm build` mantém operações bloqueadas sem modo válido. `pnpm build:demo` e `pnpm build:api` selecionam explicitamente os adaptadores.
- `pnpm docker:up` inicia frontend, duas APIs, Redis e PostgreSQL em http://localhost:8080 após `pnpm setup:local`; `pnpm docker:down` preserva o volume.
- Formatação: Prettier com `.prettierrc.json`. O antigo oxfmt 0.2 removia separadores obrigatórios de tipos TypeScript e foi substituído.

## Regras de código

- Domínio não importa React, navegador, aplicação ou infraestrutura.
- Aplicação depende de domínio e portas, não dos adaptadores.
- Apresentação utiliza os casos de uso injetados; não acessa persistência diretamente.
- `shared` não depende de módulos de negócio.
- Exportar componentes React como default; usar nomes descritivos por responsabilidade.
- Usar centavos inteiros para dinheiro e validar entradas e dados persistidos.
- Tratar erros com `Result<T>` e códigos estáveis. Nunca informar sucesso antes da gravação nem substituir falhas por dados demonstrativos.
- Manter dados pessoais, imagens e mensagens de pedido fora dos logs.
- Backend autorizado nesta etapa: NestJS + Fastify + Prisma + PostgreSQL em `backend/`. Nunca acessar o banco pelo navegador nem adicionar chamadas Supabase.
- Domínio portátil compartilhado em `packages/domain`; contratos de entrada/saída em `packages/contracts`. Evitar duplicação entre cliente e servidor.
- Acesso real exige sessão e autorização por tenant no servidor. A demonstração permanece explicitamente isolada.
- Consulte `backend/AGENTS.md` e `docs/backend.md` ao trabalhar na API.
- Preservar UTF-8. Em PowerShell, configurar `$OutputEncoding = [System.Text.UTF8Encoding]::new($false)` antes de enviar texto acentuado via pipe para scripts. Execute `pnpm check:text` após editar mensagens.
- Manter JSX válido e proteger apóstrofos em strings.

## UX/UI Design Principles — Mandatory Review

- Antes de implementar ou modificar interfaces, consulte [.agents/skills/ux-ui-design-principles/SKILL.md](.agents/skills/ux-ui-design-principles/SKILL.md).
- Aplique a skill durante decisões de layout, navegação, formulários, botões, tabelas, modais e outros elementos interativos. Depois de alterações relevantes, revise seu checklist e execute as verificações disponíveis.
- Em refatorações, preserve ou aprimore os padrões existentes. Em revisões frontend, identifique problemas de usabilidade, inconsistência visual e acessibilidade.
- Não introduza alterações estéticas que prejudiquem os fluxos. Priorize componentes reutilizáveis e evite duplicações.
- Trate violações relevantes de usabilidade como problemas de qualidade, com gravidade e correção concreta.
- Esta revisão não se aplica a tarefas exclusivamente backend, infraestrutura ou documentação sem impacto na interface.

- Resiliência e ensaios locais: consulte `docs/resilience.md`; `compose.benchmark.yaml` usa exclusivamente `_test` e limites próprios. Restaure com `pnpm benchmark:restore`.

- Formulários: use os controles em `shared/presentation/form-validation` e os contratos Zod de `packages/contracts/src/fields.ts`. Consulte `docs/form-validation.md`; mantenha schemas de rascunho permissivos para entradas incompletas e nunca normalize senhas.
