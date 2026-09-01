export class CourseTree {
  constructor({ courses = [], selectedNodeId = null, onSelect, expandedNodeIds, onToggle } = {}) {
    this.courses = courses;
    this.selectedNodeId = selectedNodeId;
    this.onSelect = onSelect;
    this.expandedNodeIds = expandedNodeIds ?? new Set(allBranchIds(courses));
    this.onToggle = onToggle;
  }

  render() {
    const navigation = document.createElement('nav');
    navigation.className = 'course-tree';
    navigation.setAttribute('aria-label', 'Cursos e módulos');
    const list = document.createElement('ul');
    list.className = 'course-tree-list';
    for (const course of this.courses) list.appendChild(this.renderCourse(course));
    navigation.appendChild(list);
    return navigation;
  }

  renderCourse(course) {
    const item = document.createElement('li');
    item.className = 'course-tree-item';
    item.appendChild(this.nodeButton(course, course.modules, 'course'));
    if (this.isExpanded(course.id)) item.appendChild(this.moduleList(course.modules));
    return item;
  }

  moduleList(modules) {
    const list = document.createElement('ul');
    list.className = 'course-tree-list course-tree-list-nested';
    for (const module of modules) {
      const item = document.createElement('li');
      item.className = 'course-tree-item';
      item.appendChild(this.nodeButton(module, module.children, 'module'));
      if (this.isExpanded(module.id) && module.children?.length) item.appendChild(this.moduleList(module.children));
      list.appendChild(item);
    }
    return list;
  }

  nodeButton(node, children = [], kind) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `course-tree-node course-tree-node-${kind}`;
    button.dataset.nodeId = node.id;
    const hasChildren = children.length > 0;
    button.setAttribute('aria-expanded', String(hasChildren && this.isExpanded(node.id)));
    button.setAttribute('aria-current', node.id === this.selectedNodeId ? 'page' : 'false');
    button.textContent = node.title;
    button.addEventListener('click', () => {
      if (hasChildren) this.onToggle?.(node.id, !this.isExpanded(node.id));
      this.onSelect?.(node.id);
    });
    return button;
  }

  isExpanded(id) {
    return this.expandedNodeIds.has(id);
  }
}

function allBranchIds(courses) {
  const ids = new Set();
  for (const course of courses) {
    ids.add(course.id);
    collectModuleIds(course.modules, ids);
  }
  return ids;
}

function collectModuleIds(modules, ids) {
  for (const module of modules) {
    ids.add(module.id);
    collectModuleIds(module.children || [], ids);
  }
}
