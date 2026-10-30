# Perfil, categorias e apresentação pública

## Conta pessoal

“Meu perfil e contato” fica na seleção de lojas e no menu administrativo. A pessoa pode alterar nome, celular e foto, incluindo remover a foto. Esses campos são privados da conta e não entram no cardápio público. A alteração de email exige a senha atual, limpa códigos antigos, reinicia o prazo de confirmação e encerra as outras sessões. Quando emails estão ativados, a interface encaminha a pessoa para confirmar o novo endereço. O telefone e a foto também entram na exportação privada de dados.

## Categorias

“Gestão do Cardápio → Categorias do cardápio” permite criar, renomear e excluir categorias independentemente de criar produtos. Nomes são únicos após normalização; exclusão exige mover ou remover os produtos primeiro. Operações exigem permissão de catálogo, CSRF e revisão atual no servidor. Produtos, combos, adicionais, promoções e regiões já possuíam edição e exclusão; esses fluxos foram preservados.

## Endereço e horários

“Configurações → Sobre a sua loja” oferece endereço livre com complemento e seleção do ponto físico pelo mapa, localização do dispositivo ou coordenadas. Confirmar o ponto é uma ação explícita. Isso não altera o ponto de saída nem as regras de cálculo de frete.

O cardápio mostra “Onde estamos”, com endereço, mapa carregado somente após solicitação e link para aplicativo de mapas. “Horários de funcionamento” é uma seção expansível, com os sete dias, indicação de hoje, múltiplas faixas e exceções do dia. A programação continua sendo editada em “Horários da loja”; cálculo de disponibilidade permanece no servidor.

## Convite de compartilhamento

“Compartilhar cardápio” permite definir título, mensagem e formato preferido, copiar o link e alternar prévias de WhatsApp, Facebook, LinkedIn e X. A interface usa termos comuns. Prévias são ilustrativas; plataformas podem cortar ou abreviar conteúdo e manter cache próprio. O Instagram tem instrução específica para link na bio/stories.

- Formato padrão: PNG de **600×600** gerado por loja.
- Alternativa: PNG em paisagem de **1200×630**.
- Fotos opcionais por formato: PNG/JPEG/WebP, **até 5 MiB por arquivo**, decodificadas e verificadas no servidor; limite de 40 megapixels e tempo de processamento limitado.
- O processamento normaliza orientação, recorta ao centro e remove metadados do arquivo original. Imagens remotas não são baixadas pelo servidor.
- Sem foto, o servidor gera uma imagem com título e mensagem; campos vazios usam nome/descrição da loja.
- O HTML inicial de `/menu/:slug` contém os metadados sociais; a configuração Caddy injeta somente HTML escapado da API no shell confiável. Texto de cliente nunca pode introduzir ações de template.
- A origem canônica vem de `CORS_ORIGINS` (primeira origem pública), sem confiar no cabeçalho Host. Imagens usam URLs HTTPS com a revisão do cardápio.
- O shell para Caddy é preparado por `scripts/prepare-menu-shell.mjs` nos builds Docker/Railway/Render. O servidor Vite de desenvolvimento não faz essa injeção de HTML; valide essa camada com `node scripts/test-social-shell.mjs` após um build.

As colunas novas são opcionais e preservam dados existentes. A migration `20261030150000_profile_and_menu_sharing` precisa ser aplicada pelo serviço de migrations antes das novas APIs. Réplicas não executam DDL ao iniciar.
