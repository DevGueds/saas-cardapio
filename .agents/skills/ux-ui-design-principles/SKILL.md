---
name: ux-ui-design-principles
description: Projetar e revisar interfaces com foco em usabilidade, acessibilidade e consistência, em tarefas de frontend que alterem layout, navegação, formulários ou componentes interativos. Não se aplica a backend, infraestrutura ou documentação sem impacto na interface.
---

# Princípios de UX/UI

Oriente decisões e revisões pelo que a pessoa precisa realizar. Esta skill é independente de framework; adapte-a à stack e aos componentes do projeto. Preserve regras de negócio, contratos, persistência e fluxos existentes em tarefas exclusivamente visuais.

## Processo

1. **Inspecionar:** leia as instruções do projeto, os componentes, estilos e testes dos fluxos afetados. Identifique público, tarefa principal, estados e restrições; não invente pesquisa com usuários.
2. **Planejar:** defina a hierarquia e quais princípios abaixo ajudam a resolver problemas observados. Reutilize o design system; altere a direção visual somente quando autorizado pelo pedido.
3. **Implementar:** use componentes coesos, tokens e padrões reutilizáveis. Preserve rótulos acessíveis, conteúdo, validações, dados digitados e ações existentes.
4. **Revisar:** aplique o checklist, durante e após mudanças relevantes. Em refatorações, preserve ou melhore os padrões; em revisão de código, trate violações relevantes de usabilidade como defeitos.
5. **Validar:** execute as verificações disponíveis e percorra os fluxos afetados em desktop, celular e teclado. Inspecione a interface renderizada quando houver navegador disponível, inclusive estados vazio, carregando, erro e sucesso.
6. **Relatar:** registre correções e evidências, distinguindo testes executados, inspeção visual e limitações. Não alegue conformidade WCAG completa nem testes com usuários sem evidência.

## Princípios para tomar decisões

| Princípio                            | Aplicação prática                                                                                                                                                                                   |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Centralidade no usuário              | Considere objetivos, familiaridade, capacidades e limitações do público. Prefira linguagem reconhecível, exemplos úteis e uma próxima ação evidente a preferências pessoais.                        |
| Consistência e padrões               | Reutilize nomenclatura, hierarquia, componentes e comportamento entre telas. O mesmo tipo de ação deve parecer e funcionar da mesma forma.                                                          |
| Hierarquia visual                    | Separe título, contexto, conteúdo e ação principal por tipografia, contraste, espaçamento e agrupamento. Evite várias ações concorrentes com o mesmo peso.                                          |
| Controle e liberdade                 | Ofereça cancelar, voltar, corrigir e recuperar. Preserve os campos em falhas. Confirme ou permita desfazer operações destrutivas conforme seu risco.                                                |
| Lei de Fitts                         | Posicione ações junto ao objeto afetado; dê área de toque confortável. Adote 44 × 44 CSS px como alvo de projeto para controles frequentes, sem confundir essa escolha com o mínimo normativo WCAG. |
| Lei de Hick-Hyman                    | Agrupe escolhas relacionadas. Apresente primeiro as decisões necessárias; use divulgação progressiva sem esconder recursos essenciais.                                                              |
| Reconhecimento em vez de memorização | Mantenha rótulos, valores, seleção e contexto visíveis. Não use placeholder como único rótulo, nem ícones ambíguos como única orientação.                                                           |
| Lei de Jakob                         | Prefira interações familiares: links para navegação, botões para ações e controles nativos quando adequados.                                                                                        |
| Lei de Miller                        | Divida informação em grupos significativos. Não imponha limites numéricos arbitrários a menus ou opções.                                                                                            |
| Lei de Tesler                        | Resolva a complexidade que a interface pode assumir, com defaults seguros e exemplos; não transfira detalhes de implementação ao usuário.                                                           |
| Lei de Prägnanz e proximidade        | Use estruturas simples, alinhamentos e distâncias que tornem evidente quais elementos pertencem ao mesmo grupo.                                                                                     |
| Visibilidade do estado               | Mostre seleção, carregamento, salvamento e resultado. Não anuncie sucesso antes da confirmação; mantenha ações duplicadas bloqueadas durante operações.                                             |
| Prevenção e recuperação              | Explique o problema e a próxima ação em português claro. Associe erros aos campos e dê uma recuperação que preserve os dados.                                                                       |

