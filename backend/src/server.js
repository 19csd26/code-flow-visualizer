const express = require('express');
const cors = require('cors');
const { buildJavaCFG } = require('./parsers/javaParser');
const { buildRubyCFG } = require('./parsers/rubyParser');
const { runRubyTrace } = require('./utils/rubyTracer');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.post('/api/analyze', (req, res) => {
  const { code, language } = req.body;
  if (!code || !language) return res.status(400).json({ error: 'code and language required' });

  try {
    let result;
    if (language === 'java') result = buildJavaCFG(code);
    else if (language === 'ruby') result = buildRubyCFG(code);
    else return res.status(400).json({ error: 'Unsupported language. Use java or ruby.' });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/trace', async (req, res) => {
  const { code, language } = req.body;
  if (!code || !language) return res.status(400).json({ error: 'code and language required' });

  if (language !== 'ruby') {
    return res.status(400).json({ error: 'Step-by-step trace is currently available for Ruby only.' });
  }

  try {
    const trace = await runRubyTrace(code);
    res.json(trace);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
