# Importação do cardápio do cliente

SQL pronto para PostgreSQL: [`scripts/sql/importar-cardapio-cliente.sql`](../scripts/sql/importar-cardapio-cliente.sql).

São **3 categorias e 41 produtos**: 12 pizzas grandes de 8 fatias, 25 hambúrgueres e 4 bebidas. Os preços foram mantidos exatamente como no `cardapio.txt`. As linhas repetidas com nomes de bebidas foram tratadas como repetição do texto, sem criar produtos extras.

## Executar na Railway

1. Conecte-se ao banco da aplicação no serviço **cardapio-postgres**, e não ao banco do Evolution. O banco da configuração deste repositório se chama `cardapio`.
2. Identifique a loja pelo slug, que é a parte do link depois de `/menu/`. Se precisar consultá-lo, execute:

   ```sql
   SELECT r.id, r.name, r.slug
   FROM public."Restaurant" AS r
   JOIN public."Tenant" AS t ON t.id = r."tenantId"
   WHERE t.active
   ORDER BY r.name, r.slug;
   ```

3. Abra o arquivo SQL e substitua **somente** `PREENCHA_O_SLUG_DA_LOJA` pelo slug exato da loja na declaração `v_slug`. Não informe o link inteiro.
4. Cole e execute todo o bloco `DO` no console SQL com acesso de escrita ao banco. A execução é atômica; qualquer erro desfaz todas as alterações do bloco. O console recebe avisos com as quantidades criadas e atualizadas.
5. Atualize a página da administração antes de continuar a editar. O cache do cardápio público pode levar aproximadamente 5 segundos para expirar nesta versão.

## Comportamento

- O SQL obtém `restaurantId` e `tenantId` da própria loja; não seleciona automaticamente a primeira loja nem importa em todas.
- Reexecuções reaproveitam categorias e produtos equivalentes da mesma loja/categoria, comparando nomes sem diferença de acentos, caixa, espaços e pontuação. Também reconhecem os nomes originais corrigidos, como `Mussarela`, `Egg-burgue` e `Eggs-Double-salcisha`.
- Cadastros equivalentes recebem o nome, a descrição e o preço deste arquivo. Seus IDs, imagens e estados de disponibilidade/destaque são preservados. Produtos novos começam disponíveis, sem destaque e sem imagem.
- Outros produtos, pedidos, adicionais, combos, cupons e configurações da loja são preservados. A loja não é aberta automaticamente.
- A revisão do catálogo aumenta uma vez se houver alterações. Uma reexecução sem diferenças mantém a revisão.
- Duas execuções deste script na mesma loja são serializadas pelo bloqueio da linha do restaurante. Se já houver vários cadastros equivalentes, o bloco interrompe e desfaz a importação para permitir revisão, sem escolher ou excluir um deles automaticamente. Nomes totalmente diferentes não são inferidos como o mesmo produto; produtos de categorias distintas podem representar tamanhos/opções diferentes.
- Não cria tabelas, índices ou extensões. Usa os nomes e as restrições do schema Prisma deste repositório.

## Padronização

Nomes em caixa de título, descrições com ingredientes em minúsculas, espaços após vírgulas e ponto final. Correções de acentos e grafia incluem “Muçarela”, “Três Queijos”, “Hambúrguer”, “Egg-Burger” e “Salsicha”. Foram mantidos os ingredientes, as quantidades e a distinção entre batata e batata palha. A marca Catupiry foi preservada; volumes passaram a usar espaço entre número e unidade, como `350 ml`, `600 ml` e `1 L`.

