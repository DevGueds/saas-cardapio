# Segurança e verificação em duas etapas

## Uso pela equipe

Em **Proteção da minha conta**, informe a senha, adicione o QR Code ao aplicativo autenticador e confirme um código de seis dígitos. A chave manual permite configurar no mesmo celular. A ativação só ocorre após essa confirmação. Guarde os dez códigos de recuperação: aparecem uma única vez, não são gravados no navegador e cada um funciona uma vez.

Proprietário e gerente acessam **Segurança da equipe**. A regra geral exige MFA nas lojas da organização; cada pessoa pode seguir essa regra, ter exigência permanente ou ser dispensada. Mudanças pedem confirmação e a senha atual. Para começar a exigir, a pessoa responsável precisa já ter ativado seu próprio autenticador. Gerentes não podem mudar individualmente a regra do proprietário.

**Retirar uma exigência não apaga a proteção pessoal.** Uma pessoa pode pertencer a várias organizações. Uma loja não consegue desativar uma proteção exigida por outra. Depois de dispensada em todas as organizações que a exigiam, a própria pessoa pode desativar MFA com senha e código atual ou de recuperação. Todas as sessões são encerradas. Para trocar de aplicativo, conclua esse procedimento e configure novamente; mantenha códigos de recuperação disponíveis. Não há recuperação por perguntas pessoais nem desativação pública sem comprovação. Perder simultaneamente autenticador e todos os códigos exige recuperação administrativa verificada fora da interface, não um bypass automático.

MFA é opcional para instalações existentes até a gestão ativar a exigência. Funciona no Docker local; TOTP não depende de SMS, WhatsApp ou Web Push. A implantação pública continua exigindo HTTPS. TOTP reduz o risco de senha vazada, mas não é resistente a phishing em tempo real como passkeys/WebAuthn.

## Controles implementados

- `otplib` 13.5.0 implementa TOTP: seis dígitos, período de 30 segundos, tolerância de um período adjacente. Ajuste o relógio do celular automaticamente. O contador aceito é persistido para recusar reutilização.
- Segredos TOTP são cifrados com AES-256-GCM e IV aleatório, com chave derivada para esse propósito e associação criptográfica ao usuário. Cópia de um segredo cifrado para outra conta não é aceita. Não são retornados depois da ativação.
- Códigos de recuperação têm 96 bits aleatórios e apenas hashes são persistidos, vinculados à conta. Validação/consumo, ativação e rotação de sessão são transacionais com bloqueio por usuário. Tentativas concorrentes não reutilizam o mesmo código.
- Depois da senha, uma sessão pendente só acessa estado/configuração/verificação do MFA e logout, com CSRF nas mutações. Expira para esse fluxo após dez minutos. O backend bloqueia também chamadas diretas aos casos de uso; esconder botões não autoriza operações.
- O cookie opaco e o token CSRF são substituídos após a confirmação. Ativar MFA revoga outras sessões; desativar ou trocar senha revoga todas. O login revalida o hash da senha na transação para impedir criação tardia de uma sessão com senha já alterada.
- Redis limita códigos a cinco tentativas por conta em cinco minutos e confirmação de senha a dez em quinze minutos, compartilhados entre réplicas. Redis indisponível não desliga os controles.
- Regras são reavaliadas no servidor em cada acesso. Contas pendentes são direcionadas à segunda etapa também se a política mudar durante o uso. A exigência efetiva considera todas as associações ativas.
- `SecurityEvent` registra ativação, desativação, uso de recuperação e mudanças de política, na mesma transação. Guarda ação, horário e identificadores de ator/organização/alvo, sem senha, segredo ou código. Não é um log imutável contra administradores do banco. A auditoria geral de todas as operações do sistema continua sendo uma extensão futura.
- API sem cache de respostas privadas, cookies HttpOnly/SameSite, origem e CSRF, autorização por organização e validação estrita de entrada. O log registra apenas metadados permitidos e referências de diagnóstico.
- Container da API sem root, filesystem somente leitura, capabilities removidas e `no-new-privileges`; dados e logs têm volumes próprios. O Compose local não é uma infraestrutura de produção com alta disponibilidade.

