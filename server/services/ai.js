const axios = require('axios');

function resolveAiConfig() {
  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.AI_API_KEY || '';
  const baseUrl = (process.env.AI_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, '');
  const model = process.env.AI_MODEL || process.env.DEEPSEEK_MODEL || 'deepseek-flash';
  return { apiKey, baseUrl, model };
}

/**
 * 调用 OpenAI 兼容的 chat/completions 流式接口。
 * 返回 axios 响应，response.data 为 SSE 可读流。
 */
async function chatStream(messages, options = {}) {
  const { apiKey, baseUrl, model } = resolveAiConfig();
  if (!apiKey) {
    const error = new Error('服务器未配置 AI API Key');
    error.code = 'AI_NOT_CONFIGURED';
    throw error;
  }

  return axios.post(
    `${baseUrl}/chat/completions`,
    {
      model,
      messages,
      stream: true,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 1200,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      responseType: 'stream',
      timeout: options.timeout || 120000,
    }
  );
}

/**
 * 将上游 SSE 流转成前端可读的 SSE。
 * 按字节缓冲，只在完整 0x0A 行边界解码，避免 UTF-8 多字节被截断。
 */
function relaySSE(upstream, res) {
  let pending = Buffer.alloc(0);

  const handleLine = (rawLine) => {
    const line = rawLine.replace(/\r$/, '');
    if (!line.startsWith('data: ')) return;
    const payload = line.slice(6).trim();
    if (payload === '[DONE]') {
      res.write('data: [DONE]\n\n');
      return;
    }
    try {
      const json = JSON.parse(payload);
      const content = json.choices?.[0]?.delta?.content;
      if (content) res.write(`data: ${JSON.stringify({ content })}\n\n`);
    } catch {
      /* 忽略无法解析的行 */
    }
  };

  upstream.on('data', (chunk) => {
    pending = Buffer.concat([pending, chunk]);
    let idx;
    while ((idx = pending.indexOf(0x0a)) !== -1) {
      const lineBuf = pending.slice(0, idx);
      pending = pending.slice(idx + 1);
      handleLine(lineBuf.toString('utf-8'));
    }
  });

  upstream.on('end', () => {
    if (pending.length) {
      handleLine(pending.toString('utf-8'));
      pending = Buffer.alloc(0);
    }
    res.write('data: [DONE]\n\n');
    res.end();
  });

  upstream.on('error', (err) => {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  });
}

module.exports = { chatStream, relaySSE, resolveAiConfig };
