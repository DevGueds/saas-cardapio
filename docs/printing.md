# Comprovantes e impressão

No modo API, a gestão acessa **Impressão e comprovantes** no painel. Os documentos são emitidos nos detalhes do pedido (resumo, comanda de preparo e guia de entrega) e no histórico de recebimentos (incluindo avulsos e revertidos). Todos são **não fiscais**: não substituem documento fiscal, não confirmam liquidação bancária e imprimir não dá baixa no pedido.

## Configuração rápida

1. Adicione um perfil baseado no modelo ou escolha térmica/Bluetooth genérica de 58 ou 80 mm. A4 atende laser e jato de tinta. O limite é de oito perfis por loja.
2. Ajuste papel, largura útil, margem mínima, tamanho da letra e quantidade de vias. O perfil configura o documento, não altera fisicamente a impressora.
3. Escolha um perfil padrão por tipo de comprovante. A equipe pode escolher outro perfil na emissão.
4. Abra **Editar layout e logo**. O Editor.js permite texto simples, logo, linha divisória e seções preenchidas automaticamente. Há botões para subir/descer/remover blocos, sem exigir arraste. Seções obrigatórias, indicação não fiscal, identidade e situação do registro permanecem protegidas.
5. Use **Testar layout no perfil em edição** antes de salvar. O teste usa dados explicitamente fictícios, não cria pedidos nem pagamentos. Confirme o salvamento para aplicar os padrões a toda a equipe.

O logo aceita PNG/JPEG/WebP local até 5 MB, é normalizado para PNG e reduzido antes do envio. Nenhuma URL remota é consultada para imprimir. Textos rejeitam HTML e caracteres de controle. Layouts têm até 32 blocos; uma edição inválida impede salvar e permanece disponível para correção, inclusive ao alternar o tipo de documento. Configurações concorrentes retornam conflito em vez de sobrescrever silenciosamente.

## Saídas e compatibilidade

**PDF:** texto vetorial selecionável, fontes Noto Sans locais incorporadas (licença OFL), logo PNG e paginação real. Papel térmico usa páginas de até 280 mm de comprimento; A4 usa 210 × 297 mm. Conteúdo longo gera novas páginas identificadas. A prévia e o PDF usam o mesmo plano de posições e quebras. Símbolos ausentes na fonte são indicados pelo código Unicode, com aviso na interface, sem omissão silenciosa.

**Imprimir pelo sistema:** abre o diálogo do navegador/sistema com o documento preparado. Instale o driver ou serviço de impressão do fabricante. Escolha papel correto, escala de 100%, desative cabeçalhos/rodapés do navegador e mantenha **1 cópia no driver**: as vias configuradas já estão incluídas no documento. Fechar o diálogo ou gerar um arquivo não prova impressão física. Não há reenvio automático ou marcação de “impresso”.

**ESC/POS:** exportação `.bin` rasterizada em preto e branco por `@point-of-sale/receipt-printer-encoder`, para perfis de até 83 mm. Usar em um utilitário local que envie bytes RAW a impressora comprovadamente compatível. Corte e avanço só afetam esse arquivo. O padrão não corta papel e nunca abre gaveta. Antes de gerar, a interface exige confirmação da compatibilidade e mostra resolução, vias e corte. O navegador não envia bytes automaticamente, não abre porta TCP nem expõe um agente local de impressão.

**Bluetooth desconhecido:** pareie nas configurações do dispositivo e procure o driver/aplicativo do fabricante. Bluetooth sozinho não identifica ESC/POS nem compatibilidade com o navegador. No Android, é necessário um serviço de impressão compatível; no iPhone/iPad, o diálogo depende de AirPrint ou do aplicativo adequado. Web Bluetooth atende BLE/GATT e não é uma solução universal para impressoras Bluetooth clássicas. Esta etapa não implementa impressão direta por Web Bluetooth/Web Serial, ponte QZ Tray ou impressão silenciosa. PDF e impressão via sistema são os caminhos principais.

