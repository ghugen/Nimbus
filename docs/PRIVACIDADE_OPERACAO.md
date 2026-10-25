# Privacidade: procedimentos para a operação Nimbus

Este roteiro técnico não certifica adequação jurídica. Antes do lançamento comercial, o responsável deve aprovar as finalidades, bases legais, retenção e contratos aplicáveis. A central administrativa exige nome ou razão social do controlador, contato público de privacidade e critérios de retenção. Não preencher esses campos com dados fictícios.

## Inventário inicial para validação

| Dados                                            | Finalidade                                   | Avaliação inicial de fundamento                                            | Acesso                                         |
| ------------------------------------------------ | -------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------- |
| Identificador de acesso, nome e e-mail           | Conta, autenticação e entrega                | Execução do serviço solicitado                                             | Titular e administração                        |
| Curso e instituição opcionais                    | Perfil acadêmico                             | Validar necessidade/fundamento; não condicionar compra                     | Titular e administração                        |
| Pedidos e itens                                  | Entrega, conciliação, estornos e comprovação | Contrato, obrigações aplicáveis e exercício de direitos, conforme operação | Titular e administração                        |
| Política comercial e aceite por venda/publicação | Registrar condições contratadas              | Contrato e exercício de direitos                                           | Titular e administração                        |
| Taxas, comissões e referência de repasse         | Demonstrativo e conciliação                  | Contrato e obrigações aplicáveis                                           | Autor correspondente e administração           |
| Anotações, progresso e favoritos                 | Recursos solicitados pelo estudante          | Execução do serviço                                                        | Titular                                        |
| Avaliações e nome público                        | Avaliação voluntária do material adquirido   | Validar fundamento e transparência da publicação                           | Público; edição pelo titular                   |
| Arquivos e autoria                               | Comercialização autorizada                   | Contrato com autor; verificar dados de terceiros                           | Autor, administração e compradores autorizados |
| Solicitações de suporte/privacidade              | Atendimento e direitos                       | Contrato/obrigação aplicável/exercício de direitos                         | Titular e administração                        |
| Histórico administrativo                         | Segurança e prestação de contas              | Avaliar obrigação/legítimo interesse e proporcionalidade                   | Administração                                  |

Não há coleta local de senha ou cartão completo. Não solicitar documentos ou dados bancários por tickets. O registro de repasse armazena apenas referência de transferência, não comprovante nem chave PIX. Não há marketing ou rastreamento publicitário implementado.

## Fornecedores a avaliar

Hospedagem e identidade Sites/ChatGPT, infraestrutura Cloudflare D1/R2, Stripe quando habilitada e Google Fonts para fontes visuais. Confirmar os papéis de cada fornecedor, termos contratuais, suboperadores, regiões de processamento e mecanismo aplicável a transferências internacionais. Os dados de cartão são tratados pelo checkout do provedor.

O carrinho usa armazenamento local do navegador; o service worker guarda apenas recursos estáticos de ausência de conexão e ícones, não APIs nem documentos privados. A autenticação depende dos recursos da hospedagem. Se publicidade ou analytics opcionais forem adicionados, revisar previamente finalidade, base legal e controles de preferência. Não adicionar uma caixa genérica “aceito a LGPD”.

## Atendimento de solicitações

1. Usuário autenticado solicita acesso, correção, exclusão, oposição ou informações na Central de privacidade. Uma exportação JSON dos dados da conta está disponível por endpoint autenticado, sem credenciais internas.
2. A administração verifica o protocolo, delimita o pedido e acompanha os prazos legais aplicáveis ao caso. A ferramenta registra datas; não substitui o acompanhamento de prazos pela operação.
3. Analisar documentos comerciais, obrigações e exercício de direitos antes de excluir. Registrar justificativa para retenção ou restrição. Não apagar comprovantes necessários nem prometer eliminação indiscriminada.
4. Executar correção/exclusão/anonimização autorizada no sistema e fornecedores aplicáveis com procedimento restrito, verificação e registro. **Responder no painel não executa exclusão.** A ferramenta não inclui exclusão automática da conta.
5. Informar o resultado e eventuais restrições no próprio protocolo. Não enviar e-mails automaticamente ou expor pedidos de outros usuários.
6. Disponibilizar também o contato público para pessoas sem acesso à conta, quando o responsável o configurar. A operação deve acompanhar essa caixa de e-mail externamente.

## Retenção e backups

Definir uma tabela de prazos por categoria, fundamentos e destino final. Validar retenção fiscal, contábil, contratual e de segurança com os responsáveis competentes. Informar critérios públicos na administração; não há expurgo automático nesta implementação. Confirmar políticas de backups e restauração da hospedagem e armazenamento, testar recuperação e considerar o ciclo de expiração das cópias ao atender exclusões. Esses procedimentos de backup não foram configurados nem auditados por esta alteração.

## Incidente

Conter acessos afetados, preservar evidências, identificar dados e titulares atingidos, avaliar risco/dano relevante e documentar decisões. Consultar o regulamento atual da ANPD para determinar comunicação e prazos; não usar prazo fixo genérico. Designar responsável pelo atendimento, comunicação e correção. Não compartilhar incidentes ou dados dos titulares em canais públicos.

## Materiais de terceiros e público menor de idade

Não publicar prontuários identificados, listas de alunos, documentos, imagens ou dados de saúde de pessoas sem análise apropriada. Anonimizar quando adequado e validar autorização e fundamento. Revisão editorial humana não foi automatizada. Definir público etário e requisitos para tratamento de dados de crianças/adolescentes antes de oferecer a operação a esse público.

## Referências oficiais

- LGPD compilada: https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm
- ANPD, agentes de pequeno porte: https://www.gov.br/anpd/pt-br/acesso-a-informacao/institucional/atos-normativos/regulamentacoes_anpd/resolucao-cd-anpd-no-2-de-27-de-janeiro-de-2022
- ANPD, guia de cookies: https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia_orientativo_cookies_e_protecao_de_dados_pessoais

## Novos registros do marketplace

O inventário inclui perfis públicos autorizados, histórico editorial e versões, componentes de kits por compra, notificações internas e fila de e-mails transacionais. A exportação inclui avisos e componentes adquiridos. Clerk e Resend são integrações opcionais; validar contratos, configuração, bases aplicáveis e transferências antes de ativá-los. O acesso não mescla contas de provedores distintos.

Medição de catálogo é opcional e desativada sem escolha afirmativa. O identificador da sessão permanece no sessionStorage; o servidor registra apenas hash por evento/material/dia, tipo, material e data. Relatórios agregados restritos ao autor e administrador. Definir rotina e prazo de retenção para eventos e fila de e-mails; nesta versão não existe expurgo automático. Revogar a escolha impede novos eventos, sem apagar automaticamente os anteriores.

## Campanhas e participação dos estudantes

O inventário também inclui uso de cupons por conta e pedido, sugestões de materiais e relatos de correção por página. Sugestões são privadas ao estudante e à administração; correções também são acessíveis ao autor do material. Relatos não devem conter dados identificáveis de pacientes ou terceiros. Respostas geram avisos transacionais. A exportação inclui os registros do solicitante. Definir e aplicar retenção desses registros em conjunto com os demais dados operacionais.

PDFs de demonstração são públicos, gratuitos e originais; o acesso direto dispensa cadastro. O carrinho e a aquisição na biblioteca continuam opcionais. A audiência da hospedagem permanece conforme o compartilhamento configurado pelo proprietário.
