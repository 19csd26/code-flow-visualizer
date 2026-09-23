const Parser = require('tree-sitter');
const Java = require('tree-sitter-java');

class JavaCFGBuilder {
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
    this.nodes.push({ id, type: `custom`, data: { label, nodeType, ...extras }, position: { x: 0, y: 0 } });
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

  text(node) {
    return this.code.slice(node.startIndex, node.endIndex);
  }

  short(text, max = 48) {
    const s = text.replace(/\s+/g, ' ').trim();
    return s.length > max ? s.slice(0, max) + '…' : s;
  }

  parse() {
    const parser = new Parser();
    parser.setLanguage(Java);
    const tree = parser.parse(this.code);
    this.findMethods(tree.rootNode);
    return { nodes: this.nodes, edges: this.edges, language: 'java' };
  }

  findMethods(node) {
    const methodTypes = ['method_declaration', 'constructor_declaration'];
    if (methodTypes.includes(node.type)) {
      this.buildMethod(node);
      return;
    }
    for (const child of node.namedChildren) this.findMethods(child);
  }

  buildMethod(methodNode) {
    const nameNode = methodNode.childForFieldName('name');
    const name = nameNode ? this.text(nameNode) : 'anonymous';
    const sig = this.short(this.text(methodNode).split('{')[0], 60);

    const headerId = this.addNode('method', `${name}()`, {
      code: sig,
      line: methodNode.startPosition.row + 1,
      fullCode: this.text(methodNode)
    });

    const startId = this.addNode('start', 'Start', { nodeType: 'start' });
    this.addEdge(headerId, startId);

    const body = methodNode.childForFieldName('body');
    const { exitIds } = body
      ? this.buildBlock(body.namedChildren, startId)
      : { exitIds: [startId] };

    const endId = this.addNode('end', 'End', { nodeType: 'end' });
    for (const eid of exitIds) this.addEdge(eid, endId);
  }

  // Returns { entryId, exitIds }
  buildBlock(stmts, fromId) {
    const filtered = stmts.filter(n => n.isNamed && n.type !== 'comment');
    if (filtered.length === 0) return { entryId: fromId, exitIds: [fromId] };

    let currentExits = [fromId];
    let firstEntry = null;

    for (const stmt of filtered) {
      const { entryId, exitIds } = this.buildStmt(stmt);
      if (entryId) {
        for (const eid of currentExits) this.addEdge(eid, entryId);
        if (!firstEntry) firstEntry = entryId;
        currentExits = exitIds;
      }
    }

    return { entryId: firstEntry || fromId, exitIds: currentExits };
  }

