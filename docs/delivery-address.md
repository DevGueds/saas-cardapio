# Endereço e preenchimento assistido

O checkout separa rua, número, complemento, bairro, cidade, UF, CEP e referência. Rua, número, bairro, cidade e UF são obrigatórios para entrega. **Sem número** exige uma referência que identifique a entrada. **Apartamento ou condomínio** exige complemento. CEP é opcional para permitir áreas rurais e preenchimento manual durante indisponibilidade da consulta.

As mesmas regras portáteis são aplicadas nos campos React, no contrato HTTP e no domínio que cria o pedido. O servidor monta o texto do entregador a partir dos campos validados; o texto livre enviado pelo navegador não é fonte de verdade. Retirada dispensa endereço e remove esses dados do pedido. Pedidos históricos continuam legíveis; rascunhos antigos mostram o texto anterior para o cliente distribuir nos novos campos, sem adivinhação automática.

## Assistência sem bloquear o usuário

- CEP válido é consultado ao sair do campo ou pressionar Enter. O botão **Buscar CEP** permite repetir a busca. Não há consulta a cada tecla, no carregamento do rascunho ou enquanto o CEP está incompleto.
- [BrasilAPI CEP v2](https://brasilapi.com.br/docs) é a fonte primária. [ViaCEP](https://viacep.com.br/) é a alternativa quando a primeira fonte falha. Ambas dispensam chave. As consultas passam pelo backend, com timeout, limite de concorrência, circuitos independentes e limites por IP/provedor. Respostas verificadas ficam em cache por 24 horas. CEP divergente, formato inválido e respostas corrompidas não são usados.
- O resultado preenche apenas rua e região. Nunca presume número, apartamento ou entrada. O complemento de logradouro do provedor (ex.: lado ímpar) não é um apartamento e não é copiado. CEP genérico pode não fornecer rua/bairro: os campos permanecem disponíveis para revisão manual.
- O cliente pode continuar preenchendo durante a busca. Se mudar o endereço, CEP, modalidade, região ou revisão do cardápio, uma resposta antiga é descartada. Fechar o formulário também impede sua aplicação. Uma falha mostra orientação e preserva os dados.
- O cadastro de bairros reutiliza a mesma busca e proteção contra respostas atrasadas. A consulta não bloqueia o botão de salvar caso os campos já estejam completos.
- Nome, telefone e endereço usam os atributos HTML de [autocomplete](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/autocomplete), com grupos distintos para cliente e loja. Login e cadastro distinguem usuário, senha atual e nova senha. A oferta de dados salvos depende do navegador e da configuração da pessoa. O sistema não guarda cartão nem consulta CPF/CNPJ.

## Frete, privacidade e compatibilidade

Em entrega por bairros, bairro/cidade/UF seguem a região escolhida. O servidor exige correspondência normalizada entre endereço e região cobrada. Um CEP não atendido limpa a seleção anterior. Em entrega por raio, todos os campos obrigatórios precisam estar válidos antes de confirmar o ponto. Alterar qualquer parte do endereço invalida a confirmação e exige nova cotação. Veja [delivery-radius.md](delivery-radius.md).

O endereço estruturado e a versão legível ficam no snapshot do pedido. Detalhes internos e mensagem de WhatsApp incluem complemento e referência. Cozinha e visualização não recebem o endereço estruturado; o painel público mantém seu contrato reduzido. Logs não incluem endereços, CEP consultado ou payloads dos provedores.

**Limite:** validar a estrutura e consultar CEP não comprova a existência do imóvel nem verifica que o ponto no mapa corresponde ao endereço. O cliente confirma o local e o restaurante mantém sua conferência operacional. Sem HTTPS na rede local, continuam disponíveis endereço manual e mapa/coordenadas; GPS e push dependem das permissões do navegador e de contexto seguro.

## Verificação

Testes cobrem validação por campo, referência e complemento condicionais, retirada, histórico, endereço derivado no servidor, correspondência da região, privacidade, indisponibilidade/fallback/cache de CEP, respostas atrasadas e submissão acessível. Os fluxos de navegador verificam persistência do rascunho, bairros, alteração de número com invalidação do frete e entrega real na API.
