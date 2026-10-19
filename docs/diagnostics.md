# Diagnóstico e recuperação

## Erros previsíveis

Toda operação retorna `Result<T>`. Em caso de falha, a interface mostra uma mensagem em português e uma referência de diagnóstico. O console recebe um objeto estruturado com horário UTC, módulo, operação, código, referência, causa técnica controlada e nomes permitidos de campos inválidos.

Não são registrados conteúdo do armazenamento, imagens, nomes de clientes, telefones, endereços, mensagens de pedido, mensagens arbitrárias de exceções ou pilhas. Falhas do destino de logs não transformam uma operação negada em sucesso.

| Código                   | Significado e recuperação                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `VALIDATION`             | Corrigir o campo ou estado indicado. Não há gravação parcial.                                                            |
| `NOT_FOUND`              | Restaurante ou produto deixou de existir; conferir a URL ou atualizar o catálogo.                                        |
| `ACCESS_DENIED`          | Operação administrativa não autorizada; a demonstração precisa ser habilitada explicitamente.                            |
| `CONFIGURATION`          | O modo demo/API ou alguma configuração obrigatória está inválido. Usar o comando apropriado; não há fallback.            |
| `CONFLICT`               | Outra operação gravou antes. Atualizar os dados, conferir os campos preservados e salvar novamente conscientemente.      |
| `STORAGE_UNAVAILABLE`    | O armazenamento local ou banco/API está indisponível. Verificar permissões e tentar novamente.                           |
| `STORAGE_QUOTA`          | O armazenamento está cheio. Usar imagens menores ou remover imagens desnecessárias antes de repetir a operação.          |
| `CORRUPT_DATA`           | JSON, versão, entidades ou referências inválidas. Preservar o conteúdo original e corrigir a origem antes de recarregar. |
| `CAPABILITY_UNAVAILABLE` | Web Locks indisponível; usar navegador atualizado em HTTPS ou localhost.                                                 |
| `UNEXPECTED`             | Falha não prevista. Usar a referência, o módulo e a operação para reproduzir com dados de teste.                         |

## Investigar a demonstração sem perder dados

1. Anotar referência e operação exibidas. Filtrar o console por `[cardapio]` e pelo identificador.
2. Se o problema é persistência, inspecionar a chave do restaurante nas ferramentas do navegador. Não limpar `localStorage` como primeira tentativa: isso descarta os dados desse navegador.
3. Antes de corrigir conteúdo manualmente, guardar uma cópia local. Não compartilhar payloads contendo imagens ou dados pessoais em logs e tickets.
4. Em dados legados, verificar as três chaves `saas_cardapio_store`, `saas_cardapio_categories` e `saas_cardapio_products`. A migração mantém seus valores originais.
5. Corrigir a causa e usar **Atualizar dados e tentar novamente**. Em conflito, a atualização da revisão mantém os campos digitados: conferir esses campos antes de reenviar.

Se a chave nova já existe, os dados antigos nunca a substituem. Se o documento é removido durante uma sessão já carregada, a aplicação bloqueia a operação em vez de recriar exemplos naquela sessão. Apagar todo o armazenamento e recarregar equivale a iniciar uma nova demonstração e perde as alterações locais.

## Verificações de desenvolvimento

Execute `pnpm check` e `pnpm test:e2e`. Os testes exercitam leitura inválida, quota, migração, revisão concorrente, autorização negada, valores monetários, carrinho, formulários e o link WhatsApp. Os testes de navegador usam as portas 4173 e 4174.

`scripts/check-text.mjs` valida a codificação UTF-8 e procura corrupção em textos de interface, evitando confundir URLs e operadores TypeScript com texto. Essa verificação roda no lint e antes dos builds. `.editorconfig` orienta os editores a preservar UTF-8 e quebras LF.

## API e Docker

A demonstração permanece independente. No modo API, a autorização, as revisões e o isolamento são verificados no servidor. `UNAUTHENTICATED` pede novo login; `CSRF_INVALID` pede atualização da sessão; `RATE_LIMITED` exige aguardar a janela do limite. Consulte a tabela completa em [backend.md](backend.md).

1. Confira o estado com `docker compose --env-file backend/.env --profile app ps` e a prontidão em `http://localhost:8080/api/v1/health/ready`.
2. Consulte `docker compose --env-file backend/.env logs api` e procure o `diagnosticId` exibido. A API registra somente metadados sanitizados; não habilite logs de payload ou queries para investigar.
3. Em falha de inicialização, confira se `backend/.env` existe e as migrations foram aplicadas. `setup:local` preserva os segredos existentes. Trocar a senha no arquivo não altera automaticamente a senha de um volume MySQL já inicializado.
4. Em conflito, atualize o catálogo/pedido e confira a alteração antes de reenviar. Em erro de envio, preserve a tentativa: a mesma chave de idempotência recupera o resultado sem duplicar o pedido.
5. Nunca use exclusão de volume, seeds, dados demo ou limpeza de banco como recuperação automática. Faça backup antes de intervir em dados persistidos.

Verificações completas: `pnpm check:all`, `pnpm api:test:db`, `pnpm test:e2e` e `pnpm test:e2e:api`. A API fora do Docker usa `localhost:3001`; os testes usam banco `_test` e portas próprias.

## Acesso pelo IP no celular

- **A página não abre:** confirme computador/celular na mesma rede, IPv4 atual e porta 8080. Execute `pnpm setup:lan --host <IP>` e `pnpm docker:up`; mudar somente o `.env` não recria containers existentes. Confira `docker compose --env-file backend/.env --profile app ps`. O firewall deve permitir a porta na rede usada, sem expor MySQL/Redis.
- **A página abre, mas salvar/enviar retorna ACCESS_DENIED:** confira `DOCKER_CORS_ORIGINS` (Docker) ou `CORS_ORIGINS` (Vite) em `backend/.env`. Inclua exatamente protocolo, IP e porta usados no navegador. `setup:lan` realiza essa configuração de desenvolvimento. Nunca use `*` nem remova CSRF. Causas sanitizadas `origin_not_allowed` e `origin_missing` distinguem esses bloqueios nos logs sem registrar o endereço de origem.
- **Recursos disponíveis apenas em localhost:** `crypto.randomUUID` e `crypto.subtle` dependem de contexto seguro. Identificadores e hash da tentativa agora passam por adaptadores portáteis; não habilite flags de navegador para mascarar o problema. Push e Web Locks (gravações da demonstração local) continuam requerendo HTTPS/localhost. Essas limitações não impedem pedidos pela API.
- **A resposta do pedido se perdeu:** preserve o carrinho/rascunho. Recarregar e recuperar a tentativa consulta o pedido já registrado; não apague armazenamento nem crie outra tentativa para resolver um timeout.

A porta 8080 é desenvolvimento HTTP. Produção exige HTTPS; os testes de rede local não reduzem validações de origem, sessão, tenant, CSRF ou TLS de produção. O ambiente E2E usa uma origem HTTP por IP, banco `_test` e testa checkout, recuperação, combos, adicionais, pagamentos, persistência e acompanhamento.

Referências técnicas: [MDN — randomUUID](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID), [MDN — getRandomValues](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues), [SHA-256 portátil](https://github.com/paulmillr/noble-hashes).
