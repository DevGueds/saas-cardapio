# Deploy completo na Render

Alternativa à [Railway](railway.md), preservando o Compose local e os arquivos da Railway. O [render.yaml](../render.yaml) é um Blueprint importável pela Render: frontend, duas APIs, PostgreSQL, Redis, migrations e WhatsApp. Não importa dados nem segredos do computador.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://dashboard.render.com/blueprint/new?repo=https://github.com/VitorsmX/saas-cardapio)

O endereço inicial é `https://<nome-gerado>.onrender.com`, com HTTPS gerenciado pela Render. **Domínio gratuito não significa infraestrutura gratuita.** Este Blueprint usa compute pago e quatro discos persistentes. A Render mostra os custos antes da criação; nenhum recurso é criado ao executar os verificadores deste repositório.

## Importar

1. Publique os arquivos desta alteração no repositório que será conectado à sua conta Render. Enquanto a alteração estiver em revisão, escolha a branch `codex/render-deployment` na criação do Blueprint; depois do merge, use `main`.
2. No painel Render, escolha **New → Blueprint**, conecte o GitHub e selecione o repositório/branch. O arquivo é `render.yaml`, na raiz. O botão acima abre o mesmo fluxo; confira a branch antes de continuar.
3. Confira os oito serviços, os discos e os planos apresentados. Todos ficam na região `virginia`. Altere a região de **todos** antes da primeira criação, se necessário; recursos existentes não mudam de região por editar o YAML.
4. Crie o Blueprint. As senhas, as sementes de sessão e de Web Push e a chave do provedor são geradas pela Render. Não é necessário copiar `backend/.env`, montar URLs manualmente ou desabilitar cookies seguros.
5. Aguarde os deploys. `cardapio-migrations` executa seu **pre-deploy command** antes de iniciar o processo privado de saúde. As APIs aguardam as migrations concluídas e verificam os checksums dos arquivos versionados. Confira o evento `migrations_completed` e a prontidão das APIs.
6. Abra o endereço HTTPS mostrado em `cardapio-web`. Crie a conta do responsável e a loja. A loja começa vazia e fechada. Configure os produtos e a operação antes de abri-la.
7. Após cadastrar o responsável, altere `SIGNUP_ENABLED` para `"false"` no grupo `cardapio-api-settings` **e no YAML versionado**, e redeploye as duas APIs. O cadastro de equipe autorizado pela própria aplicação permanece disponível.

Se a criação inicial das APIs terminar antes das migrations e falhar por dependência, aguarde `cardapio-migrations` concluir e redeploye as APIs. Não altere o banco manualmente nem habilite migrations na inicialização para contornar a falha.

Os serviços de código usam `autoDeployTrigger: checksPass`: deploys automáticos aguardam o CI do GitHub. Uma atualização exclusivamente de documentação não reconstrói todos os serviços. O PostgreSQL do provedor usa imagem pronta fixada por digest; a troca dessa imagem é explícita.

Mudanças no Blueprint são sincronizadas pela Render nos recursos afetados. O YAML não é incluído como gatilho de rebuild de todos os serviços: fechar o cadastro nas APIs não deve reiniciar os bancos. Se desativar Auto Sync no painel do Blueprint, faça Manual Sync após revisar alterações de configuração.

## Serviços

| Serviço                 | Tipo/compute inicial  | Dados persistentes                 | Acesso                                           |
| ----------------------- | --------------------- | ---------------------------------- | ------------------------------------------------ |
| `cardapio-web`          | Web, `0.5c-512mb`     | Bundle versionado, sem disco       | Único domínio público                            |
| `cardapio-api`          | Privado, `0.5c-512mb` | PostgreSQL/Redis compartilhados    | Porta 3001, privada                              |
| `cardapio-api-replica`  | Privado, `0.5c-512mb` | PostgreSQL/Redis compartilhados    | Porta 3001, privada                              |
| `cardapio-migrations`   | Privado, `0.5c-512mb` | Nenhum disco                       | Pré-deploy DDL; depois apenas `/healthz` privado |
| `cardapio-postgres`     | Privado, `0.5c-512mb` | 4 GB em `/var/lib/postgresql`      | PostgreSQL 18, porta 5432 privada                |
| `cardapio-redis`        | Privado, `0.5c-512mb` | 1 GB em `/data`, AOF               | Redis autenticado, porta 6379 privada            |
| `cardapio-evolution-db` | Privado, `0.5c-512mb` | 2 GB em `/var/lib/postgresql/data` | PostgreSQL 15 separado, privado                  |
| `cardapio-evolution`    | Privado, `1c-2g`      | 1 GB em `/evolution/instances`     | Provedor WhatsApp, porta 8080 privada            |

