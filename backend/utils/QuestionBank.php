<?php

declare(strict_types=1);

final class QuestionBank {
    private const SESSION_SIZES = [10, 25, 50, 75, 100];

    private const ENEM_SUBJECTS = [
        'natureza' => 'Ciências da Natureza e suas Tecnologias',
        'humanas' => 'Ciências Humanas e suas Tecnologias',
        'linguagens' => 'Linguagens, Códigos e suas Tecnologias',
        'matematica' => 'Matemática e suas Tecnologias',
    ];

    private const CONCURSO_SUBJECTS = [
        'conhecimentos-especificos' => 'Conhecimentos Específicos',
        'conhecimentos-gerais-atualidades' => 'Conhecimentos Gerais e Atualidades',
        'conhecimentos-pedagogicos' => 'Conhecimentos Pedagógicos',
        'legislacao-direito' => 'Legislação e Direito',
        'lingua-portuguesa' => 'Língua Portuguesa',
        'nocoes-informatica' => 'Noções de Informática',
        'politicas-saude-sus' => 'Políticas de Saúde / SUS',
        'raciocinio-logico-matematico' => 'Raciocínio Lógico e Matemático',
    ];

    public function __construct(private readonly PDO $pdo) {}

    public function facets(?string $track, ?string $subject, ?string $specialty): array {
        $tracks = [
            ['slug' => 'enem', 'label' => 'ENEM', 'count' => $this->enemCount()],
            ['slug' => 'concursos', 'label' => 'Concursos', 'count' => $this->concursoCount()],
        ];
        $result = ['tracks' => $tracks, 'subjects' => [], 'specialties' => [], 'topics' => []];
        if ($track === null || $track === '') return $result;
        if (!in_array($track, ['enem', 'concursos'], true)) throw new InvalidArgumentException('Modalidade inválida.');

        $result['subjects'] = $track === 'enem' ? $this->enemSubjects() : $this->concursoSubjects();
        if ($track !== 'concursos' || $subject !== 'conhecimentos-especificos') return $result;
        $result['specialties'] = $this->specialties();
        if ($specialty !== null && $specialty !== '') {
            if (!$this->isKnownSpecialty($specialty)) throw new InvalidArgumentException('Área específica inválida.');
            $result['topics'] = $this->topics($specialty);
        }
        return $result;
    }

