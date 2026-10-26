# As 100 melhorias da Nimbus

66 implementados · 24 parciais · 9 com dependência externa · 1 pendente.

Fonte técnica: `lib/roadmap.ts`. Painel: Administração → Gestão → 100 melhorias. O andamento editável é separado desta avaliação técnica. Homologação comercial, privacidade, acessibilidade e recuperação completa não são certificadas pela presença de código.

## Lançamento

| Nº  | Melhoria                                          | Estado           | Evidência e limite                                                                                                                                                   |
| --- | ------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Configurar o provedor de pagamentos               | Ativação externa | Configure STRIPE_SECRET_KEY e STRIPE_WEBHOOK_SECRET na hospedagem.                                                                                                   |
| 2   | Testar compra, confirmação, entrega e reembolso   | Ativação externa | As simulações existem; a validação real exige credenciais, webhook acessível e execução em ambiente de teste do provedor.                                            |
| 3   | Ativar acesso por e-mail                          | Ativação externa | Configure as chaves Clerk e valide a verificação de e-mail.                                                                                                          |
| 4   | Configurar e-mails transacionais                  | Ativação externa | Configure Resend e um remetente com domínio verificado.                                                                                                              |
| 5   | Confirmar responsável pela operação e privacidade | Ativação externa | Responsável, contato e critérios de retenção precisam ser confirmados pelo proprietário.                                                                             |
| 6   | Cadastrar primeiros materiais comerciais reais    | Ativação externa | Enviar arquivos comerciais originais e confirmar preços e direitos.                                                                                                  |
| 7   | Preparar coleção comercial de Veterinária         | Ativação externa | A estrutura das coleções existe; falta o conteúdo comercial autorizado.                                                                                              |
| 8   | Definir condições comerciais dos parceiros        | Implementado     | Política configurável por autor, aceite obrigatório, comissão padrão de 25% após taxa real e fotografia imutável por item vendido. A negociação final é do operador. |
| 9   | Configurar domínio próprio                        | Ativação externa | Escolher e conectar um domínio disponível, sob sua titularidade.                                                                                                     |
| 10  | Definir abertura do site ao público               | Ativação externa | Decisão do proprietário sobre a audiência; o compartilhamento atual é preservado.                                                                                    |

## Estudo

| Nº  | Melhoria                          | Estado       | Evidência e limite                                                                                                                   |
| --- | --------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| 11  | Ler PDFs na biblioteca            | Implementado | Leitor PDF.js com arquivo autorizado pelo servidor; arquivo gratuito original de três páginas validado no navegador.                 |
| 12  | Retomar última página             | Implementado | Página e zoom persistidos por estudante e material; retomada ao abrir.                                                               |
| 13  | Marcar páginas importantes        | Implementado | Marcadores privados por página, com navegação e exclusão.                                                                            |
| 14  | Anotar por página                 | Implementado | Anotações privadas por página, protegidas por titularidade e direito de acesso.                                                      |
| 15  | Destacar trechos                  | Parcial      | Trechos selecionados no texto extraído são salvos como destaques por página; ainda não há marcação sobre as coordenadas do PDF.      |
| 16  | Organizar por pastas ou etiquetas | Implementado | Uma pasta ou etiqueta por material e filtros na biblioteca.                                                                          |
| 17  | Estados de estudo                 | Implementado | Estados não iniciado, estudando e concluído, salvos no servidor.                                                                     |
| 18  | Pesquisar dentro do PDF           | Implementado | Busca de texto extraível em todas as páginas; PDFs digitalizados precisam de OCR externo.                                            |
| 19  | Planejamento de revisão           | Implementado | Próxima revisão por data e contagem de revisões vencidas na biblioteca.                                                              |
| 20  | Acessibilidade do leitor          | Parcial      | Controles rotulados, navegação por teclado e texto extraído alternativo. Falta validação com leitores de tela reais e PDFs marcados. |

## Descoberta

