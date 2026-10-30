# Segurança, Cloudflare e e-mail

O código está preparado para Cloudflare e para envio pelo Postal autohospedado. Ativar DNS/WAF, criar as chaves e operar um servidor de e-mail são passos externos: nenhuma alteração na conta Cloudflare nem envio a destinatários reais faz parte dos testes locais.

A implementação usa as orientações das skills locais `security-audit` (revisão dirigida ao código alterado), `implementing-ddos-mitigation-with-cloudflare`, `implementing-cloud-waf-rules` e `ux-ui-design-principles`. A revisão é voltada aos fluxos e controles descritos abaixo; não representa uma auditoria independente de toda a infraestrutura.

## Senhas e confirmação

- Cadastro e troca de senha usam a mesma política no navegador e na API: de 8 a 128 pontos Unicode, sem cortar, normalizar ou remover espaços. Aceitam força média ou maior; login continua aceitando senhas antigas.
- A indicação de força é uma estimativa local conservadora, não uma previsão de tempo de quebra. Rejeita senhas comuns, sequências curtas e repetições; incentiva diversidade ou frases longas. A confirmação é obrigatória na interface. O servidor valida a força mesmo em chamadas diretas.
- Contas novas recebem 7 dias corridos (`EMAIL_VERIFICATION_GRACE_SECONDS=604800`, de 1 hora a 30 dias). A migration concede 7 dias a contas existentes a partir da aplicação; alterar a variável não altera prazos já gravados.
- O cadastro tenta enviar automaticamente um código sem desfazer a conta se o provedor falhar. O titular também pode solicitar o envio na tela `/confirmar-email`.
- Código aleatório criptográfico de 6 números, válido por 10 minutos, vinculado ao usuário por HMAC-SHA256 com o segredo do servidor. O banco armazena somente esse hash. O código circula em claro apenas no transporte protegido e na mensagem de e-mail.
- Até 5 tentativas por código; até 10 confirmações a cada 15 minutos por conta; até 5 solicitações de envio por hora, contando o cadastro e os envios recusados. Há intervalo de 60 segundos entre códigos emitidos. Reenvio invalida o anterior. Tentativas e consumo são transacionais com bloqueio por usuário, compartilhados entre réplicas.
- Após o prazo, a API e os casos de uso administrativos recusam acesso com `EMAIL_VERIFICATION_REQUIRED`. O titular ainda consegue entrar, cumprir MFA, confirmar e-mail e sair. Confirmar restaura o acesso sem apagar dados. O cardápio e os pedidos públicos continuam disponíveis para os clientes.
- Uma associação nova à equipe exige e-mail já confirmado, mesmo durante o período inicial. Isso impede que alguém cadastre um e-mail de outra pessoa e receba os acessos destinados a ela. Atualize os vínculos existentes de acordo com a política de implantação.
- A confirmação cria um evento `EMAIL_VERIFIED` na mesma transação, com identificador do titular e data, sem código ou hash na auditoria.
- Não há recuperação de senha ou alteração de e-mail neste fluxo; o código comprova posse do endereço cadastrado. Senha esquecida e troca de endereço exigem um fluxo próprio com reautenticação, auditoria e revogação de sessões.

## Desenvolvimento: Mailpit

`pnpm setup:local` adiciona a configuração local sem sobrescrever valores existentes. `pnpm db:up` inicia PostgreSQL, Redis e Mailpit; para subir só o email, use `pnpm mail:up`. O Mailpit captura mensagens e permite lê-las em `http://127.0.0.1:8025`; não entrega mensagens na internet. A imagem tem versão e digest fixos, limites de memória/processos e porta publicada só em loopback. As mensagens são temporárias.

```dotenv
MAIL_PROVIDER=mailpit
MAIL_API_URL=http://127.0.0.1:8025
MAIL_FROM=conta@localhost.invalid
```

