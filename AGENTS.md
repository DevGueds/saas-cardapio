# SaaS Cardápio

React 19, TypeScript, Vite 8 e Tailwind CSS v4. Aplicação demonstrativa local organizada em DDD e arquitetura hexagonal. Leia `README.md` e `docs/architecture.md` para o mapa de responsabilidades e contratos.

## Entradas

- `src/main.tsx`: montagem React e CSS global.
- `src/app/composition.ts`: injeção manual de dependências e adaptadores.
- `src/app/routes.tsx`: rotas públicas e administrativas.
- `src/modules`: restaurante, catálogo, checkout e pedidos demonstrativos.
- `src/shared`: domínio comum, contratos técnicos, infraestrutura de navegador e UI reutilizável.
- `src/index.css`: imports dos estilos separados por responsabilidade e Tailwind v4.

## Desenvolvimento e verificações

- `pnpm dev` seleciona explicitamente a demonstração em `.env.demo`, porta 8443. Verifique se a porta já está em uso antes de iniciar outro servidor.
- `pnpm check` executa tipos, lint, limites arquiteturais, integridade UTF-8, testes e build demonstrativo.
- `pnpm test:e2e` usa Chromium e servidores nas portas 4173 e 4174. Instale o navegador com `pnpm exec playwright install chromium` quando necessário.
- `pnpm build` fica bloqueado sem configuração demo; `pnpm build:demo` habilita explicitamente a demonstração.
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
- Não adicionar banco, autenticação real ou chamadas Supabase nesta etapa.
- Preservar UTF-8. Em PowerShell, configurar `$OutputEncoding = [System.Text.UTF8Encoding]::new($false)` antes de enviar texto acentuado via pipe para scripts. Execute `pnpm check:text` após editar mensagens.
- Manter JSX válido e proteger apóstrofos em strings.