| Nº  | Melhoria                              | Estado       | Evidência e limite                                                                       |
| --- | ------------------------------------- | ------------ | ---------------------------------------------------------------------------------------- |
| 21  | Busca por termos semelhantes          | Implementado | Normalização de acentos e tolerância a um erro em termos com pelo menos quatro letras.   |
| 22  | Alternativas sem resultados           | Implementado | Filtros podem ser limpos e a API sugere disciplinas quando não encontra resultados.      |
| 23  | Salvar filtros                        | Implementado | Até vinte buscas nomeadas por usuário, com restauração dos filtros.                      |
| 24  | Materiais relacionados                | Implementado | Sugestões por disciplina, curso e autoria nas páginas dos materiais.                     |
| 25  | Comparar materiais                    | Implementado | Comparação de até três materiais por preço, nível, formato, tamanho e autoria.           |
| 26  | Seguir autores                        | Implementado | Seguir e deixar de seguir autores na conta do estudante.                                 |
| 27  | Avisos opcionais de novas publicações | Implementado | Avisos internos com adesão opcional; envio por e-mail depende da configuração do item 4. |
| 28  | Páginas de disciplinas completas      | Implementado | Páginas /disciplinas/:slug com assuntos, recortes, níveis e materiais disponíveis.       |
| 29  | Diferenciar materiais semelhantes     | Implementado | Assunto, nível e metadados exibidos na comparação e na página individual.                |
| 30  | Recomendações por preferências        | Implementado | Preferências explícitas de disciplinas aplicadas ao catálogo, removíveis pelo usuário.   |

## Produtos

| Nº  | Melhoria                                | Estado       | Evidência e limite                                                                                    |
| --- | --------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------- |
| 31  | Conhecimentos prévios                   | Implementado | Campo editável de conhecimentos prévios e exibição pública.                                           |
| 32  | Público do material                     | Implementado | Campo editável de público indicado e exibição pública.                                                |
| 33  | Conteúdo incluído e excluído            | Implementado | Descrição, objetivos, sumário e exclusões apresentados antes da compra.                               |
| 34  | Data e histórico de atualização         | Implementado | Histórico das versões publicadas e notas de atualização; versões anteriores continuam protegidas.     |
| 35  | Requisitos dos arquivos                 | Implementado | Campo de requisitos dos arquivos no cadastro e na página do produto.                                  |
| 36  | Galeria de amostras no celular          | Implementado | Galeria com botões, indicadores e gesto horizontal; imagens contidas no espaço disponível.            |
| 37  | Títulos dos componentes dos kits        | Implementado | Kits mostram os títulos reais dos componentes publicados.                                             |
| 38  | Perguntas frequentes por material       | Implementado | Perguntas frequentes editáveis por material.                                                          |
| 39  | Perguntas antes da compra com moderação | Implementado | Perguntas autenticadas com resposta moderada; perguntas pendentes não são expostas na página pública. |
| 40  | Comparar kit e materiais individuais    | Implementado | Preço do kit comparado à soma dos itens individuais, sem inventar economia.                           |

## Compras

| Nº  | Melhoria                        | Estado       | Evidência e limite                                                                                                                          |
| --- | ------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 41  | Solicitar reembolso pelo pedido | Parcial      | Solicitação, análise e aprovação integradas ao provedor; código e simulações validados. Reembolso real depende das chaves e de homologação. |
| 42  | Acompanhar etapas do reembolso  | Parcial      | Estados do provedor persistidos e atualizados por webhook assinado; falta homologação externa.                                              |
| 43  | Mensagens de pagamento          | Parcial      | Pedidos e retornos de pagamento exibem estados; os estados novos de serviço e assinatura ainda precisam de revisão integral de linguagem.   |
| 44  | Tentar novamente um pagamento   | Parcial      | Retoma a URL de sessão existente. Sessões expiradas exigem novo pedido; renovação automática ainda não implementada.                        |
| 45  | Comprovante de aquisição        | Implementado | Comprovante HTML protegido, com valores efetivos e aviso de que não substitui documento fiscal.                                             |
| 46  | Desconto em cada item           | Implementado | Desconto rateado em centavos nos itens e preservado no pedido.                                                                              |
| 47  | Motivo de cupom inválido        | Implementado | Mensagens específicas para cupom inválido, expirado, esgotado, usado ou inaplicável.                                                        |
| 48  | Presentear com material         | Implementado | Compra para destinatário; acesso reservado ao e-mail verificado, sem liberar o conteúdo ao remetente.                                       |
| 49  | Licenças para turma             | Implementado | Compra de até cem licenças, quota transacional e distribuição por e-mail verificado.                                                        |
| 50  | Histórico unificado por pedido  | Implementado | Detalhes do pedido reúnem itens, cupom, reembolso e atendimentos que citam seu identificador.                                               |

## Autores

