# Formatação e validação dos formulários

Os contratos em `packages/contracts/src/fields.ts` usam Zod e são compartilhados entre navegador e API. Cada caso de uso do servidor continua validando os dados: remover a validação do navegador não libera uma operação inválida.

## Comportamento

- Todos os controles usam `ValidatedInput`, `ValidatedTextarea` ou `ValidatedSelect`; `Fields.tsx` agrega rótulos e ajuda. `ValidatedForm` valida os campos montados antes de enviar, mostra orientação, abre seções recolhidas e foca o primeiro erro. Campos desabilitados não impedem uma operação permitida.
- Erros aparecem junto ao campo após sair dele ou tentar enviar; depois, acompanham a correção. `aria-invalid`, `aria-describedby` e rótulos estáveis permitem identificar e ouvir o problema. A API retorna erros seguros por caminho de campo.
- Ao sair do campo, telefones recebem DDD e máscara, CEP recebe hífen e valores monetários usam vírgula e duas casas. Formatar ao sair preserva a posição do cursor durante a digitação e permite corrigir o meio do texto.
- Nomes preservam acentos, cedilha, maiúsculas e minúsculas; apenas espaços extras e a representação Unicode são normalizados. Nomes pessoais aceitam uma palavra, alfabetos Unicode, apóstrofos e hífens. Nomes comerciais também aceitam números.
- E-mails são aparados e convertidos para minúsculas; o endereço público do cardápio usa letras sem acento, minúsculas e hífens. Cupons usam maiúsculas. Estas normalizações não afirmam que um e-mail, CEP ou telefone exista ou pertença à pessoa.
- Telefones aceitam DDD brasileiro, celular de 9 dígitos iniciado por 9 e fixo de 8 dígitos iniciado por 2–5, com `+55` opcional. O domínio mantém a representação canônica `55 + DDD + número`. WhatsApp vazio nas configurações desabilita o canal.
- Dinheiro aceita vírgula ou ponto e até duas casas, sem milhares. Texto residual, `Infinity`, notação exponencial e valores fora do limite não são corrigidos silenciosamente. Preço/desconto fixo devem ser positivos; taxas e mínimos podem ser zero.
- Senhas não recebem trim, máscara de valor, normalização ou truncamento. Nova senha tem de 8 a 128 caracteres Unicode; o campo de login preserva a credencial como digitada.
- Validações relacionais cobrem troco suficiente, datas da promoção, porcentagem de 1 a 100, prazo máximo >= mínimo, limite de usos e coordenadas em pares. A existência de produtos/categorias, autorização, preços e total final continuam sendo revalidados pelos casos de uso/domínio.
- Imagens passam pelo contrato Zod de formato/tamanho, seguido das verificações existentes de assinatura, leitura e decodificação.

## Rascunhos e manutenção

Rascunhos Redux têm schemas de estrutura/tamanho deliberadamente mais permissivos que os schemas de envio. Um telefone incompleto ou um preço inválido deve sobreviver ao recarregamento para ser corrigido. Persistir um rascunho não equivale a publicar dados válidos.

Para um novo campo, utilize os componentes acima, defina limites e `required`, e selecione `validation` quando houver formatação. Use `schema` para uma regra específica, mantendo o contrato correspondente na API. Não substitua validação por remoção indiscriminada de caracteres. Campos de busca também possuem limites; escolhas são conferidas contra as opções disponíveis.

Testes: `tests/field-validation.test.ts`, `tests/form-validation.test.tsx`, `tests/e2e/validation.spec.ts` e `backend/test/unit/security.test.ts`, além dos fluxos existentes. Documentação técnica: [schemas do Zod](https://zod.dev/api) e [mensagens de erro](https://zod.dev/error-customization).

A verificação arquitetural impede novos formulários/controles nativos fora da camada de validação e do seletor de arquivos. Referência para DDD e numeração: [Anatel](https://www.gov.br/anatel/pt-br/regulado/numeracao/perguntas-frequentes).