O bloco utiliza [`DO` do PostgreSQL](https://www.postgresql.org/docs/18/sql-do.html), [normalização de texto](https://www.postgresql.org/docs/18/functions-string.html) e [bloqueio de linha](https://www.postgresql.org/docs/18/explicit-locking.html). Abaixo está o conteúdo padronizado para conferência antes da execução.

## Validação local

```sh
node --env-file=backend/.env --test backend/scripts/test-menu-import.mjs
```

Os seis testes executam somente em `TEST_DATABASE_URL` local com sufixo `_test`: validação da loja, importação e reexecução, preservação de cadastros antigos, rollback por produtos ambíguos, rejeição de categorias ambíguas e duas importações concorrentes. As lojas temporárias são removidas ao final. Nenhum SQL foi executado na Railway para esta entrega.

## Pizzas Grandes (8 Fatias)

| Produto                | Descrição                                                                                       | Preço    |
| ---------------------- | ----------------------------------------------------------------------------------------------- | -------- |
| Muçarela               | Molho, muçarela, tomate, azeitona e orégano.                                                    | R$ 40,00 |
| Presunto               | Molho, muçarela, presunto, milho, pimentão, tomate, azeitona e orégano.                         | R$ 40,00 |
| Calabresa              | Molho, muçarela, calabresa, cebola, milho, pimentão, tomate, azeitona e orégano.                | R$ 40,00 |
| Frango                 | Molho, muçarela, frango, milho, pimentão, tomate, azeitona e orégano.                           | R$ 40,00 |
| Três Queijos           | Molho, muçarela, Catupiry, cheddar, azeitona e orégano.                                         | R$ 40,00 |
| Bacon                  | Molho, muçarela, bacon, cebola, milho, pimentão, tomate, azeitona e orégano.                    | R$ 40,00 |
| Calabresa com Catupiry | Molho, muçarela, calabresa, Catupiry, milho, azeitona e orégano.                                | R$ 48,00 |
| Frango com Catupiry    | Molho, muçarela, frango, Catupiry, milho, azeitona e orégano.                                   | R$ 48,00 |
| Frango Crocante        | Molho, muçarela, frango, batata palha, milho, pimentão, tomate, azeitona e orégano.             | R$ 45,00 |
| Calabacon              | Molho, muçarela, calabresa, bacon, cebola, milho, pimentão, tomate, azeitona e orégano.         | R$ 48,00 |
| Frambacon              | Molho, muçarela, frango, bacon, milho, pimentão, tomate, azeitona e orégano.                    | R$ 48,00 |
| Da Casa                | Molho, muçarela, frango, calabresa, bacon, cebola, milho, pimentão, tomate, azeitona e orégano. | R$ 60,00 |

## Hambúrgueres Tradicionais

| Produto               | Descrição                                                                                                                    | Preço    |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------- |
| Hambúrguer            | Pão de hambúrguer, carne, salada e batata.                                                                                   | R$ 15,60 |
| X-Burger              | Pão de hambúrguer, carne, queijo, salada e batata.                                                                           | R$ 18,20 |
| X-Calabresa           | Pão de hambúrguer, carne, calabresa, queijo, salada e batata.                                                                | R$ 20,80 |
| X-Salada              | Pão de hambúrguer, carne, queijo, presunto, salada e batata.                                                                 | R$ 20,80 |
| X-Bacon               | Pão de hambúrguer, carne, bacon, queijo, salada e batata.                                                                    | R$ 21,00 |
| X-Frango              | Pão de hambúrguer, frango, queijo, salada e batata.                                                                          | R$ 20,80 |
| X-Double              | 3 fatias de pão, 2 carnes, 2 queijos, salada e batata.                                                                       | R$ 25,00 |
| X-Double-Calabacon    | 3 fatias de pão, 2 carnes, 2 queijos, bacon, calabresa, salada e batata.                                                     | R$ 33,80 |
| X-Double-Bacon        | 3 fatias de pão, 2 carnes, 2 queijos, 2 porções de bacon, salada e batata.                                                   | R$ 33,80 |
| X-Double-Salsicha     | 3 fatias de pão, 2 carnes, 2 queijos, 2 salsichas, salada e batata.                                                          | R$ 31,20 |
| X-Double-Calabresa    | 3 fatias de pão, 2 carnes, 2 queijos, 2 porções de calabresa, salada e batata.                                               | R$ 31,20 |
| X-Calabacon           | Pão de hambúrguer, carne, queijo, calabresa, bacon, salada e batata palha.                                                   | R$ 32,00 |
| Egg-Burger            | Pão de hambúrguer, carne, queijo, ovo, salada e batata.                                                                      | R$ 20,80 |
| Eggs-Salada           | Pão de hambúrguer, carne, queijo, presunto, ovo, salada e batata palha.                                                      | R$ 23,40 |
| Eggs-Calabresa        | Pão de hambúrguer, carne, queijo, calabresa, ovo, salada e batata palha.                                                     | R$ 23,40 |
| Eggs-Bacon            | Pão de hambúrguer, carne, queijo, bacon, ovo, salada e batata palha.                                                         | R$ 23,40 |
| Eggs-Frango           | Pão de hambúrguer, frango, queijo, ovo, salada e batata palha.                                                               | R$ 23,40 |
| Eggs-Calabacon        | Pão de hambúrguer, carne, queijo, ovo, calabresa, bacon, salada e batata palha.                                              | R$ 25,00 |
| Eggs-Double           | 3 fatias de pão de hambúrguer, 2 carnes, 2 queijos, 2 ovos, salada e batata palha.                                           | R$ 31,20 |
| Eggs-Double-Bacon     | 3 fatias de pão de hambúrguer, 2 carnes, 2 porções de bacon, 2 queijos, 2 ovos, salada e batata palha.                       | R$ 35,00 |
| Eggs-Double-Calabresa | 3 fatias de pão de hambúrguer, 2 carnes, 2 queijos, 2 porções de calabresa, 2 ovos, salada e batata palha.                   | R$ 35,00 |
| Eggs-Double-Salsicha  | 3 fatias de pão de hambúrguer, 2 carnes, 2 queijos, 2 salsichas, 2 ovos, salada e batata palha.                              | R$ 35,00 |
| Eggs-Double-Calabacon | 3 fatias de pão de hambúrguer, 2 carnes, 1 porção de calabresa, 1 porção de bacon, 2 queijos, 2 ovos, salada e batata palha. | R$ 35,00 |
| Americano             | 3 fatias de pão de hambúrguer, carne, queijo, presunto, ovo, salada e batata palha.                                          | R$ 23,40 |
| Bauru                 | 3 fatias de pão de hambúrguer, carne, queijo, presunto, bacon, ovo, salada e batata palha.                                   | R$ 25,00 |

## Bebidas

| Produto                   | Descrição                         | Preço    |
| ------------------------- | --------------------------------- | -------- |
| Tuchaua Champ 350 ml      | Lata de 350 ml.                   | R$ 7,00  |
| Coca-Cola Original 600 ml | Garrafa de 600 ml.                | R$ 10,00 |
| Coca-Cola Original 1 L    | Garrafa de 1 L.                   | R$ 12,00 |
| Coca-Cola 350 ml          | Porção de 350 ml. Serve 1 pessoa. | R$ 7,00  |
