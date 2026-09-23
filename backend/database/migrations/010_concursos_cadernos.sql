-- Concursos tracks are split into cadernos of at most 50 questions.
-- Clearing the composition makes SimulatorCatalogImporter::ensureImported
-- rebuild every catalog. The old per-track catalog rows stay unpublished:
-- legacy attempts still reference them. Sessions keep their own questions.
DELETE FROM simulator_catalog_questions;
UPDATE simulator_catalogs SET published = 0 WHERE category = 'concursos';
