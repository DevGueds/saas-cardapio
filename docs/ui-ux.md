# Interface e revisão de UX/UI

O redesenho altera somente apresentação e estilos. Domínio, casos de uso, adaptadores, documentos persistidos e contratos permanecem os mesmos. O quadro de pedidos continua sendo uma simulação local.

## Skill permanente

A skill está em [ux-ui-design-principles](../.agents/skills/ux-ui-design-principles/SKILL.md), com metadados em `agents/openai.yaml`. O [AGENTS.md da raiz](../AGENTS.md) exige sua consulta antes de alterar interfaces, aplicação durante a implementação e revisão posterior pelo checklist.

Ela se aplica, por exemplo, a criar um formulário, ajustar o layout do cardápio, revisar navegação por teclado ou refatorar um modal. Tarefas exclusivamente backend, infraestrutura e documentação sem impacto visual não acionam a revisão. A skill usa frontmatter com `name` e `description` e foi aprovada pelo validador oficial do skill-creator. A descoberta automática depende de o cliente carregar as skills locais; a referência explícita no AGENTS.md permite consultá-la diretamente, inclusive na sessão atual.

## Mapa da apresentação

| Responsabilidade                               | Arquivos                                                                          |
| ---------------------------------------------- | --------------------------------------------------------------------------------- |
| Tokens, tipografia, foco e estados             | `src/shared/presentation/styles/base.css`                                         |
| Campos, botões, mensagens e diálogos           | `src/shared/presentation/styles/forms.css`, `Dialog.tsx`                          |
| Cabeçalho e seções reutilizáveis               | `PageHeading.tsx`, `FormSection.tsx`                                              |
| Navegação desktop e modal móvel                | `src/app/presentation/AdminLayout.tsx`, `AdminNavigation.tsx`, `admin-layout.css` |
| Gestão de catálogo, cards/tabela e formulário  | `src/modules/catalog/presentation/`                                               |
| Cardápio público                               | `PublicMenuPage.tsx`, `PublicProductCard.tsx`, `public-menu.css`                  |
| Carrinho, entrega e preparação do WhatsApp     | `src/modules/checkout/presentation/`                                              |
| Configurações agrupadas                        | `src/modules/restaurant/presentation/`                                            |
| Pedidos simulados, busca, filtros e transições | `src/modules/demo-orders/presentation/`                                           |
| Regressões de interface                        | `tests/e2e/ui-ux.spec.ts` e `tests/e2e/menu.spec.ts`                              |

A paleta utiliza verde profundo, superfícies claras e tons suaves para agrupamento. Tokens vivem no CSS comum; estilos específicos permanecem no módulo correspondente. Novas telas devem reutilizar cabeçalhos, seções, campos e diálogos antes de criar padrões paralelos.

## Decisões de usabilidade

- A ação principal aparece junto ao título; editar, disponibilidade e exclusão continuam próximos ao produto.
- Configurações estão divididas em loja, WhatsApp, entrega e identidade. A barra de salvar fica no topo durante a rolagem; campos têm margem de rolagem para preservar o foco visível.
- O cardápio mostra custos e prazo antes da escolha, oferece busca e categorias e mantém preços junto ao botão Adicionar.
- O checkout organiza pedido, entrega e pagamento; mantém mensagens de erro, atualização explícita do carrinho e confirmação final no WhatsApp.
- Pedidos têm agrupamento por etapa, contadores, busca por nome/número, filtros e ações com o nome do próximo estado. Mover um cartão anuncia a alteração e reposiciona o foco. A impressão permanece disponível para o quadro.
- Diálogos e menu móvel contêm o foco, permitem Escape quando não há operação pendente e devolvem o foco ao acionador.
- Seleção, indisponibilidade e estados combinam texto e aparência. A interface respeita movimento reduzido e mantém alternativas a imagens indisponíveis.

## Revisão realizada

| Gravidade | Problema observado                                         | Correção                                                          |
| --------- | ---------------------------------------------------------- | ----------------------------------------------------------------- |
| Alta      | Tab podia sair do menu móvel ao alcançar o último controle | Ciclo de foco em ambas as direções, mantendo Escape e restauração |
| Média     | Resumo financeiro excedia a largura de 320 px              | Reorganização dos indicadores em telas pequenas                   |
| Média     | Textos pequenos e ações identificadas somente por ícones   | Escala tipográfica, contraste e rótulo Editar                     |
| Média     | Formulário de configurações sem agrupamento por tarefa     | Seções com títulos e orientações contextuais                      |
| Média     | Mudança de etapa removia o elemento com foco               | Foco no cartão movido ou no título da etapa filtrada              |

## Validação e limites

- Os 76 testes unitários/integração anteriores e 13 fluxos de navegador foram preservados.
- Sete cenários adicionais cobrem pedidos, foco do menu móvel, catálogo, configurações e larguras de 320, 768 e 1280 px.
- Inspeção visual em Chromium em desktop e celular, incluindo cardápio, catálogo, pedidos, configurações e checkout.
- Auditoria pontual com axe-core: nenhuma violação detectada nas regras WCAG A/AA executadas em quatro telas a 1440 e 390 px e no checkout. O utilitário foi instalado apenas em `.cache`, sem dependência nova do aplicativo.
- Tipagem, lint, fronteiras arquiteturais, UTF-8 e build seguem os comandos existentes.

A inspeção e os testes automatizados não equivalem a pesquisa com usuários, teste manual com leitor de tela ou certificação integral de acessibilidade. As referências e o checklist permanente estão na skill.
