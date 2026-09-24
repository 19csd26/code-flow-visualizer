import { type Node } from 'web-tree-sitter';
import type { AnalyzeResult, NodeType } from '../types/flow';
import { makeParser } from './treeSitter';

type SNode = Node;

class RubyCFGBuilder {
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
    const parser = makeParser('ruby');
    const tree = parser.parse(this.code);
    if (!tree) throw new Error('Failed to parse Ruby code');
    this.findMethods(tree.rootNode);
    if (this.nodes.length === 0) this.buildTopLevel(tree.rootNode);
    return { nodes: this.nodes, edges: this.edges, language: 'ruby' };
  }

  private findMethods(node: SNode) {
    if (node.type === 'method' || node.type === 'singleton_method') { this.buildMethod(node); return; }
    for (const child of node.namedChildren) this.findMethods(child);
  }

  private buildTopLevel(root: SNode) {
    const headerId = this.addNode('method', '(top level)', { nodeType: 'method' });
    const startId = this.addNode('start', 'Start', { nodeType: 'start' });
    this.addEdge(headerId, startId);
    const { exitIds } = this.buildBlock(root.namedChildren, startId);
    const endId = this.addNode('end', 'End', { nodeType: 'end' });
    for (const eid of exitIds) this.addEdge(eid, endId);
  }

  private buildMethod(n: SNode) {
    const nameNode = n.childForFieldName('name');
    const name = nameNode ? this.text(nameNode) : 'anonymous';
    const headerId = this.addNode('method', `def ${name}`, { code: this.short(this.text(n).split('\n')[0], 60), line: n.startPosition.row + 1, fullCode: this.text(n), nodeType: 'method' });
    const startId = this.addNode('start', 'Start', { nodeType: 'start' });
    this.addEdge(headerId, startId);
    const body = n.childForFieldName('body');
    const stmts = body ? body.namedChildren : n.namedChildren.filter((c: SNode) => c.type !== 'identifier' && c.type !== 'method_parameters');
    const { exitIds } = this.buildBlock(stmts, startId);
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
    return { entryId: firstEntry ?? fromId, exitIds: currentExits.length ? currentExits : fromId ? [fromId] : [] };
  }

  private buildStmt(n: SNode): { entryId: string | null; exitIds: string[] } {
    switch (n.type) {
      case 'if': case 'unless': return this.buildConditional(n);
      case 'if_modifier': case 'unless_modifier': return this.buildModifier(n);
      case 'while': case 'until': return this.buildWhile(n);
      case 'while_modifier': case 'until_modifier': return this.buildWhileModifier(n);
      case 'for': return this.buildFor(n);
      case 'begin': return this.buildBegin(n);
      case 'return': return this.buildReturn(n);
      case 'raise': return this.buildRaise(n);
      case 'call': case 'method_call': return this.buildCall(n);
      case 'assignment': case 'operator_assignment': case 'multiple_assignment': return this.buildProcess(n, 'declare');
      case 'body_statement': return this.buildBlock(n.namedChildren, null);
      case 'then': case 'else': return this.buildBlock(n.namedChildren, null);
      default: return n.isNamed ? this.buildProcess(n, 'process') : { entryId: null, exitIds: [] };
    }
  }

  private buildProcess(n: SNode, nodeType = 'process') {
    const raw = this.text(n);
    const id = this.addNode(nodeType, this.short(raw), { code: raw, line: n.startPosition.row + 1, nodeType });
    return { entryId: id, exitIds: [id] };
  }

  private buildCall(n: SNode) {
    const raw = this.text(n);
    const id = this.addNode('call', this.short(raw), { code: raw, line: n.startPosition.row + 1, nodeType: 'call' });
    return { entryId: id, exitIds: [id] };
  }

  private buildReturn(n: SNode) {
    const id = this.addNode('return', this.short(this.text(n)), { code: this.text(n), line: n.startPosition.row + 1, nodeType: 'return' });
    return { entryId: id, exitIds: [] as string[] };
  }

  private buildRaise(n: SNode) {
    const id = this.addNode('throw', this.short(this.text(n)), { code: this.text(n), line: n.startPosition.row + 1, nodeType: 'throw' });
    return { entryId: id, exitIds: [] as string[] };
  }

  private buildConditional(n: SNode) {
    const isUnless = n.type === 'unless';
    const cond = n.childForFieldName('condition');
    const decId = this.addNode('decision', `${isUnless ? 'unless' : 'if'} ${this.short(cond ? this.text(cond) : '?', 40)}`, { code: this.text(n).split('\n')[0], line: n.startPosition.row + 1, nodeType: 'decision' });

    const consequence = n.childForFieldName('consequence') ?? n.childForFieldName('body');
    const alternative = n.childForFieldName('alternative');
    let trueExits = [decId], falseExits = [decId];

    if (consequence) {
      const { entryId, exitIds } = this.buildBlock(consequence.namedChildren, null);
      if (entryId) { this.addEdge(decId, entryId, isUnless ? 'false' : 'true'); trueExits = exitIds; }
    }
    if (alternative) {
      const altChildren = alternative.type === 'else' ? alternative.namedChildren : [alternative];
      const { entryId, exitIds } = this.buildBlock(altChildren, null);
      if (entryId) { this.addEdge(decId, entryId, isUnless ? 'true' : 'false'); falseExits = exitIds; }
    }
    return { entryId: decId, exitIds: [...trueExits, ...falseExits] };
  }

  private buildModifier(n: SNode) {
    const isUnless = n.type === 'unless_modifier';
    const cond = n.childForFieldName('condition');
    const decId = this.addNode('decision', `${isUnless ? 'unless' : 'if'} ${this.short(cond ? this.text(cond) : '?', 40)}`, { code: this.text(n), line: n.startPosition.row + 1, nodeType: 'decision' });
    const body = n.childForFieldName('body');
    if (body) { const { entryId } = this.buildStmt(body); if (entryId) this.addEdge(decId, entryId, isUnless ? 'false' : 'true'); }
    return { entryId: decId, exitIds: [decId] };
  }

  private buildWhile(n: SNode) {
    const isUntil = n.type === 'until';
    const cond = n.childForFieldName('condition');
    const condId = this.addNode('loop', `${isUntil ? 'until' : 'while'} ${this.short(cond ? this.text(cond) : '?', 40)}`, { code: this.text(n).split('\n')[0], line: n.startPosition.row + 1, nodeType: 'loop' });
    const body = n.childForFieldName('body');
    if (body) {
      const { entryId, exitIds } = this.buildBlock(body.namedChildren, condId);
      if (entryId && entryId !== condId) { this.addEdge(condId, entryId, 'body'); for (const eid of exitIds) this.addEdge(eid, condId, '', true); }
    }
    return { entryId: condId, exitIds: [condId] };
  }

  private buildWhileModifier(n: SNode) {
    const isUntil = n.type === 'until_modifier';
    const cond = n.childForFieldName('condition');
    const condId = this.addNode('loop', `${isUntil ? 'until' : 'while'} ${this.short(cond ? this.text(cond) : '?', 35)} (modifier)`, { code: this.text(n), line: n.startPosition.row + 1, nodeType: 'loop' });
    const body = n.childForFieldName('body');
    if (body) { const { entryId, exitIds } = this.buildStmt(body); if (entryId) { this.addEdge(condId, entryId, 'body'); for (const eid of exitIds) this.addEdge(eid, condId, '', true); } }
    return { entryId: condId, exitIds: [condId] };
  }

  private buildFor(n: SNode) {
    const pattern = n.childForFieldName('pattern');
    const value   = n.childForFieldName('value');
    const forId = this.addNode('loop', `for ${pattern ? this.text(pattern) : '?'} in ${this.short(value ? this.text(value) : '?', 25)}`, { code: this.text(n).split('\n')[0], line: n.startPosition.row + 1, nodeType: 'loop' });
    const body = n.childForFieldName('body');
    if (body) {
      const { entryId, exitIds } = this.buildBlock(body.namedChildren, forId);
      if (entryId && entryId !== forId) { this.addEdge(forId, entryId, 'each'); for (const eid of exitIds) this.addEdge(eid, forId, '', true); }
    }
    return { entryId: forId, exitIds: [forId] };
  }

  private buildBegin(n: SNode) {
    const tryId = this.addNode('try', 'begin', { nodeType: 'try', line: n.startPosition.row + 1 });
    const body = n.namedChildren.find(c => c.type === 'body_statement');
    let tryExits: string[] = [tryId];

    if (body) {
      const normalStmts = body.namedChildren.filter((c: SNode) => !['rescue', 'ensure', 'else'].includes(c.type));
      if (normalStmts.length) { const { exitIds } = this.buildBlock(normalStmts, tryId); tryExits = exitIds; }

      const rescueExits: string[] = [];
      for (const r of body.namedChildren.filter((c: SNode) => c.type === 'rescue')) {
        const exc = r.childForFieldName('exceptions');
        const rescueId = this.addNode('catch', `rescue ${this.short(exc ? this.text(exc) : 'Exception', 25)}`, { nodeType: 'catch', line: r.startPosition.row + 1 });
        this.addEdge(tryId, rescueId, 'rescue');
        const rb = r.childForFieldName('body');
        if (rb) { const { exitIds } = this.buildBlock(rb.namedChildren, rescueId); rescueExits.push(...exitIds); }
        else rescueExits.push(rescueId);
      }

      const ensure = body.namedChildren.find((c: SNode) => c.type === 'ensure');
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
}

export function buildRubyCFG(code: string): AnalyzeResult {
  return new RubyCFGBuilder(code).build();
}
