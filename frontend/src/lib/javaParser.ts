import { type Node } from 'web-tree-sitter';
import type { AnalyzeResult, NodeType } from '../types/flow';
import { makeParser } from './treeSitter';

type SNode = Node;

class JavaCFGBuilder {
  private nodes: AnalyzeResult['nodes'] = [];
  private edges: AnalyzeResult['edges'] = [];
  private counter = 0;
  private edgeSet = new Set<string>();

  constructor(private code: string) {}

  private id() { return `n${++this.counter}`; }

  private addNode(nodeType: NodeType | string, label: string, extras: Record<string, unknown> = {}) {
    const id = this.id();
    this.nodes.push({ id, type: 'custom', data: { label, nodeType: nodeType as NodeType, ...extras }, position: { x: 0, y: 0 } });
    return id;
  }

  private addEdge(source: string, target: string, label = '', animated = false) {
    if (!source || !target) return;
    const key = `${source}→${target}:${label}`;
    if (this.edgeSet.has(key)) return;
    this.edgeSet.add(key);
    this.edges.push({ id: `e${this.counter++}`, source, target, label, animated, markerEnd: { type: 'arrowclosed' } } as AnalyzeResult['edges'][number]);
  }

  private text(n: SNode) { return this.code.slice(n.startIndex, n.endIndex); }
  private short(t: string, max = 48) { const s = t.replace(/\s+/g, ' ').trim(); return s.length > max ? s.slice(0, max) + '…' : s; }

  build(): AnalyzeResult {
    const parser = makeParser('java');
    const tree = parser.parse(this.code);
    if (!tree) throw new Error('Failed to parse Java code');
    this.findMethods(tree.rootNode);
    return { nodes: this.nodes, edges: this.edges, language: 'java' };
  }

  private findMethods(node: SNode) {
    if (node.type === 'method_declaration' || node.type === 'constructor_declaration') {
      this.buildMethod(node); return;
    }
    for (const child of node.namedChildren) this.findMethods(child);
  }

  private buildMethod(n: SNode) {
    const nameNode = n.childForFieldName('name');
    const name = nameNode ? this.text(nameNode) : 'anonymous';
    const headerId = this.addNode('method', `${name}()`, { code: this.short(this.text(n).split('{')[0], 60), line: n.startPosition.row + 1, fullCode: this.text(n) });
    const startId = this.addNode('start', 'Start', { nodeType: 'start' });
    this.addEdge(headerId, startId);
    const body = n.childForFieldName('body');
    const { exitIds } = body ? this.buildBlock(body.namedChildren, startId) : { exitIds: [startId] };
    const endId = this.addNode('end', 'End', { nodeType: 'end' });
    for (const eid of exitIds) this.addEdge(eid, endId);
  }

  private buildBlock(stmts: SNode[], fromId: string | null): { entryId: string | null; exitIds: string[] } {
    const filtered = stmts.filter((n: SNode) => n.isNamed && n.type !== 'comment');
    if (!filtered.length) return { entryId: fromId, exitIds: fromId ? [fromId] : [] };
    let currentExits: string[] = fromId ? [fromId] : [];
    let firstEntry: string | null = null;
    for (const stmt of filtered) {
      const { entryId, exitIds } = this.buildStmt(stmt);
      if (entryId) {
        for (const eid of currentExits) this.addEdge(eid, entryId);
        if (!firstEntry) firstEntry = entryId;
        currentExits = exitIds;
      }
    }
    return { entryId: firstEntry ?? fromId, exitIds: currentExits };
  }

  private buildStmt(n: SNode): { entryId: string | null; exitIds: string[] } {
    switch (n.type) {
      case 'block': return this.buildBlock(n.namedChildren, null);
      case 'if_statement': return this.buildIf(n);
      case 'while_statement': return this.buildWhile(n);
      case 'for_statement': return this.buildFor(n);
      case 'enhanced_for_statement': return this.buildForEach(n);
      case 'do_statement': return this.buildDoWhile(n);
      case 'try_statement': return this.buildTry(n);
      case 'return_statement': return this.buildReturn(n);
      case 'throw_statement': return this.buildThrow(n);
      case 'switch_statement': case 'switch_expression': return this.buildSwitch(n);
      case 'local_variable_declaration': return this.buildProcess(n, 'declare');
      case 'expression_statement': return this.buildExpression(n);
      default: return n.isNamed ? this.buildProcess(n, 'process') : { entryId: null, exitIds: [] };
    }
  }

