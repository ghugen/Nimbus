# Escopo consolidado da Nimbus

Atualização: 26/10/2026.

Lista solicitada pelo proprietário, sem duplicar recursos. Disponibilidade no código não significa integração externa ativada ou conteúdo comercial fornecido.

## Catálogo e vendas

| Recurso | Estado | Evidência e limite | Área |
| --- | --- | --- | --- |
| Coleção inicial com materiais reais | Depende de ativação/conteúdo | Enviar arquivos autorais, definir preços e aprovar a publicação. | /#admin/lancamento |
| Organização por curso, disciplina, tema e formato | Disponível no código | Taxonomia e filtros do catálogo. | /#catalogo |
| Busca e filtros | Disponível no código | Busca normalizada e filtros combináveis. | /#catalogo |
| Sumário e páginas de amostra | Disponível no código | Campos editoriais e galeria; cada autor deve enviar amostras. | /#autores/materiais |
| Referências, autoria e data de revisão | Disponível no código | Cadastro editorial e programação de revisão. | /#autores/materiais |
| Kits complementares | Disponível no código | Validação de componentes e fotografia dos arquivos adquiridos. | /#autores/materiais |
| Materiais gratuitos | Disponível no código | Quatro PDFs originais e experiência com cartões e quiz. | /#gratuitos |
| Lista de desejos e alertas | Disponível no código | Favoritos, autores seguidos e avisos opcionais de novas publicações. | /#favoritos |
| Avaliações verificadas | Disponível no código | Direito de avaliação condicionado à aquisição. | /#catalogo |
| Pedidos de novos temas | Disponível no código | Mural moderado com apoios por conta. | /#mural |

## Compra e pagamento

| Recurso | Estado | Evidência e limite | Área |
| --- | --- | --- | --- |
| Compra completa de teste Stripe | Depende de ativação/conteúdo | Testes locais simulados; validar Checkout real, webhook acessível e reembolso na sandbox. | /#admin/conexoes |
| Confirmação e liberação automática | Depende de ativação/conteúdo | Código de webhook assinado e idempotente; ativação depende de entrega externa validada. | /#admin/conexoes |
| Retomar pagamento sem duplicidade | Disponível no código | Consulta à sessão original; renovação somente após expiração e com chave idempotente. | /#pedidos |
| Pedidos, comprovantes e situação | Disponível no código | Histórico e comprovante de aquisição; não substitui documento fiscal. | /#pedidos |
| Cupons claros | Disponível no código | Regras, limite, validade e proteção de saldo. | /#admin/cupons |
| Presentes | Disponível no código | Destinatário por e-mail verificado. | /#licencas |
| Grupos e instituições | Disponível no código | Licenças nominativas e propostas com escopo, valor e arquivos congelados. | /#instituicoes |
| Reembolsos | Disponível no código | Solicitação, decisão, chamada idempotente e conciliação; depende do provedor ativo. | /#admin/reembolsos |
| Meios de pagamento | Depende de ativação/conteúdo | Checkout apresenta métodos elegíveis à conta, moeda e operação. | /#admin/conexoes |
| Emissão fiscal | Depende de ativação/conteúdo | Fila de solicitações e registro de emissão externa; integração fiscal e enquadramento pendentes. | /#admin/documentos |

## Experiência do estudante

| Recurso | Estado | Evidência e limite | Área |
| --- | --- | --- | --- |
| Navegação no celular | Disponível no código | Layout responsivo, menus e leitor adaptável. | /#biblioteca |
| Pastas, favoritos e progresso | Disponível no código | Organização privada por estudante. | /#biblioteca |
| Busca, marcações e anotações no PDF | Disponível no código | PDF.js com texto extraível, estado e notas por página. | /#biblioteca |
| Avisos de atualização | Disponível no código | Avisos internos e fila de e-mails aos adquirentes. | /#notificacoes |
| Cartões e questionários | Disponível no código | Pacotes editoriais e demonstração gratuita com correção no servidor. | /#gratuitos |
| Planos e lembretes de estudo | Parcial | Planejamento de revisões disponível; disparos enquanto o site está fechado exigem agendamento externo. | /#biblioteca |
| Acessibilidade | Parcial | Rótulos, foco e teclado; auditoria assistiva completa ainda pendente. | /#biblioteca |
| Recuperação de conta | Depende de ativação/conteúdo | Acesso ChatGPT preservado; acesso independente por e-mail depende de configuração e teste. | /#admin/conexoes |

## Autores e qualidade editorial

