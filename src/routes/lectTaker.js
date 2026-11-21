const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const Subject = require('../models/Subject');
const requireAuth = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const SCRIPTS_DIR = path.join(__dirname, '../../../lms-agent');

router.post('/run', async (req, res) => {
  const { vulmsId, password, subjectId, lessonCount = 1 } = req.body;

  const subject = await Subject.findOne({ _id: subjectId, userId: req.user._id });
  if (!subject) return res.status(404).json({ error: 'Subject not found' });

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
    COURSE_NAME: subject.fullName,
    LESSON_COUNT: String(lessonCount),
    CHROME_PROFILE_DIR: process.env.CHROME_PROFILE_DIR || 'F:\\ChromeAutomationTestProfile',
    PYTHONUNBUFFERED: '1',
  };

  const child = spawn('python', [path.join(SCRIPTS_DIR, 'lect-taker.py')], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const handleLine = (line) => {
    if (!line.trim()) return;
    send('log', { message: line });
  };

  let stdoutBuf = '';
  child.stdout.on('data', (chunk) => {
    stdoutBuf += chunk.toString();
    const lines = stdoutBuf.split('\n');
    stdoutBuf = lines.pop();
    lines.forEach(handleLine);
  });

  let stderrBuf = '';
  child.stderr.on('data', (chunk) => {
    stderrBuf += chunk.toString();
    const lines = stderrBuf.split('\n');
    stderrBuf = lines.pop();
    lines.filter(l => l.trim()).forEach(handleLine);
  });

  child.on('close', (code) => {
    if (stdoutBuf.trim()) handleLine(stdoutBuf);
    if (stderrBuf.trim()) handleLine(stderrBuf);
    const success = code === 0;
    send('done', { exitCode: code, message: success ? `Completed ${lessonCount} lesson(s).` : `Process exited with code ${code}` });
    res.end();
  });

  req.on('close', () => { if (!child.killed) child.kill(); });
});

module.exports = router;
