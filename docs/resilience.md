# Resiliência, operação e capacidade

## Proteções reutilizáveis

- `Bulkhead`: limita trabalho ativo sem fila ilimitada. HTTP: 128 requisições ativas por réplica por padrão; Argon2: 4 operações por réplica; consulta externa: 4. Saturação devolve erro controlado, sem executar trabalho em outra fonte.
- `RedisStore`: conexão autenticada, fila de comandos limitada a 512, sem fila offline, prazo de resposta de 2 segundos e reconexão com atraso limitado. Produção exige TLS. Redis indisponível bloqueia operações protegidas e readiness; não desativa o limitador.
- `RedisLimiter`: incremento + expiração atômicos via Lua. Chaves HMAC evitam armazenar IP/e-mail em claro; as réplicas precisam usar o mesmo segredo. Limites específicos de login/cadastro/pedidos continuam mesmo quando o limite global é ajustado.
- `CachedMenu`: somente leitura pública, cache Redis de 5 segundos, validação de schema/slug, single-flight de misses por processo e invalidação após edição. Snapshots maiores que 1 MB não são armazenados no cache. Uma leitura concorrente com edição pode publicar cache antigo por até o TTL; revisão e checkout autoritativo impedem confirmar preço antigo. Cotação, administração e checkout sempre consultam PostgreSQL.
- `ResilientHttp`: GET externo com no máximo duas tentativas, timeout de 3 segundos por tentativa, jitter, corpo até 64 KiB, circuit breaker após três operações falhas por 30 segundos e uma sonda de recuperação. 404 não é repetido. URL de BrasilAPI é fixa, evitando SSRF.
- Prisma usa pool de dez conexões por réplica, aquisição/consulta com falhas traduzidas, transações e CAS de revisão. Consumo de promoção e criação de pedido são atômicos. Banco não é acessado pelo cliente.

As portas ficam em `backend/src/shared/application`, adaptadores em `shared/infrastructure`, e composição em `app/composition.ts`. Para outro cache/provedor, implemente a porta e preserve comportamento de erro, limites e testes. Não replique políticas por controller.

## Trabalho de CPU com Parallel.js

`ParallelTaskRunner` usa Parallel.js 1.1.0 para cálculos independentes, com adaptador de processos Node que controla saída prematura, cancelamento e encerramento. Não recebe código do usuário. Não paraleliza gravações, pagamentos ou consultas dentro da mesma transação. Relatórios continuam lendo um snapshot coerente; apenas a agregação de centavos sai do processo HTTP. Os workers recebem datas, métodos e valores, sem nomes, descrições, IDs, cookies ou credenciais. A validação de pixels do logo usa a mesma capacidade limitada e devolve apenas um booleano, sem registrar a imagem.

Configuração por réplica: `CPU_WORKERS=2` (1–4), `CPU_JOB_TIMEOUT_MS=7000` (1–30 segundos), `REPORT_PARALLEL_THRESHOLD=2000` (100–10.000 registros de pedidos + pagamentos). Relatórios menores usam o cálculo local. Cada filho tem heap antigo de 64 MiB e geração jovem limitada; buffers nativos têm limites próprios de entrada/saída/pixels, portanto isso não equivale a um limite de RSS por processo. O limite de memória do container continua necessário. A capacidade é compartilhada entre relatórios e logos. Saturação ou prazo devolvem 503 controlado, sem fila ilimitada, sem execução síncrona alternativa e sem alterar dados; encerrar a API cancela os filhos.

O isolamento protege a resposta da API, mas iniciar processos e serializar dados tem custo: não significa que cada relatório termina mais rápido. Ajuste o limiar com medições do ambiente; aumentar workers exige orçamento de memória/CPU. A CSP do navegador permanece restrita: não se habilitou `unsafe-eval`/workers de código dinâmico no frontend.

`pnpm api:build && pnpm benchmark:cpu` compara 12 relatórios sintéticos de 5.000 pedidos + 5.000 pagamentos, com no máximo dois filhos simultâneos. Verifica igualdade dos totais e mede duração e atraso do event loop, em `.cache/benchmark-cpu.json`. É um microbenchmark de isolamento, sem banco/HTTP, não uma medida de capacidade de produção. `BENCHMARK_CPU_JOBS=2..50` controla a duração. Testes reais de banco também exercitam cinco consultas simultâneas com 2.000 movimentos, saúde da API e recusa de perfil sem permissão.