Use as leis como critérios contextuais, não como fórmulas universais.

## Acessibilidade e responsividade

- Use HTML semântico, hierarquia de títulos, rótulos persistentes, nomes acessíveis e estados programáticos. Não comunique disponibilidade ou erro apenas por cor.
- Garanta teclado, ordem de foco coerente, foco visível e não encoberto, saída de diálogos com Escape quando permitido e retorno ao acionador. Painéis modais precisam conter o foco e tornar o fundo inerte.
- Tome WCAG 2.2 AA como referência: contraste de texto normal de pelo menos 4,5:1, texto grande 3:1 e informação visual de controles 3:1 quando aplicável. O critério 2.5.8 prevê alvo mínimo de 24 CSS px com exceções; procure alvos maiores para toque.
- Verifique reflow em 320 CSS px e ampliação. Evite rolagem horizontal da página; tabelas que exigem duas dimensões podem ter região própria com acesso por teclado.
- Prefira texto de corpo confortável e unidades relativas. Não esconda informações importantes para caber em telas pequenas.
- Respeite movimento reduzido; não dependa de animação, hover ou arraste para concluir ações. Forneça alternativa a imagens ausentes e preserve a legibilidade sem fontes externas.

## Checklist de revisão

- [ ] A interface e os termos são compreensíveis para o público?
- [ ] A ação principal e a próxima etapa estão evidentes?
- [ ] Componentes, rótulos e comportamentos são consistentes?
- [ ] As opções estão agrupadas, sem complexidade desnecessária?
- [ ] Botões têm áreas de interação confortáveis e nomes claros?
- [ ] É possível cancelar, voltar, corrigir e recuperar ações?
- [ ] Navegação, seleção e contexto dispensam memorização?
- [ ] Carregamento, vazio, erro, indisponibilidade e sucesso têm tratamento?
- [ ] Formulários têm rótulos, instruções, validações e mensagens úteis?
- [ ] Celular, ampliação e textos longos continuam utilizáveis?
- [ ] Teclado, foco, semântica e tecnologias assistivas foram considerados?
- [ ] Os fluxos, dados e funcionalidades anteriores foram preservados?

## Classificação dos achados

- **Crítica:** impede concluir tarefa essencial ou induz perda de dados/ação irreversível.
- **Alta:** bloqueia parte do público (por exemplo, foco inacessível) ou causa erro recorrente em fluxo principal.
- **Média:** atrito relevante, baixa legibilidade ou inconsistência com recuperação possível.
- **Baixa:** acabamento ou clareza localizada sem bloqueio de tarefa.

Para achados relevantes, indique arquivo/componente, efeito no usuário e correção concreta. Quando não houver violações relevantes, relate brevemente as verificações, sem relatório artificialmente longo.

## Limites

Não reescreva componentes funcionais sem motivo ligado à tarefa. Não adicione dependências desnecessárias nem troque o design system sem autorização. Não sacrifique acessibilidade por estética, transforme gosto em regra absoluta ou altere regras de negócio numa revisão visual. A autorização e o escopo do pedido atual prevalecem sobre exemplos desta skill.

## Referências conceituais

Consulte a fonte pertinente quando a decisão depender de um critério específico; não é necessário reler todas a cada edição.

- [Nielsen Norman Group — heurísticas de usabilidade](https://www.nngroup.com/articles/ten-usability-heuristics/)
- [Laws of UX — leis e aplicações](https://lawsofux.com/)
- [W3C — WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [Figma — princípios de UI](https://www.figma.com/pt-br/resource-library/principios-design-ui/)
- [ESPM — princípios de UX](https://uxdi.espm.br/principios-fundamentais-de-design-de-experiencia-do-usuario/)
