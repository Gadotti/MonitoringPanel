/**
 * Loads a vanilla JS file (with global function declarations) into the
 * Jest global scope so the functions become accessible in tests.
 *
 * Works by wrapping the file contents so that function declarations
 * are captured and assigned to globalThis.
 */
const fs = require('fs');
const path = require('path');

const PUBLIC_JS = path.join(__dirname, '..', '..', 'public', 'js');

function loadScript(filename) {
  const code = fs.readFileSync(path.join(PUBLIC_JS, filename), 'utf8');

  // Extract top-level function names (function declarations only)
  const fnPattern = /^function\s+([a-zA-Z_$][\w$]*)\s*\(/gm;
  const names = [];
  let match;
  while ((match = fnPattern.exec(code)) !== null) {
    names.push(match[1]);
  }

  // Also capture async function declarations
  const asyncPattern = /^async\s+function\s+([a-zA-Z_$][\w$]*)\s*\(/gm;
  while ((match = asyncPattern.exec(code)) !== null) {
    names.push(match[1]);
  }

  // Wrap: execute the code, then assign all discovered functions to globalThis
  const exports = names.map(n => `globalThis.${n} = ${n};`).join('\n');
  const wrapped = `(function() {\n${code}\n${exports}\n})();`;

  // Use indirect eval to run in global scope
  const fn = new Function(wrapped);
  fn();
}

module.exports = { loadScript };
