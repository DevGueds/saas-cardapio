# Conexão e desempenho no navegador

## Transporte HTTP

`src/shared/infrastructure/resilient-http.ts` centraliza as chamadas JSON do app, com limites por instância do navegador:

- Até três tentativas para leituras e para o endpoint de criação de pedido com UUID de idempotência. Login, cadastro, alterações, exclusões e pagamentos não são reenviados automaticamente.
- Falhas de rede, interrupção durante a leitura do corpo e HTTP 408/429/502/503/504 podem ser repetidos. Erros de validação, autorização, configuração ou capacidade indisponível são preservados.
- Espera progressiva com variação aleatória. O prazo `Retry-After`, em segundos ou data HTTP, nunca é encurtado para caber no orçamento da chamada. Se ele exceder o tempo disponível, a chamada retorna o erro em vez de repetir antes do permitido. Consulte a [semântica HTTP](https://www.rfc-editor.org/rfc/rfc9110.html#field.retry-after).
- Prazo de 20 segundos por tentativa e 60 segundos por operação; em redes lentas indicadas pelo navegador, 35 e 90 segundos. Uploads grandes recebem até 120 segundos, sem repetição automática.
- Até quatro transferências simultâneas, ou duas quando o navegador informa rede lenta/economia de dados. A fila admite até 64 chamadas, com cancelamento e prazo próprios. Isso mantém leituras independentes em paralelo sem abrir trabalho ilimitado.
- Leituras iguais em andamento compartilham a transferência. URL, chave de pedido, CSRF e token de acompanhamento fazem parte do escopo. Troca de CSRF e início/fim de mutações invalidam esse compartilhamento; uma atualização após gravação não reutiliza uma leitura antiga ainda pendente.
- Os prazos cobrem cabeçalhos e corpo. Controladores, temporizadores, esperas, slots e referências de requisições são liberados na conclusão ou cancelamento. A implementação usa `AbortController`, sem exigir `AbortSignal.timeout` do dispositivo.

O teste de concorrência reúne **100 leituras simultâneas iguais em uma chamada HTTP**. Isso mede o compartilhamento no cliente; capacidade de 100 requisições distintas por segundo no servidor exige outro ensaio com carga e recursos representativos. Os limites de segurança do backend continuam aplicáveis.

## Quedas, retorno ao app e pedidos

O aviso de conexão mantém o conteúdo visível e diferencia desconexão, nova tentativa e retorno da conexão. Dados que já carregaram permanecem na tela. Rascunhos e carrinho continuam no armazenamento existente do dispositivo.

Ao reconectar, retornar à aba ou abrir novamente a janela, as leituras são atualizadas. Eventos próximos são agrupados; atualizações automáticas compartilham uma consulta já em andamento. A recarga explícita após uma gravação inicia uma leitura nova e descarta respostas antigas. Polling de cardápio, pedidos, acompanhamento, notificações e desempenho pausa quando a aba está oculta ou o navegador informa desconexão. Imagens que falharam também podem ser carregadas novamente após recuperação. Falhas finais continuam visíveis e permitem tentar outra vez.

O sinal `navigator.onLine` é uma indicação, não uma confirmação de acesso à API. Por isso o transporte permite a primeira tentativa, e o app valida respostas reais. Veja as limitações documentadas pela [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine). As informações sobre tipo de rede são opcionais; dispositivos sem essa API usam os limites padrão.

Pedidos usam a mesma chave e o mesmo corpo serializado durante as tentativas. Uma resposta perdida depois da gravação não cria outro pedido. A identidade pendente é mantida por até 30 dias, inclusive após limitação de tentativas, permitindo recuperar o resultado. O registro dessa identidade guarda chave e hash, sem acrescentar dados pessoais. A confirmação da interface continua dependendo da resposta válida do servidor.

Não existe fila de alterações ou pagamentos para envio posterior em segundo plano. A consulta offline depende do que já carregou: abrir uma página nova ou recarregar completamente ainda precisa de conexão. Cadastro, preços, estoque, horários e pedidos continuam sendo validados pelo servidor.

## React e ordenação

- `MenuScope` separa atualização em segundo plano de carregamento inicial. Uma leitura periódica não interrompe o arraste nem desabilita o formulário. Erros e revisões continuam protegendo gravações.
- O contexto do cardápio é memoizado. O relógio dos horários não renderiza todos os consumidores a cada segundo quando a disponibilidade permanece igual; há teste específico para isso.
- Categorias preenchidas, agrupamento de produtos, contagens e associações usam `Map`/`Set` e `useMemo`, evitando percorrer todos os produtos uma vez por categoria. A busca normaliza o termo uma vez e o ranking utiliza índice por identificador.
- Cards já memoizados recebem callbacks estáveis. A lista de categorias usa linhas com `memo`, controles de toque/teclado e transformações CSS. A projeção da posição usa cálculo constante por linha em vez de reconstruir uma lista por linha durante o arraste.
- Efeitos de conexão, relógios, polling e imagens removem listeners e temporizadores. O coletor de lixo do navegador continua responsável por recuperar memória sem referências; não há tentativa de forçar coleta.

Essas mudanças reduzem chamadas redundantes e trabalho repetido. Paralelismo de rede é limitado pelo transporte; não há nova thread para cálculos pequenos que custariam mais para transferir e coordenar.

## Verificação

Os testes cobrem gateways HTML temporariamente indisponíveis, queda ao ler o corpo, prazos, `Retry-After`, cancelamento, isolamento de sessão/token, limite de concorrência, 100 leituras compartilhadas e recuperação do pedido. Cenários de navegador exercitam desconexão e retorno em celular/desktop, preservação dos campos e uma resposta perdida após o pedido ter sido gravado.

A organização das categorias é validada com mouse, toque e teclado, falha de gravação, publicação explícita e recarga. O banco exige permissão, CSRF, revisão atual e uma permutação completa das categorias da loja.
