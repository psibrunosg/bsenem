# Simulados permanentes e personalizados

## Objetivo

Substituir a dependência da biblioteca local por um catálogo autenticado e
permanente de simulados. O usuário pode iniciar conjuntos publicados e montar
um simulado escolhendo uma ou mais matérias e a quantidade de questões.

## Decisões

- Questões vêm apenas de fontes importadas com alternativa e gabarito.
- O gerador nunca completa quantidade com outra matéria e rejeita pedidos acima
  da disponibilidade selecionada.
- Cada montagem é associada ao usuário, preserva a seleção feita e registra a
  tentativa no servidor.
- ENEM mantém seus conjuntos completos; concursos usam as questões extraídas e
  validadas por cargo e disciplina.
- Uma matéria só aparece como filtro se possuir questões explicitamente
  classificadas. Não inferir Física ou Química por palavras do enunciado.

## Etapas

1. Criar a migração do banco para catálogo, banco de questões, montagens e
   tentativas de simulados permanentes.
2. Criar um importador idempotente para os JSONs ENEM e concursos já versionados.
3. Expor endpoints autenticados para catálogo, iniciar publicado, gerar
   personalizado e salvar tentativa.
4. Trocar a página de simulados para consumir o catálogo remoto e reutilizar o
   jogador existente.
5. Cobrir a regra de capacidade e isolamento por usuário em PHP, e fluxo de
   catálogo/geração no frontend; executar testes e build antes do commit.
