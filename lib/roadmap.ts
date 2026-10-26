const titles = [
  "Configurar o provedor de pagamentos",
  "Testar compra, confirmação, entrega e reembolso",
  "Ativar acesso por e-mail",
  "Configurar e-mails transacionais",
  "Confirmar responsável pela operação e privacidade",
  "Cadastrar primeiros materiais comerciais reais",
  "Preparar coleção comercial de Veterinária",
  "Definir condições comerciais dos parceiros",
  "Configurar domínio próprio",
  "Definir abertura do site ao público",
  "Ler PDFs na biblioteca",
  "Retomar última página",
  "Marcar páginas importantes",
  "Anotar por página",
  "Destacar trechos",
  "Organizar por pastas ou etiquetas",
  "Estados de estudo",
  "Pesquisar dentro do PDF",
  "Planejamento de revisão",
  "Acessibilidade do leitor",
  "Busca por termos semelhantes",
  "Alternativas sem resultados",
  "Salvar filtros",
  "Materiais relacionados",
  "Comparar materiais",
  "Seguir autores",
  "Avisos opcionais de novas publicações",
  "Páginas de disciplinas completas",
  "Diferenciar materiais semelhantes",
  "Recomendações por preferências",
  "Conhecimentos prévios",
  "Público do material",
  "Conteúdo incluído e excluído",
  "Data e histórico de atualização",
  "Requisitos dos arquivos",
  "Galeria de amostras no celular",
  "Títulos dos componentes dos kits",
  "Perguntas frequentes por material",
  "Perguntas antes da compra com moderação",
  "Comparar kit e materiais individuais",
  "Solicitar reembolso pelo pedido",
  "Acompanhar etapas do reembolso",
  "Mensagens de pagamento",
  "Tentar novamente um pagamento",
  "Comprovante de aquisição",
  "Desconto em cada item",
  "Motivo de cupom inválido",
  "Presentear com material",
  "Licenças para turma",
  "Histórico unificado por pedido",
  "Rascunho automático",
  "Recuperar preenchimento interrompido",
  "Prévia da publicação",
  "Checklist de qualidade",
  "Conferência de arquivo e cadastro",
  "Duplicar cadastro",
  "Modelos de capa Nimbus",
  "Fila de ajustes editoriais",
  "Comparar versões de cadastro",
  "Programar lançamento aprovado",
  "Critérios editoriais por formato",
  "Padronizar referências",
  "Registro de aspectos revisados",
  "Diferenciar credenciais declaradas e verificadas",
  "Denúncias sobre autoria",
  "Identificar arquivos duplicados",
  "Vincular correção a uma versão",
  "Avisar sobre correções relevantes",
  "Avaliações de conteúdo, clareza e apresentação",
  "Moderação e resposta de avaliações",
  "Período no resumo administrativo",
  "Relatório por material",
  "Separar acervo próprio e parceiros",
  "Exportar financeiro em CSV",
  "Evolução de vendas",
  "Resultado de campanhas",
  "Orientações para pendências financeiras",
  "Histórico de ajustes comerciais",
  "Permissões de administrador, revisor e atendimento",
  "Tarefas com responsável e prazo",
  "Paginar listas grandes",
  "Otimizar imagens e carregamento",
  "Recuperação de erros",
  "Monitorar falhas operacionais",
  "Alertas operacionais",
  "Backup e restauração testados",
  "Verificar arquivos enviados",
  "Limites contra abuso",
  "Revisão de acessibilidade",
  "Revisar permissões periodicamente",
  "Flashcards interativos",
  "Questões e simulados com correção",
  "Trilhas de aprendizagem",
  "Minicursos e videoaulas",
  "Assinatura de biblioteca",
  "Clube de estudos",
  "Agenda e contratação de mentorias",
  "Oficinas e aulas ao vivo",
  "Serviços editoriais com orçamento",
  "Aplicativos iOS e Android",
];
const categories = [
  "Lançamento",
  "Estudo",
  "Descoberta",
  "Produtos",
  "Compras",
  "Autores",
  "Curadoria",
  "Gestão",
  "Operação",
  "Novas ofertas",
];
export type ImplementationState =
  "implemented" | "partial" | "external" | "pending";
