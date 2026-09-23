const Parser = require('tree-sitter');
const Ruby = require('tree-sitter-ruby');

class RubyCFGBuilder {
  constructor(code) {
    this.code = code;
    this.nodes = [];
    this.edges = [];
    this.counter = 0;
    this.edgeSet = new Set();
  }

  id() { return `n${++this.counter}`; }

  addNode(nodeType, label, extras = {}) {
    const id = this.id();
    this.nodes.push({ id, type: 'custom', data: { label, nodeType, ...extras }, position: { x: 0, y: 0 } });
    return id;
  }

  addEdge(source, target, label = '', animated = false) {
    if (!source || !target) return;
    const key = `${source}→${target}:${label}`;
    if (this.edgeSet.has(key)) return;
    this.edgeSet.add(key);
    this.edges.push({
      id: `e${this.counter++}`,
      source, target, label, animated,
      markerEnd: { type: 'arrowclosed' }
    });
  }

  text(node) { return this.code.slice(node.startIndex, node.endIndex); }

  short(text, max = 48) {
    const s = text.replace(/\s+/g, ' ').trim();
    return s.length > max ? s.slice(0, max) + '…' : s;
  }

  parse() {
    const parser = new Parser();
    parser.setLanguage(Ruby);
    const tree = parser.parse(this.code);
    this.findMethods(tree.rootNode);

    // If no methods found, visualize top-level code
    if (this.nodes.length === 0) {
      this.buildTopLevel(tree.rootNode);
    }

    return { nodes: this.nodes, edges: this.edges, language: 'ruby' };
  }

  findMethods(node) {
    const methodTypes = ['method', 'singleton_method'];
    if (methodTypes.includes(node.type)) {
      this.buildMethod(node);
      return;
    }
    for (const child of node.namedChildren) this.findMethods(child);
  }

  buildTopLevel(root) {
    const headerId = this.addNode('method', '(top level)', { nodeType: 'method' });
    const startId = this.addNode('start', 'Start', { nodeType: 'start' });
    this.addEdge(headerId, startId);

    const { exitIds } = this.buildBlock(root.namedChildren, startId);
    const endId = this.addNode('end', 'End', { nodeType: 'end' });
    for (const eid of exitIds) this.addEdge(eid, endId);
  }

  buildMethod(methodNode) {
    const nameNode = methodNode.childForFieldName('name');
    const name = nameNode ? this.text(nameNode) : 'anonymous';
    const sig = this.short(this.text(methodNode).split('\n')[0], 60);

    const headerId = this.addNode('method', `def ${name}`, {
      code: sig, line: methodNode.startPosition.row + 1,
      fullCode: this.text(methodNode), nodeType: 'method'
    });

    const startId = this.addNode('start', 'Start', { nodeType: 'start' });
    this.addEdge(headerId, startId);

    const body = methodNode.childForFieldName('body');
    const stmts = body ? body.namedChildren : methodNode.namedChildren.filter(n => n.type !== 'identifier' && n.type !== 'method_parameters');
    const { exitIds } = this.buildBlock(stmts, startId);

    const endId = this.addNode('end', 'End', { nodeType: 'end' });
    for (const eid of exitIds) this.addEdge(eid, endId);
  }

  buildBlock(stmts, fromId) {
    const filtered = stmts.filter(n => n.isNamed && n.type !== 'comment');
    if (filtered.length === 0) return { entryId: fromId, exitIds: [fromId] };

    let currentExits = fromId ? [fromId] : [];
    let firstEntry = null;

    for (const stmt of filtered) {
      const { entryId, exitIds } = this.buildStmt(stmt);
      if (entryId) {
        for (const eid of currentExits) this.addEdge(eid, entryId);
        if (!firstEntry) firstEntry = entryId;
        currentExits = exitIds;
      }
    }

    return { entryId: firstEntry || fromId, exitIds: currentExits.length ? currentExits : [fromId] };
  }

