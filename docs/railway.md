# Deploy completo na Railway

Configuração revisada em 28/10/2026. O repositório atual usa PostgreSQL 18.6 para o aplicativo e PostgreSQL 15 para o Evolution, não MySQL. A definição [.railway/railway.ts](../.railway/railway.ts) cobre os serviços do `compose.yaml`, com imagens fixadas, dados persistentes e rede privada.

## Formato atual

A Railway substituiu o Config as Code de serviço (`railway.json`/`railway.toml`) por Infrastructure as Code de projeto (`.railway/railway.ts`). Os arquivos antigos deixam de ser lidos em 01/12/2026 e novos serviços não podem optar por eles. Os dois arquivos legados deste repositório foram removidos. A definição é aplicada explicitamente pelo CLI: conectar o GitHub sozinho não aplica a infraestrutura.

Fontes oficiais: [Config as Code](https://docs.railway.com/config-as-code), [IaC](https://docs.railway.com/infrastructure-as-code), [referência do SDK](https://docs.railway.com/infrastructure-as-code/reference).

## Serviços e persistência

| Serviço        | Responsabilidade                                                         | Persistência / exposição                         |
| -------------- | ------------------------------------------------------------------------ | ------------------------------------------------ |
| `postgres`     | PostgreSQL 18.6, cria banco e papéis separados de aplicação/migration    | Volume `/var/lib/postgresql`, 4 GB; privado      |
| `redis`        | Cache, limites compartilhados e locks; AOF, senha, política `noeviction` | Volume `/data`, 1 GB; privado; bancos 0 e 6      |
| `migrate`      | Executa migrations Prisma como `cardapio_migrator`, uma vez por deploy   | Sem volume e sem domínio; termina com código 0   |
| `api`          | NestJS/Fastify, HTTP interno 3001                                        | Sem volume; usuário `node`; privado              |
| `api-replica`  | Segunda instância com as mesmas chaves e dados                           | Sem volume; usuário `node`; privado              |
| `web`          | React estático + Caddy, HTTP interno 8080                                | Único domínio público, HTTPS na borda            |
| `evolution-db` | PostgreSQL 15 exclusivo do provedor de WhatsApp                          | Volume `/var/lib/postgresql/data`, 2 GB; privado |
| `evolution`    | Evolution API 2.3.7 e filtro de logs do provedor                         | Volume `/evolution/instances`, 1 GB; privado     |

Os tamanhos são pedidos iniciais de capacidade, não estimativa de cobrança. Recursos e quantidade de volumes dependem do plano da conta. Instâncias e bancos ficam na mesma região inicial do projeto. Se alterar região/tamanho, revise o plano: reduzir ou mover volumes pode afetar dados. Configure backups dos dois PostgreSQL e do volume de sessões do provedor antes de uso operacional.

Os serviços de banco são containers persistentes definidos pelo repositório, não uma promessa de HA ou de banco totalmente administrado. As APIs não recebem senha de administrador nem DSN de migration. A conta de runtime não cria tabelas ou altera o schema. Logs das APIs seguem para stdout e para a observabilidade Railway; `LOG_DIRECTORY` vazio evita arquivos efêmeros nas réplicas. No Docker local, a configuração existente continua gravando arquivos em volume.

## Primeiro deploy limpo, com domínio gratuito

Requisitos: código com esses arquivos publicado no GitHub, Node 24, pnpm 11.23.0 e conta Railway com acesso ao repositório. Use projeto novo para evitar que um blueprint de ambiente inteiro altere recursos existentes.

```sh
npm ci --prefix .railway
pnpm railway:prepare --environment production
pnpm railway:check
```

`prepare` gera senhas independentes, segredo de sessão e par VAPID em `.railway/local/production.json`. O arquivo fica fora do Git e do contexto Docker. Repetir o comando preserva os valores; mantenha backup seguro. Para usar uma branch ainda não incorporada à main:

```sh
pnpm railway:prepare --environment production --branch codex/railway-complete
```

Execute os comandos abaixo da raiz. `pnpm railway` usa o CLI local fixado e funciona também no Windows, sem instalação global.

```sh
pnpm railway login
pnpm railway init --name saas-cardapio
pnpm railway link --project saas-cardapio --environment production
pnpm railway add --service web --json
pnpm railway domain --service web --port 8080 --json
pnpm railway:plan
```

O serviço `web` é criado vazio para obter o domínio gratuito antes do primeiro deploy. A definição IaC o adota pelo nome e configura seu código. Não adicione `web` novamente se o comando anterior já tiver criado o serviço; confirme com `pnpm railway service list --json`.

Revise o plano: oito serviços, quatro volumes novos, apenas `web` público e nenhuma remoção inesperada. Em seguida, aplique o plano no projeto/ambiente conferidos:

```sh
pnpm railway config apply
pnpm railway deployment list --service migrate --json
pnpm railway deployment list --service api --json
pnpm railway deployment list --service api-replica --json
pnpm railway deployment list --service web --json
```

Aplique sem `--yes` para revisar a confirmação nativa. O `migrate` deve terminar com sucesso; API e réplica precisam passar `/api/v1/health/ready`; web passa `/healthz`; Evolution responde em `/`. Consulte também `evolution`, `evolution-db`, `postgres` e `redis` no painel. Um upload ou build concluído não comprova deploy saudável.

Abra a URL HTTPS gerada em `web`. Cadastre a primeira conta, crie/configure a loja e pareie o WhatsApp pela interface. Depois, se não quiser cadastro público de novas organizações, feche-o:

```sh
pnpm railway:prepare --environment production --close-signup
pnpm railway:plan
pnpm railway config apply
```

Isso controla novos cadastros; não remove a conta criada. A chave e as sessões WhatsApp são próprias da instalação. O deploy limpo não importa dados ou pareamentos do Docker local.

## HTTPS, cookies e domínio pago depois

O domínio gratuito `*.up.railway.app` já oferece HTTPS e aceita cookies `Secure`. O frontend chama `/api/v1` na mesma origem; Caddy encaminha para as APIs privadas. Não crie um segundo domínio público para a API para contornar cookies.

`SESSION_COOKIE_SECURE` aceita:

| Valor           | Comportamento                                                                |
| --------------- | ---------------------------------------------------------------------------- |
| `auto` (padrão) | Usa `Secure` em produção e quando todas as origens configuradas são HTTPS    |
| `true`          | Força `Secure`; útil também no desenvolvimento com HTTPS                     |
| `false`         | Aceito somente fora de produção e com origens HTTP; útil no Docker/LAN local |

Produção rejeita `false`, inclusive em domínio gratuito: não há motivo técnico para retirar a proteção nesse domínio. Cookies permanecem `HttpOnly`, `SameSite=Lax`, com `Path=/` e sem `Domain`. Quando seguros usam o prefixo `__Host-`. Login, MFA e logout usam a mesma configuração. Alterar o modo/nome pode exigir novo login. Não use `SameSite=None` sem necessidade nem `Domain=.up.railway.app`.

`CORS_ORIGINS` usa o domínio de `web` por referência, não um endereço gerado copiado no código. Caddy substitui o endereço de cliente encaminhado com `X-Real-IP` da borda; as APIs privadas confiam somente no salto do proxy. Não habilite domínio/TCP público em API, Redis, bancos ou Evolution mantendo essa política de confiança.

Quando adquirir o domínio:

```sh
pnpm railway:prepare --environment production --origin https://menu.seudominio.com --contact mailto:operacao@seudominio.com
pnpm railway:plan
pnpm railway config apply
```

Configure o DNS conforme indicado pela Railway e confirme o certificado antes de distribuir a URL. O blueprint adiciona o domínio em web e atualiza a origem aceita nas APIs. Cookies são próprios de cada host: a mudança exige login no domínio novo. O modo de cookies continua `auto`.

Referências: [domínios Railway](https://docs.railway.com/networking/domains/railway-domains), [Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie).

## Rede, migrations e atualizações

A opção `PRIVATE_NETWORK_TRANSPORT=railway` permite PostgreSQL/Redis sem TLS adicional somente se o processo recebe os identificadores de projeto/ambiente Railway e o destino corresponde exatamente a `<serviço>.railway.internal`. O tráfego interno usa a malha WireGuard criptografada. Hosts públicos, sufixos parecidos ou ausência de contexto continuam exigindo TLS verificado em produção. A validação das migrations usa a mesma regra. Não há `rejectUnauthorized=false`, `NODE_TLS_REJECT_UNAUTHORIZED=0` ou `NODE_ENV=development` em produção.

O serviço PostgreSQL incorpora o script de criação de papéis; o Redis incorpora seu startup; o Evolution incorpora `provider-log-gate.cjs`. Assim, nenhum depende de bind mount de arquivos do computador. PostgreSQL 18 usa volume no diretório pai `/var/lib/postgresql`; o provedor PostgreSQL 15 mantém seu caminho próprio.

Evolution permanece privado, com documentação/gerenciador próprios desativados e autenticação por API key. Seu CORS interno aceita `*`, sem credenciais de navegador: a versão fixada devolve erro em probes sem `Origin` quando recebe uma origem fixa. Isso permite o healthcheck nativo Railway, que não envia esse cabeçalho. O teste de imagens verifica também que consultas protegidas sem API key são recusadas. O CORS da API do aplicativo continua restrito à origem HTTPS de web.

`migrate` é a única instância com credencial DDL. As APIs aguardam, por tempo limitado, os registros de migrations correspondentes aos arquivos/checksums da própria imagem antes de iniciar. Isso também protege a primeira instalação e o autodeploy de pushes, que não garante ordem entre serviços. A referência `MIGRATION_RELEASE` estabelece dependência em deploys em lote. O processo de migration falha com código e evento seguros, sem imprimir DSN ou SQL de clientes.

As mudanças no schema devem permitir que a versão anterior continue funcionando durante a atualização. Falha de migration bloqueia o novo runtime; o healthcheck não é uma estratégia de rollback de dados. Um volume já inicializado não executa scripts de init novamente. Alterar senha no arquivo local, sozinho, não altera o usuário no banco: rotação exige operação coordenada, não remoção do volume.

Os filtros `watchPatterns` limitam autodeploys aos arquivos de cada serviço: alterações do frontend não reiniciam PostgreSQL, Redis ou Evolution. Mudanças de infraestrutura exigem novo plano/aplicação; mudanças das variáveis referenciadas podem atualizar consumidores.

Fontes: [rede privada](https://docs.railway.com/networking/private-networking), [ordem de deploy](https://docs.railway.com/deployments/deployment-actions), [volumes](https://docs.railway.com/volumes).

## Template para reuso

A definição IaC é o template importável por CLI. A Railway também permite arrastar Compose no canvas, mas o importador não cobre todas as opções. O `compose.yaml` da raiz é local, contém bind mounts, aliases, ferramentas de teste e segredos em `.env`: não o use diretamente como configuração de produção.

Para um botão de implantação oficial, use o projeto validado para gerar um rascunho com `pnpm railway templates create`. [railway/template/README.md](../railway/template/README.md) contém os ajustes e geradores de segredos para que outra instalação não herde credenciais. O link só passa a existir quando o template for criado na conta; nenhum ID fictício é fornecido. A publicação no marketplace é opcional.

Fontes: [criar template](https://docs.railway.com/templates/create), [CLI de templates](https://docs.railway.com/cli/templates), [limites do importador Compose](https://docs.railway.com/builds/dockerfiles).

## Verificação e diagnóstico

- `pnpm railway:check`: tipos do SDK, cobertura dos serviços, referências, volumes, separação de credenciais e plano determinístico; sem conta Railway.
- `pnpm test:railway:images`: constrói as imagens e sobe um projeto Docker descartável com os oito serviços; verifica migrations, proxy, sessão compartilhada, cookies seguros, origem e privilégios. Usa segredos aleatórios próprios, sem importar `backend/.env`; remove somente os próprios volumes ao terminar.
- `pnpm railway:plan`: validação e comparação remota; exige autenticação e vínculo com o ambiente. Não executa deploy.
- `pnpm api:check`: tipos, arquitetura, testes de cookies/transporte e build da API.
- `node --test scripts/railway-readiness.test.mjs`: checksum, migrations incompletas, corrida de inicialização e prazo limite.

Se aparecer `Not authenticated`, faça login para planejar/aplicar; a preparação local continua válida, mas ainda não houve validação do estado remoto. `api_startup_blocked` pede conferir domínio/CORS, contexto de rede, credenciais e o resultado de `migrate`. Não exponha segredos no terminal para diagnosticar. Inspecione os logs dos serviços com limite de linhas e preserve códigos técnicos.
