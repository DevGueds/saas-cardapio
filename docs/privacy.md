# Privacidade e LGPD — Pede Aqui

Responsável informado pelo titular da operação: **66.369.962 VITOR SOUSA MESQUITA**, CNPJ **66.369.962/0001-20**, canal **pedeaqui99@gmail.com**. Os documentos públicos usam esses dados; solicitações de privacidade continuam sem resposta automática por e-mail. O cadastro envia códigos de confirmação pelo Postal autohospedado quando configurado; no desenvolvimento, o Mailpit captura somente mensagens locais. Consulte [Cloudflare e e-mail](cloudflare-and-email.md).

Esta implementação oferece controles técnicos e transparência. A adequação à LGPD também depende da operação, dos contratos e da análise das finalidades e bases legais. Não constitui certificação de conformidade jurídica.

## Controles implementados

- Termos, privacidade e dados do dispositivo em diálogos acessíveis, disponíveis no login, administração, cardápio e `/privacidade`.
- Aceite explícito e versionado no cadastro, persistido na mesma transação da conta. A versão fica em `packages/contracts/src/privacy.ts`; guardar versões anteriores quando os documentos forem atualizados. Contas antigas não recebem aceite fictício.
- Aviso informativo sobre armazenamento essencial. “Entendi” apenas registra a ciência do aviso; não é consentimento genérico. Sem analytics e publicidade nesta versão; fontes locais.
- Dados pessoais do preenchimento do checkout no armazenamento da aba, com TTL de 24 horas e migração de rascunhos antigos. Limpeza específica preserva carrinho, pedidos, comprovantes e chaves de tentativas pendentes.
- Perfil e exportação dos próprios dados com sessão, MFA quando exigido, CSRF, confirmação da senha e limitação de tentativas. A exportação não contém hashes, tokens, segredos ou dados de clientes/terceiros. É uma cópia dos dados de conta, não uma resposta exaustiva a todos os direitos.
- Solicitações de titulares persistidas com protocolo, status e resposta consultável. Pedir eliminação não exclui automaticamente usuários, lojas ou pedidos.
- Autorização por organização e função, hash Argon2id, cookies protegidos e logs sanitizados já existentes foram preservados.

## Inventário inicial e responsabilidades

| Dados                                     | Finalidade / papel                                           | Conservação e ação                                                                                         |
| ----------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Conta e vínculos da equipe                | Prestação do serviço; Pede Aqui controlador                  | Enquanto necessários à relação; avaliar encerramento e retenções justificadas                              |
| Pedidos, telefone, endereço e observações | Atendimento da compra; loja controladora, Pede Aqui operador | Definir com cada loja, considerando obrigações fiscais, consumeristas e defesa de direitos                 |
| Sessões, limites e eventos                | Acesso e prevenção de abuso                                  | Sessões e limites vencidos são removidos pela manutenção; definir prazo para demais eventos                |
| Aceites e solicitações                    | Prova de versão, atendimento de direitos                     | Acesso restrito; definir prazo justificado, sem conservação indefinida por padrão organizacional           |
| Push e mensageria                         | Avisos opcionais sobre o pedido                              | Consentimentos separados e revogáveis; assinaturas vencidas e eventos de notificação têm limpeza existente |
| Rascunho pessoal de checkout              | Continuidade do preenchimento                                | Aba atual, até 24 horas e limpeza manual                                                                   |

Não basear todo tratamento em consentimento. Contrato, obrigação legal e outras hipóteses precisam ser definidos por finalidade. Registrar a avaliação de legítimo interesse quando aplicável. Evitar dados sensíveis em campos livres.

## Atendimento de solicitações

1. Monitorar o e-mail e a fila diariamente, restringindo acesso ao responsável e substituto autorizado. Clientes sem conta usam o canal público e a loja; a fila autenticada não substitui esse atendimento.
2. Confirmar a identidade com informações mínimas e verificar o escopo. Não pedir senha, documentos completos ou dados excessivos. Separar dados próprios dos de terceiros.
3. Para dados de pedidos, acionar a loja controladora e registrar a instrução recebida. Verificar retenções legais antes de apagar ou anonimizar. Não executar exclusão em massa por uma solicitação individual.
4. Atender confirmação/acesso nos termos do art. 19: resposta simplificada imediata ou declaração completa em até 15 dias, conforme o caso. Aplicar os demais prazos pertinentes à natureza da solicitação; justificar limites e informar os meios de reclamação.
5. Registrar resposta e conclusão somente depois da ação efetiva. Revogação de consentimento não elimina obrigações independentes de conservação. Remover arquivos temporários de atendimento após o uso conforme a política aprovada.

Ferramenta de operação **apenas no servidor**, com credenciais restritas, depois de `pnpm api:build`:

```sh
pnpm --filter @cardapio/api privacy:requests list
pnpm --filter @cardapio/api privacy:requests show <protocolo> <arquivo-privado-novo.json>
pnpm --filter @cardapio/api privacy:requests respond <protocolo> <resposta.txt> IN_REVIEW
pnpm --filter @cardapio/api privacy:requests respond <protocolo> <resposta.txt> COMPLETED
```

`list` imprime somente protocolos, tipo, status e data. `show` escreve dados do solicitante em arquivo novo, modo 0600 em sistemas compatíveis; no Windows, use pasta com ACL restrita. Não salvar no repositório nem enviar aos logs. A resposta tem 10 a 2.000 caracteres e aparece ao titular; `DECLINED` exige justificativa escrita. O comando não envia e-mail nem apaga dados. Solicitações encerradas não podem ser sobrescritas por essa ferramenta.

## Providências da operação antes de ampliar o uso

- Aprovar tabela de retenção por finalidade e rotina de descarte/anonimização incluindo backups e fornecedores. A manutenção técnica existente não apaga automaticamente pedidos, contas, aceites ou solicitações.
- Configurar backups protegidos, acesso mínimo, periodicidade, retenção e testes de restauração. Não presumir que o plano de hospedagem já oferece todos esses controles.
- Formalizar contratos entre Pede Aqui, lojas e suboperadores, com instruções, confidencialidade, segurança e suporte a direitos. Revisar Railway, WhatsApp/Meta e serviços de mapa/CEP conforme o uso real.
- Na implantação Railway atual os serviços estão em Amsterdã. Verificar o mecanismo jurídico de transferência internacional e as garantias contratuais exigidas pela Resolução ANPD 19/2024. A publicação de uma política não substitui essas garantias.
- Manter registro das operações e um procedimento de incidentes com responsáveis, evidências, avaliação de risco, contenção e comunicações ao titular/ANPD quando exigidas pela Resolução 15/2024. Validar prazos e exceções aplicáveis ao caso.
- Revisar os textos com assessoria jurídica à luz dos contratos comerciais, consumidores atendidos e operação efetiva. Alterar a informação de região quando a hospedagem mudar.

Referências: [LGPD](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm), [direitos dos titulares — ANPD](https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados/direito-dos-titulares), [materiais e guia de cookies — ANPD](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes), [transferência internacional — Resolução 19/2024](https://www.gov.br/anpd/pt-br/acesso-a-informacao/institucional/atos-normativos/regulamentacoes_anpd/resolucao-cd-anpd-no-19-de-23-de-agosto-de-2024), [comunicação de incidentes — ANPD](https://www.gov.br/anpd/pt-br/canais_atendimento/agente-de-tratamento/comunicado-de-incidente-de-seguranca-cis).
