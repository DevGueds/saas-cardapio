# Diagnóstico e recuperação

## Erros previsíveis

Toda operação retorna `Result<T>`. Em caso de falha, a interface mostra uma mensagem em português e uma referência de diagnóstico. O console recebe um objeto estruturado com horário UTC, módulo, operação, código, referência, causa técnica controlada e nomes permitidos de campos inválidos.

Não são registrados conteúdo do armazenamento, imagens, nomes de clientes, telefones, endereços, mensagens de pedido, mensagens arbitrárias de exceções ou pilhas. Falhas do destino de logs não transformam uma operação negada em sucesso.

| Código                   | Significado e recuperação                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `VALIDATION`             | Corrigir o campo ou estado indicado. Não há gravação parcial.                                                            |
| `NOT_FOUND`              | Restaurante ou produto deixou de existir; conferir a URL ou atualizar o catálogo.                                        |
| `ACCESS_DENIED`          | Operação administrativa não autorizada; a demonstração precisa ser habilitada explicitamente.                            |
| `CONFIGURATION`          | O modo da aplicação não está configurado como demo. Usar o comando apropriado; não há fallback.                          |
| `CONFLICT`               | Outra operação gravou antes. Atualizar os dados, conferir os campos preservados e salvar novamente conscientemente.      |
| `STORAGE_UNAVAILABLE`    | O navegador recusou leitura ou escrita. Verificar permissões e tentar novamente.                                         |
| `STORAGE_QUOTA`          | O armazenamento está cheio. Usar imagens menores ou remover imagens desnecessárias antes de repetir a operação.          |
| `CORRUPT_DATA`           | JSON, versão, entidades ou referências inválidas. Preservar o conteúdo original e corrigir a origem antes de recarregar. |
| `CAPABILITY_UNAVAILABLE` | Web Locks indisponível; usar navegador atualizado em HTTPS ou localhost.                                                 |
| `UNEXPECTED`             | Falha não prevista. Usar a referência, o módulo e a operação para reproduzir com dados de teste.                         |

## Investigar sem perder dados

1. Anotar referência e operação exibidas. Filtrar o console por `[cardapio]` e pelo identificador.
2. Se o problema é persistência, inspecionar a chave do restaurante nas ferramentas do navegador. Não limpar `localStorage` como primeira tentativa: isso descarta os dados desse navegador.
3. Antes de corrigir conteúdo manualmente, guardar uma cópia local. Não compartilhar payloads contendo imagens ou dados pessoais em logs e tickets.
4. Em dados legados, verificar as três chaves `saas_cardapio_store`, `saas_cardapio_categories` e `saas_cardapio_products`. A migração mantém seus valores originais.
5. Corrigir a causa e usar **Atualizar dados e tentar novamente**. Em conflito, a atualização da revisão mantém os campos digitados: conferir esses campos antes de reenviar.

Se a chave nova já existe, os dados antigos nunca a substituem. Se o documento é removido durante uma sessão já carregada, a aplicação bloqueia a operação em vez de recriar exemplos naquela sessão. Apagar todo o armazenamento e recarregar equivale a iniciar uma nova demonstração e perde as alterações locais.

## Verificações de desenvolvimento

Execute `pnpm check` e `pnpm test:e2e`. Os testes exercitam leitura inválida, quota, migração, revisão concorrente, autorização negada, valores monetários, carrinho, formulários e o link WhatsApp. Os testes de navegador usam as portas 4173 e 4174.

`scripts/check-text.mjs` valida a codificação UTF-8 e procura corrupção em textos de interface, evitando confundir URLs e operadores TypeScript com texto. Essa verificação roda no lint e antes dos builds. `.editorconfig` orienta os editores a preservar UTF-8 e quebras LF.

A política de acesso demonstrativo não protege um serviço remoto: não há esse serviço nesta etapa. A futura API precisa repetir todas as verificações de autorização, isolamento e integridade no servidor.
