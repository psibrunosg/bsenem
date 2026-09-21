# Navegação de conteúdo por instituição — design

## Objetivo

Transformar o catálogo autenticado em uma navegação clara por instituição e formação, sem exigir a Biblioteca local do navegador. Videoaulas, áudios e documentos devem usar os links já importados, preservando o mesmo caminho de organização em cada aba.

## Estrutura de navegação

A barra lateral terá quatro destinos de conteúdo:

1. **Biblioteca de estudos** — visão institucional de todo o acervo.
2. **Videoaulas** — apenas itens do tipo vídeo.
3. **Áudios** — apenas itens do tipo áudio.
4. **Documentos** — PDFs e outros documentos compatíveis.

`Biblioteca local` deixa de aparecer no menu, nas rotas e nos fluxos do usuário. O catálogo remoto autenticado é a fonte dessas quatro experiências.

Cada destino mantém a mesma hierarquia:

```text
Instituição → graduação / pós-graduação / matéria → módulo → materiais
```

Exemplo: `Faculdade Metropolitana → Psicologia Comportamental Dialética → TCC → módulos → videoaulas`. Ao entrar em uma formação ou módulo, os seus filhos são mostrados como cards de grade; o usuário não recebe uma lista misturada de todo o acervo.

## Galeria institucional

A página inicial da Biblioteca de estudos mostra uma seção por instituição. Cada seção usa um trilho horizontal de cards de formações, matérias ou graduações, conforme a taxonomia existente:

- Descomplica: matérias.
- Unifatécie: graduações.
- Faculdade Metropolitana e Cognitivo: pós-graduações e materiais complementares.
- INPBE: módulos.

Os cards ficam mais compactos que a versão atual. O trilho é navegado por setas anterior/próxima no canto superior direito da própria seção, com suporte a teclado, toque e rolagem horizontal. Não haverá carregamento de uma grade de aulas aleatórias abaixo dos trilhos nem botão alternativo que reintroduza essa mistura.

## Visualização de materiais

Somente no último nível da hierarquia aparecem materiais individuais. A aba atual define quais tipos podem aparecer:

- Videoaulas: vídeos incorporados dentro do BS Estudos quando o Drive permitir prévia; link externo como alternativa.
- Áudios: player incorporado quando o link permitir; link externo como alternativa.
- Documentos: PDFs e documentos aparecem exclusivamente nesta aba, também com prévia incorporada quando possível e alternativa de abertura no Drive.

Assim, PDFs não aparecem no percurso de Videoaulas ou Áudios e não competem visualmente com módulos e formações.

## Dados e comportamento

O endpoint autenticado de catálogo continuará a usar `study_library_items` e os links diretos já armazenados. Ele precisa aceitar um filtro de formato compatível com cada rota e retornar, para o caminho selecionado, apenas:

- filhos imediatos, quando o usuário ainda está navegando na hierarquia;
- materiais terminais do formato selecionado, quando não há filhos;
- paginação somente para uma lista terminal de materiais.

O servidor, e não o cliente, define a ordem estável dos filhos. Não haverá sorteio ou agregação de itens de caminhos diferentes.

## Critérios de aceite

- A sidebar não exibe Biblioteca local e nenhum fluxo pede seleção de pasta do navegador.
- Biblioteca de estudos, Videoaulas, Áudios e Documentos usam o catálogo autenticado e os links importados.
- Os trilhos institucionais exibem cards compactos e setas superiores funcionais, sem despejar materiais aleatórios na tela inicial.
- Ao abrir uma formação, incluindo TCC, os módulos são cards em grade; materiais só aparecem após o caminho chegar ao último nível.
- PDFs não são listados em Videoaulas ou Áudios e são encontrados em Documentos pela mesma hierarquia.
- Os links diretos continuam sendo validados e a prévia incorporada mantém o fallback seguro de abrir no Drive.
- Testes cobrem filtro por rota/formato, hierarquia sem mistura, remoção da rota local do menu e navegação por setas.

## Fora de escopo

Esta alteração não cria, baixa ou armazena os arquivos do Drive; ela usa apenas metadados e links diretos já importados. A criação do banco de questões e do gerador de simulados será especificada separadamente.
