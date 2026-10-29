# Template reutilizável

O blueprint importável é [`.railway/railway.ts`](../../.railway/railway.ts), aplicado com o CLI oficial. Ele cria o stack inteiro com senhas novas via `railway:prepare`. O [guia](../../docs/railway.md) inclui o primeiro deploy com domínio gratuito.

Para criar um template do composer/marketplace, a Railway atualmente usa um projeto existente ou o editor da conta; não há um formato JSON de template arbitrário documentado para arrastar ao canvas. `variables.json` neste diretório é uma lista de substituições para o editor, **não um arquivo de importação de serviços**.

Depois de aplicar e validar o projeto:

```sh
pnpm railway templates create --project saas-cardapio --environment production --json
```

O comando gera um rascunho não publicado. No composer:

1. Confira os oito serviços, quatro volumes, Dockerfiles com contexto na raiz e comandos do blueprint.
2. Habilite domínio HTTP público somente em `web`, porta 8080. Não copie o domínio gerado da instalação de origem.
3. Substitua as variáveis indicadas em `variables.json`, por serviço. Os geradores são avaliados a cada instalação do template. Preserve as demais referências entre serviços.
4. Marque `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY` como opcionais. Deixe ambas vazias no template: um par de chaves EC não pode ser gerado por duas chamadas independentes de `secret()`. Na instalação IaC, `prepare` já gera o par válido; em instalações pelo catálogo, configure um novo par após importar. Push fica desativado até isso; pedidos e avisos na tela continuam disponíveis.
5. Remova qualquer credencial, domínio customizado, ID, CA privada ou outro valor específico da instalação de origem. Revise o rascunho antes de compartilhar.

O número do WhatsApp exige pareamento na própria instalação. Sessões de outra loja não devem ser copiadas para o template. O volume de instâncias começa novo.

A URL de implantação só existe depois que a Railway criar o template na conta. Nenhum link fictício ou identificador de template é incluído no repositório. Publicar no marketplace é opcional e separado do deploy.