| Recurso | Estado | Evidência e limite | Área |
| --- | --- | --- | --- |
| Envio, revisão e publicação | Disponível no código | Estados editoriais e rejeição de publicação sem arquivo/condições. | /#autores |
| Padronização editorial | Disponível no código | Modelos de capa, sumário, referências e checklist. | /#autores/materiais |
| Autorização e declaração de autoria | Disponível no código | Aceite com versão e fotografia das condições. Não equivale a assinatura externa. | /#autores |
| Critérios de aprovação | Disponível no código | Checklist e moderação editorial. | /#admin/aprovações |
| Versões e histórico | Disponível no código | Histórico do cadastro e arquivos preservados. | /#autores/materiais |
| Revisões periódicas | Disponível no código | Datas, fila e pausa opcional de novas vendas vencidas; avisos verificados ao abrir a fila. | /#admin/revisoes |
| Denúncias e correções | Disponível no código | Registros moderados e vínculo a versões corrigidas. | /#admin/denúncias |
| Vendas, taxas, comissão e saldo | Disponível no código | Cálculo com taxas reais e condições imutáveis por venda. | /#autores/vendas |
| Repasses e comprovantes | Disponível no código | Registro auditado de transferência externa realizada. | /#admin/financeiro |
| Repasses automáticos | Depende de ativação/conteúdo | Stripe Connect depende de definição comercial, onboarding e configuração. | /#admin/conexoes |
| Assinatura eletrônica | Depende de ativação/conteúdo | Acompanhamento de contratos e referências externas; provedor de assinatura não conectado. | /#admin/documentos |

## Administração e atendimento

| Recurso | Estado | Evidência e limite | Área |
| --- | --- | --- | --- |
| Permissões por função | Disponível no código | Administração, revisão e atendimento; conferência periódica registrada. | /#admin/equipe |
| Painel de vendas e reembolsos | Disponível no código | Resumo e financeiro com período. | /#admin |
| Fila de ações pendentes | Disponível no código | Tarefas, revisões, pedidos e alertas operacionais. | /#admin/tarefas |
| Propostas e contratos institucionais | Disponível no código | Escopo aceito e registro documental. | /#admin/instituicoes |
| Central de atendimento | Disponível no código | Chamados, referência de pedido, respostas e acompanhamento. | /#suporte |
| E-mails automáticos | Depende de ativação/conteúdo | Fila e tentativas de envio implementadas; falta provedor/remetente verificado. | /#admin/conexoes |
| Ajuda contextual | Disponível no código | Orientação junto ao pagamento, leitura, autores e parcerias. | /#catalogo |
| Relatórios exportáveis | Disponível no código | Relatórios operacionais e financeiros em CSV. | /#admin/relatórios |
| Auditoria administrativa | Disponível no código | Ator, ação, alvo e data. | /#admin/histórico |

## Segurança e privacidade

| Recurso | Estado | Evidência e limite | Área |
| --- | --- | --- | --- |
| Proteção de downloads | Disponível no código | Verificação de aquisição ou licença em cada acesso. | /#biblioteca |
| Verificação dos arquivos | Parcial | Assinatura, tamanho, duplicidade, estrutura e páginas de PDF; antivírus e detecção de plágio não integrados. | /#autores/materiais |
| Identificação individual de cópias | Parcial | Código opaco em PDFs compatíveis até 10 MB e 200 páginas; sem promessa de DRM. | /#autores/materiais |
| Credenciais e ambientes | Disponível no código | Segredos no runtime, sem chaves no repositório; trava de prontidão de pagamentos. | /#admin/conexoes |
| Retenção e exclusão | Depende de ativação/conteúdo | Solicitações disponíveis; responsável e política final de retenção exigem definição do operador. | /#admin/privacidade |
| Acesso e exportação de dados | Disponível no código | Exportação privada e solicitações acompanhadas. | /#perfil |
| Termos, privacidade e cookies | Parcial | Textos e controles presentes; validação jurídica final é externa. | /#privacidade |
| Backups e restauração | Parcial | Exportação e restauração SQL testadas; objetos R2 precisam de cópia e ensaio externo. | /#admin/relatórios |
| Monitoramento e abuso | Parcial | Eventos internos e limites de uso; serviço externo de alertas contínuos não configurado. | /#admin/alertas |

## Crescimento e novos serviços

| Recurso | Estado | Evidência e limite | Área |
| --- | --- | --- | --- |
| Busca orgânica | Disponível no código | Páginas próprias de materiais, metadados e sitemap. Indexação exige audiência pública. | /#catalogo |
| Navegação e conversão | Parcial | Eventos agregados de visualização, amostra, carrinho e compras; análise entre dispositivos não disponível. | /#admin/indicadores |
| Indicações e afiliados | Disponível no código | Programa inicialmente desativado, regras aceitas, desconto no acervo próprio e conciliação. | /#admin/parcerias |
| Licenciamento institucional | Disponível no código | Proposta, aceite e até cem acessos nominativos por pedido. | /#instituicoes |
| Mentorias, oficinas e aulas | Disponível no código | Ofertas, horários, orçamento e entrega; conteúdo e preços dependem da operação. | /#servicos |
| Agenda e lembretes | Parcial | Reservas com capacidade controlada; sincronização externa e lembretes programados pendentes. | /#servicos |
| Assinaturas | Depende de ativação/conteúdo | Estrutura e fotografia do acervo presentes; ativação exige teste do ciclo completo e configuração de cobrança. | /#admin/planos |
| Assistente com fontes | Parcial | Busca de trechos com páginas disponível; IA generativa exige chave/modelo, autorização do autor e consentimento. | /#biblioteca |
| Aplicativos iOS e Android | Adiado | Adiados até validar a operação do site. | /#admin/melhorias |
