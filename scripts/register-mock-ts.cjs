// Tests execute the same canonical TypeScript modules imported by the mock page.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const moduleDirectory = path.resolve(__dirname, '../lib');
const allowed = new Set(['mockData.ts', 'itineraryOps.ts', 'chatKeys.ts']);
require.extensions['.ts'] = (module, filename) => {
  if (path.dirname(path.resolve(filename)) !== moduleDirectory || !allowed.has(path.basename(filename))) {
    throw new Error('Only mock TypeScript modules may use this test loader');
  }
  const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
  });
  if (result.diagnostics?.some(item => item.category === ts.DiagnosticCategory.Error)) {
    throw new Error('Mock TypeScript transpilation failed');
  }
  module._compile(result.outputText, filename);
};
