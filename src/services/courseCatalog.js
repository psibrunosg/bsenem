const TYPE_FOLDERS = new Set(['video', 'videos', 'audio', 'audios', 'pdf', 'pdfs']);
const collator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });

export function normalizeFolder(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLocaleLowerCase('pt-BR');
}

export function isTypeFolder(value) {
  return TYPE_FOLDERS.has(normalizeFolder(value));
}

export function displayTitle(raw, fallback = 'Material complementar') {
  const source = String(raw || '').trim();
  const withoutPrefix = source.replace(/^(?:(?:c\d+(?:-a\d+)?(?:-mc\d+)?)|\d+)[_\s.-]*/i, '');
  const remainder = withoutPrefix.replace(/(?:[_\s.-]+\d+)+$/, '').trim();
  return hasAlphabeticText(remainder) ? titleCase(remainder.replace(/[_-]+/g, ' ')) : fallback;
}

export function modulePathFor(pathSegments) {
  return (pathSegments || []).filter(segment => !isTypeFolder(segment));
}

export function buildCourseCatalog(items) {
  const courses = new Map();
  const lessons = new Map();
  const itemToLessonId = new Map();

  for (const item of items || []) {
    const folderPath = modulePathFor(item.pathSegments);
    const courseSource = folderPath[0] || 'Biblioteca local';
    const modulePath = folderPath.slice(1);
    const course = getCourse(courses, courseSource);
    const module = getModule(course, modulePath);

    if (item.resourceType === 'video' || item.resourceType === 'audio') {
      const stem = rawStem(item);
      const lessonKey = `${course.id}\u0000${module.id}\u0000${fold(stem)}`;
      let lesson = lessons.get(lessonKey);
      if (!lesson) {
        lesson = {
          id: `lesson:${escapePath([course.source, ...module.path, stem])}`,
          title: displayTitle(stem, 'Aula'),
          courseId: course.id,
          moduleId: module.id,
          video: null,
          audio: null,
          transcript: null,
          sortName: stem
        };
        lessons.set(lessonKey, lesson);
        module.lessons.push(lesson);
      }
      if (!lesson[item.resourceType]) lesson[item.resourceType] = displayItem(item);
      if (!lesson.transcript && item.transcript) lesson.transcript = item.transcript;
      itemToLessonId.set(item.id, lesson.id);
      continue;
    }

    if (item.resourceType === 'pdf') module.materials.push(displayItem(item));
  }

  return {
    courses: sortCourses([...courses.values()]).map(toCourseNode),
    lessons: new Map([...lessons.values()].map(lesson => [lesson.id, toLesson(lesson)])),
    itemToLessonId
  };
}

function getCourse(courses, source) {
  const key = String(source);
  if (!courses.has(key)) {
    courses.set(key, {
      id: `course:${escapePath([key])}`,
      source: key,
      title: displayTitle(key, 'Biblioteca local'),
      modules: [],
      moduleMap: new Map()
    });
  }
  return courses.get(key);
}

function getModule(course, path) {
  let parent = null;
  let nodes = course.modules;
  let moduleMap = course.moduleMap;
  const effectivePath = path.length ? path : ['Conteúdos do curso'];
  for (const segment of effectivePath) {
    const key = `${parent?.id || course.id}\u0000${segment}`;
    let node = moduleMap.get(key);
    if (!node) {
      const nodePath = parent ? [...parent.path, segment] : [segment];
      node = {
        id: `module:${escapePath([course.source, ...nodePath])}`,
        source: segment,
        title: path.length ? displayTitle(segment, 'Conteúdos do curso') : 'Conteúdos do curso',
        path: nodePath,
        children: [],
        lessons: [],
        materials: []
      };
      moduleMap.set(key, node);
      nodes.push(node);
    }
    parent = node;
    nodes = node.children;
  }
  return parent;
}

function sortCourses(courses) {
  return courses.sort((left, right) => compareSource(left.source, right.source));
}

function toCourseNode(course) {
  return {
    id: course.id,
    title: course.title,
    modules: sortModules(course.modules)
  };
}

function sortModules(modules) {
  return modules
    .sort((left, right) => compareSource(left.source, right.source))
    .map(module => ({
      id: module.id,
      title: module.title,
      children: sortModules(module.children),
      lessons: module.lessons.sort((left, right) => compareSource(left.sortName, right.sortName)).map(toLesson),
      materials: module.materials.sort((left, right) => compareSource(rawStem(left), rawStem(right)))
    }));
}

function toLesson(lesson) {
  const { sortName, ...publicLesson } = lesson;
  return publicLesson;
}

function displayItem(item) {
  return { ...item, title: displayTitle(rawStem(item)) };
}

function rawStem(item) {
  return String(item.rawTitle ?? item.title ?? '');
}

function fold(value) {
  return String(value).normalize('NFC').toLocaleLowerCase('und');
}

function escapePath(segments) {
  return segments.map(segment => encodeURIComponent(String(segment))).join('/');
}

function compareSource(left, right) {
  return collator.compare(left, right) || String(left).localeCompare(String(right));
}

function hasAlphabeticText(value) {
  return /\p{L}/u.test(value);
}

function titleCase(value) {
  const compact = String(value).replace(/\s+/g, ' ').trim();
  if (/^[A-ZÀ-Ý0-9]+$/.test(compact) && compact.length <= 5) return compact;
  return compact
    .toLocaleLowerCase('pt-BR')
    .replace(/(^|\s)(\p{L})/gu, (_, boundary, letter) => `${boundary}${letter.toLocaleUpperCase('pt-BR')}`);
}
