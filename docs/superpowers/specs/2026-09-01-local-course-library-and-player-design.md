# Biblioteca local por cursos e player único

**Status:** desenho aprovado, aguardando revisão do documento e aprovação do plano de implementação.

## Objetivo

Transformar a biblioteca local de arquivos em uma experiência de curso organizada, sem enviar os arquivos ao servidor:

- navegar automaticamente por curso, módulo e submódulo;
- apresentar aulas, áudios e PDFs como cards claros, em vez de uma lista crua de arquivos;
- relacionar vídeo e áudio da mesma aula pelo mesmo nome-base;
- usar um único player completo, sem a barra inferior duplicada;
- preservar posição, volume, mute e velocidade ao alternar entre vídeo e áudio.

Não haverá catálogo manual, manifesto de curso, upload, alteração na pasta do usuário ou migração de banco para esta funcionalidade.

## Contrato da pasta local

O usuário escolhe uma pasta pelo seletor existente. A leitura é automática e recursiva.

```text
Biblioteca escolhida
└── Curso
    ├── Módulo
    │   ├── Vídeos
    │   │   └── Apresentando o curso.mp4
    │   ├── Áudios
    │   │   └── Apresentando o curso.mp3
    │   └── PDFs
    │       └── Leitura complementar.pdf
    └── Submódulo
        └── Vídeos
```

### Regras de classificação

1. Diretórios de tipo são identificados sem depender de maiúsculas, acentos ou singular/plural: `video`, `vídeo`, `videos`, `vídeos`, `audio`, `áudio`, `audios`, `áudios`, `pdf` e `pdfs`.
2. Todo diretório que não for de tipo é tratado como curso, módulo ou submódulo conforme sua posição na árvore.
3. Se a pasta selecionada contém diretamente diretórios de tipo, ela própria é um curso. Se contém pastas de curso, cada uma delas aparece no primeiro nível da árvore.
4. Materiais diretamente no curso, sem pasta de módulo, aparecem na seção automática `Conteúdos do curso`.
5. A ordenação segue primeiro a estrutura física da pasta e, dentro dela, a ordenação natural do nome original. O nome original continua sendo usado apenas para localizar o arquivo; não é exibido quando for técnico.
6. Vídeo e áudio pertencem à mesma aula quando estão no mesmo módulo e possuem o mesmo nome-base, ignorando extensão. Exemplo: `O que é evidência.mp4` e `O que é evidência.mp3`.
7. Um PDF nunca entra na fila de reprodução. Ele é material complementar do módulo ou da aula em que estiver localizado.

## Títulos e capas automáticos

### Normalização de títulos

O título mostrado remove prefixos de ordenação ou códigos apenas se restar texto descritivo. Exemplos:

| Arquivo de origem | Título exibido |
| --- | --- |
| `01-Introdução.mp4` | `Introdução` |
| `04_VIDEOAULA_03.mp4` | `Videoaula` |
| `C4-A3-MC4 - Evidência.pdf` | `Evidência` |

Se o nome for somente um código, ele não será exposto na interface. O card receberá o rótulo neutro `Material complementar`; o identificador técnico continuará interno para abertura correta do arquivo. Essa é uma limitação assumida da organização 100% automática: o sistema não inventa um assunto que não existe no nome ou na pasta.

### Capas

- Vídeos: usar o primeiro frame disponível como miniatura; se a extração falhar, usar uma capa visual do módulo.
- Áudios: usar uma capa visual com forma de onda e cor do módulo.
- PDFs: usar card de leitura com ícone, extensão e dados disponíveis; não renderizar uma lista textual sem tratamento visual.

Nenhuma miniatura é enviada a servidor. Tudo é criado localmente a partir do arquivo selecionado ou por fallback visual.

## Navegação e cards

### Biblioteca local

- Coluna esquerda: árvore expansível `Curso → Módulo → Submódulo`.
- Área principal: cabeçalho do caminho atual, filtros de `Todos`, `Vídeos`, `Áudios` e `PDFs`, e cards ordenados do módulo escolhido.
- Cards de aula mostram capa, título limpo, tipo disponível, duração quando conhecida e indicação de vídeo/áudio quando houver ambos.
- Cards de PDF mostram título, tipo e metadados disponíveis.
- A seleção de pasta, alteração de pasta, atualização e reset da biblioteca existentes permanecem acessíveis.

### Videoaulas e Áudios

As abas deixam de despejar todos os itens em uma grade global. Cada uma mostra os mesmos cursos e módulos, filtrando o tipo selecionado. A aula com vídeo e áudio é uma única entidade nos dois contextos.

