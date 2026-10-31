# Validação das melhorias do cardápio

## Correções verificadas

- Configuração pública aceita campos adicionais de versões novas da API e continua rejeitando tipos inválidos. A tela de acesso publicada carregou sem `CORRUPT_DATA`.
- Todos os produtos aparecem por categoria. Links navegam para a seção, preservam os outros itens e refletem a categoria durante a rolagem, inclusive com link direto e após limpar a busca.
- Adicionais respeitam produtos vinculados. Seleção única, opções repetíveis, limites, obrigatoriedade, quantidade do produto e total foram exercitados no navegador com PostgreSQL.
- A edição de um produto atualiza seus vínculos e preserva os vínculos dos outros produtos.
- Abertura e fechamento ficam próximos e alinhados; faixas adicionais começam vazias para preenchimento explícito.
- Cabeçalho móvel preserva espaço para notificações e controle da loja. A ação de salvar entregas deixou de encobrir campos no celular.
- Com emails desligados, cadastro, sessão, perfil e inclusão de pessoas na equipe dispensam confirmação. O proprietário e as demais permissões continuam protegidos.

## Verificações executadas

- Frontend/domínio: 245 testes em 37 arquivos.
- Backend: 72 testes unitários e 62 testes de integração com banco isolado.
- Navegador com API real: 15 cenários, incluindo cadastro, confirmação com Mailpit, MFA, privacidade, impressão, pedidos, horários, perfil, categorias, compartilhamento e adicionais.
- Demonstração: 26 cenários; revisão adicional dos 10 cenários de UI após os ajustes do cabeçalho.
- Railway: 10 verificações do blueprint e preparação.
- Scripts: 11 testes aprovados; um cenário exclusivo de POSIX fica dispensado no Windows.
- Tipos, lint, arquitetura, UTF-8, build de produção, busca de segredos e `git diff --check`.
- Caddy em contêiner: metadados no HTML inicial, links com query e páginas genéricas.
- Revisão responsiva em 15 telas administrativas a 1440 e 320 px, aguardando os dados e verificando ausência de erros e rolagem horizontal. Inclui cardápio, pedidos, configurações, horários, impressão, segurança, compartilhamento, canais, adicionais, aparência, promoções, entregas, equipe e caixa. Outros cenários cobrem perfil e cardápio público.

## Publicação e operação

As duas APIs e o frontend receberam a versão validada e concluíram os healthchecks na Railway. A instalação Postal concluiu o healthcheck e o login administrativo foi conferido. O modo desativado do Postal também foi exercitado e depois revertido para manter o painel disponível.

`EMAIL_SEND_ENABLED=false` permanece nas APIs e no Postal. O envio real depende de domínio e infraestrutura SMTP apropriada; as limitações e os controles de ativação estão em [Postal na Railway](postal-railway.md). As credenciais iniciais ficam no arquivo local privado documentado ali.

Cloudflare permanece preparado no código. Domínio, DNS e chaves Turnstile são configurados pelo operador conforme [segurança e emails](cloudflare-and-email.md).
