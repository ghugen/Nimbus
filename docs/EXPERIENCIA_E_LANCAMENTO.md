# Experiência e preparação para lançamento

Atualização: 26/10/2026.

| Melhoria solicitada | Entrega | Limite |
| --- | --- | --- |
| Comece por aqui | /comecar e menu da loja: curso, disciplina, objetivo e sugestões explicadas | Regras do catálogo, sem perfil psicológico nem promessa de desempenho |
| Índice de qualidade editorial | Quadro de transparência por material, com informação cadastrada ou verificação registrada | Sem nota artificial de qualidade, certificação ou validação científica automática |
| Amostras acessíveis | /amostras/:id com HTML semântico, texto selecionável, ajuste de fonte e descrições de imagens | Depende da prévia e das descrições fornecidas; não certifica acessibilidade dos PDFs |
| Feedback após o estudo | Formulário privado para titulares de acesso, relatório do autor/equipe e remoção pelo estudante | Não é avaliação acadêmica nem prova de eficácia; sem identidade exibida ao autor |
| Procura por temas | Administração → Procura por temas: buscas com/sem resultados, favoritos, mural e eventos | Medição opcional; não guarda texto da busca nem identificador do visitante; sinais expiram em até noventa dias com limpeza nas próximas gravações |
| Checklist de lançamento | Espaço do autor → Meus materiais → Conferir preparação | Conferência automática e orientativa; não publica nem aprova conteúdo |
| Política por produto | Condições públicas de atualização; cópia imutável por aquisição e proposta institucional | Não altera a política de compras anteriores; não implementa restrições de versões que o sistema não aplica |
| Onboarding de autores | Espaço do autor → Primeiros passos | O aceite das condições continua no envio; nenhum contrato é aceito pelo assistente |
| Teste com estudantes | /avaliar, cinco tarefas e formulário autenticado; painel de relatos na administração | Roteiro e formulário implementados; participação e observação de estudantes reais ainda precisam acontecer. Não grava tela nem cliques |
| Prontidão para lançamento | Administração → Prontidão para lançamento | Separa configuração detectada e evidências manuais. Nenhuma marcação ativa pagamentos, envia e-mails ou certifica conformidade |

## Proteção das informações

Feedback e relatos de usabilidade exigem consentimento no envio e ficam vinculados à conta para atender solicitações de privacidade. Os relatórios não mostram nome, e-mail ou ID do estudante. Textos livres podem conter dados digitados pelo usuário; os formulários orientam a não inserir informações pessoais de terceiros. A exportação privada de dados inclui os novos registros.

A medição de busca é independente do login e só é enviada pelo cliente quando permitida na preferência de medição. O servidor exige consentimento e token válido, valida filtros, calcula se há resultados e guarda apenas curso, disciplina, tipo do resultado, data e um hash de deduplicação. Não guarda consulta textual, token do visitante ou vínculo com a conta. Os indicadores não representam pessoas únicas e podem conter ruído; não devem ser usados isoladamente para definir produção.

## Validação

Testes em SQLite real com R2 e Stripe simulados cobrem autorização, consentimento, deduplicação, atualização de feedback, exportação privada, transparência editorial sem verificações inventadas e preservação de condições de aquisição. A verificação visual cobre as páginas públicas e os controles de navegação. Não foi realizado estudo com participantes humanos nem certificação de acessibilidade assistiva.
