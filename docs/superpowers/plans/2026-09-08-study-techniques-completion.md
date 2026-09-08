# Técnicas de Estudo — Plano de implementação

**Objetivo:** transformar técnicas hoje apenas anunciadas em jornadas completas, rastreáveis e sem dados fictícios.

**Ordem de entrega:** cada etapa é utilizável sozinha e preserva os dados existentes.

1. **Recuperação ativa e repetição espaçada**
   - Conectar a página de Flashcards ao `FlashcardManager` e à `ReviewQueue`.
   - Exibir criar, editar, excluir, filtrar e importar/exportar cards; iniciar revisão apenas com cards vencidos.
   - Enviar avaliações ao endpoint real `POST /api/flashcards/{id}/review`, atualizar a fila e refletir XP/estatísticas.
   - Corrigir a geração de cards a partir de notas para gravar as colunas reais `front`, `back`, `tags` e `due_date`.
   - Testes: card novo aparece, fila vencida é revisada, avaliação persiste, geração sem credencial informa indisponibilidade sem quebrar a nota.

2. **Notas e Método Feynman**
   - Corrigir seleção de notas existentes, salvamento assíncrono e feedback somente após confirmação da API.
   - Manter o modelo Feynman como roteiro de explicação, analogia, lacunas e revisão; identificar as notas por tag e permitir retomá-las.
   - Testes: selecionar, salvar com sucesso, falhar ao salvar e abrir um novo roteiro Feynman.

3. **Simulados e caderno de erros**
   - Usar os arquivos locais `*.bsestudos.exam.json` já validados pela biblioteca como fonte da página de Simulados.
   - Exibir lista de simulados, iniciar `ExamPlayer`, salvar tentativa autenticada, mostrar `ResultsScreen` e revisar respostas erradas.
   - Criar uma visão de erros por questão/tópico a partir das tentativas, sem exemplos estáticos.
   - Testes: descoberta do arquivo, início, resposta, término, persistência e revisão de erro.

4. **Pomodoro e planejamento de sessão**
   - Tornar o temporizador recuperável ao navegar, encerrar intervalos ao destruir o cabeçalho e registrar apenas ciclos de foco concluídos.
   - Exibir foco/pausa, ciclos concluídos e comando claro para iniciar/pausar; manter duração padrão de 25/5 com pausa longa após quatro focos.
   - Testes: início, pausa, conclusão, navegação/cleanup e registro único no progresso.

5. **Dashboard factual e publicação**
   - Remover linhas fictícias de desempenho e atividade recente; renderizar estados vazios e dados de sessão, cards, simulados e biblioteca local.
   - Corrigir a atualização do `StatsDashboard` sem substituir um nó já montado por um nó desconectado.
   - Rodar frontend, backend, lint PHP, build e revisão das jornadas autenticadas. Só então preparar deploy com backup, rollback e health check da VPS.

**Contrato de dados:** banco é a fonte dos flashcards, notas, Pomodoro e tentativas; a biblioteca local é a fonte de vídeo, áudio, PDFs e simulados locais; analytics locais permanecem identificados como dados do dispositivo.

**Critérios de aceite:** nenhum botão de técnica fica sem efeito, nenhuma técnica mostra conteúdo fictício, erros de API deixam mensagem acionável, e cada jornada possui teste de ponta a ponta proporcional ao risco.
