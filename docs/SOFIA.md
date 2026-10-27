# Sofia — assistente de estudos da Nimbus

Acesso pelo botão “Fale com a Sofia” ou pelo rodapé. A versão `sofia-rules-v1` usa regras locais, busca lexical e assuntos relacionados. Não chama um modelo externo, não foi treinada como um modelo generativo e pode não compreender algumas frases. Não exige chave de IA. Permanecem os custos normais de hospedagem e armazenamento.

## Uso

- Conversar: informar curso, tema, formato e orçamento; refinar a mesma busca com “só gratuitos” ou “até R$ 30”. As sugestões usam materiais publicados reais e explicam a correspondência. Sem resultado compatível, não inventam produtos. Demonstrações pagas são excluídas.
- Biblioteca opcional: entrar e escolher conectar para consultar materiais com acesso atual, página de retomada e revisões pendentes. Não consulta o texto das anotações. Presentes, kits e assinaturas respeitam os direitos atuais; abrir um material confere novamente o acesso.
- Meu plano: informar até 20 temas, 10 a 180 minutos por dia, prova opcional, horário e fuso. Prévia de até 14 dias alterna estudo, recordação e revisão. A soma das tarefas respeita o tempo diário. Temas que não couberem são informados. O roteiro não garante aprendizagem nem exige compras.
- Salvar o plano requer conta. Cada versão tem tarefas próprias; salvar outra substitui os checks anteriores. Checks não alteram notas ou progresso acadêmico do leitor.
- Exportar agenda cria `.ics` para importar no calendário. Alarmes de dez minutos são opcionais. Horários são locais e interpretados pelo calendário: conferir fuso e datas ao importar. A plataforma não envia lembretes externos por conta própria.
- Preferências: preenchimento temporário por padrão. Gravação exige escolha explícita e botão Salvar. A exclusão das preferências/plano exige confirmação própria e preserva compras e anotações.

## Dados e limites

Mensagens permanecem apenas na memória da página, são descartadas ao sair e não são enviadas a um endpoint de conversa, gravadas no banco ou transmitidas a um fornecedor de IA. Não inserir dados de terceiros. A troca de conta reinicia a Sofia.

`sofia_settings` armazena somente preferências explicitamente salvas e o plano, por titular. `sofia_task_checks` armazena tarefas concluídas da versão atual. Ambos entram na exportação privada da conta. O botão de apagar remove esses registros do titular no banco ativo; backups seguem a política operacional. A conexão com a biblioteca é opcional e não equivale a autorização para salvar preferências.

O catálogo de recomendação tem limite de 500 itens; a interface mostra quantidade consultada e total. O contexto privado limita-se a 150 materiais com acesso atual. Consultas privadas usam lotes para evitar uma consulta por produto. Escritas têm limite de 30 por minuto por conta/rota. Planos são reconstruídos e validados no servidor, inclusive data real, fuso, versão e tarefa. Nenhum arquivo privado ou gabarito aparece no catálogo da Sofia.

## Implementação e validação

Núcleo determinístico: `lib/sofia-core.ts`. API: `lib/sofia.ts`. Interface: `components/sofia.tsx`. Migração: `0027_sofia_assistant.sql`.

Validação: 16 testes unitários e 567 verificações de integração em SQLite isolado com serviços externos simulados, além de TypeScript e build. Cobertura inclui inferência, filtros, ausência de resultados, orçamento, conservação de minutos, calendário/escape, acesso por conta, presentes, revogação e versões de tarefas. Conferência no navegador como visitante: recomendação gratuita, tema sem correspondência, explicação de limites, prévia e check de plano e layout de 390 px. Conta autenticada foi verificada pela integração; importação em calendário real e dispositivos físicos não foram homologadas.

## Evolução possível

Ampliar vocabulário a partir de consultas agregadas e consentidas; avaliar qualidade das recomendações com um catálogo maior; adicionar busca semântica ou modelo externo somente quando houver necessidade demonstrada, orçamento, controles de privacidade e avaliação de respostas. A assistência editorial externa existente é um módulo separado e não é necessária para a Sofia.