  buildStmt(node) {
    switch (node.type) {
      case 'if':
      case 'unless':
        return this.buildConditional(node);
      case 'if_modifier':
      case 'unless_modifier':
        return this.buildModifier(node);
      case 'while':
      case 'until':
        return this.buildWhile(node);
      case 'while_modifier':
      case 'until_modifier':
        return this.buildWhileModifier(node);
      case 'for':
        return this.buildFor(node);
      case 'begin':
        return this.buildBegin(node);
      case 'rescue':
      case 'rescue_modifier':
        return this.buildRescue(node);
      case 'return':
        return this.buildReturn(node);
      case 'raise':
        return this.buildRaise(node);
      case 'call':
      case 'method_call':
        return this.buildCall(node);
      case 'assignment':
      case 'operator_assignment':
      case 'multiple_assignment':
        return this.buildProcess(node, 'declare');
      case 'body_statement':
        return this.buildBlock(node.namedChildren, null);
      case 'then':
      case 'else':
        return this.buildBlock(node.namedChildren, null);
      default:
        if (node.isNamed) return this.buildProcess(node, 'process');
        return { entryId: null, exitIds: [] };
    }
  }

  buildProcess(node, nodeType = 'process') {
    const raw = this.text(node);
    const id = this.addNode(nodeType, this.short(raw), {
      code: raw, line: node.startPosition.row + 1, nodeType
    });
    return { entryId: id, exitIds: [id] };
  }

  buildCall(node) {
    const raw = this.text(node);
    const id = this.addNode('call', this.short(raw), {
      code: raw, line: node.startPosition.row + 1, nodeType: 'call'
    });
    return { entryId: id, exitIds: [id] };
  }

  buildReturn(node) {
    const raw = this.text(node);
    const id = this.addNode('return', this.short(raw), {
      code: raw, line: node.startPosition.row + 1, nodeType: 'return'
    });
    return { entryId: id, exitIds: [] };
  }

  buildRaise(node) {
    const raw = this.text(node);
    const id = this.addNode('throw', this.short(raw), {
      code: raw, line: node.startPosition.row + 1, nodeType: 'throw'
    });
    return { entryId: id, exitIds: [] };
  }

  buildConditional(node) {
    const isUnless = node.type === 'unless';
    const cond = node.childForFieldName('condition');
    const condText = cond ? this.text(cond) : '?';
    const keyword = isUnless ? 'unless' : 'if';

    const decId = this.addNode('decision', `${keyword} ${this.short(condText, 40)}`, {
      code: this.text(node).split('\n')[0], line: node.startPosition.row + 1, nodeType: 'decision'
    });

    const consequence = node.childForFieldName('consequence') || node.childForFieldName('body');
    const alternative = node.childForFieldName('alternative');

    let trueExits = [decId];
    let falseExits = [decId];

    if (consequence) {
      const { entryId, exitIds } = this.buildBlock(consequence.namedChildren, null);
      if (entryId) {
        this.addEdge(decId, entryId, isUnless ? 'false' : 'true');
        trueExits = exitIds;
      }
    }

    if (alternative) {
      const altChildren = alternative.type === 'else' ? alternative.namedChildren : [alternative];
      const { entryId, exitIds } = this.buildBlock(altChildren, null);
      if (entryId) {
        this.addEdge(decId, entryId, isUnless ? 'true' : 'false');
        falseExits = exitIds;
      }
    }

    return { entryId: decId, exitIds: [...trueExits, ...falseExits] };
  }

  buildModifier(node) {
    const isUnless = node.type === 'unless_modifier';
    const cond = node.childForFieldName('condition');
    const body = node.childForFieldName('body');

    const condText = cond ? this.text(cond) : '?';
    const decId = this.addNode('decision', `${isUnless ? 'unless' : 'if'} ${this.short(condText, 40)}`, {
      code: this.text(node), line: node.startPosition.row + 1, nodeType: 'decision'
    });

    if (body) {
      const { entryId, exitIds: _ } = this.buildStmt(body);
      if (entryId) this.addEdge(decId, entryId, isUnless ? 'false' : 'true');
    }

    return { entryId: decId, exitIds: [decId] };
  }

  buildWhile(node) {
    const isUntil = node.type === 'until';
    const cond = node.childForFieldName('condition');
    const condText = cond ? this.text(cond) : '?';

    const condId = this.addNode('loop', `${isUntil ? 'until' : 'while'} ${this.short(condText, 40)}`, {
      code: this.text(node).split('\n')[0], line: node.startPosition.row + 1, nodeType: 'loop'
    });

    const body = node.childForFieldName('body');
    if (body) {
      const { entryId, exitIds } = this.buildBlock(body.namedChildren, condId);
      if (entryId && entryId !== condId) {
        this.addEdge(condId, entryId, 'body');
        for (const eid of exitIds) this.addEdge(eid, condId, '', true);
      }
    }

    return { entryId: condId, exitIds: [condId] };
  }

