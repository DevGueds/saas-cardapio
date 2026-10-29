import { LEGAL_VERSION, privacyController } from "@cardapio/contracts"

export type LegalDocumentKind = "terms" | "privacy" | "cookies"
export const legalDocuments: Record<
  LegalDocumentKind,
  {
    title: string
    introduction: string
    sections: { title: string; paragraphs: string[] }[]
  }
> = {
  terms: {
    title: "Termos de Uso",
    introduction:
      "Regras claras para uma gestão mais simples. Estes termos explicam o uso do Pede Aqui por estabelecimentos, suas equipes e clientes.",
    sections: [
      {
        title: "1. Quem oferece o Pede Aqui",
        paragraphs: [
          `O Pede Aqui é operado por ${privacyController.legalName}, CNPJ ${privacyController.document}. O contato para atendimento e privacidade é ${privacyController.email}.`,
          "A plataforma disponibiliza cardápio digital, gestão de catálogo, pedidos, equipe, entregas e registros financeiros. O estabelecimento é responsável pela oferta, pelos produtos e pelo atendimento de seus clientes.",
        ],
      },
      {
        title: "2. Sua conta e os acessos da equipe",
        paragraphs: [
          "Forneça informações corretas e mantenha suas credenciais em sigilo. Use uma senha exclusiva e, quando disponível, a verificação em duas etapas. Cada integrante deve utilizar sua própria conta.",
          "O responsável pela loja administra os acessos e deve conceder somente as permissões necessárias ao trabalho de cada pessoa. Comunique qualquer suspeita de acesso indevido ao nosso canal de atendimento.",
        ],
      },
      {
        title: "3. Cardápio, pedidos e pagamentos",
        paragraphs: [
          "Preços, disponibilidade, informações sobre ingredientes, condições de entrega, descontos e cumprimento dos pedidos são de responsabilidade do estabelecimento. O envio registra o pedido e não representa, por si só, sua aceitação ou a confirmação do pagamento.",
          "Os registros de caixa e de pagamentos são controles de gestão. O Pede Aqui não movimenta dinheiro, não substitui instituição financeira, documento fiscal ou orientação contábil. O pagamento e eventuais cancelamentos devem ser combinados diretamente com o estabelecimento, respeitados os direitos do consumidor.",
        ],
      },
      {
        title: "4. Uso responsável",
        paragraphs: [
          "Não utilize o serviço para fraude, violação de direitos, acesso não autorizado, divulgação de informações ilícitas ou tratamento de dados pessoais sem uma finalidade legítima. Respeite os direitos sobre textos, fotografias, marcas e materiais inseridos no catálogo.",
          "Podemos limitar acessos diante de indícios fundamentados de abuso ou risco à segurança, com análise do caso e possibilidade de contato pelo canal de atendimento. As medidas devem ser proporcionais ao risco.",
        ],
      },
      {
        title: "5. Dados pessoais e integrações",
        paragraphs: [
          "A Política de Privacidade informa as finalidades e as bases legais do tratamento. Aceitar estes termos não autoriza publicidade nem substitui autorizações específicas para funcionalidades opcionais.",
          "O estabelecimento atua como controlador dos dados de seus clientes e orienta o tratamento necessário ao atendimento. O Pede Aqui atua como operador nesse contexto e como controlador dos dados necessários à operação de suas próprias contas e à segurança da plataforma.",
          "WhatsApp, notificações e localização possuem controles próprios. A loja precisa configurar e parear seu canal de mensagens. A autorização do cliente para receber avisos pode ser retirada pelo acompanhamento do pedido.",
        ],
      },
      {
        title: "6. Disponibilidade, conteúdo e encerramento",
        paragraphs: [
          "O serviço pode passar por manutenção ou depender de conexão e de fornecedores externos. Falhas devem ser comunicadas ao suporte; não há promessa de funcionamento ininterrupto. Nenhuma disposição afasta responsabilidades ou garantias que não possam ser excluídas por lei.",
          "O conteúdo do catálogo permanece de responsabilidade de quem o fornece. Para encerrar a conta ou obter uma cópia de seus dados, utilize a Central de Privacidade ou o contato informado. Solicitações de eliminação serão analisadas conforme a identidade do solicitante e as obrigações legais de conservação.",
        ],
      },
      {
        title: "7. Atualizações e legislação",
        paragraphs: [
          "Alterações relevantes serão informadas por uma nova versão dos documentos e, quando necessário, por novo aceite. O histórico de aceites identifica a versão e a data; não são atribuídos aceites retroativos a contas antigas.",
          "Estes termos são regidos pela legislação brasileira, inclusive pela LGPD e, quando aplicável, pelo Código de Defesa do Consumidor. Permanecem assegurados os direitos e os meios de solução de conflitos previstos em lei.",
        ],
      },
    ],
  },
  privacy: {
    title: "Política de Privacidade",
    introduction:
      "Sua confiança faz parte do pedido. Aqui você encontra o que tratamos, para quê, com quem compartilhamos e como exercer seus direitos.",
    sections: [
      {
        title: "1. Responsável e canal de privacidade",
        paragraphs: [
          `${privacyController.legalName}, CNPJ ${privacyController.document}, opera a marca Pede Aqui. Fale sobre seus dados pelo e-mail ${privacyController.email} ou pela Central de Privacidade. O atendimento é gratuito.`,
          "Nos pedidos, o estabelecimento é o controlador dos dados de seus clientes. Para informações sobre um pedido específico, contate também a loja. Encaminharemos ao responsável solicitações que dependam de suas decisões.",
        ],
      },
      {
        title: "2. Dados e finalidades",
        paragraphs: [
          "Conta e equipe: nome, e-mail, credenciais protegidas, vínculos com lojas e registros de acesso são usados para autenticar, autorizar e administrar o serviço. Senhas não são armazenadas em texto aberto.",
          "Pedidos: nome, telefone, itens, observações e, quando necessária a entrega, endereço e ponto indicado no mapa são usados para cotar, preparar, entregar e acompanhar o pedido. O endereço não é necessário para retirada. Evite inserir informações sensíveis nas observações.",
          "Gestão do estabelecimento: os pedidos permitem calcular indicadores de vendas, recompra, produtos e desempenho das entregas. Proprietários e gerentes podem consultar rankings de compradores da própria loja, com nome e telefone parcialmente oculto. O cardápio público mostra apenas a ordenação dos produtos mais vendidos, sem identificar compradores ou divulgar quantidades de vendas.",
          "Segurança e suporte: informações técnicas de acesso, identificadores de sessão, registros de ações e dados informados em solicitações são tratados para prevenir abusos, atender titulares e investigar incidentes. Os logs da aplicação não devem conter senhas, mensagens de pedidos ou dados pessoais de clientes.",
        ],
      },
      {
        title: "3. Bases legais",
        paragraphs: [
          "O funcionamento da conta e o atendimento de pedidos se baseiam, conforme o contexto, na execução de contrato ou em procedimentos solicitados pelo titular. Obrigações legais, exercício regular de direitos e proteção contra abusos podem justificar outros tratamentos necessários, com avaliação de finalidade e proporcionalidade.",
          "Quando a funcionalidade depende de consentimento, ele é específico e pode ser revogado. Mensagens opcionais no WhatsApp e notificações do dispositivo possuem autorizações separadas. A leitura desta política não constitui consentimento genérico para outros usos.",
        ],
      },
      {
        title: "4. Compartilhamento e fornecedores",
        paragraphs: [
          "Os dados do pedido ficam disponíveis à loja e às pessoas autorizadas, conforme sua função. Entregadores recebem o necessário à entrega. O acesso de uma loja não autoriza consultar dados de outra organização.",
          "Utilizamos fornecedores de hospedagem e banco de dados, como Railway, e serviços configurados para comunicação, como Evolution API e WhatsApp/Meta. Os dados necessários à mensageria são compartilhados quando o canal está ativo e o cliente autoriza os avisos.",
          "Mapas OpenStreetMap são consultados ao usar o recurso de mapa; buscas de CEP podem consultar BrasilAPI e ViaCEP. Esses fornecedores possuem políticas próprias. As fontes da interface são hospedadas pelo próprio Pede Aqui. Não instalamos ferramentas de publicidade ou análise de navegação nesta versão.",
        ],
      },
      {
        title: "5. Transferências internacionais",
        paragraphs: [
          "Fornecedores de hospedagem e comunicação podem tratar dados fora do Brasil. Na instalação Railway atual, os serviços estão na região europeia de Amsterdã. O atendimento deve observar as hipóteses e garantias aplicáveis da LGPD e da regulamentação da ANPD sobre transferências internacionais.",
          "Você pode solicitar informações sobre os fornecedores, as operações envolvidas e as garantias aplicáveis pelo canal de privacidade. Não realizamos venda de dados pessoais.",
        ],
      },
      {
        title: "6. Conservação e eliminação",
        paragraphs: [
          "Conservamos os dados pelo tempo necessário à finalidade informada e às obrigações legais aplicáveis. O encerramento da conta não implica apagar automaticamente registros que precisem ser mantidos para obrigações legais ou exercício de direitos. Esses casos devem ser limitados, justificados e informados ao titular.",
          "A sessão de acesso tem prazo de expiração. O rascunho com os dados de entrega fica no armazenamento da aba, por até 24 horas, e pode ser apagado em Dados do dispositivo. Carrinhos e links privados de acompanhamento usam o armazenamento do navegador para permitir continuar o pedido; não compartilhe esses links em dispositivos públicos.",
        ],
      },
      {
        title: "7. Seus direitos",
        paragraphs: [
          "Você pode pedir confirmação e acesso, correção, informação sobre compartilhamentos, portabilidade quando regulamentada e aplicável, oposição, revisão de decisões automatizadas quando cabível, anonimização, bloqueio ou eliminação nas hipóteses legais e revogação do consentimento.",
          "Na Central de Privacidade, titulares autenticados podem consultar seus dados de conta, baixar uma cópia e registrar uma solicitação. A exportação exige confirmação da senha. Clientes sem conta podem utilizar o contato da loja e o canal de privacidade. Podemos pedir informações mínimas para verificar sua identidade, sem exigir dados excessivos.",
          "Pedidos de confirmação e acesso seguem os procedimentos e prazos do art. 19 da LGPD: resposta simplificada imediata ou declaração completa em até 15 dias, conforme o caso. Outras solicitações são analisadas de acordo com sua natureza e as regras aplicáveis. Se necessário, você pode apresentar petição à ANPD ou procurar os órgãos de defesa do consumidor.",
        ],
      },
      {
        title: "8. Segurança e atualizações",
        paragraphs: [
          "Adotamos controles de acesso por função e organização, proteção de credenciais, sessões com expiração e verificação de origem. Cópias de segurança e procedimentos operacionais dependem da configuração e manutenção pelo responsável pela instalação. Em caso de incidente, o tratamento e as comunicações devem seguir a legislação e a regulamentação aplicáveis.",
          "Esta política pode ser atualizada para refletir alterações no serviço e na legislação. A versão vigente e a data ficam disponíveis nos documentos e nos registros de aceite.",
        ],
      },
    ],
  },
  cookies: {
    title: "Cookies e dados do dispositivo",
    introduction:
      "Apenas o necessário para você acessar, montar e acompanhar seu pedido. Sem cookies de publicidade ou rastreadores de audiência nesta versão.",
    sections: [
      {
        title: "Acesso e segurança",
        paragraphs: [
          "Um cookie essencial mantém sua sessão autenticada. Ele é protegido contra leitura por scripts, expira e, em HTTPS, é enviado por conexão segura. O navegador permite bloquear ou excluir cookies; bloquear o cookie de sessão impede o uso das áreas que exigem login.",
          "O aviso de privacidade registra somente que você leu a informação nesta versão. O botão Entendi não representa consentimento para publicidade ou para novos tratamentos.",
        ],
      },
      {
        title: "Carrinho, rascunhos e links",
        paragraphs: [
          "O navegador guarda o carrinho, os links privados de acompanhamento e os rascunhos necessários a continuar suas ações. Os dados pessoais de preenchimento do checkout são limitados à aba atual, têm prazo de até 24 horas e podem ser limpos abaixo. Sair da conta limpa os rascunhos administrativos vinculados ao acesso.",
          "Apagar o preenchimento não cancela pedidos enviados, não apaga dados do servidor e não remove os links de acompanhamento ou tentativas de envio pendentes. Solicitações sobre esses registros devem ser feitas na Central de Privacidade ou à loja responsável.",
        ],
      },
      {
        title: "Funcionalidades opcionais",
        paragraphs: [
          "WhatsApp, notificações e localização possuem escolhas separadas. Você pode negar ou revogar essas permissões sem aceitar publicidade para usar o cardápio. Se ferramentas opcionais de análise ou marketing forem adicionadas no futuro, deverão ter informações e controles adequados antes de serem ativadas.",
        ],
      },
    ],
  },
}
export { LEGAL_VERSION, privacyController }
