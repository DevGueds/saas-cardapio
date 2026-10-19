# Caixa, relatórios e diagnóstico

## Uso

Na loja conectada, abra um pedido e escolha **Registrar pagamento**. O valor inicial é o saldo em aberto; pode ser reduzido para registrar um pagamento parcial. Escolha a forma efetivamente recebida e confirme. O pedido fica pago quando a soma dos recebimentos não revertidos alcança o total. O andamento da cozinha continua independente do pagamento.

Em **Caixa e relatórios → Recebimentos**, registre valores avulsos com uma descrição curta. Use essa opção para entradas sem pedido no sistema; ela não liquida um pedido. A lista inclui registros recebidos ou revertidos no período. Paginação de 100 registros, sem descartar os anteriores.

Gerente/proprietário pode **Reverter**, informar o motivo e confirmar. O registro original, valor, data e operador permanecem; a reversão adiciona data, responsável e motivo. Repetir a mesma reversão não desconta novamente. A operação não devolve dinheiro automaticamente: a equipe deve realizar a devolução pelo meio combinado, quando necessária.

## Permissões

| Perfil                                          | Ver recebimentos/saldo | Registrar | Reverter | Relatórios/PDF reais |
| ----------------------------------------------- | ---------------------- | --------- | -------- | -------------------- |
| Proprietário / gerente                          | Sim                    | Sim       | Sim      | Sim                  |
| Caixa                                           | Sim                    | Sim       | Não      | Não                  |
| Atendente legado, cozinha, entregador, consulta | Não                    | Não       | Não      | Não                  |

Validação também ocorre nos casos de uso do backend, independentemente de botões ou URL. O legado `STAFF` conserva permissões anteriores de pedidos; não recebe acesso financeiro implicitamente. O proprietário pode atribuir `CASHIER` quando apropriado. Relatórios não incluem nomes, contatos, endereços ou observações dos clientes.

## Semântica dos relatórios

- Período com início inclusivo e fim exclusivo na API; a interface converte dias inclusivos para Brasília (UTC−03).
- Até 31 dias e 5.000 pedidos / 5.000 registros de pagamento por relatório. Acima do limite, a consulta falha com orientação para dividir o período; não produz um total incompleto. A prévia em tela mostra até 100 pedidos; o PDF contém todos os registros retornados, com paginação.
- **Vendas**: totais de pedidos criados no período, excluindo cancelados e incluindo frete; não significa recebimento.
- **Recebimentos**: pagamentos registrados no período, inclusive avulsos e pedidos anteriores.
- **Reversões**: pagamentos revertidos no período, ainda que recebidos em outra data. Um pagamento pode aparecer em períodos distintos por seus dois eventos, mas cada soma considera apenas o evento dentro do intervalo.
- **Líquido recebido**: recebimentos menos reversões; pode ser negativo.
- **Saldo em aberto**: saldo atual dos pedidos não cancelados criados no período, calculado com todos os pagamentos desses pedidos. É uma posição na data da consulta, não uma reconstrução histórica no fim do dia selecionado.
- Relatório gerencial não é documento fiscal. Ainda não há fechamento de turno, sangrias/despesas, DRE, ranking de produtos ou conciliação bancária. Essas extensões não devem ser inferidas do saldo de recebimentos.

## Integridade e integração futura

Valores individuais usam `Int` MySQL em centavos; strings de entrada são validadas e convertidas sem arredondamento de valores inválidos. Totais de relatório aceitam inteiros seguros maiores que um único `Int`. Transações serializáveis, bloqueio do restaurante/pedido e revisão do saldo evitam sobrepagamento entre operadores. A chave de tentativa é única por tenant/loja; o hash do payload impede reutilização com valores diferentes.

O formulário persiste sua chave e seus valores antes do envio no armazenamento de rascunhos, isolado por usuário/loja. Após resposta incerta, **Verificar recebimento** repete a mesma tentativa. Os campos ficam bloqueados para não alterar uma tentativa potencialmente confirmada. O rascunho dura 24 horas e não substitui o histórico permanente no servidor: após expiração, exclusão dos dados do navegador ou troca de dispositivo, confira o histórico antes de registrar novamente um avulso.

O módulo `payments` possui portas de repositório, contratos compartilhados, casos de uso e adaptador Prisma. A API atual aceita somente registro manual; `source=MANUAL`. O futuro gateway deve usar assinatura validada, referência externa única e reconciliação, sem reutilizar endpoint manual como webhook aberto.

Rotas autenticadas em `/api/v1/restaurants/:restaurantId`:

- `POST /payments`: `PaymentInput`, com `requestId`, `orderId` (ou `null`), `expectedPaid`, `amount` textual, `method` e `description`.
- `GET /payments?from=...&to=...&cursor=...`.
- `POST /payments/:paymentId/reverse`: `{ reason }`.
- `GET /orders/:orderId/balance`.
- `GET /reports/financial?from=...&to=...`.

## Logs e recuperação de erros

| Canal                     | Conteúdo                                                                                                                                                                                                                                                         |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tela                      | Mensagem de ação/correção em português, Toastify e erros junto ao formulário. Fronteiras mostram área afetada, código seguro e referência; nunca a exceção bruta.                                                                                                |
| Console do navegador      | Diagnósticos sanitizados de UI/transporte pelo `Executor`. Não é arquivo de auditoria do servidor. React não duplica a exceção bruta em seu callback de erro capturado.                                                                                          |
| Terminal e arquivo da API | Pino JSON: operação, código, referência, tipo seguro, arquivo/linha sem mensagem arbitrária; requisições usam template de rota, status, duração e ID. Não registra corpo, URL bruta/query, headers, nomes, e-mail, telefone, endereço, imagens, senha ou tokens. |

Variáveis geradas por `pnpm setup:local` sem sobrescrever valores existentes: `LOG_LEVEL=info`, `LOG_DIRECTORY=logs`, `LOG_INSTANCE=api`. Níveis: debug/info/warn/error/silent. No Docker, diretório `/app/logs`, instâncias `api` e `api-replica`, volume `cardapio_logs`. Cada arquivo gira a cada 10 MB ou dia, com até sete arquivos antigos comprimidos por instância. Falha do arquivo mantém o terminal e não confirma nem rejeita uma operação financeira por conta própria.

```powershell
docker compose --env-file backend/.env -f compose.yaml logs --tail 80 api api-replica
docker compose --env-file backend/.env -f compose.yaml exec api sh -c 'tail -n 40 /app/logs/api/api.log'
```

O HTTP continua retornando `diagnosticId` para correlacionar uma falha. Não copie logs brutos de dependências para respostas ao cliente. Referências ao operador em pagamentos pertencem à auditoria financeira persistida; não aos logs técnicos.

## Docker e verificações

```powershell
pnpm setup:local
pnpm docker:up
pnpm check:all
pnpm api:test:db
pnpm test:e2e:api
pnpm test:e2e:docker
```

A migração `202610180001_manual_payments` é aditiva e executada pelo serviço `migrate`, não pelo startup de cada API. Dados existentes e volumes são preservados. Acesso local: `http://localhost:8080`. Não há credencial administrativa fixa; crie a conta pelo primeiro acesso. Testes de integração usam somente bancos com sufixo `_test` e limpam exclusivamente IDs gerados por eles.
