import { Parser, Language } from 'web-tree-sitter';

let ready = false;
let javaLang: Language | null = null;
let rubyLang: Language | null = null;

export async function initTreeSitter(): Promise<void> {
  if (ready) return;

  await Parser.init({
    locateFile: (name: string) => `/wasm/${name}`,
  });

  [javaLang, rubyLang] = await Promise.all([
    Language.load('/wasm/tree-sitter-java.wasm'),
    Language.load('/wasm/tree-sitter-ruby.wasm'),
  ]);

  ready = true;
}

export function makeParser(language: 'java' | 'ruby'): Parser {
  if (!ready) throw new Error('Call initTreeSitter() first');
  const p = new Parser();
  p.setLanguage(language === 'java' ? javaLang! : rubyLang!);
  return p;
}
