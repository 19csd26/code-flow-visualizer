import Parser from 'web-tree-sitter';

type Language = Parser.Language;

let ready = false;
let javaLang: Language | null = null;
let rubyLang: Language | null = null;

export async function initTreeSitter(): Promise<void> {
  if (ready) return;

  await Parser.init({
    locateFile: (name: string) => `/wasm/${name}`,
  });

  [javaLang, rubyLang] = await Promise.all([
    Parser.Language.load('/wasm/tree-sitter-java.wasm'),
    Parser.Language.load('/wasm/tree-sitter-ruby.wasm'),
  ]);

  ready = true;
}

export function makeParser(language: 'java' | 'ruby'): Parser {
  if (!ready) throw new Error('Call initTreeSitter() first');
  const p = new Parser();
  p.setLanguage(language === 'java' ? javaLang! : rubyLang!);
  return p;
}
