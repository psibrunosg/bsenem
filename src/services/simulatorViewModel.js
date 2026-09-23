// src/services/simulatorViewModel.js
const STATUS_LABELS = {
  insufficient: 'Dados insuficientes',
  attention: 'Ponto de atenção',
  evolving: 'Em evolução',
  strong: 'Bom domínio',
};

/**
 * Builds the home view state from the catalog subjects and the overview payload.
 * Returns exactly one hero: recommended practice, subject chooser or content-unavailable.
 */
export function overviewViewModel({ subjects = [], catalogs = [], recommendation = null, mastery = [], active_sessions: activeSessions = [] } = {}) {
  const resume = resumeViewModel(activeSessions[0] ?? null);
  const otherActiveCount = Math.max(0, activeSessions.length - (resume ? 1 : 0));

  if (subjects.length === 0) {
    return { hero: unavailableHero(), mastery: [], resume, otherActiveCount, subjects: [], catalogs: [] };
  }

  return {
    hero: recommendation ? recommendedHero(recommendation) : chooseSubjectHero(subjects),
    mastery: mastery.map(masteryRowViewModel),
    resume,
    otherActiveCount,
    subjects,
    catalogs,
  };
}

function unavailableHero() {
  return {
    kind: 'unavailable',
    title: 'Simulados',
    description: 'Ainda não há questões publicadas para praticar.',
    ctaLabel: 'Explorar catálogo',
    ctaDisabled: true,
  };
}

function chooseSubjectHero(subjects) {
  return {
    kind: 'choose-subject',
    title: 'Prática de hoje',
    description: 'Escolha uma matéria para começar. O mapa de domínio aparece depois de respostas suficientes.',
    ctaLabel: 'Escolha uma matéria para começar',
    ctaDisabled: false,
    subjects,
  };
}

function recommendedHero(recommendation) {
  const scope = recommendation.topic ? `${recommendation.subject} · ${recommendation.topic}` : recommendation.subject;
  return {
    kind: 'recommended',
    title: 'Prática de hoje — 25 minutos',
    description: `${scope} · ${recommendation.answered_count} questões avaliadas · ${recommendation.accuracy}% de aproveitamento`,
    ctaLabel: 'Começar prática',
    ctaDisabled: false,
    subject: recommendation.subject,
    topic: recommendation.topic,
  };
}

function masteryRowViewModel(row) {
  return {
    subject: row.subject,
    answeredCount: row.answered_count,
    accuracy: row.accuracy,
    accuracyLabel: row.accuracy === null ? 'Dados insuficientes' : `${row.accuracy}%`,
    status: row.status,
    statusLabel: STATUS_LABELS[row.status] ?? row.status,
  };
}

function resumeViewModel(session) {
  if (!session) return null;
  const remainingSeconds = Math.max(0, (session.time_limit_seconds ?? 0) - (session.elapsed_seconds ?? 0));
  return {
    id: session.id,
    subject: session.subject,
    topic: session.topic,
    answeredCount: session.answered_count ?? 0,
    questionLimit: session.question_limit,
    remainingSeconds,
    ctaLabel: 'Continuar',
  };
}
