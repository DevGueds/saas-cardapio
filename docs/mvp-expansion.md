# Combos, promoções, entregas e equipe

## Operação da loja

1. Cadastre os produtos normalmente. Em **Combos e promoções**, crie um combo com nome, descrição, foto e preço próprio; inclua produtos fixos e/ou grupos com uma escolha obrigatória. Cada opção pode ter adicional. O preço do produto individual não é somado ao preço do combo.
2. Um item fixo indisponível ou um grupo sem opção disponível bloqueia o combo. Produtos referenciados por combos não podem ser excluídos; ajuste o combo primeiro. Pedidos já registrados preservam a composição e os valores originais.
3. Em **Promoções**, escolha porcentagem inteira, valor em reais ou entrega grátis. Configure início/fim, mínimo de itens, teto opcional, inclusão de combos e limite total de usos. Código vazio significa promoção automática; código preenchido exige cupom no checkout. Um benefício por pedido: sem cupom, ganha o maior desconto válido. Não existe acúmulo.
4. O contador de uso é do servidor e não pode ser editado. Pedido e consumo do cupom são gravados juntos. Duas compras disputando o último uso não ultrapassam o limite. Cancelamentos não devolvem usos. Alterar a campanha não zera o contador; para outra campanha, crie uma nova.
5. Em **Entregas e retirada**, escolha taxa fixa ou taxa por cidade/bairro, mantenha ao menos uma modalidade ativa e configure previsão de retirada. Cada região tem UF, cidade, bairro, taxa, prazo e disponibilidade. Ao adicionar/editar bairros, **Salvar entregas** publica toda a lista. Regiões pausadas não são oferecidas no checkout.
6. O cliente escolhe a modalidade e a região, vê frete/desconto/total e informa contato/endereço. A API recalcula tudo, verifica revisão e disponibilidade e rejeita um total desatualizado. O mínimo da loja considera os itens antes de desconto e frete. Troco deve cobrir o total final.

Limites explícitos: até 100 combos, 20 itens fixos, 8 grupos por combo, 20 opções por grupo; até 500 regiões. São limites técnicos de proteção, não planos comerciais. Consulte os schemas para limites de campos e campanhas.

## Mapa e CEP

Leaflet usa tiles OpenStreetMap apenas após **Ver mapa de referência**, com atribuição visível, sem prefetch/download de área. `MAP_TILE_URL` permite outro provedor de tiles compatível com dados OSM e sua política de atribuição; não coloque segredos no template, pois ele é público. O endpoint público da OSM não oferece SLA: para tráfego comercial intenso use hospedagem/provedor de tiles adequado. Não há Nominatim público nem busca de endereço a cada tecla.

**Buscar CEP** chama o backend, que consulta BrasilAPI CEP v2 em host fixo, valida a resposta, limita consultas e guarda cache de 24 horas. Número e complemento continuam manuais. Coordenadas podem estar ausentes. O frete vem da região cadastrada, nunca da API de mapas nem de coordenadas enviadas pelo cliente. O restaurante deve conferir que o endereço informado pertence à região. Falha de mapa/CEP não bloqueia o preenchimento manual; nenhuma região é inventada para aceitar o pedido.

Não há cálculo de distância, roteirização nem rastreamento ao vivo do entregador. O mapa mostra apenas uma referência da região; as etapas do pedido são informadas pela equipe.

## Pedidos e acesso da equipe

Fluxo de entrega: recebido → em preparo → pronto → saiu para entrega → concluído. Retirada: recebido → em preparo → pronto para retirar → concluído. Cancelamento antes da saída. Atribua um entregador ativo nos detalhes antes de despachar; um entregador só vê os pedidos atribuídos a ele. O gerente/caixa pode operar a entrega diretamente, sem exigir cadastro de entregador no MVP.

| Perfil              | Catálogo/ofertas/entregas | Pedidos                                           | Equipe     |
| ------------------- | ------------------------- | ------------------------------------------------- | ---------- |
| Proprietário        | Gerencia                  | Todas as operações                                | Gerencia   |
| Gerente             | Gerencia                  | Todas as operações                                | Sem gestão |
| Caixa / atendimento | Consulta                  | Recebe, cancela, atribui e movimenta              | Sem gestão |
| Cozinha             | Consulta                  | Itens e observações; inicia preparo/marca pronto  | Sem gestão |
| Entregador          | Consulta                  | Só os atribuídos; saída/conclusão                 | Sem gestão |
| Consulta            | Consulta                  | Leitura sem dados pessoais/observações do cliente | Sem gestão |

