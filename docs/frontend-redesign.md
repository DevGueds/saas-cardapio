# Dashboard e cardápio: direção de interface

## Contexto e objetivos

Organizar a operação em blocos bento, com superfícies claras e vidro discreto na navegação. A ação principal precisa continuar reconhecível em celular e desktop. A direção aplica o `SKILL.md` mestre e as referências de glassmorphism, bento, performance e UX/UI fornecidas para esta alteração.

O frontend mantém os serviços injetados, contratos, permissões, revisões de gravação, carrinho, adicionais, recuperação de conexão e dados reais. O dashboard demonstrativo utiliza os produtos cadastrados; indicadores de vendas continuam dependendo da API.

## Tokens e fundamentos

| Token            | Padrão                                           | Uso                               |
| ---------------- | ------------------------------------------------ | --------------------------------- |
| Fonte            | Plus Jakarta Sans, variável 400–800, WOFF2 local | Interface inteira                 |
| Ação             | `#ce283d`                                        | Ações administrativas e seleção   |
| Texto            | `#25252d`                                        | Títulos e conteúdo principal      |
| Texto secundário | `#656570`                                        | Rótulos e explicações             |
| Fundo            | `#f6f5f8`                                        | Área de trabalho                  |
| Superfície       | `#ffffff`                                        | Cartões e formulários             |
| Sucesso          | `#19724c`                                        | Loja aberta e confirmações        |
| Espaçamento      | 4, 8, 12, 16, 24, 32 px                          | Ritmo entre elementos             |
| Bordas           | 12–14 px em controles; 18–26 px em cartões       | Hierarquia entre controle e bloco |

`design-tokens.css` concentra os valores. Os layouts ficam nos módulos; `redesign-components.css` uniformiza os componentes compartilhados. As quatro cores e os três modelos escolhidos pelo estabelecimento permanecem disponíveis no cardápio.

## Regras dos componentes

- **Navegação:** grupos por tarefa; rótulos visíveis e seleção explícita. Abaixo de 768 px, atalhos inferiores com área de toque mínima de 44 px e espaço para a área segura do aparelho. O menu completo usa o diálogo existente, com contenção e retorno de foco.
- **Dashboard:** na loja conectada, os indicadores de vendas vêm primeiro, seguidos pelo gráfico e pelos dados operacionais. Na demonstração, catálogo e atalhos usam blocos de tamanhos diferentes. Datas, comparação, tabelas alternativas e exportação permanecem disponíveis.
- **Cardápio:** identidade, informações e imagem da loja em blocos; produtos com descrição, preço, foto e ação. Cada categoria mantém todos os itens e atalhos por âncora. Seleção e quantidade são visíveis. Fotos ocultas e produtos indisponíveis têm tratamento próprio.
- **Formulários e diálogos:** conservar rótulos, regras, mensagens, rascunhos e validações existentes. Controles mantêm os estados normal, hover, foco, ativo, desabilitado, carregando, erro e sucesso. O botão principal confirma o resultado somente após a gravação.
- **Vidro:** um desfoque de 12 px no cabeçalho administrativo e 8 px nos atalhos do cardápio em desktop. No celular, superfícies mais opacas dispensam o desfoque. Fallbacks CSS atendem ausência de suporte e preferência por transparência reduzida.

## Acessibilidade e critérios verificáveis

- Testar 320, 390, 768 e 1440 px, sem rolagem horizontal da página.
- Verificar contraste de pelo menos 4,5:1 nos textos da navegação; manter o teste de cálculo de luminância.
- Verificar pelo menos 3:1 entre borda e fundo dos campos; a camada visual deve preservar a ênfase vermelha dos campos inválidos.
- Percorrer atalhos e menu completo por teclado; Escape fecha o diálogo e o foco volta ao acionador.
- Reservar espaço para a barra inferior e aplicar margem de rolagem aos controles, evitando foco encoberto.
- Manter os dados do gráfico em tabela e os estados de pedido disponíveis por texto.
- Honrar movimento reduzido. As barras e cartões dispensam animação contínua.

Essas verificações são específicas dos fluxos exercitados; não equivalem a uma certificação WCAG integral.

## Conteúdo e tom

Usar tarefas concretas: “Organizar produtos”, “Acompanhar pedidos”, “Salvar ordem”. Explicar o resultado de ações e falhas. Preços, dados de cliente, status e disponibilidade continuam derivados dos dados da loja. Evitar números promocionais fictícios ou botões sem ação.

