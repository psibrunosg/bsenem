# Plano mínimo - imagens fiéis nos simulados ENEM locais

## Objetivo

Exibir em um simulado local a imagem oficial associada a cada questão ENEM, mantendo o arquivo e todos os seus assets dentro da pasta que o usuário autorizou no seletor de biblioteca. Não há upload, URL remota, caminho local persistido em servidor ou fallback textual inventado.

## Contrato de conteúdo

Cada questão poderá declarar `images`, um vetor opcional de caminhos relativos POSIX, por exemplo `assets/dia-1/q-005-1.png`. A ausência do campo preserva o comportamento textual atual. Um item que dependa de figura só será marcado publicável quando todos os arquivos declarados existirem e forem imagens válidas. Alternativas que sejam pictóricas devem ser preservadas como recortes separados, na ordem A-E; a prova não recebe texto substituto ou placeholder.

O manifesto registra, para cada asset, caderno, número da questão, página do PDF, índice visual, hash e o caminho relativo. O texto do enunciado e das alternativas é preservado quando extraível de forma fiel; a imagem oficial continua sendo a fonte visual.

## Implementação proposta

1. Em `src/services/examSchema.js`, validar `images` somente quando presente: vetor não vazio de strings relativas normalizadas, sem barra inicial, `..`, barra invertida, esquema URL, query ou fragmento. Repassar o vetor pelo adaptador para o player.
2. Em `LocalLibraryService`, ao abrir o JSON de prova, resolver cada segmento do caminho a partir do diretório que contém o arquivo de prova, usando somente `getFileHandle` naquele diretório. Rejeitar qualquer segmento inválido ou handle ausente. Criar URLs de objeto apenas para os handles resolvidos.
3. Associar essas URLs ao exame em memória, nunca ao IndexedDB. Ao atualizar, desconectar ou perder permissão da biblioteca, revogar todas as URLs de objeto, limpar a associação e tornar o exame indisponível.
4. Em `ExamPlayer` e `QuestionCard`, renderizar todas as imagens recebidas na sequência registrada, com `alt` informativo somente quando houver texto fiel fornecido pela prova; caso contrário, usar descrição neutra de imagem oficial e manter o recorte visual. Os controles A-E permanecem na mesma ordem do caderno.
5. Registrar diagnósticos locais para asset ausente, caminho inválido, formato não suportado e permissão revogada. Nenhum desses casos publica uma questão visual incompleta.

## Testes e aceite

- Aceita imagens relativas simples e múltiplas imagens por questão; rejeita `../`, caminhos absolutos, URLs e barras invertidas.
- Uma imagem em subdiretório não pode resolver fora da pasta selecionada.
- A questão exibe recortes oficiais em ordem e as respostas A-E continuam ligadas aos índices 0-4 originais.
- Após revogação, atualização ou destruição do player, não há URL de objeto ativa e o item não é iniciado.
- Arquivo de prova sem `images` continua válido e não altera a experiência atual.
