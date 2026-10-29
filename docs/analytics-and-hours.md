# Descoberta do cardápio, desempenho e horários

## Filtros para o cliente

O cardápio público oferece três filtros rápidos, combinados com busca e categoria:

- **Mais vendidos:** até 20 produtos disponíveis, ordenados pelas unidades de pedidos concluídos criados nos últimos 30 dias. Cancelados, pedidos em andamento e linhas de combo não entram nesse ranking. A API pública retorna somente IDs ordenados, sem compradores, contatos ou quantidades. O cache dura até 60 segundos.
- **Promoções:** apresenta os cupons ativos e os combos da loja. Quando há um cupom ativo, os produtos disponíveis aparecem com os preços normais; o benefício depende das condições e é calculado no carrinho. Não anuncia um desconto unitário que ainda não foi aplicado. Cupons vencidos ou com limite de uso atingido ficam de fora.
- **Menores preços:** ordena os produtos pelo preço base em centavos, do menor para o maior. Adicionais opcionais continuam sendo escolhidos no produto.

A marcação manual `popular` permanece compatível, agora identificada como **Destaque da loja**, inclusive no formulário e nos cartões. Ela não representa vendas calculadas. Na demonstração não existe histórico real para o ranking automático; sua ausência é informada sem inventar vendas.

## Dashboard

Abra **Dashboard** na administração. Os dados reais são restritos ao proprietário e aos gerentes com a permissão `reports:read`, sempre dentro da loja autorizada. As comparações incluem **dia, semana, mês e ano**, com uma data de referência e o fuso configurado nos horários da loja, ou `America/Sao_Paulo` quando não configurado. A semana começa na segunda-feira.

Em períodos ainda em andamento, a comparação usa o mesmo tempo decorrido do período anterior, limitado ao fim daquele período. Períodos passados completos são comparados com o anterior completo. Partes futuras do gráfico não são apresentadas como vendas zeradas.

| Indicador                         | Definição                                                                                                                        |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Vendas concluídas                 | Soma de `Order.total` dos pedidos atualmente concluídos, pela data de criação, após descontos e incluindo entrega                |
| Ticket médio                      | Vendas concluídas divididas pelos pedidos concluídos                                                                             |
| Recebidos e cancelamentos         | Todos os pedidos criados no período; taxa = cancelados / recebidos                                                               |
| Clientes compradores              | Telefones normalizados distintos em pedidos concluídos                                                                           |
| Novos e anteriores                | Primeira compra concluída no histórico da loja dentro do período, ou existência de compra concluída anterior                     |
| Recompra                          | Clientes com pelo menos dois pedidos concluídos no período / clientes compradores                                                |
| Produtos e combos                 | Unidades por ID e tipo do item histórico; valor bruto inclui adicionais, antes de descontos e frete                              |
| Entregadores                      | Entregas concluídas atribuídas a cada entregador; retiradas são excluídas                                                        |
| Preparo                           | Tempo da criação até a primeira etapa de pronto, saída ou conclusão registrada; somente pedidos concluídos e etapas cronológicas |
| Entrega                           | Tempo entre saída para entrega e conclusão, quando ambas as etapas estão registradas                                             |
| Demanda                           | Pedidos não cancelados por hora e dia da semana no fuso da loja                                                                  |
| Modalidade, pagamento e promoções | Entregas/retiradas, forma de pagamento escolhida no pedido, descontos e promoções em pedidos concluídos                          |

Os rankings de clientes mostram nome e telefone parcialmente oculto. O agrupamento usa o telefone internamente; o identificador retornado é um fingerprint com segredo do servidor e escopo da loja. Endereços, telefones completos, notas e mensagens não entram no relatório nem em logs. Entregadores sem vínculo atual com o tenant são agrupados sem expor usuários de outra organização.

O gráfico permite alternar entre valor e quantidade, selecionar barras com mouse/teclado e consultar uma tabela. Os dados podem ser baixados em JSON. O painel atualiza a cada minuto enquanto visível e possui atualização manual.

As somas e agrupamentos são feitos no PostgreSQL em uma leitura consistente, sem baixar todos os pedidos no navegador ou estabelecer limite silencioso de 5.000 registros no ano. Valores agregados são validados como inteiros seguros. Os indicadores representam **vendas**, não recebimentos nem lucro; custos, avaliações e visitas/conversão não são inventados, pois não há essas fontes neste sistema. O caixa existente continua responsável pelos recebimentos e estornos.

### Referências do iFood