Preserve **SESSION_SECRET** junto ao backup seguro do banco: ele protege também o MFA e as inscrições Push. Não o troque isoladamente, pois os segredos antigos ficarão indecifráveis. Nenhuma chave adicional é necessária para esta entrega. Não publique `.env`, backups, códigos de recuperação ou traces do navegador. Trace de teste pode conter credenciais sintéticas e fica ignorado pelo Git.

## QR Code e política de conteúdo

`qr-code-styling` fazia XHR do logo quando `saveAsBlob` estava ativo, inclusive para `data:`. Isso conflita com `connect-src 'self'` do Docker. A preparação agora carrega a imagem com prazo e cancelamento, rasteriza em 256 × 256 preservando proporção, compõe transparência sobre branco e entrega uma imagem já incorporada à biblioteca. `saveAsBlob` fica desligado. Prévia e exportações usam o mesmo SVG; PNG é rasterizado desse SVG. A CSP não foi relaxada para permitir conexões externas. Logos remotos precisam permitir CORS; upload nas configurações evita essa dependência.

Falhas de imagem permitem tentar novamente ou retirar o logo, sem reaproveitar erros de outra geração. Os modelos mantêm correção H, contraste e área de silêncio. Testes de navegador decodificam os três PNGs com logo retangular/transparente e verificam a incorporação no SVG.

## Verificação reproduzível

```sh
pnpm security:secrets
pnpm check:all
pnpm api:test:db
pnpm test:e2e:api
pnpm docker:up
pnpm test:e2e:docker
pnpm test:docker:security
pnpm audit --prod
```

Gitleaks 8.30.1 é baixado do release oficial, com SHA-256 fixado e validado antes da execução. Examina histórico, diff e staged com redação total de segredos. A CI busca o histórico completo. A única exceção cobre dois textos exatos de instrução de geração de segredo em `backend/.env.example`; não exclui o arquivo inteiro nem ignora credenciais reais. Arquivos ainda não rastreados precisam ser adicionados ao staging antes da checagem final.

As simulações de MFA incluem sessão incompleta, CSRF, acesso entre organizações, perfil sem permissão, reutilização de TOTP/recuperação, corrida com duas requisições, configuração vinculada à sessão, expiração e limitação de tentativas. Testes usam somente banco com sufixo `_test` e contas sintéticas.

`test:docker:security` sobe um container temporário da imagem real da API em `127.0.0.1:8082`, conectado exclusivamente ao banco `_test`. `NODE_ENV=test` impede iniciar o worker de mensagens. Verifica execução sem root, escrita recusada no filesystem, autenticação, payloads de injeção, origem/CSRF, cache e tentativas de bypass/replay do MFA. A limpeza remove somente contas geradas pela execução e o próprio container. Não altera pedidos reais, contas existentes, pareamento WhatsApp ou volumes da aplicação. Requer imagens construídas, migrações de teste e backend compilado; é executado pela CI.

## Referências e limites

Foram aplicadas contextualmente as skills `testing-api-authentication-weaknesses`, `testing-api-for-broken-object-level-authorization`, `performing-csrf-attack-simulation`, `hardening-docker-containers-for-production` e `implementing-secret-scanning-with-gitleaks` do repositório local indicado pelo responsável (`skills/Anthropic-Cybersecurity-Skills`). Seus exemplos foram adaptados à aplicação com cookies opacos e múltiplas organizações. A skill de DAST/ZAP foi estudada; não se afirma que um scan ZAP foi executado. Nenhuma ferramenta prova ausência de todas as vulnerabilidades.

Fontes primárias: [OWASP MFA](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html), [testes de MFA OWASP](https://owasp.github.io/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/04-Authentication/11-Multi-Factor_Authentication), [otplib](https://otplib.yeojz.dev/guide/getting-started), [tolerância TOTP](https://otplib.yeojz.dev/guide/advanced-usage), [Gitleaks](https://github.com/gitleaks/gitleaks) e [QR Code Styling](https://github.com/kozakdenys/qr-code-styling).

Antes da operação pública: domínio/HTTPS, verificação e recuperação de e-mail, recuperação administrativa documentada com verificação de identidade, retenção de auditoria/backups, proteção de borda e revisão independente. Passkeys e rotação versionada de chaves são evoluções recomendadas. Não há alegação de certificação ou de sistema invulnerável.
