# Postal opcional na Railway

O projeto PedeAqui possui `postal` (painel/API Postal 3.3.7) e `postal-db` (MariaDB 11.4 com volume exclusivo). São independentes do PostgreSQL, Redis, healthcheck, migrations e autenticação do app. O painel usa HTTPS no domínio gerado pela Railway; não é necessário comprar um domínio para acessar o painel.

O envio está desligado. Não foi configurado um domínio remetente nem feita uma promessa de entrega. O plano Hobby bloqueia saída SMTP; Pro ou superior libera a saída, mas não resolve a entrada: o proxy TCP atribui uma porta externa, e servidores de email precisam receber conexões na porta 25 para MX/retornos. Antes de ativar entrega, é necessário resolver domínio, SPF/DKIM/DMARC, retornos, PTR e reputação do IP, usando infraestrutura SMTP apropriada ou um gateway externo. Fontes: [saída SMTP](https://docs.railway.com/networking/outbound-networking), [proxy TCP](https://docs.railway.com/networking/tcp-proxy), [DNS do Postal](https://docs.postalserver.io/getting-started/dns-configuration/).

## Chave geral de emails

```dotenv
EMAIL_SEND_ENABLED=false
```

Na API e na réplica, o padrão é `false`. Nesse estado:

- Nenhum código é enviado, nem automaticamente no cadastro nem pelos endpoints de confirmação.
- O adaptador de envio fica desativado, mesmo com credenciais antigas do Postal presentes.
- Cadastro e login funcionam sem Postal e sem confirmação de email; contas com prazo vencido também continuam acessando normalmente.
- A interface não mostra lembretes de confirmação nem encaminha novos cadastros para essa etapa.
- Senha, sessão, CSRF, autorização por loja e verificação em duas etapas continuam sendo exigidas conforme as suas políticas.
- O banco preserva a informação real de confirmação; desativar emails não marca endereços como confirmados.

Configure o mesmo valor nas duas APIs. Cada processo lê a variável ao iniciar; aguarde os redeploys antes de considerar uma troca concluída. No Postal, mantenha a mesma variável em `false`: ela também impede iniciar o worker e desliga as mensagens administrativas do próprio Postal.

```powershell
pnpm railway variable set EMAIL_SEND_ENABLED=false --service cardapio-api
pnpm railway variable set EMAIL_SEND_ENABLED=false --service cardapio-api-replica
pnpm railway variable set EMAIL_SEND_ENABLED=false --service postal
```

Se habilitar emails, use `EMAIL_SEND_ENABLED=true`, `MAIL_PROVIDER=postal`, URL HTTPS válida, chave da API e remetente autorizado nas duas APIs. Configuração incompleta com envio ativado impede iniciar a API; evite essa situação configurando e verificando primeiro o provedor. A confirmação volta a respeitar os prazos persistidos. Mantenha emails desligados enquanto não houver domínio e entrega operante.

## Desativar somente o Postal

```powershell
pnpm railway variable set POSTAL_ENABLED=false --service postal
```

O contêiner passa a servir somente uma resposta de saúde; não inicia Rails, worker, SMTP nem conexão ao MariaDB. O app continua funcionando com `EMAIL_SEND_ENABLED=false`. O volume do MariaDB permanece preservado. Para economizar recursos, o operador também pode parar os serviços Postal no dashboard; não exclua o volume para uma pausa temporária.

`POSTAL_ENABLED=true` inicia painel e API. `POSTAL_DELIVERY_ENABLED=false` mantém o worker de entrega desligado. Entrega somente pode iniciar se **ambas** `EMAIL_SEND_ENABLED` e `POSTAL_DELIVERY_ENABLED` forem `true`, além de configurar um hostname SMTP próprio. Não há servidor SMTP público nesta implantação; isso exige uma topologia adicional para retornos de email.

## Provisionar e atualizar

O código está em `railway/postal/`; `.railway/postal.ts` representa os recursos opcionais do blueprint. `postalProvisioned` inclui os recursos no grafo, enquanto `emailSendEnabled` controla a política do app. Depois de provisionar, mantenha `postalProvisioned=true`: removê-los do grafo não é uma forma de pausar serviços. A pausa deve usar as variáveis ou o controle de execução do dashboard.

```powershell
node scripts/deploy-postal.mjs --project <id-do-projeto> --environment production --apply
pnpm railway up railway/postal --path-as-root --project <id-do-projeto> --environment production --service postal --detach
pnpm railway domain --service postal --port 5000
```

O script é aditivo e usa a CLI autenticada: cria somente os serviços que faltam e o volume exclusivo, sem aplicar ou substituir a configuração do restante do projeto. Ele grava credenciais aleatórias no arquivo privado `.railway/local/postal-<id-do-projeto>.json`, ignorado pelo Git. O login inicial está nos campos `adminEmail` e `adminPassword`; também existem variáveis correspondentes no serviço Postal. Não imprima nem versione esse arquivo. A inicialização cria o administrador somente se ele não existir; atualizações preservam senha, chave de assinatura e dados.

Faça backup do volume e das credenciais. O app não depende desse backup para autenticar quando emails estão desligados.