    public function createSession(int $userId, array $input): array {
        $track = $this->requiredString($input, 'track');
        $subject = $this->requiredString($input, 'subject');
        $questionCount = $input['questionCount'] ?? null;
        if (!is_int($questionCount) || !in_array($questionCount, self::SESSION_SIZES, true)) throw new InvalidArgumentException('Quantidade de questões inválida.');
        $specialty = $this->optionalString($input, 'specialty');
        $topic = $this->optionalString($input, 'topic');
        $filters = compact('track', 'subject', 'specialty', 'topic');
        $questions = $this->selectQuestions($filters, $questionCount);
        if (count($questions) !== $questionCount) throw new InvalidArgumentException('Não há questões oficiais suficientes para esta seleção.');

        $sessionId = bin2hex(random_bytes(16));
        $title = $this->sessionTitle($filters);
        $this->pdo->beginTransaction();
        try {
            $this->pdo->prepare('INSERT INTO question_bank_sessions (id, user_id, title, filters_json, question_count, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
                ->execute([$sessionId, $userId, $title, $this->json($filters), $questionCount, date('Y-m-d H:i:s', time() + 86400)]);
            $insert = $this->pdo->prepare('INSERT INTO question_bank_session_items (session_id, position, question_key, payload_json) VALUES (?, ?, ?, ?)');
            foreach ($questions as $position => $question) $insert->execute([$sessionId, $position, $question['id'], $this->json($question)]);
            $this->pdo->commit();
        } catch (Throwable $error) {
            if ($this->pdo->inTransaction()) $this->pdo->rollBack();
            throw $error;
        }
        return ['sessionId' => $sessionId, 'title' => $title, 'filters' => $filters, 'questions' => array_map([$this, 'publicQuestion'], $questions)];
    }

    public function submitSession(int $userId, string $sessionId, array $input): array {
        $session = $this->pdo->prepare('SELECT * FROM question_bank_sessions WHERE id = ? AND user_id = ?');
        $session->execute([$sessionId, $userId]);
        $row = $session->fetch();
        if (!$row) throw new OutOfBoundsException('Sessão não encontrada.');
        if ($row['status'] === 'completed') return $this->decode($row['result_json']);
        if ($row['expires_at'] <= date('Y-m-d H:i:s')) throw new RuntimeException('Esta sessão expirou.');
        if (!is_array($input['answers'] ?? null)) throw new InvalidArgumentException('Respostas inválidas.');

        $items = $this->pdo->prepare('SELECT position, question_key, payload_json FROM question_bank_session_items WHERE session_id = ? ORDER BY position');
        $items->execute([$sessionId]);
        $storedItems = $items->fetchAll();
        $answersByQuestion = $this->answersByQuestion($input['answers'], $storedItems);
        $results = [];
        $correct = 0;
        $incorrect = 0;
        $unanswered = 0;
        $this->pdo->beginTransaction();
        try {
            $insertAnswer = $this->pdo->prepare('INSERT INTO question_bank_session_answers (session_id, question_key, selected_option, flagged, is_correct) VALUES (?, ?, ?, ?, ?)');
            foreach ($storedItems as $item) {
                $question = $this->decode($item['payload_json']);
                $answer = $answersByQuestion[$item['question_key']] ?? ['selectedOption' => null, 'flagged' => false];
                $selected = $answer['selectedOption'];
                $isCorrect = $selected !== null && $selected === $question['correctOption'];
                if ($selected === null) $unanswered++;
                elseif ($isCorrect) $correct++;
                else $incorrect++;
                $insertAnswer->execute([$sessionId, $item['question_key'], $selected, $answer['flagged'] ? 1 : 0, $isCorrect ? 1 : 0]);
                $results[] = ['questionId' => $question['id'], 'questionText' => $question['text'], 'selectedAnswer' => $selected, 'correctAnswer' => $question['correctOption'], 'isCorrect' => $isCorrect, 'flagged' => $answer['flagged'], 'question' => $this->reviewQuestion($question)];
            }
            $total = count($storedItems);
            $result = ['exam' => ['id' => $sessionId, 'title' => $row['title'], 'subject' => $row['title']], 'totalQuestions' => $total, 'correct' => $correct, 'incorrect' => $incorrect, 'unanswered' => $unanswered, 'score' => $total === 0 ? 0 : (int) round(($correct / $total) * 100), 'totalTime' => max(0, time() - strtotime($row['created_at'])), 'questionResults' => $results];
            $this->pdo->prepare("UPDATE question_bank_sessions SET status = 'completed', completed_at = CURRENT_TIMESTAMP, result_json = ? WHERE id = ?")
                ->execute([$this->json($result), $sessionId]);
            $this->pdo->commit();
            return $result;
        } catch (Throwable $error) {
            if ($this->pdo->inTransaction()) $this->pdo->rollBack();
            throw $error;
        }
    }

    public function errors(int $userId): array {
        $query = $this->pdo->prepare("SELECT s.id AS session_id, s.title, s.completed_at, i.payload_json, a.selected_option, a.flagged FROM question_bank_sessions s JOIN question_bank_session_answers a ON a.session_id = s.id JOIN question_bank_session_items i ON i.session_id = a.session_id AND i.question_key = a.question_key WHERE s.user_id = ? AND s.status = 'completed' AND a.is_correct = 0 AND a.selected_option IS NOT NULL ORDER BY s.completed_at DESC, i.position ASC");
        $query->execute([$userId]);
        return array_map(function (array $row): array {
            $question = $this->decode($row['payload_json']);
            return ['sessionId' => $row['session_id'], 'examTitle' => $row['title'], 'completedAt' => $row['completed_at'], 'questionId' => $question['id'], 'questionText' => $question['text'], 'selectedAnswer' => (int) $row['selected_option'], 'correctAnswer' => $question['correctOption'], 'flagged' => (bool) $row['flagged'], 'question' => $this->reviewQuestion($question)];
        }, $query->fetchAll());
    }

    public function history(int $userId): array {
        $query = $this->pdo->prepare('SELECT id, title, filters_json, question_count, created_at, completed_at, result_json FROM question_bank_sessions WHERE user_id = ? ORDER BY created_at DESC');
        $query->execute([$userId]);
        return array_map(fn(array $row): array => ['sessionId' => $row['id'], 'title' => $row['title'], 'filters' => $this->decode($row['filters_json']), 'questionCount' => (int) $row['question_count'], 'createdAt' => $row['created_at'], 'completedAt' => $row['completed_at'], 'score' => $row['result_json'] ? ($this->decode($row['result_json'])['score'] ?? null) : null], $query->fetchAll());
    }

    private function selectQuestions(array $filters, int $limit): array {
        return match ($filters['track']) {
            'enem' => $this->selectEnem($filters['subject'], $limit),
            'concursos' => $this->selectConcursos($filters, $limit),
            default => throw new InvalidArgumentException('Modalidade inválida.'),
        };
    }

    private function selectEnem(string $subject, int $limit): array {
        $area = self::ENEM_SUBJECTS[$subject] ?? null;
        if ($area === null) throw new InvalidArgumentException('Matéria ENEM inválida.');
        $query = $this->pdo->prepare("SELECT id, year, day, question_number, statement, option_a, option_b, option_c, option_d, option_e, correct_option, images FROM enem_questions WHERE area = ? AND status = 'valid' AND correct_option IN ('A', 'B', 'C', 'D', 'E') ORDER BY RANDOM() LIMIT ?");
        $query->bindValue(1, $area, PDO::PARAM_STR);
        $query->bindValue(2, $limit, PDO::PARAM_INT);
        $query->execute();
        return array_map(fn(array $row): array => ['id' => 'enem:' . $row['id'], 'text' => $row['statement'], 'answers' => [$row['option_a'], $row['option_b'], $row['option_c'], $row['option_d'], $row['option_e']], 'correctOption' => $this->optionIndex($row['correct_option']), 'images' => $this->images($row['images']), 'source' => "ENEM {$row['year']} · Dia {$row['day']} · Questão {$row['question_number']}"], $query->fetchAll());
    }

    private function selectConcursos(array $filters, int $limit): array {
        $subject = $filters['subject'];
        if (!array_key_exists($subject, self::CONCURSO_SUBJECTS)) throw new InvalidArgumentException('Matéria de concurso inválida.');
        $where = ['q.subject_slug = ?'];
        $params = [$subject];
        $join = '';
        if ($subject === 'conhecimentos-especificos') {
            if ($filters['specialty'] === null || $filters['topic'] === null || !$this->isKnownSpecialty($filters['specialty'])) throw new InvalidArgumentException('Selecione área específica e subtema.');
            $join = ' JOIN concurso_question_topics t ON t.question_id = q.id ';
            $where[] = 't.specialty_slug = ?';
            $where[] = 't.topic_slug = ?';
            array_push($params, $filters['specialty'], $filters['topic']);
        } elseif ($filters['specialty'] !== null || $filters['topic'] !== null) throw new InvalidArgumentException('Área específica só pode ser usada em Conhecimentos Específicos.');
        $query = $this->pdo->prepare('SELECT q.* FROM concurso_questions q ' . $join . ' WHERE ' . implode(' AND ', $where) . ' ORDER BY RANDOM() LIMIT ?');
        foreach ($params as $index => $value) $query->bindValue($index + 1, $value, PDO::PARAM_STR);
        $query->bindValue(count($params) + 1, $limit, PDO::PARAM_INT);
        $query->execute();
        return array_map(fn(array $row): array => ['id' => 'concurso:' . $row['id'], 'text' => $row['statement'], 'answers' => [$row['option_a'], $row['option_b'], $row['option_c'], $row['option_d'], $row['option_e']], 'correctOption' => $this->optionIndex($row['correct_option']), 'images' => [], 'source' => $row['source_label']], $query->fetchAll());
    }

    private function enemCount(): int { return (int) $this->pdo->query("SELECT COUNT(*) FROM enem_questions WHERE status = 'valid' AND correct_option IN ('A', 'B', 'C', 'D', 'E')")->fetchColumn(); }
    private function concursoCount(): int { return (int) $this->pdo->query('SELECT COUNT(*) FROM concurso_questions')->fetchColumn(); }

    private function enemSubjects(): array {
        $result = [];
        foreach (self::ENEM_SUBJECTS as $slug => $label) {
            $query = $this->pdo->prepare("SELECT COUNT(*) FROM enem_questions WHERE area = ? AND status = 'valid' AND correct_option IN ('A', 'B', 'C', 'D', 'E')");
            $query->execute([$label]);
            $count = (int) $query->fetchColumn();
            if ($count > 0) $result[] = compact('slug', 'label', 'count');
        }
        return $result;
    }

    private function concursoSubjects(): array {
        $query = $this->pdo->query('SELECT subject_slug, subject_label, COUNT(*) AS total FROM concurso_questions GROUP BY subject_slug, subject_label ORDER BY subject_label');
        return array_map(fn(array $row): array => ['slug' => $row['subject_slug'], 'label' => $row['subject_label'], 'count' => (int) $row['total']], $query->fetchAll());
    }

    private function specialties(): array {
        $query = $this->pdo->query('SELECT specialty_slug AS slug, COUNT(*) AS total FROM concurso_question_topics GROUP BY specialty_slug ORDER BY specialty_slug');
        return array_map(fn(array $row): array => ['slug' => $row['slug'], 'label' => $this->specialtyLabel($row['slug']), 'count' => (int) $row['total']], $query->fetchAll());
    }

    private function topics(string $specialty): array {
        $query = $this->pdo->prepare('SELECT p.slug, p.label, p.position, COUNT(t.question_id) AS total FROM question_bank_topics p LEFT JOIN concurso_question_topics t ON t.specialty_slug = p.specialty_slug AND t.topic_slug = p.slug WHERE p.specialty_slug = ? GROUP BY p.slug, p.label, p.position ORDER BY p.position');
        $query->execute([$specialty]);
        return array_map(fn(array $row): array => ['slug' => $row['slug'], 'label' => $row['label'], 'count' => (int) $row['total']], $query->fetchAll());
    }

    private function answersByQuestion(array $answers, array $storedItems): array {
        $allowed = array_fill_keys(array_column($storedItems, 'question_key'), true);
        $result = [];
        foreach ($answers as $answer) {
            if (!is_array($answer) || !is_string($answer['questionId'] ?? null) || !array_key_exists($answer['questionId'], $allowed) || array_key_exists($answer['questionId'], $result)) throw new InvalidArgumentException('Uma resposta não pertence a esta sessão.');
            $selected = $answer['selectedOption'] ?? null;
            if ($selected !== null && (!is_int($selected) || $selected < 0 || $selected > 4)) throw new InvalidArgumentException('Alternativa inválida.');
            $result[$answer['questionId']] = ['selectedOption' => $selected, 'flagged' => (bool) ($answer['flagged'] ?? false)];
        }
        return $result;
    }

    private function publicQuestion(array $question): array {
        return ['id' => $question['id'], 'text' => $question['text'], 'answers' => $question['answers'], 'images' => array_map(fn(string $path): string => '/question-assets/enem/' . $path, $question['images']), 'source' => $question['source']];
    }
    private function reviewQuestion(array $question): array { return $this->publicQuestion($question) + ['correctAnswer' => $question['correctOption']]; }

    private function images(string $images): array {
        $paths = $this->decode($images);
        if (!is_array($paths)) return [];
        foreach ($paths as $path) if (!is_string($path) || !preg_match('#^assets/[A-Za-z0-9._/-]+$#', $path) || str_contains($path, '..')) throw new RuntimeException('Caminho de imagem inválido no banco.');
        return $paths;
    }

    private function requiredString(array $input, string $key): string { $value = $this->optionalString($input, $key); if ($value === null) throw new InvalidArgumentException("{$key} é obrigatório."); return $value; }
    private function optionalString(array $input, string $key): ?string { $value = $input[$key] ?? null; if ($value === null) return null; if (!is_string($value) || trim($value) === '') throw new InvalidArgumentException("{$key} é inválido."); return trim($value); }
    private function sessionTitle(array $filters): string { $track = $filters['track'] === 'enem' ? 'ENEM' : 'Concursos'; $label = $filters['track'] === 'enem' ? (self::ENEM_SUBJECTS[$filters['subject']] ?? '') : (self::CONCURSO_SUBJECTS[$filters['subject']] ?? ''); if ($filters['specialty'] !== null) $label .= ' · ' . $this->specialtyLabel($filters['specialty']); if ($filters['topic'] !== null) $label .= ' · ' . $filters['topic']; return trim($track . ' · ' . $label, ' ·'); }
    private function isKnownSpecialty(string $specialty): bool { return in_array($specialty, ['psicologia', 'nutricao', 'educacao-fisica'], true); }
    private function specialtyLabel(string $specialty): string { return match ($specialty) {'psicologia' => 'Psicologia', 'nutricao' => 'Nutrição', 'educacao-fisica' => 'Educação Física', default => $specialty}; }
    private function optionIndex(string $option): int { return ord($option) - ord('A'); }
    private function json(mixed $value): string { return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR); }
    private function decode(?string $value): array { if (!is_string($value)) return []; $decoded = json_decode($value, true, flags: JSON_THROW_ON_ERROR); return is_array($decoded) ? $decoded : []; }
}