A seleção foi orientada pelos materiais oficiais sobre [indicadores da Tela de Desempenho](https://blog-parceiros.ifood.com.br/como-vender-mais-no-ifood/), [perfil e hábitos de compradores no Portal do Parceiro](https://blog-parceiros.ifood.com.br/portal-do-parceiro/) e [ranking automático dos últimos 30 dias](https://blog-parceiros.ifood.com.br/destaque-cardapio/). A implementação usa exclusivamente os pedidos do Pede Aqui; não existe integração de dados com a conta iFood nem comparação com concorrentes.

## Horários da loja

Abra **Horários da loja** e:

1. Escolha o fuso e configure as faixas da semana. Cada dia aceita até quatro faixas. Dias sem faixa ficam fechados. É possível copiar a segunda-feira para os dias úteis ou para a semana inteira.
2. Para atender na madrugada seguinte, informe, por exemplo, `18:00` até `02:00`. A abertura é inclusiva e o fechamento é exclusivo. O botão **24 horas** representa `00:00` até `24:00`.
3. No calendário mensal, escolha a data para cadastrar um fechamento ou horários especiais. O nome da exceção, a opção de repetir anualmente e as faixas podem ser editados em um diálogo. Uma data específica prevalece sobre uma regra anual; ambas prevalecem sobre a semana.
4. Ative a automação e clique em **Salvar programação**. As alterações passam a valer somente após a confirmação da gravação. O rascunho suporta campos ainda incompletos e permanece no navegador por até 24 horas.

Feriados e exceções são cadastrados pelo responsável, conforme a cidade e a operação. Não há importação automática de um calendário nacional que possa desconsiderar feriados locais. A exceção vale para a data inteira: um feriado fechado corta à meia-noite uma faixa iniciada na véspera.

O interruptor do cabeçalho continua disponível. Com automação ativa, ele cria uma alteração manual que vence na próxima mudança da programação, por no máximo **12 horas**. O prazo aparece no painel. **Voltar à programação** remove essa alteração; fica indisponível enquanto há rascunho pendente para evitar descartar edições. Salvar a programação também remove a alteração manual vigente.

### Funcionamento real no servidor

A programação é persistida em `Restaurant.hours` (JSONB nullable), com a revisão do catálogo existente. Lojas antigas continuam no modo manual. Mutações exigem sessão, autorização `catalog:write`, CSRF e a revisão correta; entradas inválidas ou conflitantes não são gravadas.

A abertura efetiva é calculada a partir do horário atual, do fuso e das regras persistidas. O cardápio e a administração atualizam o estado a cada segundo quando há programação ativa. O servidor reavalia os horários ao cotar e validar o pedido, inclusive se a página estiver antiga ou se nenhum navegador estiver aberto. Não depende de cron, de um navegador ligado nem de outro serviço Railway.

O campo legado `Restaurant.isOpen` continua representando o controle manual. Quando a automação está ativa, consultar somente esse campo no SQL não representa a abertura efetiva. A API projeta o estado conforme as regras; salvar produtos não grava por cima da programação. As transações e revisões evitam sobrescrever alterações concorrentes.

## Contratos e implantação

- `GET /api/v1/public/restaurants/:slug/best-sellers`: público e limitado por IP, sem dados pessoais.
- `GET /api/v1/restaurants/:id/analytics?period=DAY|WEEK|MONTH|YEAR&date=YYYY-MM-DD`: privado, com permissão de relatório.
- `PUT /api/v1/restaurants/:id/hours`: `{ expectedRevision, schedule }`, sem permitir injetar um override pelo formulário.

Antes de iniciar a API atualizada, aplique explicitamente a migration `20261029180000_store_hours` pelo fluxo normal de migrations. Na Railway, publique o serviço de migrations e depois as duas APIs e o web com o mesmo código. Nenhum serviço ou volume adicional é necessário. O documento de privacidade passou à versão `2026-10-29.2` para informar o uso dos pedidos nos indicadores e nos rankings restritos à gestão.

## Verificações

```sh
pnpm check:all
pnpm api:test:db
pnpm test:e2e
pnpm test:e2e:api
```

As regras de horários, calendário e descoberta têm testes unitários. `backend/test/integration/analytics-hours.test.ts` valida agregações em centavos, clientes, tempos, isolamento, permissões, CSRF, revisão, horários e rejeição de pedidos em feriados. `tests/api-e2e/analytics-hours.spec.ts` percorre os filtros, comparações, entregas, rascunhos e programação em navegador real, inclusive em 320 px. Os testes de integração usam exclusivamente o banco `_test` e limpam somente os registros gerados por sua execução.