  buildStmt(node) {
    switch (node.type) {
      case 'block':
        return this.buildBlock(node.namedChildren, null) || { entryId: null, exitIds: [] };
      case 'if_statement':
        return this.buildIf(node);
      case 'while_statement':
        return this.buildWhile(node);
      case 'for_statement':
        return this.buildFor(node);
      case 'enhanced_for_statement':
        return this.buildForEach(node);
      case 'do_statement':
        return this.buildDoWhile(node);
      case 'try_statement':
        return this.buildTry(node);
      case 'return_statement':
        return this.buildReturn(node);
      case 'throw_statement':
        return this.buildThrow(node);
      case 'switch_statement':
      case 'switch_expression':
        return this.buildSwitch(node);
      case 'local_variable_declaration':
        return this.buildProcess(node, 'declare');
      case 'expression_statement':
        return this.buildExpression(node);
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

  buildExpression(node) {
    const raw = this.text(node);
    // Detect method calls vs assignments
    const isCall = /\w+\s*\(/.test(raw) && !/^\s*(if|while|for|switch)\s*\(/.test(raw);
    return this.buildProcess(node, isCall ? 'call' : 'process');
  }

  buildDeclaration(node) {
    return this.buildProcess(node, 'declare');
  }

  buildReturn(node) {
    const raw = this.text(node);
    const id = this.addNode('return', this.short(raw), {
      code: raw, line: node.startPosition.row + 1, nodeType: 'return'
    });
    return { entryId: id, exitIds: [] }; // terminal
  }

  buildThrow(node) {
    const raw = this.text(node);
    const id = this.addNode('throw', this.short(raw), {
      code: raw, line: node.startPosition.row + 1, nodeType: 'throw'
    });
    return { entryId: id, exitIds: [] }; // terminal
  }

  buildIf(node) {
    const cond = node.childForFieldName('condition');
    const condText = cond ? this.text(cond) : '?';
    const decId = this.addNode('decision', `if ${this.short(condText, 40)}`, {
      code: this.text(node).split('\n')[0], line: node.startPosition.row + 1, nodeType: 'decision'
    });

    const consequence = node.childForFieldName('consequence');
    const alternative = node.childForFieldName('alternative');

    let trueExits = [decId];
    let falseExits = [decId];

    if (consequence) {
      const { entryId, exitIds } = this.buildStmt(consequence);
      if (entryId) {
        this.addEdge(decId, entryId, 'true');
        trueExits = exitIds;
      }
    }

    if (alternative) {
      // alternative might be an else-if or else block
      const altNode = alternative.type === 'if_statement' ? alternative : alternative;
      const { entryId, exitIds } = this.buildStmt(altNode);
      if (entryId) {
        this.addEdge(decId, entryId, 'false');
        falseExits = exitIds;
      }
    }

    return { entryId: decId, exitIds: [...trueExits, ...falseExits] };
  }

  buildWhile(node) {
    const cond = node.childForFieldName('condition');
    const condText = cond ? this.text(cond) : '?';
    const condId = this.addNode('loop', `while ${this.short(condText, 40)}`, {
      code: this.text(node).split('\n')[0], line: node.startPosition.row + 1, nodeType: 'loop'
    });

    const body = node.childForFieldName('body');
    if (body) {
      const { entryId, exitIds } = this.buildStmt(body);
      if (entryId) {
        this.addEdge(condId, entryId, 'true');
        for (const eid of exitIds) this.addEdge(eid, condId, '', true); // loop back
      }
    }

    return { entryId: condId, exitIds: [condId] }; // false branch exits
  }

  buildFor(node) {
    const init = node.childForFieldName('init');
    const cond = node.childForFieldName('condition');
    const update = node.childForFieldName('update');

    const initText = init ? this.text(init) : '';
    const condText = cond ? this.text(cond) : 'true';
    const updateText = update ? this.text(update) : '';

    const forLabel = `for (${this.short(initText, 15)}; ${this.short(condText, 15)}; ${this.short(updateText, 12)})`;
    const forId = this.addNode('loop', forLabel, {
      code: this.text(node).split('\n')[0], line: node.startPosition.row + 1, nodeType: 'loop'
    });

    const body = node.childForFieldName('body');
    if (body) {
      const { entryId, exitIds } = this.buildStmt(body);
      if (entryId) {
        this.addEdge(forId, entryId, 'body');
        for (const eid of exitIds) this.addEdge(eid, forId, '', true);
      }
    }

    return { entryId: forId, exitIds: [forId] };
  }

  buildForEach(node) {
    const type = node.childForFieldName('type');
    const name = node.childForFieldName('name');
    const value = node.childForFieldName('value');

    const label = `for (${type ? this.text(type) : ''} ${name ? this.text(name) : ''} : ${value ? this.short(this.text(value), 20) : ''})`;
    const forId = this.addNode('loop', label, {
      code: this.text(node).split('\n')[0], line: node.startPosition.row + 1, nodeType: 'loop'
    });

    const body = node.childForFieldName('body');
    if (body) {
      const { entryId, exitIds } = this.buildStmt(body);
      if (entryId) {
        this.addEdge(forId, entryId, 'each');
        for (const eid of exitIds) this.addEdge(eid, forId, '', true);
      }
    }

    return { entryId: forId, exitIds: [forId] };
  }

  buildDoWhile(node) {
    const body = node.childForFieldName('body');
    const cond = node.childForFieldName('condition');
    const condText = cond ? this.text(cond) : '?';

    const condId = this.addNode('loop', `do…while ${this.short(condText, 35)}`, {
      code: this.text(node).split('\n')[0], line: node.startPosition.row + 1, nodeType: 'loop'
    });

    let bodyEntry = condId;
    if (body) {
      const { entryId, exitIds } = this.buildStmt(body);
      if (entryId) {
        // Body runs first (link will be done by caller), condition after body
        bodyEntry = entryId;
        for (const eid of exitIds) this.addEdge(eid, condId);
        this.addEdge(condId, entryId, 'true', true); // loop back
      }
    }

    return { entryId: bodyEntry, exitIds: [condId] };
  }

  buildTry(node) {
    const tryId = this.addNode('try', 'try', { nodeType: 'try', line: node.startPosition.row + 1 });

    const body = node.childForFieldName('body');
    let tryExits = [tryId];
    if (body) {
      const { entryId, exitIds } = this.buildBlock(body.namedChildren, tryId);
      tryExits = exitIds;
    }

    const catches = node.namedChildren.filter(c => c.type === 'catch_clause');
    const catchExits = [];

    for (const catchNode of catches) {
      const param = catchNode.childForFieldName('name');
      const paramText = param ? this.text(param) : 'e';
      const catchId = this.addNode('catch', `catch (${paramText})`, {
        nodeType: 'catch', line: catchNode.startPosition.row + 1
      });
      this.addEdge(tryId, catchId, 'exception');

      const catchBody = catchNode.childForFieldName('body');
      if (catchBody) {
        const { exitIds } = this.buildBlock(catchBody.namedChildren, catchId);
        catchExits.push(...exitIds);
      } else {
        catchExits.push(catchId);
      }
    }

    const finallyNode = node.namedChildren.find(c => c.type === 'finally_clause');
    if (finallyNode) {
      const finallyId = this.addNode('finally', 'finally', { nodeType: 'finally' });
      const allPre = [...tryExits, ...catchExits];
      for (const eid of allPre) this.addEdge(eid, finallyId);
      const finallyBody = finallyNode.namedChildren.find(c => c.type === 'block');
      if (finallyBody) {
        const { exitIds } = this.buildBlock(finallyBody.namedChildren, finallyId);
        return { entryId: tryId, exitIds };
      }
      return { entryId: tryId, exitIds: [finallyId] };
    }

    return { entryId: tryId, exitIds: [...tryExits, ...catchExits] };
  }

  buildSwitch(node) {
    const cond = node.childForFieldName('condition') || node.childForFieldName('value');
    const condText = cond ? this.text(cond) : '?';
    const switchId = this.addNode('decision', `switch ${this.short(condText, 35)}`, {
      nodeType: 'switch', line: node.startPosition.row + 1
    });

    const exits = [];
    const body = node.childForFieldName('body');
    if (!body) return { entryId: switchId, exitIds: [switchId] };

    const cases = body.namedChildren.filter(c => c.type === 'switch_block_statement_group' || c.type === 'switch_rule');

    for (const caseNode of cases) {
      const labels = caseNode.namedChildren.filter(c => c.type === 'switch_label' || c.type === 'default_case');
      const labelText = labels.map(l => this.text(l)).join(', ') || 'case';

      const caseId = this.addNode('process', this.short(labelText, 30), { nodeType: 'case', line: caseNode.startPosition.row + 1 });
      this.addEdge(switchId, caseId, this.short(labelText, 20));

      const stmts = caseNode.namedChildren.filter(c => c.type !== 'switch_label' && c.type !== 'default_case');
      const { exitIds } = this.buildBlock(stmts, caseId);
      exits.push(...exitIds);
    }

    return { entryId: switchId, exitIds: exits.length ? exits : [switchId] };
  }
}

function buildJavaCFG(code) {
  const builder = new JavaCFGBuilder(code);
  return builder.parse();
}

module.exports = { buildJavaCFG };