| Nº  | Melhoria                             | Estado       | Evidência e limite                                                                                                         |
| --- | ------------------------------------ | ------------ | -------------------------------------------------------------------------------------------------------------------------- |
| 51  | Rascunho automático                  | Implementado | Rascunho de formulário salvo automaticamente após pausa na edição.                                                         |
| 52  | Recuperar preenchimento interrompido | Implementado | Recuperação de preenchimento com aceite de direitos e condições sempre desmarcados.                                        |
| 53  | Prévia da publicação                 | Implementado | Prévia interna do título, descrição e apresentação antes do envio.                                                         |
| 54  | Checklist de qualidade               | Implementado | Checklist de qualidade com declarações do autor e critérios de revisão.                                                    |
| 55  | Conferência de arquivo e cadastro    | Parcial      | Extensão, assinatura básica, tamanho e hash conferidos. Contagem de páginas e conteúdo ainda exigem conferência editorial. |
| 56  | Duplicar cadastro                    | Implementado | Duplicação cria rascunho sem arquivo, sem publicação e sem reaproveitar aceites.                                           |
| 57  | Modelos de capa Nimbus               | Implementado | Gerador de capas PNG com tipografia e quatro tons da identidade Nimbus.                                                    |
| 58  | Fila de ajustes editoriais           | Implementado | Fila de ajustes com retorno editorial e nova submissão.                                                                    |
| 59  | Comparar versões de cadastro         | Implementado | Comparação de campos entre fotografias anteriores do cadastro; arquivos têm histórico separado.                            |
| 60  | Programar lançamento aprovado        | Parcial      | Lançamento aprovado é liberado na primeira consulta ao catálogo após a data. Liberação sem visitas exige agendador.        |

## Curadoria

| Nº  | Melhoria                                         | Estado       | Evidência e limite                                                                                                     |
| --- | ------------------------------------------------ | ------------ | ---------------------------------------------------------------------------------------------------------------------- |
| 61  | Critérios editoriais por formato                 | Implementado | Critérios de curadoria adaptados aos formatos, inclusive atividades e vídeos.                                          |
| 62  | Padronizar referências                           | Implementado | Auxiliar de referências com campos estruturados; não valida automaticamente todas as normas bibliográficas.            |
| 63  | Registro de aspectos revisados                   | Implementado | Aspectos revisados registrados no evento editorial com responsável e data.                                             |
| 64  | Diferenciar credenciais declaradas e verificadas | Implementado | Credenciais declaradas separadas de verificação administrativa com evidência privada.                                  |
| 65  | Denúncias sobre autoria                          | Implementado | Denúncias autenticadas sobre autoria e qualidade, com tratamento pela administração.                                   |
| 66  | Identificar arquivos duplicados                  | Implementado | Hashes SHA-256 dos uploads e relatório de duplicatas para análise administrativa.                                      |
| 67  | Vincular correção a uma versão                   | Implementado | Correção pode apontar para uma versão já publicada do material.                                                        |
| 68  | Avisar sobre correções relevantes                | Implementado | Publicação de atualização gera aviso para compradores, destinatários e assinantes elegíveis; e-mail depende do item 4. |
| 69  | Avaliações de conteúdo, clareza e apresentação   | Implementado | Notas de conteúdo, clareza e apresentação, disponíveis a compradores.                                                  |
| 70  | Moderação e resposta de avaliações               | Implementado | Autor pode responder; somente administrador altera visibilidade com justificativa e auditoria.                         |

## Gestão

| Nº  | Melhoria                                           | Estado       | Evidência e limite                                                                                                           |
| --- | -------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| 71  | Período no resumo administrativo                   | Implementado | Resumo administrativo com filtro de vendas por período; saldos e pendências identificados como posição atual.                |
| 72  | Relatório por material                             | Implementado | Relatório agrupado por material com bruto, taxas, estornos e líquidos conciliados.                                           |
| 73  | Separar acervo próprio e parceiros                 | Implementado | Relatório separa acervo próprio e parceiros.                                                                                 |
| 74  | Exportar financeiro em CSV                         | Implementado | Exportação CSV protegida, por período e escopo do autor ou administração.                                                    |
| 75  | Evolução de vendas                                 | Implementado | Evolução mensal em tabela, derivada dos itens conciliados no período.                                                        |
| 76  | Resultado de campanhas                             | Implementado | Pedidos, desconto e receita atribuídos a cada cupom; sem alegação de causalidade ou lucro.                                   |
| 77  | Orientações para pendências financeiras            | Parcial      | Consulta de conciliação e indicação de bloqueio de saldo disponíveis. A triagem de divergências continua administrativa.     |
| 78  | Histórico de ajustes comerciais                    | Implementado | Mudanças comerciais auditadas, com regra histórica preservada por venda.                                                     |
| 79  | Permissões de administrador, revisor e atendimento | Implementado | Revisores e atendimento têm endpoints separados; nenhuma função de equipe recebe acesso administrativo ou financeiro global. |
| 80  | Tarefas com responsável e prazo                    | Implementado | Tarefas operacionais com responsável, prazo, estado e observações.                                                           |