`STAFF` antigo equivale a caixa. Cozinha recebe nome genérico e não recebe telefone, endereço ou troco; conserva observações de preparo. Permissões são revalidadas no servidor em toda operação; esconder botões não concede segurança. O vínculo é com a organização e vale para suas lojas. Para granularidade por unidade, crie uma nova política de escopo.

O membro usa **Cadastro de equipe**, sem criar loja. Depois o proprietário associa seu e-mail e papel em **Equipe e permissões**. A conta precisa existir; não são enviados convites ou e-mails. Reinformar o e-mail permite alterar o perfil. Revogação bloqueia as próximas operações. O proprietário não pode remover ou rebaixar o próprio vínculo por essa tela.

## Acompanhamento e envio sem duplicação

Cada pedido recebe link com token opaco no fragmento da URL (`#...`), enviado ao backend somente no header `X-Order-Token`. É um segredo de consulta: quem tem o link pode ver itens, totais e etapas, sem nome, telefone ou endereço do cliente. O banco guarda hash e expiração de 30 dias. Não registrar token, fragmento, idempotency key ou URL de WhatsApp em logs/analytics.

A consulta atualiza a cada 15 segundos enquanto a página está visível, ao voltar para ela e por botão. Recebimento no sistema não significa aceitação/pagamento. Abrir WhatsApp é opcional e não confirma nada automaticamente.

A chave UUID de uma tentativa e seu hash sobrevivem ao reload. Antes de repetir um envio, o cliente consulta o recibo dessa chave. Se o servidor já gravou, recupera o mesmo pedido e o link. **Recuperar envio anterior** funciona mesmo com carrinho inválido ou loja fechada; preserva o formulário e permite limpar os itens explicitamente depois da conferência. Se os dados foram alterados durante uma falha incerta, mantém o carrinho e pede revisão. A ação de liberar outra tentativa é explícita e orienta confirmar com a loja antes, pois uma resposta perdida não significa pedido inexistente.

## Persistência Redux e privacidade

`DraftManager` é a porta; `redux-drafts.ts` usa Redux Toolkit e um adaptador de armazenamento. React assina o estado com `useSyncExternalStore`. Cada alteração é gravada sincronicamente antes de mostrar “salvo”; não depende do evento de fechar/minimizar o navegador.

- Rascunhos de escolhas de combo, carrinho, checkout, produto, combo, promoção, configurações e regiões duram 24 horas desde a última edição. Ficam isolados por modo, loja e usuário administrativo. A URL reabre editores de produtos/ofertas e o carrinho após reload.
- Rascunhos expirados são excluídos na próxima inicialização. O navegador fechado não executa limpeza programada. Carrinho e formulário não são enviados ao servidor até a ação do usuário.
- Campos incompletos (como `1,`) e acentos são preservados. Fotos novas ficam em memória e precisam ser selecionadas novamente após reload; a interface avisa. URLs/imagens já gravadas na loja continuam no servidor.
- Senha, cookie de sessão, CSRF e imagens base64 não entram no Redux persistido. Dados de endereço/contato do checkout ficam neste navegador: não use dispositivo compartilhado sem descartar o rascunho.
- Logout, alteração de senha e expiração de sessão limpam rascunhos administrativos. Falha/quota de armazenamento mantém o texto em memória e exibe aviso; não afirma sucesso. JSON corrompido exige descarte explícito.
- Detecta versões diferentes do mesmo rascunho observadas entre abas e avisa sem substituir o texto em edição. O armazenamento de rascunhos não é transacional entre processos; a revisão e a transação do servidor são a proteção definitiva de gravações comerciais.
- Os últimos dez links de pedido são guardados por até 30 dias, separados por loja. **Esquecer links** permite removê-los. Não são prova de identidade nem autenticação administrativa.

## Validação

Testes de domínio cobrem composição, seleção inválida, produto esgotado, cupom, frete, mínimo e troco. Testes Redux cobrem reload, Unicode, listas vazias, expiração, separação, quota, corrupção e conflitos. Integração MySQL verifica consumo concorrente de promoção, snapshots, idempotência, isolamento, papéis e atribuição. Playwright percorre formulários após reload, compra de combo/cupom/bairro, mapa indisponível, resposta perdida, acompanhamento e acesso de cozinha, além dos fluxos anteriores.

Referências de comportamento: [Anota AI](https://anota.ai/ajuda/promocoes-e-cardapio-digital/), [WhatsMenu](https://blog.whatsmenu.com.br/primeiros-passos/). Referências técnicas: [política de tiles OSM](https://operations.osmfoundation.org/policies/tiles/), [BrasilAPI](https://brasilapi.com.br/docs), [Redux](https://redux.js.org/usage/writing-tests).
