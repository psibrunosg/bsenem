const SCHEMA = 'bsestudos.exam.v1';

export function validateLocalExam(input) {
  const errors = [];
  if (!input || typeof input !== 'object' || input.schema !== SCHEMA) errors.push('schema');
  if (!nonEmpty(input?.id)) errors.push('id');
  if (!nonEmpty(input?.title)) errors.push('title');
  if (!Number.isInteger(input?.durationMinutes) || input.durationMinutes <= 0) errors.push('durationMinutes');
  if (!Array.isArray(input?.questions) || !input.questions.length) errors.push('questions');

  const ids = new Set();
  for (const question of input?.questions || []) {
    if (!nonEmpty(question?.id) || ids.has(question.id)) errors.push('question.id');
    ids.add(question?.id);
    const facsimile = question?.renderMode === 'facsimile';
    if (facsimile) {
      if (!Number.isInteger(question?.questionNumber) || question.questionNumber <= 0) errors.push('question.questionNumber');
      if (!validImages(question?.images)) errors.push('question.images');
    } else {
      if (!nonEmpty(question?.statement)) errors.push('question.statement');
      if (!Array.isArray(question?.options) || question.options.length !== 5 || question.options.some(option => !nonEmpty(option))) errors.push('question.options');
      if (question?.images !== undefined && !validImages(question.images)) errors.push('question.images');
    }
    if (!Number.isInteger(question?.correctOption) || question.correctOption < 0 || question.correctOption > 4) errors.push('question.correctOption');
  }
  return { valid: !errors.length, errors };
}

export function toExamPlayerQuestion(question) {
  const facsimile = question.renderMode === 'facsimile';
  const playerQuestion = {
    id: question.id,
    text: facsimile ? `Questão ${question.questionNumber}` : question.statement,
    answers: facsimile ? ['', '', '', '', ''] : question.options,
    correctAnswer: question.correctOption
  };
  if (question.images !== undefined) playerQuestion.images = question.images;
  if (facsimile) {
    playerQuestion.renderMode = 'facsimile';
    playerQuestion.questionNumber = question.questionNumber;
  }
  if (question.explanation !== undefined) playerQuestion.explanation = question.explanation;
  return playerQuestion;
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validImages(images) {
  return Array.isArray(images) && images.length > 0 && images.every(isSafeRelativeImagePath);
}

function isSafeRelativeImagePath(path) {
  return nonEmpty(path)
    && !path.startsWith('/')
    && !path.includes('\\')
    && !path.includes('?')
    && !path.includes('#')
    && !path.includes('://')
    && path.split('/').every(segment => segment && segment !== '.' && segment !== '..');
}
