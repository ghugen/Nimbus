# Modo Estudar agora — versão 13

Na biblioteca, o botão de estudo abre um espaço com leitura, caderno e prática. Em telas largas PDF e caderno aparecem lado a lado. Até 760 pixels, os controles Ler, Anotar e Praticar mostram uma área por vez. O PDF permanece montado ao mudar de área, preservando página e zoom; as regiões ocultas não recebem interação visual. As páginas citadas nas atividades abrem novamente a área de leitura.

## Fluxo

1. Abrir o material da biblioteca. A página é retomada pelo estado do leitor já existente.
2. Iniciar uma sessão explicitamente. Existe no máximo uma sessão aberta por estudante e material. Fechar o leitor mantém a sessão para retomada.
3. Salvar anotações por página. A página da anotação é independente da página atual de leitura, para permitir referências a outras páginas sem alterar o ponto de retomada.
4. Criar um cartão a partir de uma anotação, conferir a pergunta e salvar. O verso e a página vêm da anotação autenticada no servidor. Um mesmo registro não gera cartões duplicados por repetição do envio. Os cartões são pessoais.
5. Em Praticar, abrir a fila de cartões ou simulados. O cabeçalho conta cartões com agendamento vencido ou para hoje; cartões nunca revisados também aparecem na fila de prática, mas não entram nesse contador.
6. Concluir a sessão com resumo, progresso e próxima revisão opcional. A conclusão salva também as anotações gerais, preserva pasta/zoom e é idempotente. O registro de abertura/conclusão não mede estudo ativo nem certifica aprendizagem.

Anotações por página exigem o botão Salvar anotação; o texto ainda não enviado não é incluído automaticamente na conclusão. Anotações gerais podem ser salvas separadamente ou junto da conclusão. Para formatos diferentes de PDF, o download continua disponível e as ferramentas pessoais permanecem acessíveis.

## Dados e segurança

As rotas `study-workspace`, `study-session` e `annotation-card` exigem identidade e direito de acesso ao material. Sessões e conversões de anotações pertencem à própria conta e integram sua exportação de dados. A migração 0026 cria `study_sessions`, `annotation_cards`, índice de sessão aberta e índice de histórico. O processamento das ações não usa IA nem serviço adicional. Os novos dados seguem os procedimentos de retenção/exclusão de PRIVACIDADE_OPERACAO.md; não há expurgo automático.

A sincronização do leitor atualiza somente os campos enviados. Assim, atualizações de página e zoom não regravam a revisão ou o status a partir de um estado antigo. A conclusão transacional usa um identificador interno por tentativa para evitar que envios concorrentes sobrescrevam o primeiro resultado.

## Validação

- 8 testes unitários e 521 verificações de integração, com SQLite real e adaptadores isolados.
- Autorização, retomada de sessão, revisão de datas inválidas, conversão preservando a fonte, repetição de envio, conclusão e exportação privada.
- Conferência no Chrome do componente real, compilado numa página isolada com API fictícia: anotar, criar cartão, localizar o cartão na prática, concluir e consultar o histórico.
- Largura de celular em iframe de 390 pixels (375 úteis com barra de rolagem), sem rolagem horizontal e com uma região de estudo visível por vez. Conferência em 1348 pixels: leitura/caderno em duas colunas, sem rolagem horizontal.
- A página de QA, seus mocks e arquivos temporários ficam em `work`, não entram na publicação. Não houve injeção de identidade de teste no site publicado, teste em aparelho físico ou aquisição numa conta real nesta validação.

## Assistente de recomendação de materiais

O assistente de descoberta solicitado pode conversar sobre curso, disciplina, objetivo e dificuldades, consultar somente o catálogo disponível, explicar sugestões e distinguir itens gratuitos e pagos. É uma próxima integração; não foi ativado por esta entrega. A assistência por IA já preparada depende de provedor e modelo configurados. Não há contratação automática de serviços ou transmissão das anotações a um provedor nesta alteração.
