# Coleção aberta Nimbus

O lançamento começa com uma biblioteca pública e quatro PDFs originais de organização acadêmica, de três páginas cada: planejamento, leitura de artigos, fichamento e revisão ativa. Os arquivos ficam em `public/materiais-gratuitos/`. Não são apostilas técnicas de Patologia Veterinária; novos materiais dessa área dependem de produção e revisão editorial antes de publicação.

A vitrine pública e as páginas de materiais excluem itens demonstrativos pagos, sem apagá-los da administração. O catálogo mantém o guia textual gratuito anterior, além dos quatro PDFs. O critério está em `isPublicListing`, compartilhado pela API do catálogo e pelos serviços das páginas públicas. Produtos reais publicados futuramente poderão aparecer com preço e condições; nada foi publicado como oferta paga nesta alteração.

A página inicial destaca download sem cadastro. Cards e páginas dos PDFs dão prioridade ao arquivo direto. A aquisição na biblioteca continua opcional, com login; favoritos, planos salvos, histórico, administração e arquivos privados conservam as autorizações anteriores. Abrir a audiência do site não concede permissões administrativas nem torna públicos os arquivos privados adquiridos. Não foram implementadas assinaturas comerciais de e-mail ou incluídos visitantes em listas de marketing.

A audiência da hospedagem foi solicitada como pública pelo proprietário nesta conversa. A mudança é feita pela configuração Sites, separadamente do código. Guardar a confirmação retornada pela ferramenta e conferir página inicial e arquivos como visitante, sem usar credencial de bypass.

Os PDFs da coleção aberta permanecem nos mesmos caminhos. Não substituir uma URL gratuita por checkout ao lançar novas ofertas. Alterar uma publicação futura não elimina as cópias já baixadas; não prometer revogação de arquivos locais.

Validação: TypeScript, build e 20 testes unitários, além de 601 verificações de integração em SQLite isolado com provedores simulados. Os testes conferem catálogo público sem demonstrações pagas, quatro links públicos e restrições das áreas pessoais. Os quatro PDFs foram inspecionados e contêm três páginas cada. A homologação de pagamentos reais é uma etapa futura.
