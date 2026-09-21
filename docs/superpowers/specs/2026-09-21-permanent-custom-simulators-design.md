# Simulados permanentes e personalizados — design

## Objetivo

Fazer Simulados uma experiência autenticada e permanente, sem depender da Biblioteca local. O usuário poderá abrir provas completas e também montar um simulado por matérias específicas — como Física e Química — escolhendo a quantidade de questões.

## Catálogo

O catálogo terá três entradas:

1. **ENEM completo**: provas completas por dia e edições publicadas.
2. **ENEM por matéria**: Matemática, Física, Química, Biologia, História, Geografia, Português, Literatura, Inglês/Espanhol, Filosofia, Sociologia e demais matérias com questões publicadas.
3. **Concursos**: provas por cargo, com filtros de área, estado, ano e banca.

A existência do catálogo é independente de qualquer seleção de pasta pelo navegador. Provas de concursos ainda disponíveis somente em PDF aparecem como prova e gabarito no catálogo; entram no player interativo somente após as questões serem estruturadas e validadas.

## Banco de questões e geração

O servidor armazena questões publicadas com identificador estável, matéria, área, origem, ano, banca/cargo quando aplicável, enunciado, alternativas, gabarito e explicação opcional. Um simulado gerado salva sua composição: não é uma seleção efêmera do navegador.

No construtor, o usuário escolhe uma ou mais matérias e a quantidade total de questões. O servidor seleciona itens publicados sem repetir questões dentro da tentativa, grava a composição e devolve o simulado ao player. Quando a quantidade pedida ultrapassa a oferta das matérias escolhidas, o sistema informa a capacidade disponível e não completa com itens de outra matéria.

A geração inicial significa **montar com questões validadas do acervo**. IA não cria questões automaticamente nesse fluxo.

## Experiência

A tela Simulados mostra primeiro as três entradas do catálogo e o botão **Montar simulado**. O construtor permite marcar mais de uma matéria, ajustar quantidade e iniciar. Após isso, o player já existente controla tempo, respostas, revisão e caderno de erros. Resultados e respostas ficam associados ao usuário e ao simulado gerado.

## Integração de fontes

Os sete JSONs ENEM existentes serão importados como conteúdo publicado. Os manifestos de questões extraídas de ENEM e concursos são fontes de preparação; uma questão só é publicada quando possui alternativas e gabarito validados. PDFs e gabaritos de concurso não serão tratados como questão interativa até essa condição ser atendida.

## Critérios de aceite

- Simulados funciona sem Biblioteca local e sem `showDirectoryPicker`.
- O usuário encontra ENEM completo e coleções por matéria no catálogo.
- O usuário pode escolher Física, Química ou ambas e definir uma quantidade.
- Questões de uma composição não se repetem e pertencem somente às matérias selecionadas.
- O sistema rejeita quantidade acima da capacidade com mensagem clara.
- Um simulado gerado pode ser retomado e revisado; resultados seguem o usuário autenticado.
- Concursos com PDF/gabarito permanecem acessíveis no catálogo e só usam o player após validação estruturada.

## Fora de escopo

Não usar IA para produzir questões, não armazenar áudios e não baixar arquivos do Drive. A extração e validação em massa dos 235 PDFs de concursos será um fluxo de conteúdo separado do gerador.

