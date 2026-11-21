const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const Subject = require('../models/Subject');
const requireAuth = require('../middleware/auth');
const { generateGdbAnswer } = require('../services/openrouter');

const router = express.Router();
router.use(requireAuth);

const SCRIPTS_DIR = path.join(__dirname, '../../../lms-agent');

function normalizeQuotes(text) {
  return text
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...');
}

router.post('/run', async (req, res) => {
  const { vulmsId, password, subjectIds } = req.body;
  if (!subjectIds?.length) return res.status(400).json({ error: 'Select at least one subject' });

  const subjects = await Subject.find({ _id: { $in: subjectIds }, userId: req.user._id });
  if (!subjects.length) return res.status(404).json({ error: 'No matching subjects found' });

  const apiKey = req.user.openrouterApiKey;
  if (!apiKey) return res.status(400).json({ error: 'No OpenRouter API key on your account. Contact support.' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (type, payload) => {
    res.write(`data: ${JSON.stringify({ type, ...payload })}\n\n`);
  };

  const env = {
    ...process.env,
    VULMS_ID: vulmsId || '',
    VULMS_PASSWORD: password || '',
    COURSE_NAMES: JSON.stringify(subjects.map(s => s.fullName)),
    CHROME_PROFILE_DIR: process.env.CHROME_PROFILE_DIR || 'F:\\ChromeAutomationTestProfile',
    PYTHONUNBUFFERED: '1',
  };

  const child = spawn('python', [path.join(SCRIPTS_DIR, 'gdb_solver.py')], {
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let stdoutBuf = '';

  child.stdout.on('data', async (chunk) => {
    stdoutBuf += chunk.toString();
    const lines = stdoutBuf.split('\n');
    stdoutBuf = lines.pop();

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const data = JSON.parse(line);
        if (data.type === 'gdb_question') {
          send('gdb_question', { question: data.question });
          send('log', { message: 'Generating answer via OpenRouter...' });
          try {
            const answer = await generateGdbAnswer(data.question, apiKey);
            const cleanAnswer = normalizeQuotes(answer);
            send('gdb_answer', { answer: cleanAnswer });
            child.stdin.write(`${cleanAnswer}\n`);
          } catch (err) {
            send('error', { message: `OpenRouter error: ${err.message}` });
            child.stdin.write('Unable to generate answer at this time.\n');
          }
          continue;
        }
        if (data.type === 'subject_start' || data.type === 'subject_done' || data.type === 'error') {
          send(data.type, data);
          continue;
        }
      } catch { /* plain log line */ }
      send('log', { message: line });
    }
  });

  let stderrBuf = '';
  child.stderr.on('data', (chunk) => {
    stderrBuf += chunk.toString();
    const lines = stderrBuf.split('\n');
    stderrBuf = lines.pop();
    lines.filter(l => l.trim()).forEach(l => send('log', { message: l }));
  });

  child.on('close', (code) => {
    if (stdoutBuf.trim()) send('log', { message: stdoutBuf });
    if (stderrBuf.trim()) send('log', { message: stderrBuf });
    send('done', { message: `Finished ${subjects.length} subject(s).`, exitCode: code });
    res.end();
  });

  req.on('close', () => { if (!child.killed) child.kill(); });
});

module.exports = router;