  buildWhileModifier(node) {
    const body = node.childForFieldName('body');
    const cond = node.childForFieldName('condition');
    const condText = cond ? this.text(cond) : '?';
    const isUntil = node.type === 'until_modifier';

    const condId = this.addNode('loop', `${isUntil ? 'until' : 'while'} ${this.short(condText, 35)} (modifier)`, {
      code: this.text(node), line: node.startPosition.row + 1, nodeType: 'loop'
    });

    if (body) {
      const { entryId, exitIds } = this.buildStmt(body);
      if (entryId) {
        this.addEdge(condId, entryId, 'body');
        for (const eid of exitIds) this.addEdge(eid, condId, '', true);
      }
    }

    return { entryId: condId, exitIds: [condId] };
  }

  buildFor(node) {
    const pattern = node.childForFieldName('pattern');
    const value = node.childForFieldName('value');
    const label = `for ${pattern ? this.text(pattern) : '?'} in ${value ? this.short(this.text(value), 25) : '?'}`;

    const forId = this.addNode('loop', label, {
      code: this.text(node).split('\n')[0], line: node.startPosition.row + 1, nodeType: 'loop'
    });

    const body = node.childForFieldName('body');
    if (body) {
      const { entryId, exitIds } = this.buildBlock(body.namedChildren, forId);
      if (entryId && entryId !== forId) {
        this.addEdge(forId, entryId, 'each');
        for (const eid of exitIds) this.addEdge(eid, forId, '', true);
      }
    }

    return { entryId: forId, exitIds: [forId] };
  }

  buildBegin(node) {
    const tryId = this.addNode('try', 'begin', { nodeType: 'try', line: node.startPosition.row + 1 });

    const body = node.namedChildren.find(c => c.type === 'body_statement');
    let tryExits = [tryId];

    if (body) {
      const normalStmts = body.namedChildren.filter(c => c.type !== 'rescue' && c.type !== 'ensure' && c.type !== 'else');
      if (normalStmts.length > 0) {
        const { exitIds } = this.buildBlock(normalStmts, tryId);
        tryExits = exitIds;
      }

      const rescues = body.namedChildren.filter(c => c.type === 'rescue');
      const rescueExits = [];
      for (const rescueNode of rescues) {
        const excType = rescueNode.childForFieldName('exceptions');
        const excText = excType ? this.text(excType) : 'Exception';
        const rescueId = this.addNode('catch', `rescue ${this.short(excText, 25)}`, {
          nodeType: 'catch', line: rescueNode.startPosition.row + 1
        });
        this.addEdge(tryId, rescueId, 'rescue');

        const rescueBody = rescueNode.childForFieldName('body');
        if (rescueBody) {
          const { exitIds } = this.buildBlock(rescueBody.namedChildren, rescueId);
          rescueExits.push(...exitIds);
        } else {
          rescueExits.push(rescueId);
        }
      }

      const ensure = body.namedChildren.find(c => c.type === 'ensure');
      if (ensure) {
        const ensureId = this.addNode('finally', 'ensure', { nodeType: 'finally' });
        for (const eid of [...tryExits, ...rescueExits]) this.addEdge(eid, ensureId);
        const { exitIds } = this.buildBlock(ensure.namedChildren, ensureId);
        return { entryId: tryId, exitIds };
      }

      return { entryId: tryId, exitIds: [...tryExits, ...rescueExits] };
    }

    return { entryId: tryId, exitIds: tryExits };
  }

  buildRescue(node) {
    const excType = node.childForFieldName('exceptions');
    const excText = excType ? this.text(excType) : 'Exception';
    const rescueId = this.addNode('catch', `rescue ${this.short(excText, 30)}`, {
      nodeType: 'catch', line: node.startPosition.row + 1
    });
    return { entryId: rescueId, exitIds: [rescueId] };
  }
}

function buildRubyCFG(code) {
  const builder = new RubyCFGBuilder(code);
  return builder.parse();
}

module.exports = { buildRubyCFG };
