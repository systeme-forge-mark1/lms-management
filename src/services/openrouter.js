const axios = require('axios');

function getKey(overrideKey) {
  return overrideKey || process.env.OPENROUTER_API_KEY;
}

function getModel() {
  return process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001';
}

async function chat(messages, apiKey, maxTokens = 512) {
  const key = getKey(apiKey);
  if (!key) throw new Error('No OpenRouter API key — set OPENROUTER_API_KEY in backend/.env');

  let res;
  try {
    res = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      { model: getModel(), messages, max_tokens: maxTokens },
      {
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://lms-manager.vercel.app',
          'X-Title': 'LMS Manager',
        },
        timeout: 30000,
      }
    );
  } catch (err) {
    if (err.code === 'ECONNABORTED') throw new Error('OpenRouter request timed out (30s)');
    if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') throw new Error('Cannot reach OpenRouter — check your internet connection');

    const status = err.response?.status;
    const body   = err.response?.data;

    if (status === 401) throw new Error('Invalid OpenRouter API key');
    if (status === 402) {
      const reason = body?.error?.message || body?.message || 'insufficient credits or model not accessible';
      throw new Error(`OpenRouter 402: ${reason}`);
    }
    if (status === 429) throw new Error('OpenRouter rate limit hit — try again in a moment');
    if (status === 503 || status === 502) throw new Error(`OpenRouter is temporarily unavailable (${status})`);

    const detail = body?.error?.message || body?.message || err.message;
    throw new Error(`OpenRouter error ${status ?? 'unknown'}: ${detail}`);
  }

  const choice = res.data?.choices?.[0]?.message?.content;
  if (!choice) throw new Error('OpenRouter returned an empty response');
  return choice.trim();
}

async function evaluateQuiz(questionData, apiKey) {
  const optionsList = questionData.options
    .map((o, i) => `${i}: ${o.option}`)
    .join('\n');

  const prompt = `You are answering a university multiple choice question. Reply with ONLY the zero-based index number of the correct answer (0, 1, 2, or 3). No explanation.

Question: ${questionData.question}

Options:
${optionsList}

Answer (number only):`;

  const reply = await chat([{ role: 'user', content: prompt }], apiKey, 10);
  const match = reply.match(/\d+/);
  const idx = match ? parseInt(match[0], 10) : 0;
  const maxIdx = questionData.options.length - 1;
  return Math.min(idx, maxIdx);
}

async function generateGdbAnswer(question, apiKey) {
  const prompt = `You are a university student writing a Graded Discussion Board (GDB) response.
Write a plain academic answer in under 200 words. Output ONLY the answer text — no word count, no notes, no labels, no meta-commentary, no markdown formatting. Write naturally with minor imperfections.

Question: ${question}

Answer:`;

  return chat([{ role: 'user', content: prompt }], apiKey, 350);
}

module.exports = { evaluateQuiz, generateGdbAnswer };
