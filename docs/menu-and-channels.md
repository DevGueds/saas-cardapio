# Adicionais, aparência e comunicação

## Operação do gerente

Em **Adicionais e extras**, crie grupos reutilizáveis, cadastre opções/preços, limite quantidades, defina mínimo/máximo e vincule produtos. Mínimo zero torna a escolha opcional. Disponibilidade da opção e ativação do grupo são independentes. O rascunho sobrevive à recarga; exclusão exige confirmação. O servidor recalcula centavos e valida os vínculos, a disponibilidade e a revisão antes de registrar o pedido. Pedidos antigos guardam seus itens/preços originais. Adicionais avulsos pertencem aos produtos; combos mantêm seus próprios grupos de escolhas.

Em **Aparência e QR Code**, escolha Clássico, Vitrine ou Compacto, uma das quatro paletas, fotos e mensagem de abertura. A prévia usa produtos reais. A publicação versionada evita sobrescrever alterações de outro gerente. Logo e capa vêm de Configurações. Os modelos reutilizam os componentes do cardápio e aceitam somente opções validadas, sem HTML personalizado.

QR Codes são gerados por `qr-code-styling`, com três modelos, logo opcional, correção H e margem de leitura. Exporte PNG de 800 px ou SVG vetorial e compartilhe o link. Se o logo remoto não permitir carregamento, envie a imagem nas Configurações ou desative-o. Confira o endereço antes de imprimir: `localhost` só funciona no próprio computador.

## Painel público em TV ou celular

Em **Painel ao vivo e mensagens**, habilite o painel e escolha TV ou celular. Abra/compartilhe o link ou seu QR Code. Na mesma rede do Docker, informe `http://IP-DO-COMPUTADOR:8080`; fora dela será necessário um endereço publicado. O seletor de modo mantém a chave de acesso. Tela cheia depende do suporte do navegador.

O painel mostra somente número, horário e etapa dos pedidos ativos das últimas 24 horas. Não transmite nomes, contatos, itens, notas, valores ou tokens de acompanhamento. São exibidos os 500 mais antigos, com aviso caso haja mais. Concluídos/cancelados saem do painel. O gerente pode desativar o painel ou invalidar todos os links anteriores; conexões abertas são revalidadas a cada atualização.

O transporte é SSE com `@microsoft/fetch-event-source` e RxJS no servidor. Cada réplica compartilha uma consulta ao banco por loja/link a cada dois segundos; o cliente recebe snapshot inicial e depois somente alterações. Isso funciona entre réplicas porque a origem é o banco compartilhado. Não depende de afinidade de sessão. Heartbeats, detecção de silêncio em 20–25 segundos, reconexão e novo snapshot recuperam interrupções. A interface sinaliza dados possivelmente desatualizados. O limite é 32 grupos e 128 conexões por réplica; conexões lentas são encerradas para não acumular memória.

No React, uma store normalizada com `useSyncExternalStore` e cartões memoizados preserva referências dos pedidos inalterados. Só os assinantes dos IDs/colunas alterados são notificados; metadados da conexão são separados. Esse comportamento tem teste específico. O painel administrativo existente continua com atualização periódica e ação manual de atualizar.

## Notificações na aplicação e Web Push

O sino do painel mostra os eventos autorizados para o perfil, permite marcar como lidos e apresenta novos eventos com React-Toastify. Caixa/proprietário/gerente podem ver pagamentos; cozinha não recebe informação financeira; entregador só recebe seus pedidos atribuídos. A consulta ocorre a cada oito segundos e ao voltar à janela. Erros locais e mensagens de validação continuam próximos da ação, com um toast resumido.

**Ativar ou renovar alertas** pede permissão ao navegador após clique. Service worker e `web-push` usam VAPID. Funciona em navegadores compatíveis no Windows, macOS, Android e iOS/iPadOS; nestes últimos, abra o site instalado na Tela de Início. Permissão do usuário, suporte do navegador e entrega pelo serviço de push continuam necessários. Não há um aplicativo nativo separado.

Para celulares acessando por IP HTTP, Web Push fica indisponível. Conforme a configuração escolhida para esta entrega, Docker permanece local; as chaves VAPID e o worker já estão preparados para HTTPS. No ambiente publicado: mantenha a mesma chave privada, defina um `VAPID_SUBJECT` de contato real, configure HTTPS e origens autorizadas, sirva `notifications-sw.js` na raiz/base da aplicação sem cache e siga a configuração de produção em [backend.md](backend.md). Alterar as chaves exige renovar inscrições. Não é necessário pedir permissão novamente por simples reinício dos containers.

Inscrições duram até 30 dias e são renováveis. As da equipe também dependem da sessão autenticada ainda válida: logout, expiração e retirada de permissão bloqueiam novos envios. Após entrar novamente, renove os alertas. As do cliente exigem o token privado do pedido. Endpoints ficam cifrados com AES-GCM, são aceitos apenas de provedores de push conhecidos e são removidos quando expirados. Desativar alertas remove somente o vínculo daquele pedido/loja; não desliga outros vínculos do navegador.