Os tamanhos são um ponto de partida, não uma promessa de capacidade. As APIs começam com pool de cinco conexões e um worker de CPU por processo. Use métricas e os [limites de carga medidos](resilience.md) antes de aumentar concorrência. Os serviços com disco têm uma instância; discos impedem escala horizontal e deploy sem interrupção desses serviços. As APIs são stateless e têm réplicas separadas, sessões e limites compartilhados no Redis.

O Blueprint conserva os mesmos bancos em containers do Compose, em vez de trocar silenciosamente para datastores gerenciados com credenciais e permissões diferentes. A operação, os upgrades e os backups desses bancos são responsabilidade da equipe. Não há banco `_test` nem dados demonstrativos no deploy.

## URLs, segredos e cookies

A Render não interpola variáveis dentro de outras variáveis no Blueprint. Por isso, [render/environment.mjs](../render/environment.mjs) monta as URLs em memória com `URL`, escapando senhas geradas com `+`, `/` e `=`. Referências `fromService` fornecem os hosts privados e as credenciais corretas.

`RENDER_APP_URL` referencia `RENDER_EXTERNAL_URL` da web. As duas APIs derivam a mesma origem HTTPS automaticamente. Frontend e API usam `/api/v1` na mesma origem; não há domínio público separado da API nem cookies entre subdomínios.

`SESSION_COOKIE_SECURE=auto` mantém `Secure`, `HttpOnly`, `SameSite=Lax`, prefixo `__Host-` e ausência de `Domain`. `false` continua restrito ao desenvolvimento HTTP; não funciona como bypass em produção. O domínio gratuito `onrender.com` suporta esses cookies normalmente. A produção exige origem HTTPS exata e valida a origem nas mutações.

`SESSION_SEED` e `VAPID_SEED` são segredos independentes de 256 bits, gerados no grupo `cardapio-api-keys`. As chaves são derivadas de forma determinística para permanecerem iguais nas réplicas e nos redeploys. Reiniciar não gera uma nova chave. Não gire `VAPID_SEED` sem planejar a renovação das inscrições de push; girar `SESSION_SEED` invalida sessões existentes.

As APIs recebem apenas a senha do usuário `cardapio`, sem DDL. Apenas `cardapio-migrations` recebe a senha de `cardapio_migrator`; a senha administrativa permanece no serviço PostgreSQL. O processo ocioso do coordenador não acessa banco e remove o material secreto de seu próprio ambiente. O pré-deploy é uma instância separada, não um worker que reinicia em laço após sair com sucesso.

`PRIVATE_NETWORK_TRANSPORT=render` permite o TCP privado somente com contexto Render (`RENDER`, ID válido e tipo `pserv`) e igualdade exata com os hosts privados injetados para PostgreSQL/Redis, nas portas esperadas. Domínios públicos, IPs, portas alternativas e nomes parecidos são rejeitados. Esse modo usa a rede privada regional da Render e **não afirma oferecer TLS entre os containers**. Fora desse contexto, a aplicação continua exigindo TLS com validação de certificado. Não exponha esses serviços como Web Services nem use um workspace compartilhado com serviços não confiáveis; isolamento de rede por ambiente depende do plano da Render.

A web sobrescreve cabeçalhos de proxy enviados pelo navegador. O IP de origem vem de `CF-Connecting-IP`, definido pela Cloudflare na borda pública da Render; se o valor estiver ausente/inválido, usa o endereço do par. A API confia em apenas um salto privado. Não coloque outro proxy público na frente sem revisar essa cadeia de confiança.

## WhatsApp, push e impressão

Na aplicação, ative e pareie o WhatsApp da loja pelo QR Code. **Fazer deploy não pareia o telefone.** O provedor não expõe seu painel, banco ou API na internet. A aplicação usa sua API privada autenticada. As instâncias e as sessões têm persistência; armazenamento de mensagens, contatos, chats e histórico fica desabilitado. O filtro de logs existente também protege saída nativa do provedor. Consentimento e regras de prioridade das mensagens permanecem obrigatórios.

Web Push pode funcionar no domínio HTTPS gratuito após autorização do navegador. Em iPhone/iPad, use o aplicativo pela Tela de Início conforme a orientação existente. O assunto VAPID usa a URL pública por padrão; é possível definir `VAPID_SUBJECT=mailto:<contato-real>` nas duas APIs.

PDFs e impressão continuam no navegador/computador da loja. Não é necessário expor a impressora Bluetooth ou USB à internet.

## Depois, usar domínio próprio

