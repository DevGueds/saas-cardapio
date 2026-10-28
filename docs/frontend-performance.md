# Desempenho e organização financeira

A organização financeira usa como referências de UX a [tela financeira](https://blog-parceiros.ifood.com.br/tela-financeira/) e o [painel financeiro](https://blog-parceiros.ifood.com.br/painel-financeiro/) documentados pelo iFood: resumo inicial, período explícito, composição dos valores e detalhamento filtrável. A identidade verde, os componentes e as regras financeiras deste projeto foram preservados. Não foram adicionados repasses, taxas ou saldo bancário fictícios.

Atalhos Hoje, Últimos 7 dias e Este mês aplicam o período. Datas personalizadas precisam de Aplicar período. Filtros de número, etapa e saldo abrangem todos os pedidos retornados pelo relatório, com páginas de 25 linhas; afetam só a lista. Indicadores e PDF continuam abrangendo todo o período aplicado, conforme explicado na interface. Datas de pedidos e datas de movimentos continuam separadas.

## Otimizações verificáveis

- Formatadores `Intl.NumberFormat` e `Intl.DateTimeFormat` são reutilizados. Na medição local de cinco execuções com 5.000 valores, a formatação monetária passou de 413–542 ms para 7–13 ms. É uma medição isolada dessa operação, não um benchmark do tempo total da aplicação.
- Listas do catálogo usam dados derivados memorizados e callbacks estáveis. Os cartões públicos recebem identificadores e funções estáveis; uma mudança de quantidade não exige renderizar os cartões inalterados.
- A análise do carrinho é calculada uma vez por mudança de itens/cardápio. A função de leitura do rascunho é estável, evitando revalidar todo o carrinho ao abrir modais.
- A tabela de recebimentos tem uma fronteira `memo` com props estáveis. Editar o motivo de uma reversão não refaz a formatação de todas as linhas. O relatório também preserva seu conteúdo ao mudar o estado da exportação.
- A busca de pedidos usa `useDeferredValue` para priorizar a digitação. A paginação limita o DOM sem excluir pedidos do filtro nem do PDF.
- O mapa Leaflet mantém sua instância, atualiza o marcador e libera recursos ao desmontar. Testes verificam dez mudanças de coordenadas com uma única criação do mapa.
- O diálogo nativo abre no `useLayoutEffect`, antes da pintura, e conserva foco, Escape e retorno ao acionador. O backdrop usa uma sobreposição sem blur de tela inteira. O registro de validação dos campos só é refeito quando sua regra muda.
- A prévia da imagem do produto é memorizada e recebe callback estável durante a edição textual.
- A configuração de impressão separa impressoras e comprovantes em abas. O diálogo de impressora mantém seu rascunho local; digitar nele não atualiza o formulário inteiro. O Editor.js só é carregado ao personalizar, permanece montado ao recolher/trocar abas e usa callbacks estáveis. A prévia/PDF é gerada ao testar, sem exportar a cada tecla.

Testes de apresentação verificam isolamento de uma tabela com 100 recebimentos durante 20 atualizações externas, atualização de valores modificados, pesquisa além da antiga prévia de 100 pedidos, paginação e exclusão dos cancelados do saldo a cobrar. Testes de navegador continuam cobrindo teclado, foco, validação, celular e operações financeiras reais.

Para investigar outras lentidões, use o React Profiler no fluxo afetado e compare `actualDuration`/`baseDuration`, além das requisições na aba Network. As otimizações não tornam uma consulta ao servidor instantânea; os estados de carregamento e falha continuam visíveis e não anunciam sucesso antes da gravação.