## Performance: gargalos, impacto, antes/depois e trade-offs

### Tipografia e payload

**Gargalo identificado:** duas fontes de interface em TTF, somando 404.864 bytes nos arquivos existentes.

**Impacto:** downloads e troca de tipografia durante o primeiro carregamento.

**Antes/depois:** a interface passa a usar uma WOFF2 variável local de 27.348 bytes, com preload e `font-display: swap`. Os arquivos anteriores continuam disponíveis para clientes com CSS antigo. O teste de navegador verifica a única fonte de UI carregada em `/fonts/`.

**Trade-offs:** o subconjunto latino cobre o português da interface; conteúdo em outros alfabetos utiliza o fallback do sistema. Fontes próprias de comprovantes continuam isoladas do estilo da UI.

### Digitação e listas

**Gargalo identificado:** normalização do mesmo termo uma vez por produto na busca administrativa; filtro e renderização competindo com a digitação.

**Impacto:** trabalho repetido proporcional ao tamanho do catálogo.

**Antes/depois:** termo normalizado uma vez, contagens memoizadas em uma passagem e `useDeferredValue` nas buscas do catálogo e cardápio. Cards e callbacks estáveis existentes são preservados.

**Trade-offs:** a lista pode atualizar depois do campo; o cardápio indica a busca pendente com `aria-busy`. A lista completa continua no HTML para preservar âncoras, busca e acessibilidade.

### Dashboard e entrada

**Gargalo identificado:** cálculo do máximo do gráfico em cada seleção e buscas repetidas no mapa de horários; página de login incluída antecipadamente.

**Impacto:** trabalho desnecessário durante interação e código carregado antes da necessidade.

**Antes/depois:** máximo do gráfico e índices dos horários memoizados; gráfico e visão geral com `memo`; login carregado por rota, assim como as outras páginas administrativas.

**Trade-offs:** a primeira visita ao login carrega um módulo adicional. Os limites de erro e carregamento do roteador continuam atendendo essa transição.

### Composição e memória

**Gargalo identificado:** desfoques numerosos e animações permanentes podem aumentar o custo de composição, especialmente em celulares.

**Impacto:** risco de perda de fluidez em dispositivos com recursos limitados.

**Antes/depois:** cartões de conteúdo opacos, desfoque limitado à navegação desktop, animações curtas e preferência por movimento reduzido. Os efeitos de conexão, polling e imagens mantêm suas limpezas existentes.

**Trade-offs:** o vidro fica mais discreto no celular. Não há detecção de GPU, nova fila de rede, novo cache de sessão ou mudança de backend nesta alteração. Não foram inferidos FPS, Lighthouse ou capacidade de requisições por segundo.

## Antipadrões e migração

- Manter os componentes de formulário e diálogo existentes ao aplicar os tokens; preservar suas validações e ações.
- Usar cores de status acompanhadas de texto. Evitar vidro sobre conteúdo variável com pouco contraste.
- Preservar a rolagem do documento e os atalhos das categorias. Fixar `html/body` e criar outro scroller quebraria esses vínculos.
- Aplicar novas cores por tokens e novas superfícies pela camada compartilhada; evitar reproduzir uma paleta independente em cada formulário.
- Manter a arquitetura e a camada HTTP resiliente existentes. Os exemplos de bibliotecas e endpoints das referências orientam os padrões de interação.

## Checklist de QA

- [x] Tipos, lint, limites arquiteturais e UTF-8.
- [x] Testes unitários e build API do frontend.
- [x] Fluxos demonstrativos: produtos, categorias, conflitos, carrinho e formulários.
- [x] Fluxos com API real: conta, pedidos, adicionais, horários, impressão e recuperação de conexão.
- [x] Três modelos, quatro cores e fotos opcionais no cardápio.
- [x] Celular, desktop, foco, contraste e largura da página.
- [x] Verificação visual dos indicadores reais, além do estado demonstrativo.

Verificação de 02/11/2026: 282 testes unitários, 32 cenários demonstrativos e 20 cenários com API real exercitados. Tipos, lint, UTF-8, build e integração do HTML social com Caddy aprovados. Os cenários demonstrativos incluem a suíte completa inicial e as verificações específicas após o ajuste de contraste dos campos.