Adicione e valide o domínio na configuração de `cardapio-web` e no DNS conforme a Render. Defina `PUBLIC_ORIGIN=https://pedidos.seudominio.com.br` em **ambas** as APIs (ou no grupo comum) e redeploye. Mantenha o YAML correspondente atualizado. A origem deve conter apenas esquema e host, sem caminho. Os cookies continuam seguros e os usuários fazem login no novo endereço.

Mudar o domínio muda a origem das inscrições de Web Push e dos links/QR Codes já compartilhados. Atualize os materiais e autorize push novamente no novo domínio. O acesso pelo domínio antigo pode ser desativado na Render depois da migração.

## Backups, atualizações e recuperação

Os discos sobrevivem a redeploys e reinícios, mas não substituem backup de banco. **Não restaure snapshots de disco como procedimento de recuperação do PostgreSQL**: a documentação Render alerta para risco de corrupção em bancos próprios. Mantenha dumps consistentes (`pg_dump` dos bancos e `pg_dumpall --globals-only` dos papéis), criptografados, fora desses discos, com retenção e restauração testada. Faça backup antes de migrations e upgrades. Os diretórios de sessão do WhatsApp também precisam de proteção e controle de acesso.

Os scripts PostgreSQL de inicialização executam apenas em disco novo. Alterar uma senha no painel não altera a senha já gravada no banco: rotacione primeiro os papéis de forma coordenada e depois atualize as referências/deploys. Não apague discos para resolver inconsistência de credenciais.

Em atualização de schema, espere o pré-deploy de `cardapio-migrations` passar antes de investigar uma API bloqueada. Revise migrations para compatibilidade com a versão anterior durante o rollout. Um rollback da imagem não reverte schema/dados automaticamente. Falhas de migration permanecem visíveis e impedem a nova versão de iniciar.

Logs da aplicação são JSON redigidos no terminal da Render; arquivos locais de log são desabilitados porque o filesystem das APIs é efêmero. Use retenção/exportação de logs da plataforma, sem habilitar logs de corpos, URLs privadas, credenciais, cookies ou mensagens. O evento de saúde da web indica apenas que o proxy está vivo; a saúde completa é `/api/v1/health/ready`.

## Verificar sem criar recursos na nuvem

```sh
npm ci --prefix .render --ignore-scripts --no-audit --no-fund
pnpm render:check
pnpm test:render:images
```

O primeiro check valida o Blueprint contra uma cópia versionada do schema oficial e verifica referências, persistência e separação de credenciais. O teste de imagens cria um **projeto Docker descartável**, sem ler `backend/.env`: banco vazio, migrations explícitas/idempotentes, duas APIs, cookies seguros, origens, permissões do banco, autenticação do provedor, cabeçalhos IPv4/IPv6, failover e persistência após recriar containers. Remove apenas os volumes do próprio projeto de teste.

Com a CLI oficial instalada e autenticada na conta/workspace de destino, faça também a validação sem criar recursos:

```sh
render blueprints validate render.yaml -o json
```

A validação semântica remota detecta conflitos com serviços já existentes e disponibilidade para a conta; o schema local e a simulação Docker não a substituem. Nenhuma verificação deste repositório faz deploy, altera a conta Render ou cria cobrança automaticamente.

## Por que não usar todos os planos Free

A Render não oferece Free para serviços privados ou discos persistentes. Web Services Free entram em suspensão após inatividade; o PostgreSQL Free expira e o Key Value Free não oferece persistência. Isso não atende à operação completa contínua nem às sessões do WhatsApp. É possível manter o **domínio gratuito** com os planos pagos declarados, sem comprar um domínio próprio.

## Referências consultadas

Documentação oficial consultada em 28/10/2026:

- [Blueprint YAML, schema e referências de variáveis](https://render.com/docs/blueprint-spec).
- [HTTPS, domínio gratuito e encaminhamento HTTP](https://render.com/docs/web-services).
- [Variáveis automáticas](https://render.com/docs/environment-variables) e [segredos](https://render.com/docs/configure-environment-variables).
- [Rede privada](https://render.com/docs/private-network) e [serviços privados](https://render.com/docs/private-services).
- [Pré-deploy e implantação](https://render.com/docs/deploys).
- [Discos, limitações e backups](https://render.com/docs/disks).
- [Limitações dos planos Free](https://render.com/docs/free).
- [Borda Cloudflare e IP do cliente na Render](https://render.com/articles/how-render-handles-ddos-attacks) e [semântica de CF-Connecting-IP](https://developers.cloudflare.com/fundamentals/reference/http-headers/#cf-connecting-ip).
- [CLI e validação semântica](https://render.com/docs/cli-reference#blueprints).
