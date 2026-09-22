# Simulados: prática orientada e mapa de domínio — design

## Status e relação com o contrato existente

Este documento detalha a experiência de prática e desempenho sobre o contrato já aprovado em `2026-09-21-permanent-custom-simulators-design.md`. Ele não restabelece a Biblioteca local como fonte do produto: simulados, questões, sessões e resultados pertencem ao usuário autenticado e funcionam sem `showDirectoryPicker`.

O objetivo é substituir a página plana de lista e o resultado isolado por um ciclo contínuo:

```text
praticar → registrar respostas → entender onde melhorar → receber uma próxima ação → retomar ou praticar de novo
```

## Resultado esperado

O estudante deve conseguir entrar nos Simulados e, sem procurar métricas ou configurar filtros antes de começar, entender uma única próxima ação útil. A ação prioritária é uma **prática de 25 minutos**. O mapa por matéria torna a recomendação explicável; ele não é um painel decorativo. Um simulado longo interrompido aparece como alternativa de retomada, nunca desaparece por abrir outra tela.

## Princípios de experiência

1. **Uma ação principal por visita.** Quando houver evidência suficiente, o botão destacado inicia a prática recomendada. A retomada de uma sessão e o catálogo permanecem disponíveis, mas discretos.
2. **Diagnóstico que leva a uma ação.** A interface não diz apenas “42% em Matemática”: informa a matéria, a quantidade de questões que sustenta o dado e oferece praticá-la.
3. **Sem falsa precisão.** Tópicos só aparecem quando a questão publicada possui taxonomia de tópico e há amostra suficiente. Caso contrário, a recomendação e o mapa ficam no nível da matéria.
4. **Retomada confiável.** Respostas, marcações, posição e cronômetro persistem enquanto a sessão estiver ativa. O usuário pode sair, atualizar ou trocar de tela sem perder o trabalho.
5. **Privacidade e autoria.** Dados de respostas e desempenho são visíveis somente ao usuário autenticado. A recomendação é calculada sobre tentativas e questões publicadas do próprio produto; ela não envia biblioteca local, arquivos, notas ou conteúdo a terceiros.

## Home de Simulados

O layout aprovado usa a linguagem existente — superfície escura, destaque laranja, tipografia limpa e divisores discretos — e contém, nesta ordem:

1. Cabeçalho `Simulados`, com uma frase curta orientada a estudo contínuo.
2. Hero de **Prática de hoje — 25 minutos**, com foco, dez questões, tempo estimado e CTA `Começar prática`.
3. `Onde melhorar agora`: tabela compacta por matéria com questões avaliadas, aproveitamento e um estado acionável.
4. `Continuar seu simulado`, quando houver uma sessão ativa, com quantidade respondida, progresso, tempo restante e CTA `Continuar`.
5. Acesso secundário ao catálogo e ao construtor de simulados, conforme o contrato de simulados permanentes.

Não há um “caderno de erros” desabilitado na superfície principal. Erros alimentam a recomendação e permanecem acessíveis como revisão, com uma contagem contextualizada.

### Estados da home

| Situação | Ação principal | Informação exibida |
| --- | --- | --- |
| Sem questões publicadas | `Explorar catálogo` desabilitado com orientação de disponibilidade | Nenhuma métrica ou promessa de prática |
| Questões disponíveis, sem histórico | `Escolher matéria e começar` | Explicação breve de que o mapa aparecerá após respostas suficientes |
| Histórico insuficiente em uma matéria | Prática curta escolhida pelo usuário | Estado “ainda coletando dados”; sem porcentagem classificada |
| Histórico suficiente | Prática recomendada | Matéria/tópico, tamanho da amostra, aproveitamento e próxima ação |
| Sessão ativa | A prática recomendada continua como hero quando houver; a retomada é sempre visível | Progresso real e tempo restante |
| Falha temporária de rede | `Tentar novamente` ou continuar o rascunho já sincronizado | Não substituir dados conhecidos por zero |

## Modelo de prática e recomendação

