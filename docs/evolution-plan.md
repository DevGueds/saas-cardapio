# Evolução do cardápio — entregas verificáveis

As três etapas estão implementadas. A operação local inclui frontend, duas APIs, MySQL, Redis, Evolution API e PostgreSQL do provedor. O número do estabelecimento precisa ser pareado pelo responsável; Web Push em celulares externos depende de HTTPS.

## Etapa 1: caixa, relatórios e resiliência

- Recebimentos manuais integrais, parciais e avulsos em centavos inteiros, com confirmação, transações, idempotência e saldo calculado no servidor. Reversão restrita ao gerente/proprietário, com motivo e autoria preservados; não representa estorno bancário.
- Relatórios por período: pedidos/cancelamentos, vendas, descontos, frete, saldo, recebimentos, reversões, métodos e totais diários. PDF com texto/tabelas selecionáveis e paginação via jsPDF + AutoTable. O quadro real leva ao relatório; o demo exporta um PDF explicitamente fictício.
- React-Toastify para notificações animadas; erros persistentes permanecem próximos da ação/campo. react-error-boundary isola renderização em áreas, navegação, cartões e checkout. Operações assíncronas continuam usando Result e helpers com recuperação.
- Pino no terminal e arquivos com rotação por tamanho/dia e retenção limitada. Códigos, localização segura e identificadores de diagnóstico; sem payloads, credenciais ou mensagens arbitrárias de exceção.
- Confirmações para fechamento, recebimentos, reversão, cancelamento e exclusões; ações operacionais comuns continuam diretas.

Operação, permissões, extensão para gateway e limites: [finance.md](finance.md).

## Etapa 2: adicionais, modelos e QR Codes

- Grupos de adicionais reutilizáveis, vínculo a produtos, opções/preços, disponibilidade, quantidade por opção e mínimo/máximo por grupo. Gerente administra em formulário com rascunho; cliente personaliza antes de adicionar ao carrinho.
- Cotação/checkout revalidam opções e preços; itens já registrados guardam snapshots. Vínculos impedem remover produtos usados. Adicionais do produto e escolhas dos combos têm regras próprias.
- Três modelos com quatro paletas, controle de fotos, mensagem e prévia com produtos cadastrados. Logo/capa vêm das configurações. Reutilização dos componentes do cardápio e publicação versionada.
- qr-code-styling: três modelos, logo opcional, PNG/SVG, alta correção de erro e margem de leitura. Compartilhamento do link. Testes decodificam os arquivos exportados com logo usando jsQR.

## Etapa 3: painel público e comunicação

- Painel TV/celular com link revogável e QR Code, somente número/etapa/horário. Pedidos ativos das últimas 24 horas, limite de 500 explícito.
- SSE com RxJS e Fetch Event Source. Uma consulta compartilhada por loja/link/réplica a cada dois segundos, snapshot inicial e deltas. Banco compartilhado permite observar alterações feitas em qualquer réplica. Heartbeats, reconexão, nova sincronização, encerramento de clientes lentos e limites próprios.
- Store normalizada com useSyncExternalStore, referências estáveis e cartões memoizados. Testes verificam que alterar um pedido não notifica os assinantes dos demais.
- Caixa de notificações com permissões, leitura persistente e React-Toastify. Web Push via service worker/VAPID, permissão por clique, renovação/revogação e remoção de endpoints expirados. Inscrições cifradas; as da equipe dependem de sessão e permissão ainda válidas.
- Evolution API autohospedada no Docker, adaptador desacoplado e pareamento pela interface. Consentimento explícito/revogável e eventos de pedido/pagamento/reversão persistidos transacionalmente. Fila compartilhada, verificação de consentimento no envio e tentativas limitadas. Resultado incerto de WhatsApp não é reenviado automaticamente.

Operação e detalhes: [menu-and-channels.md](menu-and-channels.md). Testes automatizados não fazem envio a telefones reais nem substituem homologação em aparelhos físicos. Não há gateway financeiro nem publicação em um domínio externo. Os limites e as estratégias de recuperação estão documentados; não há alegação de software imune a todo erro.

## Referências

Referências de fluxo, sem reprodução de identidade visual: [Anota AI — cardápio digital](https://anota.ai/home/funcionalidade/cardapio-digital/), [WhatsMenu — operação, adicionais e caixa](https://whatsmenu.com.br/videoaulas/) e [cadastro de complementos](https://blog.whatsmenu.com.br/cardapio-no-whatsmenu-facil-de-fazer-e-super-completo/amp/).

Bibliotecas: [React-Toastify](https://fkhadra.github.io/react-toastify/), [react-error-boundary](https://github.com/bvaughn/react-error-boundary), [Pino](https://github.com/pinojs/pino), [jsPDF-AutoTable](https://github.com/simonbengtsson/jsPDF-AutoTable), [QR Code Styling](https://github.com/kozakdenys/qr-code-styling), [Fetch Event Source](https://github.com/Azure/fetch-event-source), [Web Push](https://github.com/web-push-libs/web-push) e [Evolution API](https://github.com/EvolutionAPI/evolution-api).