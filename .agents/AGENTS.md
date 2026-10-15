# Prompt para Codex — Skill de Princípios e Leis de UX/UI

Atue como um **Senior UX/UI Designer, especialista em usabilidade, acessibilidade e engenharia de interfaces frontend**.

Sua tarefa é criar uma skill reutilizável chamada `ux-ui-design-principles`, responsável por orientar e revisar continuamente o desenvolvimento das interfaces deste projeto.

## 1. Criação da skill

1. Inspecione a estrutura do repositório e identifique o padrão existente para skills.
2. Crie a skill em `.agents/skills/ux-ui-design-principles/SKILL.md`, caso esse caminho seja compatível com o ambiente.
3. Siga o formato e as convenções oficiais de skills utilizados pelo agente.
4. Registre no arquivo `AGENTS.md`, preferencialmente na raiz do projeto, instruções explícitas para consultar e aplicar essa skill.
5. Preserve todas as instruções existentes no `AGENTS.md`, evitando duplicações e conflitos.
6. A skill deve ser independente de framework, mas adaptável à stack e aos componentes já existentes no projeto.

## 2. Princípios obrigatórios

A skill deverá documentar e aplicar os seguintes princípios:

### 1. Centralidade no Usuário

Toda decisão de interface deve considerar necessidades, expectativas, comportamentos, capacidades e limitações dos usuários reais.

Não priorizar preferências estéticas do desenvolvedor em detrimento da usabilidade.

### 2. Consistência e Padrões

Manter consistência visual, terminológica e comportamental entre telas e componentes.

Reutilizar componentes existentes, respeitar o design system e seguir convenções familiares ao público-alvo.

### 3. Hierarquia Visual

Organizar informações conforme importância e contexto, usando adequadamente tipografia, espaçamento, contraste, agrupamento e posicionamento.

A interface deve deixar evidentes as ações primárias, informações prioritárias e relações entre elementos.

### 4. Controle e Liberdade do Usuário

Garantir mecanismos apropriados para cancelar, voltar, corrigir, desfazer e recuperar ações.

Operações destrutivas devem possuir proteções proporcionais ao risco, como confirmação, recuperação ou desfazer.

### 5. Lei de Fitts

Dimensionar e posicionar elementos interativos considerando facilidade de alcance, precisão e contexto de uso.

Garantir áreas de interação adequadas, especialmente em dispositivos móveis e telas sensíveis ao toque.

### 6. Lei de Hick-Hyman

Reduzir a complexidade das decisões apresentadas ao usuário.

Agrupar opções relacionadas, estabelecer prioridades e utilizar divulgação progressiva quando apropriado, sem esconder funcionalidades importantes.

### 7. Reconhecimento em vez de Memorização

Manter informações, opções e comandos importantes visíveis ou facilmente recuperáveis.

Evitar exigir que o usuário memorize dados, caminhos de navegação ou instruções entre telas.

Utilizar rótulos claros, contexto, feedback e pistas visuais.

## 3. Princípios complementares

Incluir também, como critérios auxiliares:

- Lei de Jakob: respeitar padrões familiares de interação.
- Lei de Miller: organizar informações para facilitar compreensão, sem impor limites arbitrários à memória humana.
- Lei de Tesler: administrar a complexidade inevitável sem transferi-la desnecessariamente ao usuário.
- Lei de Prägnanz: favorecer estruturas visuais compreensíveis.
- Efeito de proximidade: agrupar elementos relacionados.
- Visibilidade do estado do sistema: fornecer feedback sobre operações e mudanças.
- Prevenção e recuperação de erros: mensagens claras e orientação para resolução.
- Acessibilidade: observar WCAG 2.2, navegação por teclado, foco visível, contraste, semântica e tecnologias assistivas.
- Responsividade: preservar usabilidade em diferentes tamanhos de tela e modalidades de interação.

Não tratar leis de UX como regras matemáticas universais. Considerar contexto, evidências e necessidades reais dos usuários.

## 4. Integração obrigatória com AGENTS.md

Adicionar uma seção intitulada:

**UX/UI Design Principles — Mandatory Review**

Estabelecer as seguintes instruções permanentes:

- Antes de implementar ou modificar uma interface, consultar a skill `ux-ui-design-principles`.
- Durante o desenvolvimento, aplicar seus princípios às decisões de layout, navegação, formulários, botões, tabelas, modais e demais elementos interativos.
- Depois de alterações relevantes na UI, revisar o resultado segundo o checklist da skill.
- Em refatorações, verificar se os padrões existentes estão sendo preservados ou aprimorados.
- Em revisões de código frontend, identificar problemas de usabilidade, inconsistência visual e acessibilidade.
- Não introduzir alterações puramente estéticas que prejudiquem fluxos existentes.
- Priorizar componentes reutilizáveis e evitar duplicações desnecessárias.
- Tratar violações relevantes de usabilidade como problemas de qualidade do software.
- Não aplicar esta revisão a tarefas exclusivamente backend, infraestrutura ou documentação sem impacto na interface.

O `AGENTS.md` deve conter uma referência clara ao caminho da skill e instruções de quando ela deve ser utilizada, sem precisar duplicar toda sua documentação.

## 5. Checklist de revisão

A skill deve incluir um checklist prático de avaliação:

- A interface é compreensível para seu público-alvo?
- As ações principais estão visualmente destacadas?
- Os componentes seguem padrões consistentes?
- Existem opções excessivas ou desnecessariamente complexas?
- Os botões possuem tamanhos e áreas interativas adequados?
- O usuário consegue cancelar, corrigir ou recuperar ações?
- A navegação evita exigir memorização?
- Existem estados de carregamento, vazio, erro e sucesso adequados?
- Os formulários possuem rótulos, validações e mensagens compreensíveis?
- A interface funciona adequadamente em dispositivos móveis?
- A navegação por teclado e as tecnologias assistivas são consideradas?
- As alterações preservam a compatibilidade com fluxos já existentes?

## 6. Processo de execução

Ao realizar tarefas que envolvam frontend:

1. **Inspecionar:** compreender os componentes, padrões e fluxos existentes.
2. **Planejar:** identificar os princípios de UX/UI relevantes.
3. **Implementar:** desenvolver respeitando esses princípios e a arquitetura existente.
4. **Revisar:** aplicar o checklist da skill às alterações.
5. **Validar:** executar os testes, verificações ou ferramentas disponíveis.
6. **Relatar:** informar problemas identificados, correções realizadas e limitações da validação.

Classificar problemas relevantes por gravidade: crítica, alta, média ou baixa.

Sempre que possível, apontar arquivos, componentes e trechos envolvidos e sugerir correções concretas.

Evitar relatórios longos quando nenhuma violação relevante for encontrada.

## 7. Restrições

- Não reescrever componentes funcionais sem justificativa.
- Não introduzir dependências novas desnecessariamente.
- Não substituir o design system existente sem autorização.
- Não transformar recomendações subjetivas em regras absolutas.
- Não sacrificar acessibilidade em favor de estética.
- Não alegar validação visual ou testes com usuários que não tenham sido realizados.
- Não modificar regras de negócio durante revisões exclusivamente visuais.

## 8. Referências

Utilizar como referências conceituais:

- Nielsen Norman Group — 10 Usability Heuristics: https://www.nngroup.com/articles/ten-usability-heuristics/
- Laws of UX: https://lawsofux.com/
- W3C — WCAG 2.2: https://www.w3.org/TR/WCAG22/
- Figma — Princípios de UI: https://www.figma.com/pt-br/resource-library/principios-design-ui/
- ESPM — Princípios fundamentais de UX: https://uxdi.espm.br/principios-fundamentais-de-design-de-experiencia-do-usuario/

## 9. Resultado esperado

Ao finalizar:

1. Apresentar a estrutura dos arquivos criados ou modificados.
2. Confirmar que o `AGENTS.md` referencia corretamente a skill.
3. Demonstrar em quais tipos de tarefas a revisão será acionada.
4. Validar que a skill segue o padrão suportado pelo ambiente.
5. Informar eventuais limitações da integração.

**Objetivo final:** estabelecer uma cultura permanente de qualidade de UX/UI no projeto, fazendo com que os agentes considerem sistematicamente as leis de usabilidade, a acessibilidade, a consistência e as necessidades reais do usuário durante todo o ciclo de desenvolvimento frontend.

A execução desta tarefa deve limitar-se à criação e integração da skill, sem modificar componentes da aplicação neste momento.