Referência: [Parallel.js](https://github.com/parallel-js/parallel.js).

## Balanceamento em Docker

`compose.yaml` executa duas APIs stateless e Caddy com `least_conn`. Healthcheck ativo consulta readiness a cada cinco segundos; falhas passivas retiram o upstream temporariamente. Caddy só repete GET/HEAD até duas vezes dentro da janela de três segundos (conexão limitada a 500 ms). Um handler separado atende POST/PUT/DELETE sem retries. O keep-alive do proxy é menor que o timeout do Fastify para evitar reutilizar conexões já encerradas. Idempotência de pedido é responsabilidade do caso de uso e da chave persistida pelo cliente.

Sessão no PostgreSQL e proteção/cache no Redis funcionam entre réplicas sem sticky sessions. APIs não têm portas externas. A confiança de proxy está restrita à rede interna declarada; Caddy determina o IP encaminhado. `HTTP_RATE_LIMIT=600` protege cada IP por minuto. Usuários atrás do mesmo NAT compartilham o limite; ajuste com métricas reais e proteção de borda, não removendo os limites de autenticação.

Redis tem 128 MB e política `noeviction`: esgotamento provoca erro explícito, sem expulsar silenciosamente contadores de segurança. O volume tem AOF; a política padrão do Redis pode perder os últimos comandos em uma falha abrupta do host. Não substitui HA/replicação de produção. Duas APIs não eliminam pontos únicos de falha de PostgreSQL, Redis, host e proxy deste Compose local.

## Ensaio reproduzível

Use somente máquina local de desenvolvimento. O override aponta as APIs para `cardapio_test` e eleva o limite global e a concorrência por réplica para medir o caminho de leitura. O perfil usa `HTTP_RATE_LIMIT=100000` e `MAX_IN_FLIGHT=512` por réplica. Não publique esse override.

```sh
pnpm setup:local
pnpm docker:up
pnpm --filter @cardapio/api db:migrate:test
pnpm benchmark:fixture
pnpm benchmark:up
pnpm benchmark
pnpm benchmark:restore
```

`benchmark:fixture` cria de forma idempotente a loja sintética `benchmark-local` somente no banco com sufixo `_test`, com 20 produtos sem fotos e sem dados pessoais. `benchmark:up` reaproveita as imagens de `docker:up`. `benchmark:restore` retorna ao banco e limites normais sem apagar volumes. Execute a restauração mesmo se o ensaio falhar.

`benchmark` usa Autocannon, padrão de 1000 conexões simultâneas durante 15 segundos, pipeline 1 e gzip. Variáveis opcionais: `BENCHMARK_CONNECTIONS` (1–5000), `BENCHMARK_SECONDS` (5–60), `BENCHMARK_URL` (somente loopback). Grava `.cache/benchmark.json`, com cenário, bytes do payload, requests/s, p50/p97.5/p99, códigos HTTP, erros e timeouts. Sai com erro quando existem respostas não 2xx ou falhas de transporte; 429/503 não contam como capacidade atendida.

O teste de cardápio em cache não mede checkout concorrente, uploads, rede móvel, mapas ou catálogo com fotos base64. Mil conexões abertas não significam mil transações de escrita por segundo. Capacidade de produção precisa de distribuição realista de tráfego, duração prolongada, observação de CPU/memória/conexões e teste de dependências. Imagens devem migrar para object storage/CDN antes de catálogos grandes; envio inline aumenta tráfego e pode desabilitar o cache.

## Verificações de falha

`pnpm api:test:db` inclui dois clientes Redis compartilhando o mesmo limite e falha após desconexão. Testes unitários cobrem saturação, liberação de capacidade, circuit breaker, cache corrompido e ausência de fallback. `pnpm test:e2e:docker` valida proxy, bundle e proteção de acesso.

Em ambiente local, parar uma réplica deve manter leituras pela outra; parar Redis deve tornar readiness indisponível e bloquear operações, sem devolver demo. Reinicie os serviços e espere readiness antes de repetir. Não faça esse exercício num ambiente que esteja atendendo pessoas.

Referências: [Caddy reverse proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy), [Node Redis em produção](https://redis.io/docs/latest/develop/clients/nodejs/produsage/), [Node Redis command options](https://github.com/redis/node-redis/blob/master/docs/command-options.md).

## Medição histórica de 17/10/2026

Esta medição foi realizada antes da migração para PostgreSQL e não mede a implementação atual. Reexecute o benchmark para avaliar esta versão.

Windows + Docker Desktop/WSL, host com 12 CPUs lógicas e 16 GiB, VM Docker com aproximadamente 7,7 GiB; duas APIs limitadas a 512 MiB cada. Node 24.19, cardápio sintético de 6.541 bytes sem fotos, gzip, Redis compartilhado, 1.000 conexões e 15 segundos. Gerador e serviços no mesmo computador.

| Concorrência por API        | Respostas 200 | Respostas 503 | Requests/s totais |   p50 |      p99 | Timeouts |
| --------------------------- | ------------: | ------------: | ----------------: | ----: | -------: | -------: |
| 128 (proteção padrão)       |        31.336 |         5.830 |             2.478 | 80 ms | 6.531 ms |       12 |
| 512 (override de benchmark) |        50.718 |             0 |             3.382 | 77 ms | 5.516 ms |        0 |

O segundo ensaio teve zero erros de transporte e zero respostas não 2xx. A cauda de latência continua alta: **não é um SLO nem comprovação de capacidade de produção**. O primeiro ensaio evidencia a rejeição controlada por saturação; respostas rejeitadas não são contabilizadas como demanda atendida. Limites normais continuam 128 requisições ativas por API e 600/minuto/IP. Não subir limites sem medir recursos, payload e padrão real de uso.

`pnpm test:docker:resilience` automatiza a parada de uma réplica, vinte leituras pela sobrevivente, indisponibilidade do Redis e do PostgreSQL com HTTP 503, verificação de leitura autoritativa sem fallback e restauração dos serviços em `finally`. Também roda no CI após o smoke Docker. É exclusivo do Compose local.
