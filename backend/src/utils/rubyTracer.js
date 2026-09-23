const { execFile } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

const TRACER_SCRIPT = `
require 'json'

steps = []
source_lines = $user_code.split("\\n")

trace = TracePoint.new(:line, :call, :return, :raise) do |tp|
  next unless tp.path == '(eval)'

  locals = {}
  begin
    tp.binding.local_variables.each do |var|
      val = tp.binding.local_variable_get(var)
      locals[var.to_s] = val.inspect[0, 120]
    end
  rescue => e
    locals['__error__'] = e.message
  end

  steps << {
    event: tp.event.to_s,
    line: tp.lineno,
    method_id: tp.method_id.to_s,
    locals: locals,
    source: source_lines[tp.lineno - 1]&.strip || ''
  }

  # Cap at 500 steps to avoid infinite loops
  trace.disable if steps.length >= 500
end

begin
  trace.enable
  eval($user_code, binding, '(eval)', 1)
rescue => e
  steps << { event: 'error', line: 0, method_id: '', locals: {}, source: e.message }
ensure
  trace.disable
end

puts JSON.generate({ steps: steps, total: steps.length })
`;

function runRubyTrace(code) {
  return new Promise((resolve, reject) => {
    // Security: basic sanity checks
    const forbidden = [
      /`[^`]*`/,        // backtick execution
      /system\s*\(/,    // system()
      /exec\s*\(/,      // exec()
      /spawn\s*\(/,     // spawn()
      /fork\s*\{/,      // fork
      /IO\.\s*popen/,   // IO.popen
      /File\.\s*(write|delete|unlink|rename)/,  // file writes
      /require\s+['"](?!json|set|date|time|bigdecimal|cmath|complex|rational|matrix|prime|pathname|tempfile|stringio|strscan|pp|prettyprint)/, // require of non-stdlib
    ];

    for (const pattern of forbidden) {
      if (pattern.test(code)) {
        return reject(new Error('Code contains restricted operations for safety.'));
      }
    }

    const tmpDir = os.tmpdir();
    const tmpFile = path.join(tmpDir, `ruby_trace_${Date.now()}.rb`);

    const fullScript = `$user_code = ${JSON.stringify(code)}\n${TRACER_SCRIPT}`;
    fs.writeFileSync(tmpFile, fullScript);

    execFile('ruby', [tmpFile], { timeout: 10000 }, (err, stdout, stderr) => {
      fs.unlinkSync(tmpFile);

      if (err && !stdout) {
        return reject(new Error(stderr || err.message));
      }

      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch {
        reject(new Error('Failed to parse trace output: ' + stdout.slice(0, 200)));
      }
    });
  });
}

module.exports = { runRubyTrace };