### Prática de 25 minutos

Uma prática é uma sessão persistente do tipo `practice`, com dez questões e limite de 25 minutos. Ela é uma composição imutável no momento da criação: iniciar, retomar ou concluir não pode trocar suas questões silenciosamente.

Seleção, em ordem:

1. Escolher a matéria com maior prioridade entre as que possuem respostas suficientes: menor aproveitamento ponderado por erros recentes.
2. Se as questões tiverem tópico e um tópico tiver ao menos cinco respostas recentes, escolher o tópico com pior aproveitamento; caso contrário, manter a matéria.
3. Incluir primeiro questões erradas ainda elegíveis para revisão; preencher o restante com questões publicadas da mesma matéria/tópico, evitando itens já usados recentemente quando houver oferta.
4. Se não houver dez questões elegíveis, informar a quantidade real antes de criar a sessão; nunca misturar matéria ou tópico sem avisar.

Com ausência de histórico suficiente, a home não inventa uma recomendação: oferece a escolha de matéria e cria a prática apenas dentro da seleção explícita do usuário.

### Mapa de domínio

O mapa agrega respostas concluídas por matéria. Cada linha contém `matéria`, `questões avaliadas`, `aproveitamento` e estado:

- **Ponto de atenção:** menos de 60%, com ao menos cinco questões avaliadas.
- **Em evolução:** 60% a 74%, com ao menos cinco questões avaliadas.
- **Bom domínio:** 75% ou mais, com ao menos cinco questões avaliadas.
- **Dados insuficientes:** menos de cinco questões; não classifica o estudante.

As classificações são indicadores de prática recente, não diagnóstico pedagógico ou previsão de nota do ENEM. A interface deve comunicar a janela de análise (por exemplo, últimas 30 respostas ou 90 dias), que será a mesma em todas as linhas.

## Sessões, respostas e ciclo de vida

Uma sessão pode ser `catalog`, `custom` ou `practice` e tem estado `active`, `completed` ou `abandoned`.

- A criação grava os itens ordenados e a configuração da sessão antes de abrir o player.
- Cada resposta, marcação, mudança de questão e atualização de tempo faz persistência idempotente do rascunho autenticado. Uma breve confirmação local mantém a interface responsiva durante oscilações de rede; o servidor é a fonte de verdade após reconexão.
- Ao concluir, o servidor fecha a sessão uma única vez, calcula o resultado a partir da composição persistida e registra as respostas. Repetir a mesma solicitação de conclusão retorna o mesmo resultado; não cria outra tentativa.
- Uma sessão concluída é revisável, mas suas respostas e composição não podem mudar. `Tentar novamente` cria outra sessão.
- Uma sessão ativa pode coexistir com outra, porém a home mostra a mais recentemente atualizada e oferece acesso às demais em “Sessões em andamento”.

## Dados publicados e dados do usuário

O banco de questões previsto no contrato anterior precisa dos seguintes campos para este produto: identificador estável, matéria, área, tópico opcional, origem, ano, enunciado, alternativas, gabarito, explicação opcional e estado de publicação. Tópico é opcional na migração do acervo existente; sua ausência ativa o fallback por matéria.

Dados do usuário necessários:

- `simulator_sessions`: `id` não enumerável, `user_id`, `kind`, `status`, `time_limit_seconds`, `current_position`, `started_at`, `updated_at`, `completed_at`.
- `simulator_session_questions`: `session_id`, `question_id`, `position`; impõe unicidade por sessão e posição.
- `simulator_session_answers`: `session_id`, `question_id`, alternativa selecionada opcional, `flagged`, `answered_at`, `updated_at`.
- Uma visão/consulta de desempenho agregada por usuário, matéria e janela de análise; ela deriva de sessões concluídas, sem expor respostas de terceiros.

As tabelas locais legadas de tentativas podem ser migradas apenas como histórico de apresentação quando se consegue vincular o identificador a uma questão publicada. Dados sem vínculo preservam o registro original, mas não alimentam porcentagens ou recomendações.