## Operação

| Nº  | Melhoria                          | Estado  | Evidência e limite                                                                                                                                                    |
| --- | --------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 81  | Paginar listas grandes            | Parcial | Administração tem paginação SQL de vinte itens; catálogo tem carregamento em lotes. Algumas outras listas ainda usam limites fixos.                                   |
| 82  | Otimizar imagens e carregamento   | Parcial | PDF.js carregado sob demanda, imagens de amostra com lazy loading e listas em lotes. Pipeline de redimensionamento de imagens ainda pendente.                         |
| 83  | Recuperação de erros              | Parcial | Mensagens de falha, repetição de consultas e estados de carregamento nos fluxos principais; não houve teste exaustivo de todas as interrupções de rede.               |
| 84  | Monitorar falhas operacionais     | Parcial | Falhas inesperadas da API registradas sem conteúdo sensível. Indisponibilidade total exige monitor externo.                                                           |
| 85  | Alertas operacionais              | Parcial | Painel reúne falhas abertas, e-mails pendentes, reembolsos com problema e bloqueios de conciliação. Alertas externos automáticos não configurados.                    |
| 86  | Backup e restauração testados     | Parcial | Exportação de dados e manifesto de objetos, com restauração SQL ensaiada em banco isolado. Falta cópia dos objetos R2 e ensaio completo de recuperação da hospedagem. |
| 87  | Verificar arquivos enviados       | Parcial | Validação de extensão, cabeçalho, tamanho e hash implementada. Não substitui análise antimalware.                                                                     |
| 88  | Limites contra abuso              | Parcial | Limites por usuário e rota com expiração dos contadores. Proteção global contra abuso anônimo depende da infraestrutura.                                              |
| 89  | Revisão de acessibilidade         | Parcial | Responsividade, foco do modal, rótulos e movimento reduzido revisados. Auditoria assistiva completa pendente.                                                         |
| 90  | Revisar permissões periodicamente | Parcial | Permissões e alterações auditadas com função de equipe restrita; a revisão periódica depende do responsável operacional.                                              |

## Novas ofertas

| Nº  | Melhoria                          | Estado       | Evidência e limite                                                                                                                                                                                    |
| --- | --------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 91  | Flashcards interativos            | Implementado | Flashcards interativos com frente, verso, autoavaliação e datas de revisão.                                                                                                                           |
| 92  | Questões e simulados com correção | Implementado | Questões com pontuação no servidor, gabarito omitido antes da resposta e histórico individual.                                                                                                        |
| 93  | Trilhas de aprendizagem           | Implementado | Aulas organizadas em trilhas com progresso por estudante.                                                                                                                                             |
| 94  | Minicursos e videoaulas           | Implementado | Aulas de texto e vídeos incorporados autorizados; vídeos externos só carregam após ação do usuário.                                                                                                   |
| 95  | Assinatura de biblioteca          | Parcial      | Planos, checkout recorrente, portal e catálogo contratado implementados e testados com provedor simulado. Ativação real depende de Stripe.                                                            |
| 96  | Clube de estudos                  | Parcial      | Posts restritos e encontros vinculados a assinantes ativos. Dependem de plano, programação e conteúdo reais.                                                                                          |
| 97  | Agenda e contratação de mentorias | Parcial      | Ofertas, horários, lotação, termos, reservas e pagamento implementados; homologação de pagamentos e operação reais ainda pendente.                                                                    |
| 98  | Oficinas e aulas ao vivo          | Parcial      | Oficinas e aulas ao vivo usam agenda, lotação e link privado. Falta cadastrar encontros reais e validar a operação.                                                                                   |
| 99  | Serviços editoriais com orçamento | Parcial      | Briefing, orçamento, aceite, cobrança e entrega privada implementados; falta homologação real e definição do serviço comercial.                                                                       |
| 100 | Aplicativos iOS e Android         | Pendente     | O site responsivo e o manifesto PWA já existem. Aplicativos nativos, assinatura de builds, testes em aparelhos e publicação nas lojas não foram realizados. A etapa de aplicativos havia sido adiada. |