## Player único

### Layout

- Abrir aula leva a uma tela dedicada com player completo.
- Existe somente uma lista de aulas: a fila do módulo, ao lado ou abaixo do player conforme largura da tela.
- A barra inferior global de reprodução é removida completamente.
- PDFs do módulo aparecem como materiais complementares, fora da fila de reprodução.

### Controles

- reproduzir/pausar;
- anterior e próxima aula do módulo;
- avançar e retroceder intervalos curtos;
- posição com seek;
- velocidade;
- volume funcional, slider e silenciar/restaurar;
- troca `Vídeo`/`Áudio` somente quando a aula possuir os dois formatos.

### Sessão de reprodução

Uma única sessão de mídia mantém:

```text
lessonId, formatoAtivo, tempoAtual, volume, silenciado, velocidade, estaReproduzindo
```

Ao trocar de vídeo para áudio ou de áudio para vídeo, o player carrega o arquivo alternativo, aplica os valores acima e busca o tempo mais próximo que exista no novo arquivo. Como a troca é acionada pelo usuário, a tentativa de retomar a reprodução é permitida; se o navegador a bloquear, o player continua pausado com ação explícita de reproduzir.

Ao abrir outra aula, a sessão passa a representar somente essa nova aula. Navegar para uma tela que não é de reprodução não cria barra, mini-player ou lista paralela.

## Estados e mensagens

| Estado | Comportamento esperado |
| --- | --- |
| Sem biblioteca conectada | orientação e ação para escolher uma pasta |
| Carregando pasta | progresso visual sem cards vazios enganosos |
| Biblioteca sem mídia reconhecida | explicar tipos aceitos e oferecer troca de pasta |
| Permissão da pasta perdida | pedir nova autorização, sem apagar a configuração silenciosamente |
| Módulo sem itens do filtro | informar que não há itens daquele tipo, mantendo os demais filtros disponíveis |
| Formato alternativo ausente | ocultar o seletor Vídeo/Áudio; nunca mostrar controle inoperante |
| Miniatura indisponível | aplicar capa visual de fallback, mantendo a aula abrível |
| Arquivo não abre | mensagem acionável e opção de voltar para a biblioteca |

## Acessibilidade e responsividade

- Todos os cards, árvore, fila e controles serão navegáveis por teclado, com foco visível e rótulos acessíveis.
- Ícones não serão a única forma de explicar um controle.
- A lista única do módulo vai abaixo do player em telas menores, sem duplicar conteúdo.
- Contraste e estados de foco devem manter legibilidade no tema atual claro e escuro.

## Correção de dados e análises do dashboard

### Diagnóstico registrado

Esta correção parte de evidências no código atual, e não de uma suposição visual:

1. `StatsDashboard` cria valores fixos para `Desempenho por Matéria` e `Atividade Recente`; portanto esses blocos não representam a conta autenticada.
2. `DashboardPage` renderiza os cards antes de terminar as chamadas de `/progress/heatmap` e `/progress/dashboard`; após a resposta, ela guarda os dados mas não atualiza o componente de estatísticas.
3. O `activity_log`, que alimenta heatmap e meta semanal, é atualizado pelo endpoint genérico de estudo. Hoje o fluxo de pomodoro é o único chamador no shell; revisão de flashcard registra `study_sessions`, mas não atualiza o resumo diário, e tentativa de simulado também não alimenta esse resumo.
4. Vídeos e áudios da biblioteca local não possuem ainda um registrador de progresso, então não podem compor tempo de estudo, atividade recente ou desempenho por módulo de forma honesta.

### Fonte de verdade

O dashboard passa a trabalhar somente com fatos persistidos e identificados pela origem:

| Origem | Persistência | Dados exibidos |
| --- | --- | --- |
| Flashcards | Banco da conta | revisões, acertos, precisão, data e matéria quando houver |
| Simulados | Banco da conta | tentativa concluída, nota e tempo gasto |
| Pomodoro e estudo autenticado | Banco da conta | minutos, sessões, XP e dia de atividade |
| Biblioteca local | armazenamento local do navegador | minutos ouvidos/assistidos, aula, curso e módulo; nenhum arquivo é enviado |

O dashboard combina os agregados autorizados do servidor com os agregados locais da biblioteca atual. Ele deve deixar claro quando um dado é deste dispositivo, em vez de fingir sincronização entre computadores.

### Modelo de eventos e contagem