No Compose, a API utiliza `http://mailpit:8025`. O modo Mailpit é recusado em produção; o modo `disabled` é apropriado para testes que não exercitam envio. Em produção, o cadastro só é liberado quando `SIGNUP_ENABLED=true` e o Postal está configurado; enquanto isso o restante do app continua disponível.

## Produção: Postal autohospedado

O envio agora depende da chave global `EMAIL_SEND_ENABLED`, cujo padrão é `false`. Com emails desligados, nenhuma mensagem é enviada e a confirmação é dispensada, inclusive para contas com prazo vencido. Veja a operação e as limitações da instalação opcional na [Railway](postal-railway.md).

O [Postal](https://docs.postalserver.io/) é uma plataforma open-source de entrega de e-mail. O adaptador usa sua [API oficial](https://docs.postalserver.io/developer/api/) sem SDK ou assinatura de um serviço de envio. A hospedagem, o domínio e a operação ainda têm custo.

1. Instale o Postal numa máquina apropriada seguindo a [instalação oficial](https://docs.postalserver.io/getting-started/installation/). O projeto recomenda servidor dedicado, ao menos 2 CPUs, 4 GB de RAM e 25 GB de disco. Confirme a liberação de saída na porta 25 e configure PTR/reverse DNS no provedor.
2. Configure um subdomínio de envio, o domínio remetente, SPF, DKIM e DMARC conforme a [documentação de DNS](https://docs.postalserver.io/getting-started/dns-configuration/). Registros de email/MX não passam pelo proxy HTTP da Cloudflare. Use TLS válido no painel/API; não coloque desafios interativos na API do Postal.
3. Crie uma organização/servidor de envio e uma credencial de API no Postal. Restrinja destinatários em homologação e confira entrega, spam, bounces e reputação antes de liberar cadastros reais.
4. Configure somente no backend (nas duas réplicas da API; na Render, use o grupo de variáveis compartilhado; na Railway, preserve essas variáveis ao revisar futuros planos):

```dotenv
MAIL_PROVIDER=postal
MAIL_API_URL=https://postal.seudominio.com
MAIL_API_KEY=<credencial-do-servidor-postal>
MAIL_FROM=conta@seudominio.com
EMAIL_VERIFICATION_GRACE_SECONDS=604800
# Se a API roda pelo Compose:
DOCKER_MAIL_API_URL=https://postal.seudominio.com
```

O backend não segue redirecionamentos ao enviar credenciais, limita concorrência e tempo de resposta e só anuncia envio após o Postal confirmar a aceitação. Aceitação pelo servidor não comprova chegada à caixa de entrada. Monitore filas/bounces. Códigos são dados sensíveis também nos backups e na retenção do Postal.

## Cloudflare Turnstile

1. Crie um widget no painel Turnstile com os hostnames exatos do frontend. Ative inicialmente em homologação. A documentação oficial descreve a [renderização explícita](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/) usada na SPA.
2. Configure no backend:

```dotenv
TURNSTILE_SITE_KEY=<chave-publica>
TURNSTILE_SECRET_KEY=<segredo-apenas-no-servidor>
TURNSTILE_HOSTNAMES=app.seudominio.com
```

As três configurações precisam corresponder. `/configuration` expõe somente a chave pública; nenhuma recompilação é necessária para habilitar o widget. O cliente envia `turnstileToken` em cadastro/login. O servidor chama o [Siteverify](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/) e exige `success`, hostname permitido e action igual a `register` ou `login` antes de criar conta/sessão. Cloudflare controla a expiração de 5 minutos e o uso único; falhas fecham a operação. Limites por IP/conta continuam ativos.

As CSPs dos proxies Docker, Railway e Render autorizam scripts e frames apenas de `https://challenges.cloudflare.com`, além das permissões já existentes. Não habilitam `unsafe-eval` nem scripts inline. `connect-src` continua restrito à própria aplicação; chamadas de validação ocorrem no backend. Se outro servidor entrega o HTML, aplique as mesmas [diretivas CSP oficiais](https://developers.cloudflare.com/turnstile/reference/content-security-policy/).

## Borda, origem e regras

1. Delegue o domínio à Cloudflare e habilite o proxy nos registros HTTP. Configure TLS Full (strict), redirecionamento HTTPS na borda e, após conferir o domínio inteiro, HSTS. Preserve CORS com origens HTTPS exatas e cookies seguros.
2. Mantenha a proteção DDoS e habilite as regras gerenciadas disponíveis no seu plano. Revise falsos positivos em homologação antes de aumentar a agressividade. Não dependa de Bot Score ou outros campos Enterprise para a proteção inicial.
3. Revise `cloudflare/custom-rules.json` e incorpore as regras ao ruleset existente. Esse arquivo é uma proposta, não um comando para substituir regras da zona. Não bloqueie países ou provedores indiscriminadamente.
4. Para uma regra de limitação de taxa disponível no plano, priorize POST para `/api/v1/auth/login`, `/api/v1/auth/register` e `/api/v1/auth/register-account`. Ajuste aos limites do plano e às métricas reais; os limites Redis da aplicação são permanentes. Retorne bloqueio/429 nas APIs; desafios HTML em XHR quebram os formulários. Use Turnstile nos formulários.
5. Faça bypass de cache em `/api/*`, `/admin*`, `/login`, `/mfa` e `/confirmar-email`. Preserve `Cache-Control: no-store`, cookies, `X-CSRF-Token`, `X-Order-Token`, idempotência e conexões SSE. Não use Cache Everything nesses caminhos. Cacheie apenas assets versionados e públicos.
6. Feche o acesso direto à origem usando Cloudflare Tunnel, firewall restrito à Cloudflare com Authenticated Origin Pulls ou uma integração equivalente do provedor. Publicar o hostname atrás de Cloudflare sem fechar os caminhos alternativos permite contornar o WAF.
7. Como proteção adicional, defina `CLOUDFLARE_ORIGIN_SECRET` como 64 caracteres hexadecimais aleatórios no backend. Na borda, use uma regra de transformação para **sobrescrever** `X-Cardapio-Origin-Secret` com esse valor em `/api/*`. Nunca coloque esse segredo no frontend, no repositório, nas respostas ou nos logs. Solicitações fora da borda serão recusadas pela API; apenas probes de saúde ficam dispensados. Teste a regra e a rota real antes de ligar a exigência.
8. Configure `TRUSTED_PROXY_CIDRS` para os proxies imediatos e conhecidos da API, ou `TRUSTED_PROXY_HOPS` apenas quando a API só puder ser alcançada por essa cadeia fixa. Nunca use confiança global nem aceite `CF-Connecting-IP` diretamente de qualquer cliente. Se o frontend usa Caddy atrás da Cloudflare, configure a lista atual de [IPs oficiais](https://www.cloudflare.com/ips/) como proxies confiáveis do Caddy para preservar o IP real com segurança; até essa etapa o rate limit pode agrupar visitantes pelo proxy. Remova/normalize headers encaminhados no primeiro proxy de confiança.

Turnstile, WAF e DDoS são camadas complementares. As regras na conta Cloudflare e a entrega externa do Postal precisam ser verificadas após a implantação; os testes locais não comprovam essas configurações.

## Validação e operação

Use `pnpm check:all`, `pnpm api:test:db`, `pnpm test:e2e` e `pnpm test:e2e:api`. Integração usa somente bancos `_test` e fixtures sintéticas; o teste de Postal usa um servidor HTTP loopback e o teste de navegador de email usa Mailpit local. Nenhuma prova depende de enviar email externo ou chamar a Cloudflare real. Execute `pnpm api:maintenance` regularmente para limpar sessões e códigos expirados. Aplique migrations com as credenciais de migração antes de iniciar a versão nova; o runtime não aplica migrations automaticamente.