## Contrato de API

Todos os endpoints exigem sessão autenticada e ignoram qualquer `user_id` enviado pelo cliente.

| Endpoint | Responsabilidade |
| --- | --- |
| `GET /simulators/overview` | Retorna recomendação honesta, mapa por matéria, sessões ativas resumidas e contagens necessárias para a home. |
| `POST /simulators/sessions` | Cria sessão de catálogo, personalizada ou prática; valida oferta, matérias/tópicos e composição antes de responder. |
| `GET /simulators/sessions/{id}` | Retorna somente sessão pertencente ao usuário, sua composição e o rascunho atual. |
| `PATCH /simulators/sessions/{id}/progress` | Persiste posição, tempo, respostas e marcações de uma sessão ativa; é idempotente. |
| `POST /simulators/sessions/{id}/complete` | Fecha a sessão, calcula resultado no servidor e devolve o resumo/revisão. |
| `GET /simulators/sessions?status=active` | Lista as sessões retomáveis do próprio usuário. |

Erros de autorização retornam uma resposta indistinguível para sessão inexistente e de outro usuário. Validações de disponibilidade, quantidade, estado e transição retornam mensagem acionável e não criam registros parciais.

## Componentes e fronteiras

- `SimulatorsPage`: orquestra a home, dados de overview e troca de estados; não calcula recomendação no DOM.
- `SimulatorOverviewService`: cliente dos endpoints da home e das sessões; converte respostas de API em view models testáveis.
- `PracticeRecommendation`: regra de domínio no servidor para amostra, fallback e composição; sem dependência de componentes visuais.
- `SimulatorSessionService`: criação, recuperação, persistência de rascunho e conclusão idempotente.
- `ExamPlayer`: adaptação do player atual para renderizar uma composição remota e chamar o serviço de rascunho; continua responsável apenas por interação de questão, cronômetro e navegação.
- `ResultsScreen`: apresenta um resultado já calculado; não grava tentativas por conta própria.

## Acessibilidade, responsividade e linguagem

No desktop, a recomendação, o mapa e a retomada ficam em uma coluna de leitura confortável. Em telas estreitas, o CTA da prática preserva prioridade, o mapa vira linhas empilhadas e nenhum estado depende exclusivamente de cor. Progresso e aproveitamento têm texto equivalente; botões têm nomes acessíveis; atualizações de rascunho e tempo não interrompem leitores de tela. Teclado percorre questões, marcações, mapa e ações em ordem lógica.

As mensagens falam de “prática”, “respostas” e “onde melhorar”; não diagnosticam capacidade, prometem aprovação ou usam linguagem punitiva.

## Critérios de aceite

- A home corresponde à direção visual aprovada: uma prática curta prioritária, mapa compacto que explica a recomendação e retomada visível.
- Sem dados suficientes, não há recomendação, porcentagem classificada nem tópico inventado.
- Prática recomendada nunca inclui questões de matéria/tópico diferente sem consentimento explícito e sua composição não muda ao retomar.
- Respostas, marcações, posição e tempo de uma sessão ativa sobrevivem a recarga e navegação; conclusão duplicada não duplica tentativa.
- O mapa conta somente respostas concluídas do usuário autenticado, informa o tamanho da amostra e aplica os limites definidos.
- Leitura e escrita de sessão de outro usuário falham sem revelar sua existência.
- Catálogo, construtor, revisão e os simulados completos previstos na especificação anterior permanecem acessíveis.
- Testes unitários cobrem seleção/fallback/classificação; testes de API cobrem autorização, composição, transições e idempotência; testes de interface cobrem estados vazios, retomada, prática, mapa e teclado em desktop e mobile.

## Fora de escopo

- IA gerando, explicando ou classificando questões sem revisão editorial.
- Diagnóstico clínico, previsão de nota ou ranking de estudantes.
- Importação de uma biblioteca local, arquivos do Drive ou dados de notas para construir recomendações.
- Alterar automaticamente uma sessão já criada, inclusive para “melhorar” a recomendação depois.
