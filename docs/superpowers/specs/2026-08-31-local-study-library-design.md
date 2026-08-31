# Biblioteca Local de Estudos — Especificação

**Status:** aguardando revisão do usuário  
**Roadmap:** Conteúdo real (biblioteca local, sem upload de mídias)  
**Escopo aprovado:** `G:\Meu Drive\Estudo` é uma referência de estrutura; o produto deve aceitar qualquer pasta que o usuário selecionar explicitamente.

## Objetivo

Substituir conteúdo demonstrativo por uma biblioteca pessoal local. A pessoa seleciona uma pasta no computador, HD externo ou Google Drive Desktop e a plataforma organiza vídeos, áudios, PDFs e transcrições sem enviar arquivos, caminhos ou conteúdo à VPS.

## Decisões de produto

- A biblioteca é pessoal e local ao navegador/computador que recebeu a autorização.
- A VPS não armazena nem distribui mídias, PDFs, transcrições, nomes de arquivos, caminhos locais ou metadados do catálogo.
- O navegador abre o seletor de pasta somente após clique explícito do usuário e solicita apenas permissão de leitura.
- A estrutura atual de pastas é preservada. O catálogo interpreta, mas não renomeia, cria, move ou apaga arquivos.
- O produto deve indexar a biblioteca inteira, não só materiais de ENEM: cursos, graduação, artigos, livros e outras áreas permanecem organizáveis por área e pasta.
- O primeiro lançamento suporta arquivos de mídia e documentos. Um simulado só aparece quando existir um arquivo local validado no formato `bsestudos.exam.v1`; não há questões de exemplo.
- Flashcards automáticos de exemplo, playlists demonstrativas, mídia externa de demonstração e simulados hardcoded são removidos. Flashcards criados pelo usuário não são apagados.

## Modelo de biblioteca

### Seleção e persistência

1. A tela Biblioteca exibe o estado inicial e o botão **Conectar pasta de estudos**.
2. Em navegador compatível e sob HTTPS, o botão chama `window.showDirectoryPicker({ mode: 'read' })`.
3. O `FileSystemDirectoryHandle` retornado é guardado apenas no IndexedDB do navegador, junto de um identificador aleatório da biblioteca e do instante da última varredura.
4. Em cada reabertura, o produto confirma a permissão de leitura. Se ela não existir, pede uma nova confirmação pelo usuário; nunca tenta localizar um caminho por conta própria.
5. A ação **Atualizar biblioteca** faz uma nova varredura da pasta autorizada. Nenhum arquivo é monitorado ou lido fora dessa ação ou de uma abertura direta pelo usuário.

### Organização derivada

A varredura é recursiva e gera um item para cada arquivo aceito. O item possui, somente no cliente:

```js
{
  id: 'identificador-local-opaco',
  relativePath: 'UNIFATECIE/01_ANATOMIA_HUMANA_BASICA_Nutricao/PDFs/aula.pdf',
  title: 'aula',
  area: 'UNIFATECIE',
  collection: '01_ANATOMIA_HUMANA_BASICA_Nutricao',
  resourceType: 'pdf',
  extension: 'pdf',
  size: 123456,
  modifiedAt: 0,
  transcriptId: null
}
```

- O primeiro diretório abaixo da pasta escolhida é a **área**.
- Os diretórios intermediários formam a **coleção**.
- Pastas chamadas `PDFs`, `Videos` e `Áudios`/`Audios` definem o tipo quando a extensão não for suficiente.
- `desktop.ini`, atalhos `.lnk`, diretórios de cache, arquivos ocultos e extensões desconhecidas não entram no catálogo.
- Títulos são derivados do nome de arquivo sem extensão e permanecem locais. Não haverá metadados inventados.

### Tipos suportados no primeiro lançamento

| Categoria | Extensões | Comportamento |
|---|---|---|
| Vídeo | `.mp4`, `.webm`, `.ogv` | Reprodução pelo player atual com URL de objeto local. |
| Áudio | `.mp3`, `.m4a`, `.wav`, `.ogg`, `.opus` | Reprodução pelo player atual com painel de transcrição. |
| Documento | `.pdf` | Abertura pelo visualizador PDF atual usando URL de objeto local. |
| Legenda sincronizada | `.vtt`, `.srt` | Associada à mídia de mesmo caminho e mesmo nome-base. |
| Transcrição textual | `.txt` | Associada à mídia de mesmo caminho e mesmo nome-base. |
| Simulado local | `.bsestudos.exam.json` | Validado antes de aparecer na área de simulados. |

Arquivos `.docx`, `.epub`, `.mobi` e outros formatos descobertos são preservados na pasta, mas aparecem como **formato ainda não suportado**; não serão renderizados nem convertidos silenciosamente.

## Reprodução e transcrições

Para um item de áudio ou vídeo, a varredura procura no mesmo diretório arquivos com o mesmo nome-base:

```text
Aula 01.mp3
Aula 01.vtt
Aula 01.txt
```

- `.vtt` é usado diretamente como faixa de legenda sincronizada.
- `.srt` é convertido apenas em memória para cues de legenda; o arquivo original não é modificado.
- `.txt` abre em painel lateral pesquisável. Não simula sincronismo porque não há marcação de tempo.
- Quando existirem legenda e `.txt`, a legenda sincronizada é a experiência principal e a transcrição completa continua acessível no painel.
- Quando nenhum arquivo associado existir, o player mostra **Transcrição não disponível para este material**.
- Nenhuma transcrição é gerada automaticamente nesta versão. Essa função exigiria um fluxo separado de consentimento, processamento e privacidade.