const external: Record<number, string> = {
  1: "Configure STRIPE_SECRET_KEY e STRIPE_WEBHOOK_SECRET na hospedagem.",
  2: "As simulações existem; a validação real exige credenciais, webhook acessível e execução em ambiente de teste do provedor.",
  3: "Configure as chaves Clerk e valide a verificação de e-mail.",
  4: "Configure Resend e um remetente com domínio verificado.",
  5: "Responsável, contato e critérios de retenção precisam ser confirmados pelo proprietário.",
  6: "Enviar arquivos comerciais originais e confirmar preços e direitos.",
  7: "A estrutura das coleções existe; falta o conteúdo comercial autorizado.",
  9: "Escolher e conectar um domínio disponível, sob sua titularidade.",
  10: "Decisão do proprietário sobre a audiência; o compartilhamento atual é preservado.",
};
export const implementationEvidence: Record<
  number,
  { state: ImplementationState; evidence: string }
> = {
  "8": {
    state: "implemented",
    evidence:
      "Política configurável por autor, aceite obrigatório, comissão padrão de 25% após taxa real e fotografia imutável por item vendido. A negociação final é do operador.",
  },
  "11": {
    state: "implemented",
    evidence:
      "Leitor PDF.js com arquivo autorizado pelo servidor; arquivo gratuito original de três páginas validado no navegador.",
  },
  "12": {
    state: "implemented",
    evidence:
      "Página e zoom persistidos por estudante e material; retomada ao abrir.",
  },
  "13": {
    state: "implemented",
    evidence: "Marcadores privados por página, com navegação e exclusão.",
  },
  "14": {
    state: "implemented",
    evidence:
      "Anotações privadas por página, protegidas por titularidade e direito de acesso.",
  },
  "16": {
    state: "implemented",
    evidence: "Uma pasta ou etiqueta por material e filtros na biblioteca.",
  },
  "17": {
    state: "implemented",
    evidence:
      "Estados não iniciado, estudando e concluído, salvos no servidor.",
  },
  "18": {
    state: "implemented",
    evidence:
      "Busca de texto extraível em todas as páginas; PDFs digitalizados precisam de OCR externo.",
  },
  "19": {
    state: "implemented",
    evidence:
      "Próxima revisão por data e contagem de revisões vencidas na biblioteca.",
  },
  "21": {
    state: "implemented",
    evidence:
      "Normalização de acentos e tolerância a um erro em termos com pelo menos quatro letras.",
  },
  "22": {
    state: "implemented",
    evidence:
      "Filtros podem ser limpos e a API sugere disciplinas quando não encontra resultados.",
  },
  "23": {
    state: "implemented",
    evidence:
      "Até vinte buscas nomeadas por usuário, com restauração dos filtros.",
  },
  "24": {
    state: "implemented",
    evidence:
      "Sugestões por disciplina, curso e autoria nas páginas dos materiais.",
  },
  "25": {
    state: "implemented",
    evidence:
      "Comparação de até três materiais por preço, nível, formato, tamanho e autoria.",
  },
  "26": {
    state: "implemented",
    evidence: "Seguir e deixar de seguir autores na conta do estudante.",
  },
  "27": {
    state: "implemented",
    evidence:
      "Avisos internos com adesão opcional; envio por e-mail depende da configuração do item 4.",
  },
  "28": {
    state: "implemented",
    evidence:
      "Páginas /disciplinas/:slug com assuntos, recortes, níveis e materiais disponíveis.",
  },
  "29": {
    state: "implemented",
    evidence:
      "Assunto, nível e metadados exibidos na comparação e na página individual.",
  },
  "30": {
    state: "implemented",
    evidence:
      "Preferências explícitas de disciplinas aplicadas ao catálogo, removíveis pelo usuário.",
  },
  "31": {
    state: "implemented",
    evidence: "Campo editável de conhecimentos prévios e exibição pública.",
  },
  "32": {
    state: "implemented",
    evidence: "Campo editável de público indicado e exibição pública.",
  },
  "33": {
    state: "implemented",
    evidence:
      "Descrição, objetivos, sumário e exclusões apresentados antes da compra.",
  },
  "34": {
    state: "implemented",
    evidence:
      "Histórico das versões publicadas e notas de atualização; versões anteriores continuam protegidas.",
  },
  "35": {
    state: "implemented",
    evidence:
      "Campo de requisitos dos arquivos no cadastro e na página do produto.",
  },
  "36": {
    state: "implemented",
    evidence:
      "Galeria com botões, indicadores e gesto horizontal; imagens contidas no espaço disponível.",
  },
  "37": {
    state: "implemented",
    evidence: "Kits mostram os títulos reais dos componentes publicados.",
  },
  "38": {
    state: "implemented",
    evidence: "Perguntas frequentes editáveis por material.",
  },
  "39": {
    state: "implemented",
    evidence:
      "Perguntas autenticadas com resposta moderada; perguntas pendentes não são expostas na página pública.",
  },
  "40": {
    state: "implemented",
    evidence:
      "Preço do kit comparado à soma dos itens individuais, sem inventar economia.",
  },
  "45": {
    state: "implemented",
    evidence:
      "Comprovante HTML protegido, com valores efetivos e aviso de que não substitui documento fiscal.",
  },
  "46": {
    state: "implemented",
    evidence: "Desconto rateado em centavos nos itens e preservado no pedido.",
  },
  "47": {
    state: "implemented",
    evidence:
      "Mensagens específicas para cupom inválido, expirado, esgotado, usado ou inaplicável.",
  },
  "48": {
    state: "implemented",
    evidence:
      "Compra para destinatário; acesso reservado ao e-mail verificado, sem liberar o conteúdo ao remetente.",
  },
  "49": {
    state: "implemented",
    evidence:
      "Compra de até cem licenças, quota transacional e distribuição por e-mail verificado.",
  },
  "50": {
    state: "implemented",
    evidence:
      "Detalhes do pedido reúnem itens, cupom, reembolso e atendimentos que citam seu identificador.",
  },
  "51": {
    state: "implemented",
    evidence:
      "Rascunho de formulário salvo automaticamente após pausa na edição.",
  },
  "52": {
    state: "implemented",
    evidence:
      "Recuperação de preenchimento com aceite de direitos e condições sempre desmarcados.",
  },
  "53": {
    state: "implemented",
    evidence:
      "Prévia interna do título, descrição e apresentação antes do envio.",
  },
  "54": {
    state: "implemented",
    evidence:
      "Checklist de qualidade com declarações do autor e critérios de revisão.",
  },
  "56": {
    state: "implemented",
    evidence:
      "Duplicação cria rascunho sem arquivo, sem publicação e sem reaproveitar aceites.",
  },
  "57": {
    state: "implemented",
    evidence:
      "Gerador de capas PNG com tipografia e quatro tons da identidade Nimbus.",
  },
  "58": {
    state: "implemented",
    evidence: "Fila de ajustes com retorno editorial e nova submissão.",
  },
  "59": {
    state: "implemented",
    evidence:
      "Comparação de campos entre fotografias anteriores do cadastro; arquivos têm histórico separado.",
  },
  "61": {
    state: "implemented",
    evidence:
      "Critérios de curadoria adaptados aos formatos, inclusive atividades e vídeos.",
  },
  "62": {
    state: "implemented",
    evidence:
      "Auxiliar de referências com campos estruturados; não valida automaticamente todas as normas bibliográficas.",
  },
  "63": {
    state: "implemented",
    evidence:
      "Aspectos revisados registrados no evento editorial com responsável e data.",
  },
  "64": {
    state: "implemented",
    evidence:
      "Credenciais declaradas separadas de verificação administrativa com evidência privada.",
  },
  "65": {
    state: "implemented",
    evidence:
      "Denúncias autenticadas sobre autoria e qualidade, com tratamento pela administração.",
  },
  "66": {
    state: "implemented",
    evidence:
      "Hashes SHA-256 dos uploads e relatório de duplicatas para análise administrativa.",
  },
  "67": {
    state: "implemented",
    evidence: "Correção pode apontar para uma versão já publicada do material.",
  },
  "68": {
    state: "implemented",
    evidence:
      "Publicação de atualização gera aviso para compradores, destinatários e assinantes elegíveis; e-mail depende do item 4.",
  },
  "69": {
    state: "implemented",
    evidence:
      "Notas de conteúdo, clareza e apresentação, disponíveis a compradores.",
  },
  "70": {
    state: "implemented",
    evidence:
      "Autor pode responder; somente administrador altera visibilidade com justificativa e auditoria.",
  },
  "71": {
    state: "implemented",
    evidence:
      "Resumo administrativo com filtro de vendas por período; saldos e pendências identificados como posição atual.",
  },
  "72": {
    state: "implemented",
    evidence:
      "Relatório agrupado por material com bruto, taxas, estornos e líquidos conciliados.",
  },
  "73": {
    state: "implemented",
    evidence: "Relatório separa acervo próprio e parceiros.",
  },
  "74": {
    state: "implemented",
    evidence:
      "Exportação CSV protegida, por período e escopo do autor ou administração.",
  },
  "75": {
    state: "implemented",
    evidence:
      "Evolução mensal em tabela, derivada dos itens conciliados no período.",
  },
  "76": {
    state: "implemented",
    evidence:
      "Pedidos, desconto e receita atribuídos a cada cupom; sem alegação de causalidade ou lucro.",
  },
  "78": {
    state: "implemented",
    evidence:
      "Mudanças comerciais auditadas, com regra histórica preservada por venda.",
  },
  "79": {
    state: "implemented",
    evidence:
      "Revisores e atendimento têm endpoints separados; nenhuma função de equipe recebe acesso administrativo ou financeiro global.",
  },
  "80": {
    state: "implemented",
    evidence:
      "Tarefas operacionais com responsável, prazo, estado e observações.",
  },
  "91": {
    state: "implemented",
    evidence:
      "Flashcards interativos com frente, verso, autoavaliação e datas de revisão.",
  },
  "92": {
    state: "implemented",
    evidence:
      "Questões com pontuação no servidor, gabarito omitido antes da resposta e histórico individual.",
  },
  "93": {
    state: "implemented",
    evidence: "Aulas organizadas em trilhas com progresso por estudante.",
  },
  "94": {
    state: "implemented",
    evidence:
      "Aulas de texto e vídeos incorporados autorizados; vídeos externos só carregam após ação do usuário.",
  },
  "15": {
    state: "partial",
    evidence:
      "Trechos selecionados no texto extraído são salvos como destaques por página; ainda não há marcação sobre as coordenadas do PDF.",
  },
  "20": {
    state: "partial",
    evidence:
      "Controles rotulados, navegação por teclado e texto extraído alternativo. Falta validação com leitores de tela reais e PDFs marcados.",
  },
  "41": {
    state: "partial",
    evidence:
      "Solicitação, análise e aprovação integradas ao provedor; código e simulações validados. Reembolso real depende das chaves e de homologação.",
  },
  "42": {
    state: "partial",
    evidence:
      "Estados do provedor persistidos e atualizados por webhook assinado; falta homologação externa.",
  },
  "43": {
    state: "partial",
    evidence:
      "Pedidos e retornos de pagamento exibem estados; os estados novos de serviço e assinatura ainda precisam de revisão integral de linguagem.",
  },
  "44": {
    state: "partial",
    evidence:
      "Retoma a URL de sessão existente. Sessões expiradas exigem novo pedido; renovação automática ainda não implementada.",
  },
  "55": {
    state: "partial",
    evidence:
      "Extensão, assinatura básica, tamanho e hash conferidos. Contagem de páginas e conteúdo ainda exigem conferência editorial.",
  },
  "60": {
    state: "partial",
    evidence:
      "Lançamento aprovado é liberado na primeira consulta ao catálogo após a data. Liberação sem visitas exige agendador.",
  },
  "77": {
    state: "partial",
    evidence:
      "Consulta de conciliação e indicação de bloqueio de saldo disponíveis. A triagem de divergências continua administrativa.",
  },
  "81": {
    state: "partial",
    evidence:
      "Administração tem paginação SQL de vinte itens; catálogo tem carregamento em lotes. Algumas outras listas ainda usam limites fixos.",
  },
  "82": {
    state: "partial",
    evidence:
      "PDF.js carregado sob demanda, imagens de amostra com lazy loading e listas em lotes. Pipeline de redimensionamento de imagens ainda pendente.",
  },
  "83": {
    state: "partial",
    evidence:
      "Mensagens de falha, repetição de consultas e estados de carregamento nos fluxos principais; não houve teste exaustivo de todas as interrupções de rede.",
  },
  "84": {
    state: "partial",
    evidence:
      "Falhas inesperadas da API registradas sem conteúdo sensível. Indisponibilidade total exige monitor externo.",
  },
  "85": {
    state: "partial",
    evidence:
      "Painel reúne falhas abertas, e-mails pendentes, reembolsos com problema e bloqueios de conciliação. Alertas externos automáticos não configurados.",
  },
  "86": {
    state: "partial",
    evidence:
      "Exportação de dados e manifesto de objetos, com restauração SQL ensaiada em banco isolado. Falta cópia dos objetos R2 e ensaio completo de recuperação da hospedagem.",
  },
  "87": {
    state: "partial",
    evidence:
      "Validação de extensão, cabeçalho, tamanho e hash implementada. Não substitui análise antimalware.",
  },
  "88": {
    state: "partial",
    evidence:
      "Limites por usuário e rota com expiração dos contadores. Proteção global contra abuso anônimo depende da infraestrutura.",
  },
  "89": {
    state: "partial",
    evidence:
      "Responsividade, foco do modal, rótulos e movimento reduzido revisados. Auditoria assistiva completa pendente.",
  },
  "90": {
    state: "partial",
    evidence:
      "Permissões e alterações auditadas com função de equipe restrita; a revisão periódica depende do responsável operacional.",
  },
  "95": {
    state: "partial",
    evidence:
      "Planos, checkout recorrente, portal e catálogo contratado implementados e testados com provedor simulado. Ativação real depende de Stripe.",
  },
  "96": {
    state: "partial",
    evidence:
      "Posts restritos e encontros vinculados a assinantes ativos. Dependem de plano, programação e conteúdo reais.",
  },
  "97": {
    state: "partial",
    evidence:
      "Ofertas, horários, lotação, termos, reservas e pagamento implementados; homologação de pagamentos e operação reais ainda pendente.",
  },
  "98": {
    state: "partial",
    evidence:
      "Oficinas e aulas ao vivo usam agenda, lotação e link privado. Falta cadastrar encontros reais e validar a operação.",
  },
  "99": {
    state: "partial",
    evidence:
      "Briefing, orçamento, aceite, cobrança e entrega privada implementados; falta homologação real e definição do serviço comercial.",
  },
  "100": {
    state: "pending",
    evidence:
      "O site responsivo e o manifesto PWA já existem. Aplicativos nativos, assinatura de builds, testes em aparelhos e publicação nas lojas não foram realizados. A etapa de aplicativos havia sido adiada.",
  },
};
export const roadmap = titles.map((title, index) => {
  const id = index + 1;
  return {
    id,
    title,
    category: categories[Math.floor(index / 10)],
    implementation: external[id]
      ? ("external" as const)
      : implementationEvidence[id]?.state || ("pending" as const),
    evidence:
      external[id] ||
      implementationEvidence[id]?.evidence ||
      "Ainda não concluído e validado.",
  };
});