1. Centralizar o registro de atividade do banco em uma rotina idempotente por evento concluído. Flashcard, simulado, pomodoro e sessão de estudo devem alimentar tanto `study_sessions` quanto o resumo diário aplicável em `activity_log`.
2. Ao reproduzir mídia local, registrar checkpoints locais em intervalos mínimos e no pause/encerramento, sem contar o mesmo trecho duas vezes. Os checkpoints devem ser vinculados ao identificador interno da aula, curso e módulo — nunca ao conteúdo do arquivo.
3. Um evento de mídia só entra nas análises depois de atingir um limiar mínimo de reprodução efetiva; seek para frente ou repetição não infla o tempo estudado.
4. Mudanças de vídeo para áudio da mesma aula continuam a mesma sessão lógica, preservando o tempo sem gerar atividade duplicada.
5. O usuário autenticado é o único escopo de qualquer dado de banco. Dados locais ficam isolados pelo perfil e pelo navegador/dispositivo que autorizou a pasta.

### Contrato de leitura do dashboard

- A página aguarda e aplica a resposta de dados antes de substituir os estados de carregamento; erro de uma fonte não pode apagar dados válidos da outra.
- `Tempo total`, `Sessões hoje`, `Cards revisados` e `Precisão` mostram somente agregados reais. A precisão é exibida como indisponível quando não houver revisões, nunca como porcentagem fictícia.
- `Meta semanal` deriva dos dias com atividade real, usando a semana local do usuário e não uma contagem sequencial artificial de bolinhas preenchidas.
- `Desempenho por Matéria` será renomeado conforme a fonte disponível: matérias dos flashcards/simulados e cursos ou módulos da biblioteca local. Cada linha exibe uma medida explícita, como minutos estudados, precisão ou aulas concluídas; métricas diferentes não serão somadas como se fossem a mesma coisa.
- `Atividade Recente` mostra somente eventos reais, ordenados por data. Cada item informa origem, conteúdo/módulo quando houver, medida e horário relativo acessível.
- Quando ainda não houver histórico, os três blocos mostram estado vazio orientativo, não nomes, percentuais ou atividades de demonstração.
- Heatmap, sequência e XP continuam consistentes com o mesmo resumo diário que alimenta os cards.

### Estados e falhas de dados

| Situação | Resposta da interface |
| --- | --- |
| Nenhuma atividade real | estado vazio com orientação para iniciar uma aula, revisão ou simulado |
| API indisponível | mensagem de falha específica para dados sincronizados; análises locais válidas continuam visíveis |
| Biblioteca não conectada | seção local explica que o desempenho de aulas será mostrado depois da conexão |
| Permissão local revogada | preservar o histórico local já consolidado quando possível e pedir reconexão para novos registros |
| Evento inválido ou repetido | não alterar contadores; registrar erro técnico sem expor detalhe sensível ao usuário |

## Critérios de aceite: dados e análises

9. Não existem arrays de matéria, porcentagem, atividade ou horário fictícios nos componentes de análise.
10. O retorno de `/progress/dashboard` atualiza efetivamente os cards, sem depender de recarregar a página.
11. Flashcards, simulados, pomodoro e estudo autenticado atualizam os seus resumos diários de modo consistente e sem duplicidade.
12. Tempo de vídeo/áudio local é contado uma única vez por reprodução efetiva, permanece local e aparece no curso/módulo correto.
13. Dashboard vazio, falha de API e biblioteca desconectada são estados distinguíveis e sem dados inventados.
14. Testes automatizados cobrem agregação, deduplicação, carregamento assíncrono, estados vazios e isolamento entre usuários.

## Critérios de aceite: biblioteca e player

1. Uma árvore de pastas como o contrato é convertida em curso, módulos, submódulos e tipos, sem exibir as pastas técnicas de tipo como níveis desnecessários.
2. Prefixos técnicos são ocultos quando há título descritivo; códigos puros não aparecem como nome de card.
3. Um par `.mp4`/`.mp3` com mesmo nome-base no mesmo módulo abre como uma aula única e alterna o formato no mesmo tempo, volume e velocidade.
4. Volume, mute, seek e navegação anterior/próxima funcionam em vídeo e áudio.
5. Há somente o player completo e uma única fila de aulas; não existe barra inferior global após a mudança.
6. Vídeos, áudios e PDFs têm cards estilizados com fallback seguro para miniaturas indisponíveis.
7. Reset e troca de pasta continuam sem apagar arquivos do disco do usuário.
8. Testes automatizados cobrem agrupamento de árvore, títulos, pareamento de mídias, sessão de reprodução e estados principais; build e testes existentes permanecem aprovados.
