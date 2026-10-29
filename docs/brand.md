# Pede Aqui

**Menos cliques. Mais controle.**

Uma marca direta e acolhedora para simplificar a gestão de pequenos estabelecimentos. O nome aproxima o pedido do dia a dia; o slogan conecta praticidade ao resultado de gestão. A direção segue princípios de marcas maduras — clareza, consistência e reconhecimento em tamanhos pequenos — com símbolo e composição próprios.

## Sistema visual

| Uso                         | Cor       |
| --------------------------- | --------- |
| Floresta, fundos e texto    | `#123e34` |
| Esmeralda, ações e degradês | `#23785b` |
| Creme, superfícies          | `#f7f9f5` |
| Lima, detalhe e destaque    | `#c7ef9a` |

Manrope nos títulos e DM Sans nos textos. Fontes hospedadas em `public/fonts`, com as respectivas licenças OFL. O símbolo reúne a letra P, um balão de conversa e um ponto que sugere um novo pedido. Não usar a cor lima sozinha para texto sobre branco; manter contraste e não depender de cor para indicar estados.

O componente `Brand` centraliza a assinatura no produto. Os movimentos são breves, sem repetição automática, e respeitam `prefers-reduced-motion`. O estabelecimento continua com seu próprio nome e identidade no cardápio público.

## Arquivos

- `public/brand/pede-aqui-mark.svg`: símbolo vetorial original.
- `public/brand/pede-aqui-logo.svg`: assinatura horizontal; usa a fonte Manrope.
- `public/icon.svg` e `public/favicon.ico`: ícone do navegador; ICO com imagens de 16, 32, 48, 64, 128 e 256 px.
- `public/brand/apple-touch-icon.png`, `icon-192.png`, `icon-512.png`: atalhos e instalação.
- `public/brand/og-pede-aqui.png`: imagem social final, PNG **600 × 600**.
- `assets/brand/pede-aqui-og-source.png`: original da geração, preservado para manutenção.

Para regenerar os ícones a partir do símbolo: `node scripts/generate-brand-assets.mjs`. Não recria a arte social.

## Compartilhamento

O HTML inicial inclui Open Graph e Twitter Card, título, descrição, idioma, imagem e dimensões. O build aceita `PUBLIC_SITE_URL` ou `VITE_PUBLIC_SITE_URL` com a origem HTTPS pública para gerar uma URL absoluta da imagem. Na Railway, o blueprint usa `https://${{RAILWAY_PUBLIC_DOMAIN}}`; instalações existentes também podem derivar a origem diretamente do argumento `RAILWAY_PUBLIC_DOMAIN`, sem exigir nova aplicação da infraestrutura. Na Render, o Dockerfile recebe `RENDER_EXTERNAL_URL`. Em Docker próprio, configure `PUBLIC_SITE_URL` no arquivo de ambiente usado pelo Compose e refaça o build web. Sem origem pública, o desenvolvimento usa o caminho relativo.

Depois de publicar, confira o HTML sem executar JavaScript e o acesso público a `/brand/og-pede-aqui.png` com HTTP 200 e `Content-Type: image/png`. As propriedades estruturadas ficam depois de `og:image`, conforme o [protocolo Open Graph](https://ogp.me/). O `robots.txt` permite leitores de prévias nas páginas públicas e na pasta da marca; a restrição geral de indexação permanece. O WhatsApp pode manter uma prévia antiga em cache; a arte nova só fica disponível depois de publicar o novo build.

## Geração da arte social

Modo utilizado: ferramenta integrada `image_gen.imagegen`, com referência do símbolo em `public/brand/icon-512.png`. O original gerado foi preservado; a entrega foi reamostrada para 600 × 600 sem alterar a composição.

Prompt utilizado:

> Create a polished square 600 x 600 px social sharing / Open Graph card for the Brazilian restaurant-management software brand 'Pede Aqui'. Use the attached brand symbol faithfully: a rounded deep emerald square with a cream geometric letter P that forms a speech-bubble point, and a small pale lime notification circle at its upper right. Keep its identity and geometry recognizable. This is a premium, restrained brand identity composition inspired by the clarity and craft of mature SaaS brands, with an original layout. All text must be exact, crisp and professional in Brazilian Portuguese. Main wordmark, large: 'Pede Aqui'. Strong slogan, large and easy to read at WhatsApp thumbnail size, on two lines: 'Menos cliques.' and 'Mais controle.'. Secondary text, smaller: 'Cardápio, pedidos e gestão em um só lugar.'. Palette: deep forest #123e34, emerald #23785b, warm cream #f7f9f5, pale lime #c7ef9a. Beautiful very subtle layered emerald gradients, soft luminous mint light, thoughtful white space, clean rounded geometric sans-serif typography similar to Manrope, a few refined abstract curved shapes suggesting a conversation and a smooth workflow. Center-weighted composition, logo in upper part, generous 45 px minimum safe margins, slogan around middle; premium but friendly. Make everything legible on mobile. Flat graphic brand design with subtle dimensional lighting, no photos of food, no device mockups, no other brand logos, no badges, no watermarks, no tiny text. Square full bleed, opaque background. Output one finished image; prioritize perfect Portuguese text and consistent original logo.