## WhatsApp automático local

O Compose inclui **Evolution API 2.3.7** com PostgreSQL dedicado e Redis isolado por base/prefixo. A imagem está fixada por digest. O adaptador usa a integração Baileys, autohospedada, sem contratação de um serviço pago. A API da aplicação é o único intermediário entre interface e provedor; sua chave não vai ao navegador. Evolution escuta somente em `127.0.0.1:8081` no host.

1. Entre em **Painel ao vivo e mensagens → Conectar número da loja**.
2. No WhatsApp desse estabelecimento, use **Aparelhos conectados → Conectar aparelho** e leia o QR de pareamento.
3. Clique em **Verificar conexão** e ative os envios automáticos, confirmando a alteração.
4. O cliente precisa concordar no checkout ou no acompanhamento. A preferência inicia desmarcada e pode ser revogada pelo acompanhamento.

Cada loja tem sua própria instância. São enviados eventos de pedido, pagamento e reversão, sem endereço, itens ou valores na mensagem. Histórico de mensagens/contatos e telemetria do provedor estão desabilitados. A conectividade depende do aparelho/conta e do protocolo do WhatsApp: a porta `WhatsappProvider` permite substituir Evolution por Cloud API oficial posteriormente. Pareamento exige o telefone do estabelecimento; testes automatizados não enviam mensagens a números reais.

Eventos são gravados na mesma transação do pedido/pagamento (outbox). Workers das duas APIs reivindicam registros no banco e usam unicidade por evento/canal/destinatário. Antes de enviar, verificam novamente consentimento, canal, tenant, sessão e permissões. Uma alteração de consentimento não cria mensagens retroativas. Eventos com mais de 24 horas não são enviados.

Push tem até cinco tentativas com espera crescente e elimina endpoints 404/410. No WhatsApp, verificações de conexão podem ser repetidas antes de tentar uma mensagem. Depois de um envio com resultado incerto (timeout, conexão perdida ou resposta inválida), a entrega fica **Sem confirmação**, sem repetição automática. Isso evita duplicar mensagens quando o provedor aceitou a primeira tentativa. Consulte o número conectado antes de contatar o cliente. “Aceito pelo serviço” não é recibo de leitura. Revogação impede envios futuros; não recolhe uma mensagem que já foi aceita pelo provedor.

`pnpm api:maintenance` remove inscrições expiradas e eventos/entregas com mais de 30 dias. Pedidos e pagamentos continuam preservados. Os logs próprios contêm códigos e referências técnicas seguras, nunca conteúdo de mensagens ou endpoints de push. Logs do provedor são reduzidos a erros e têm rotação no Docker.

## Ambiente e validação

`pnpm setup:local` gera chaves VAPID, chave do Evolution e senha do PostgreSQL sem substituir valores existentes. O `.env` não é versionado. Variáveis: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `EVOLUTION_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_DATABASE_PASSWORD`, `DOCKER_CORS_ORIGINS` e `WEB_BIND_ADDRESS`. As duas últimas controlam acesso da rede local; o setup mantém loopback por padrão. Para celular, execute `pnpm setup:lan --host <IP-DO-COMPUTADOR>` e `pnpm docker:up`. Se o IP mudar, repita os comandos com o novo endereço. Firewall/rede precisam permitir a porta 8080. Para restringir novamente ao computador, use `WEB_BIND_ADDRESS=127.0.0.1`.

Migrations são explícitas em `pnpm docker:up`; MySQL continua sendo o banco da aplicação e PostgreSQL atende somente ao provedor. `pnpm docker:down` preserva todos os volumes. Não remova volumes para resolver problemas de configuração.

Os testes de integração usam banco `_test`: preços/revisões, SSE real, deltas, revogação de conexão ativa, privacidade, consentimento, cifragem, permissões, logout e resultados incertos da fila. Playwright percorre o cadastro/seleção de adicionais, publicação, decodifica os três PNGs com logo usando `jsQR`, testa reconexão do painel e registra telas em 320 px. Não substituem homologação do telefone do estabelecimento nem testes em dispositivos físicos de cada sistema operacional.

Referências: [Evolution API](https://github.com/EvolutionAPI/evolution-api), [Web Push](https://github.com/web-push-libs/web-push), [WebKit — push em apps na Tela de Início](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [Fetch Event Source](https://github.com/Azure/fetch-event-source), [QR Code Styling](https://github.com/kozakdenys/qr-code-styling).

### Regressões de rede e leitura

O painel sinaliza perda de rede imediatamente, mantém as etapas já recebidas com aviso e aguarda conectividade antes de retomar o stream. A assinatura é cancelada ao sair da tela; reconectar busca um novo snapshot autorizado.

Os três modelos de QR Code mantêm marcadores centrais sólidos e margem branca suficiente para pelo menos quatro módulos, conforme a [orientação da DENSO WAVE](https://www.qrcode.com/en/howto/code.html). Os testes decodificam PNGs exportados com logo e endereço por IP; leitura em câmera física depende também de iluminação, foco e tamanho de impressão.
