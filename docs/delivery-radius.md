# Entrega por bairro e por raio

Em **Entregas e retirada**, a loja escolhe uma política de frete: taxa única, cidade/bairro ou raio. A retirada sempre tem frete zero. As políticas inativas permanecem cadastradas para facilitar a troca, mas não são somadas.

## Por cidade e bairro

O cliente escolhe cidade e bairro dentre as regiões ativas. A taxa e o total são recalculados ao mudar a seleção. A busca opcional por CEP preenche o endereço e seleciona uma região quando estado, cidade e bairro correspondem ao cadastro, com normalização de acentos e maiúsculas. O cliente confere rua, número e complemento. Não há inferência de bairro a partir de texto livre nem garantia de endereço exato por CEP.

Respostas de CEP são descartadas se o cliente mudar o CEP, endereço, cidade, bairro, modalidade ou revisão do cardápio enquanto aguarda. O servidor rejeita bairros removidos, inativos ou de outra loja.

## Por raio

1. O gerente confirma o ponto de saída da loja no mapa, por GPS ou por coordenadas.
2. Cadastra até 20 faixas, cada uma com limite máximo entre 0,001 e 100 km e preço fixo em reais. Os limites são diferentes e ordenados. A taxa não se acumula nem é multiplicada pela distância.
3. Salva para publicar. Ativar o modo sem origem ou sem faixas é rejeitado.
4. No checkout, o cliente preenche o endereço e confirma o ponto correspondente. O GPS só é solicitado ao clicar; sua precisão estimada é exibida para revisão. O CEP não é usado silenciosamente como coordenada exata de cobrança.
5. O servidor calcula a distância em linha reta e aplica a primeira faixa cujo limite inclua o ponto. Fora do maior raio, não há entrega. A retirada continua disponível se habilitada.

As coordenadas são normalizadas para seis casas decimais. A biblioteca [geolib](https://github.com/manuelbieh/geolib) calcula a distância, arredondada ao metro inteiro mais próximo. Por exemplo, com faixas até 2.000 m por R$ 5,00 e até 5.000 m por R$ 8,00, uma distância calculada de 2.000 m custa R$ 5,00; 2.001 m custa R$ 8,00. Isso é **raio em linha reta**, sem cálculo de trajeto, trânsito, barreiras geográficas ou quilometragem pelas ruas. A loja deve configurar uma área compatível com sua operação.

Dinheiro permanece em centavos inteiros. A conversão de quilômetros digitados usa metros inteiros, com no máximo três casas decimais. Promoções são aplicadas depois da definição do frete e seguem as regras em [finance.md](finance.md).

## Sincronização e histórico

Mudar o ponto ou endereço invalida a confirmação e a cotação anterior. O resumo fica sem total confirmado até receber uma nova cotação. Respostas antigas de cotação não substituem a localização atual. A criação do pedido recalcula os valores no servidor e verifica revisão e total esperado; campos de taxa/distância forjados pelo navegador são rejeitados.

O pedido guarda origem, destino, distância, limite da faixa e taxa usados na criação. Alterar as faixas depois não modifica pedidos existentes. Cozinha e visualização recebem dados sem coordenadas do cliente. O painel público continua expondo somente os campos necessários ao acompanhamento.

## Docker local

Sem HTTPS, navegadores em celulares pela rede local geralmente não permitem GPS. A seleção pelo mapa e por coordenadas funciona no acesso HTTP. Em localhost ou após configurar HTTPS, o botão de localização automática fica disponível conforme o navegador. Sem carregamento dos mapas, as coordenadas continuam sendo uma alternativa. Nenhuma chave de geocodificação paga é necessária.

O ponto informado pelo cliente deve corresponder ao endereço; este recurso não verifica a identidade do local nem substitui a conferência operacional de endereços pelo restaurante.