  private buildProcess(n: SNode, nodeType = 'process') {
    const raw = this.text(n);
    const id = this.addNode(nodeType, this.short(raw), { code: raw, line: n.startPosition.row + 1, nodeType });
    return { entryId: id, exitIds: [id] };
  }

  private buildExpression(n: SNode) {
    const raw = this.text(n);
    return this.buildProcess(n, /\w+\s*\(/.test(raw) ? 'call' : 'process');
  }

  private buildReturn(n: SNode) {
    const id = this.addNode('return', this.short(this.text(n)), { code: this.text(n), line: n.startPosition.row + 1, nodeType: 'return' });
    return { entryId: id, exitIds: [] as string[] };
  }

  private buildThrow(n: SNode) {
    const id = this.addNode('throw', this.short(this.text(n)), { code: this.text(n), line: n.startPosition.row + 1, nodeType: 'throw' });
    return { entryId: id, exitIds: [] as string[] };
  }

  private buildIf(n: SNode) {
    const cond = n.childForFieldName('condition');
    const decId = this.addNode('decision', `if ${this.short(cond ? this.text(cond) : '?', 40)}`, { code: this.text(n).split('\n')[0], line: n.startPosition.row + 1, nodeType: 'decision' });

    const consequence = n.childForFieldName('consequence');
    const alternative = n.childForFieldName('alternative');
    let trueExits = [decId], falseExits = [decId];

    if (consequence) {
      const { entryId, exitIds } = this.buildStmt(consequence);
      if (entryId) { this.addEdge(decId, entryId, 'true'); trueExits = exitIds; }
    }
    if (alternative) {
      const { entryId, exitIds } = this.buildStmt(alternative);
      if (entryId) { this.addEdge(decId, entryId, 'false'); falseExits = exitIds; }
    }
    return { entryId: decId, exitIds: [...trueExits, ...falseExits] };
  }

  private buildWhile(n: SNode) {
    const cond = n.childForFieldName('condition');
    const condId = this.addNode('loop', `while ${this.short(cond ? this.text(cond) : '?', 40)}`, { code: this.text(n).split('\n')[0], line: n.startPosition.row + 1, nodeType: 'loop' });
    const body = n.childForFieldName('body');
    if (body) {
      const { entryId, exitIds } = this.buildStmt(body);
      if (entryId) { this.addEdge(condId, entryId, 'true'); for (const eid of exitIds) this.addEdge(eid, condId, '', true); }
    }
    return { entryId: condId, exitIds: [condId] };
  }

  private buildFor(n: SNode) {
    const init = n.childForFieldName('init');
    const cond = n.childForFieldName('condition');
    const upd  = n.childForFieldName('update');
    const label = `for (${this.short(init ? this.text(init) : '', 12)}; ${this.short(cond ? this.text(cond) : 'true', 12)}; ${this.short(upd ? this.text(upd) : '', 10)})`;
    const forId = this.addNode('loop', label, { code: this.text(n).split('\n')[0], line: n.startPosition.row + 1, nodeType: 'loop' });
    const body = n.childForFieldName('body');
    if (body) {
      const { entryId, exitIds } = this.buildStmt(body);
      if (entryId) { this.addEdge(forId, entryId, 'body'); for (const eid of exitIds) this.addEdge(eid, forId, '', true); }
    }
    return { entryId: forId, exitIds: [forId] };
  }

  private buildForEach(n: SNode) {
    const type = n.childForFieldName('type');
    const name = n.childForFieldName('name');
    const val  = n.childForFieldName('value');
    const label = `for (${type ? this.text(type) : ''} ${name ? this.text(name) : ''} : ${this.short(val ? this.text(val) : '', 20)})`;
    const forId = this.addNode('loop', label, { code: this.text(n).split('\n')[0], line: n.startPosition.row + 1, nodeType: 'loop' });
    const body = n.childForFieldName('body');
    if (body) {
      const { entryId, exitIds } = this.buildStmt(body);
      if (entryId) { this.addEdge(forId, entryId, 'each'); for (const eid of exitIds) this.addEdge(eid, forId, '', true); }
    }
    return { entryId: forId, exitIds: [forId] };
  }

  private buildDoWhile(n: SNode) {
    const cond = n.childForFieldName('condition');
    const condId = this.addNode('loop', `do…while ${this.short(cond ? this.text(cond) : '?', 35)}`, { code: this.text(n).split('\n')[0], line: n.startPosition.row + 1, nodeType: 'loop' });
    const body = n.childForFieldName('body');
    if (body) {
      const { entryId, exitIds } = this.buildStmt(body);
      if (entryId) { for (const eid of exitIds) this.addEdge(eid, condId); this.addEdge(condId, entryId, 'true', true); return { entryId, exitIds: [condId] }; }
    }
    return { entryId: condId, exitIds: [condId] };
  }

  private buildTry(n: SNode) {
    const tryId = this.addNode('try', 'try', { nodeType: 'try', line: n.startPosition.row + 1 });
    const body = n.childForFieldName('body');
    let tryExits: string[] = [tryId];
    if (body) { const { exitIds } = this.buildBlock(body.namedChildren, tryId); tryExits = exitIds; }

    const catchExits: string[] = [];
    for (const c of n.namedChildren.filter((c: SNode) => c.type === 'catch_clause')) {
      const param = c.childForFieldName('name');
      const catchId = this.addNode('catch', `catch (${param ? this.text(param) : 'e'})`, { nodeType: 'catch', line: c.startPosition.row + 1 });
      this.addEdge(tryId, catchId, 'exception');
      const cb = c.childForFieldName('body');
      if (cb) { const { exitIds } = this.buildBlock(cb.namedChildren, catchId); catchExits.push(...exitIds); }
      else catchExits.push(catchId);
    }

    const fin = n.namedChildren.find((c: SNode) => c.type === 'finally_clause');
    if (fin) {
      const finId = this.addNode('finally', 'finally', { nodeType: 'finally' });
      for (const eid of [...tryExits, ...catchExits]) this.addEdge(eid, finId);
      const fb = fin.namedChildren.find(c => c.type === 'block');
      if (fb) { const { exitIds } = this.buildBlock(fb.namedChildren, finId); return { entryId: tryId, exitIds }; }
      return { entryId: tryId, exitIds: [finId] };
    }
    return { entryId: tryId, exitIds: [...tryExits, ...catchExits] };
  }

  private buildSwitch(n: SNode) {
    const cond = n.childForFieldName('condition') ?? n.childForFieldName('value');
    const switchId = this.addNode('decision', `switch ${this.short(cond ? this.text(cond) : '?', 35)}`, { nodeType: 'switch', line: n.startPosition.row + 1 });
    const exits: string[] = [];
    const body = n.childForFieldName('body');
    if (!body) return { entryId: switchId, exitIds: [switchId] };
    for (const c of body.namedChildren.filter((c: SNode) => c.type === 'switch_block_statement_group' || c.type === 'switch_rule')) {
      const labels = c.namedChildren.filter((l: SNode) => l.type === 'switch_label' || l.type === 'default_case');
      const labelText = labels.map((l: SNode) => this.text(l)).join(', ') || 'case';
      const caseId = this.addNode('process', this.short(labelText, 30), { nodeType: 'case', line: c.startPosition.row + 1 });
      this.addEdge(switchId, caseId, this.short(labelText, 20));
      const stmts = c.namedChildren.filter((c: SNode) => c.type !== 'switch_label' && c.type !== 'default_case');
      const { exitIds } = this.buildBlock(stmts, caseId);
      exits.push(...exitIds);
    }
    return { entryId: switchId, exitIds: exits.length ? exits : [switchId] };
  }
}

export function buildJavaCFG(code: string): AnalyzeResult {
  return new JavaCFGBuilder(code).build();
}
