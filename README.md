# SaaS Cardápio

Cardápio digital em React 19, TypeScript, Vite e Tailwind. Esta etapa funciona como demonstração local: produtos, categorias e configurações ficam no navegador. O checkout prepara uma mensagem para o WhatsApp; o quadro de pedidos contém exemplos independentes.

## Executar

Requisitos: Node.js 24 e pnpm 11.23.0, também definidos em `.mise.toml`. Execute os comandos nesta pasta, que contém `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Abra `http://localhost:8443`. `pnpm dev` seleciona explicitamente o modo `demo`, usando `.env.demo`. Para receber a mensagem preparada pelo checkout, configure um WhatsApp válido no painel em **Configurações** e salve.

| Comando               | Finalidade                                                                             |
| --------------------- | -------------------------------------------------------------------------------------- |
| `pnpm dev`            | Desenvolvimento demonstrativo, porta 8443                                              |
| `pnpm dev:restricted` | Sem demonstração; bloqueia o acesso por falta de configuração/autorização              |
| `pnpm build:demo`     | Build demonstrativo explicitamente habilitado                                          |
| `pnpm build`          | Build padrão com funcionalidades bloqueadas sem configuração demo                      |
| `pnpm preview`        | Servir o último build                                                                  |
| `pnpm typecheck`      | Validar tipos da aplicação, testes e configurações de testes                           |
| `pnpm lint`           | ESLint, limites arquiteturais e integridade dos textos UTF-8                           |
| `pnpm test`           | Testes de domínio, casos de uso, persistência e componentes                            |
| `pnpm test:e2e`       | Testes Chromium com servidores demo e restrito isolados                                |
| `pnpm check`          | Tipagem, lint, testes e build demo                                                     |
| `pnpm check:text`     | Detectar UTF-8 inválido, acentos corrompidos e substituição por `?` dentro de palavras |

Antes da primeira execução dos testes de navegador:

```sh
pnpm exec playwright install chromium
pnpm test:e2e
```

Web Locks exige HTTPS ou `localhost`. Sem essa capacidade, gravações e a inicialização do armazenamento novo são bloqueadas com uma mensagem de recuperação. Não existe fallback silencioso em memória.

## Funcionalidades

- Cardápio público com busca, categorias e destaques; `/`, `/menu` e `/menu/burger-house` representam a loja demonstrativa. Outros slugs retornam restaurante não encontrado.
- Produtos com preço em centavos, disponibilidade, destaque e imagem opcional. Categorias são criadas dentro do cadastro do produto, na mesma gravação.
- Configurações de nome, descrição, telefone, endereço, imagens, taxa, pedido mínimo e prazo de entrega.
- Carrinho vazio ao iniciar. Itens removidos e preços alterados exigem atualização explícita; itens esgotados e loja fechada impedem preparar o pedido.
- Preparação e revisão de uma mensagem antes de abrir o WhatsApp. Nenhum pedido ou pagamento é confirmado automaticamente.
- Pedidos demonstrativos com avanço de status, sem contato com clientes fictícios.

## Organização e persistência

Consulte [Arquitetura](docs/architecture.md) para responsabilidades, contratos e evolução para backend. Consulte [Diagnóstico e recuperação](docs/diagnostics.md) para erros, migração e problemas de armazenamento.

A persistência usa um documento por restaurante, com versão e revisão. As antigas chaves `saas_cardapio_*` são migradas uma vez quando não existe o documento novo e permanecem intactas. Dados vazios são preservados; dados inválidos não são substituídos pelos exemplos.

Não há banco, autenticação de produção, sincronização entre dispositivos, gateway de pagamento ou envio automático ao WhatsApp. Controles do cliente e dados do `localStorage` não constituem uma fronteira de segurança. Uma futura operação real exige autorização, validação, isolamento entre restaurantes e persistência transacional no servidor.

## Texto e ferramentas

Os arquivos usam UTF-8, definido em `.editorconfig`. Ao enviar texto acentuado de PowerShell para um programa via pipe, configure primeiro `$OutputEncoding = [System.Text.UTF8Encoding]::new($false)`; a configuração padrão de versões antigas do PowerShell pode substituir caracteres por `?` antes da gravação.

As verificações não requerem Supabase, credenciais ou serviços externos. Fontes e fotos demonstrativas podem ser carregadas de Google Fonts e Unsplash. Os testes de navegador bloqueiam essas requisições para serem determinísticos.
