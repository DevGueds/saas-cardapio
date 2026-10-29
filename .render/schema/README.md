# Schema oficial do Blueprint Render

`render.yaml.json` foi obtido de <https://render.com/schema/render.yaml.json> em 28/10/2026, conforme [a referência oficial](https://render.com/docs/blueprint-spec#validating-blueprints). A cópia versionada permite validação reproduzível no CI, sem conta Render nem dependência de um download durante cada teste.

Para atualizar, obtenha novamente o schema nessa URL, revise a alteração e execute `pnpm render:check`. O schema valida estrutura e campos; conflitos e regras específicas de uma conta exigem `render blueprints validate render.yaml` autenticado no workspace de destino.
