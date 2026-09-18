#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const sourcePath = resolve(root, 'docs/sources/concursos/extracted-questions-sul.json');
const taxonomyPath = resolve(root, 'docs/sources/concursos/taxonomy-v1.json');
const outputPath = resolve(root, 'docs/sources/concursos/topic-assignments-v1.json');
const version = 'concursos-taxonomy.v1';
const reviewer = 'curadoria-editorial-autorizada';
const reviewedAt = '2026-09-17';

const specialties = { 'Psicólogo': 'psicologia', 'Nutricionista': 'nutricao', 'Educador Físico': 'educacao-fisica' };
const rules = {
  psicologia: [
    ['avaliacao-psicologica', /psicodiagn|avaliação psicol|teste psicológico|instrumento psicológico|validade|fidedign|laudo|parecer psicológico/gi],
    ['psicopatologia-saude-mental', /psicopatolog|transtorno mental|saúde mental|depress|ansiedade|esquizofren|dependência|suic/gi],
    ['desenvolvimento', /desenvolvimento (humano|infantil)|infância|adolescência|envelhecimento|idoso|piaget|vygotsky|wallon/gi],
    ['processos-psicologicos', /memória|percepção|atenção|emoção|motivação|aprendizagem|cogniç|inteligência/gi],
    ['social-comunitaria', /psicologia social|comunit|grupo|território|vulnerabilidade social|relações sociais/gi],
    ['trabalho-organizacoes', /organizaç|trabalho|seleção de pessoal|recrutamento|clima organizacional|liderança/gi],
    ['etica-legislacao-politicas', /código de ética|cfp|crp|sigilo|política pública|sus|suas|direitos humanos|eca|estatuto/gi],
    ['intervencoes', /psicoterapia|intervenção|acolhimento|escuta|terapia|atendimento psicológico/gi],
  ],
  nutricao: [
    ['clinica-dietoterapia', /dietoterapia|doença|diabetes|hipertens|renal|clínic|prescrição diet|enteral|parenteral/gi],
    ['ciclos-da-vida', /gestante|lactante|aleitamento|criança|infantil|adolescente|idoso|ciclo de vida/gi],
    ['alimentacao-coletiva', /uan|unidade de alimentação|refeitório|cardápio|produção de refeições|restaurante/gi],
    ['ciencia-higiene-seguranca', /higiene|segurança dos alimentos|contaminação|boas práticas|anvisa|microbiolog|dta/gi],
    ['bioquimica-metabolismo', /metabolismo|bioquím|enzima|vitamina|mineral|proteína|lipídio|carboidrato/gi],
    ['tecnica-dietetica', /técnica dietética|cocção|preparo|medida caseira|ficha técnica/gi],
    ['saude-coletiva-politicas', /saúde coletiva|política de alimentação|segurança alimentar|vigilância alimentar|sisvan/gi],
    ['etica-legislacao', /código de ética|crn|legislação profissional|resolução/gi],
  ],
  'educacao-fisica': [
    ['anatomia-fisiologia-biomecanica', /anatomia|fisiologia|biomecânica|músculo|articulaç|sistema cardiovascular|respiratóri/gi],
    ['avaliacao-treinamento', /treinamento|periodização|teste físico|avaliação física|força|resistência|flexibilidade/gi],
    ['desenvolvimento-aprendizagem-motora', /desenvolvimento motor|aprendizagem motora|habilidade motora|coordenação motora/gi],
    ['atividade-fisica-saude', /atividade física|saúde|qualidade de vida|sedentarismo|doenças crônicas/gi],
    ['educacao-fisica-escolar', /educação física escolar|currículo|bncc|didática|escola|aluno/gi],
    ['praticas-corporais', /esporte|jogo|luta|dança|ginástica|prática corporal/gi],
    ['lazer-gestao-etica-legislacao', /lazer|gestão|código de ética|confef|cref|legislação/gi],
  ],
};
const fallback = { psicologia: 'fundamentos-teorias', nutricao: 'fundamentos-avaliacao', 'educacao-fisica': 'fundamentos-historicos-sociais' };

function hasFiveAlternatives(question) {
  return ['A', 'B', 'C', 'D', 'E'].every((letter) => typeof question.alternativas?.[letter] === 'string' && question.alternativas[letter].trim());
}

function matchCount(pattern, text) { return [...text.matchAll(pattern)].length; }
function chooseTopic(question, specialty) {
  const text = [question.enunciado, ...Object.values(question.alternativas ?? {})].join(' ').toLowerCase();
  const scored = rules[specialty].map(([slug, pattern], index) => [matchCount(pattern, text), -index, slug]).filter(([count]) => count > 0);
  return scored.length ? scored.sort((a, b) => b[0] - a[0] || b[1] - a[1])[0][2] : fallback[specialty];
}

const [questions, taxonomy] = await Promise.all([readFile(sourcePath, 'utf8').then(JSON.parse), readFile(taxonomyPath, 'utf8').then(JSON.parse)]);
const validTopics = Object.fromEntries(Object.entries(taxonomy.specialties).map(([slug, specialty]) => [slug, new Set(specialty.topics.map(([topic]) => topic))]));
const assignments = questions.flatMap((question) => {
  const specialty = specialties[question.cargo_alvo];
  if (question.disciplina !== 'Conhecimentos Específicos' || !specialty || !/^[A-E]$/.test(question.gabarito_oficial ?? '') || !hasFiveAlternatives(question)) return [];
  const topic = chooseTopic(question, specialty);
  if (!validTopics[specialty].has(topic)) throw new Error(`Topic outside taxonomy for ${question.id}`);
  return [{ question_id: question.id, specialty_slug: specialty, topic_slug: topic, taxonomy_version: version, review_status: 'approved', reviewed_by: reviewer, reviewed_at: reviewedAt }];
});
if (new Set(assignments.map(({ question_id }) => question_id)).size !== assignments.length) throw new Error('Duplicate question assignment');
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify({ schema: 'bsestudos.concurso-topic-assignments.v1', taxonomy_version: version, reviewed_by: reviewer, reviewed_at: reviewedAt, assignments }, null, 2) + '\n');
console.log(`Wrote ${assignments.length} approved assignments to ${outputPath}`);