Referências oficiais: [impressão Android](https://support.google.com/pixelphone/answer/3473588?hl=en), [AirPrint](https://support.apple.com/en-ie/102895), [Web Bluetooth](https://developer.chrome.com/docs/capabilities/bluetooth), [Serial por Bluetooth](https://developer.chrome.com/blog/serial-over-bluetooth), [evento afterprint](https://developer.mozilla.org/en-US/docs/Web/API/Window/afterprint_event).

O catálogo inclui Epson TM-T20X/TM-T20III, Elgin i8/i9 Full, Bematech MP-4200 TH e Xprinter XP-58IIK/XP-Q80K, além de genéricos e personalizado. Cada perfil mostra a referência oficial e ressalvas da variante. Xprinter e genéricos ampliam as opções de entrada, sem promessa de preço ou homologação. Não houve teste em impressora física. Confira firmware, largura útil, densidade, conexão e driver no manual antes de usar ESC/POS; ESC/Bema e ESC/POS são modos diferentes.

## Valores e permissões

Todos os cálculos usam centavos inteiros. A API relê pedido, recebimentos e configurações em transação serializável, valida os snapshots persistidos e calcula saldo a partir de recebimentos válidos. Preços vêm do pedido salvo, mesmo após mudar o catálogo. Pagamento revertido aparece como **RECEBIMENTO REVERTIDO**, valor original e motivo; a reversão não comprova devolução ao cliente. Pedido cancelado tem saldo não cobrável, sem alegação de quitação. Emissão indica o momento da consulta; arquivos já baixados não mudam após reversões. Use **Atualizar situação registrada** para gerar novamente.

| Perfil                 | Configurar | Documentos                                                  |
| ---------------------- | ---------- | ----------------------------------------------------------- |
| Proprietário / gerente | Sim        | Todos                                                       |
| Caixa                  | Não        | Todos                                                       |
| Atendimento            | Não        | Pedido, preparo, entrega                                    |
| Cozinha                | Não        | Somente preparo, sem cliente, telefone, endereço ou valores |
| Entregador             | Não        | Somente entrega de pedidos atualmente atribuídos a ele      |
| Consulta               | Não        | Nenhum                                                      |

Autorização e isolamento de loja ocorrem no servidor, independentemente de botões visíveis. Templates nunca ampliam o acesso aos dados. Configurações ficam em `StorePrinting`, fora do cardápio público; a migration é aditiva (`202610240001_printing`). Não há histórico persistido de emissões, assinatura digital de documento ou spooler. O download contém os dados autorizados necessários à finalidade e deve ser tratado com o mesmo cuidado que o comprovante impresso.

## Segurança e manutenção

Rotas privadas GET/PUT `restaurants/:id/printing/settings`, GET `restaurants/:id/orders/:orderId/documents/:kind` e GET `restaurants/:id/payments/:paymentId/document`. Gravação exige CSRF, papel de gestão e revisão. O corpo da configuração tem limite de 512 KB; PNG é inline, com assinatura, estrutura e dimensões verificadas. Não se aceitam HTML, JavaScript, URLs de imagem, CSS, comandos ESC/POS arbitrários ou destino de rede fornecidos pelo usuário.

HTML de prévia tem sandbox sem scripts, CSP restrita e escape de textos. A CSP do frontend permite `data:` somente para imagens e fontes necessárias ao documento autocontido; scripts continuam restritos à própria origem. Geração é carregada sob demanda, com erros locais e recuperação; não usa comprovantes fictícios se uma consulta falhar. Fonte local tem timeout e retry explícito. PDF limita-se a 100 páginas incluindo vias; ESC/POS a 8 MB, com limites de canvas. Logs contêm apenas códigos e referências técnicas, nunca conteúdo do comprovante.

Testes em `tests/receipt-*`, `tests/api-e2e/printing.spec.ts` e `backend/test/{unit,integration}/printing.test.ts` cobrem layout/paginação, bytes ESC/POS, editor, valores, reversão, permissões, concorrência, adulteração e isolamento. Testes não enviam comandos a impressoras físicas.
