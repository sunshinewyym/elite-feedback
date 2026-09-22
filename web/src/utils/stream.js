/**
 * 读取后端 SSE 流，解析 data: {content|error} 帧。
 */
export async function readSSE(resp, onJson) {
  if (!resp.ok || !resp.body) {
    let message = '请求失败';
    try {
      const data = await resp.json();
      message = data.error || message;
    } catch {
      /* 忽略 */
    }
    throw new Error(message);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (payload === '[DONE]') continue;
      try {
        onJson(JSON.parse(payload));
      } catch {
        /* 忽略 */
      }
    }
  }
}

/**
 * 发起生成请求（SSE），把增量 content 写入 onContent。
 */
export async function generateFeedback(body, onContent, onError) {
  const resp = await fetch('/api/feedback/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  await readSSE(resp, (json) => {
    if (json.content) onContent(json.content);
    if (json.error) onError?.(json.error);
  });
}