## Privacidade, segurança e progresso

- A aplicação solicita somente acesso de leitura à pasta escolhida; não usa permissões de escrita.
- URLs de objeto são revogadas ao fechar ou trocar de recurso.
- O backend não recebe dados do catálogo local. Caso uma sessão de estudo seja enviada para o progresso já existente, ela usa apenas um identificador local opaco, duração, tipo e horário; nomes e caminhos não são enviados.
- A interface explica que acesso local depende do navegador e que outro computador, outro perfil de navegador ou um celular precisará selecionar sua própria pasta.
- A implementação deve exigir contexto seguro (HTTPS) e sinalizar incompatibilidade em vez de tentar usar APIs não suportadas.

## Estados e falhas

| Situação | Resposta da interface |
|---|---|
| Nenhuma pasta conectada | Explica a biblioteca local e oferece o seletor de pasta. |
| Navegador sem suporte | Explica que a conexão de pasta requer navegador compatível e oferece lista de formatos suportados; nenhum conteúdo fictício é exibido. |
| Permissão negada ou revogada | Mantém o catálogo local anterior indisponível e apresenta **Conectar novamente**. |
| HD externo ou Drive indisponível | Informa que a biblioteca não está acessível e oferece nova tentativa ou troca de pasta. |
| Biblioteca vazia | Mostra estado vazio honesto, sem sugestão de conteúdo fictício. |
| Arquivo removido após indexação | Exibe indisponibilidade naquele item e permite atualizar a biblioteca. |
| Arquivo ou legenda inválido | Ignora somente o item afetado e informa o motivo sem interromper o restante da biblioteca. |
| Simulado inválido | Não publica o simulado; descreve os campos inválidos para correção local. |

## Mudanças no produto existente

- A navegação ganha uma entrada **Biblioteca local** e o catálogo passa a ser a origem das páginas de vídeo, áudio e PDFs.
- A página de vídeo e a página de áudio deixam de construir listas estáticas e iniciam em estado vazio até haver itens locais.
- A página de simulados não cria exames ou perguntas em código. Ela lista apenas arquivos `.bsestudos.exam.json` validados ou exibe estado vazio.
- `FlashcardsPage` deixa de executar qualquer semeadura; os controles de criação, importação e revisão de cards reais continuam disponíveis.
- O mini-player recebe apenas metadados já obtidos localmente, sem chamadas novas ao backend para a mídia.
- O projeto recupera um manifesto de dependências e scripts de teste/build reprodutíveis antes das mudanças funcionais. Essa é uma pré-condição para testes de regressão.

## Contrato de simulado local `bsestudos.exam.v1`

O arquivo de simulado é local e tem extensão exata `.bsestudos.exam.json`. O formato mínimo é:

```json
{
  "schema": "bsestudos.exam.v1",
  "id": "enem-2026-dia-1",
  "title": "ENEM 2026 — Dia 1",
  "durationMinutes": 330,
  "questions": [
    {
      "id": "q-001",
      "statement": "Enunciado da questão",
      "options": ["A", "B", "C", "D", "E"],
      "correctOption": 0,
      "explanation": "Explicação opcional"
    }
  ]
}
```

Validação obrigatória: `schema` exato, `id` e `title` não vazios, `durationMinutes` inteiro positivo, ao menos uma questão, cinco opções não vazias por questão, `correctOption` entre 0 e 4, e IDs únicos. Dados inválidos jamais são exibidos como simulados.

## Critérios de aceite

1. Sem uma pasta conectada, nenhuma página do produto mostra cards, aulas, áudios, simulados ou números demonstrativos.
2. Com uma pasta local autorizada, vídeos, áudios e PDFs aceitos são agrupados pela estrutura existente sem modificar a pasta.
3. A troca, revogação de permissão ou desconexão do HD não expõe conteúdo antigo como se estivesse acessível.
4. Legendas `.vtt` e `.srt` de mesmo nome-base acompanham o player; `.txt` abre como transcrição pesquisável.
5. Nenhum teste, requisição, log, telemetria ou API transmite bytes de mídia, caminhos locais, títulos ou conteúdo das transcrições para a VPS.
6. Apenas simulados `.bsestudos.exam.json` válidos aparecem na tela de simulados.
7. Flashcards existentes do usuário são preservados e nenhuma semente é criada para uma conta nova.
8. Os testes unitários cobrem varredura, exclusões, associação de transcrições, validação de simulados, perda de permissão e estados vazios; testes de interface cobrem a seleção simulada de pasta e os players com URLs de objeto.
9. Build, testes do frontend, lint PHP e testes PHP podem ser executados por comandos declarados no repositório antes de release.

## Fora de escopo

- Upload, cópia ou sincronização de mídia para a VPS.
- Acesso direto a uma pasta sem seleção e permissão explícitas.
- Geração automática de transcrições, OCR, IA ou processamento de conteúdo na nuvem.
- Edição, renomeação, exclusão ou reorganização da pasta local.
- Leitores internos para `.docx`, `.epub` e `.mobi`.
- Disponibilizar a mesma mídia automaticamente em celular, outro navegador ou outro computador.
