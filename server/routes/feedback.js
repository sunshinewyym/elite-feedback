const express = require('express');
const axios = require('axios');
const { chatStream, relaySSE } = require('../services/ai');

const router = express.Router();

const COURSE_NAMES = Object.freeze({
  l1: 'L1 课程',
  cpp: 'C++',
  robotics: '机器人',
  graphical: '图形化',
  python: 'Python',
});

const TRACK_NAMES = Object.freeze({
  basic: 'C++ 基础篇',
  algorithm: 'C++ 算法篇',
  'data-structure': 'C++ 数据结构篇',
  gesp: 'GESP 考级 1~4 级',
  'graphical-basic': '图形化初级',
  'snap-basic': 'Snap 初级',
  'graphical-advanced': '图形化高级',
  'wedo-q1': 'Wedo（Q1）',
  'wedo-basic': 'Wedo 初级',
  'wedo-mid': 'Wedo 中级',
  'spike-basic': 'SPIKE 初级',
  'spike-mid': 'SPIKE 中级',
  'spike-advanced': 'SPIKE 高级',
  'csai-advanced': 'CS & AI 高级',
  other: '其他',
});

const DEFAULT_STYLES = Object.freeze({
  cpp: `【输出模板】
家长您好，以下是本次课堂内容分享：

上课时间：{日期}
✨上课主题：{主题}
🎯课程目标：
1、{目标1，≤15字，动词开头}
2、{目标2，≤15字，动词开头}

📌 课堂情况反馈
【课程知识点】：{≤50字，正式风格}
【课堂表现】：
· {学生名}{表现，以肯定和鼓励为主}

【风格规则】
1. 课程目标每条≤15字，动词开头（掌握/学会/熟练运用），共2条，覆盖本课核心。
2. 知识点用正式风格，模板「本节课重点训练……，为后续……建立操作基础」。
3. 课堂表现分点符号用「· 」，题号一律替换为题目名称，绝不出现数字题号。
4. 整体以鼓励表扬为主，多肯定态度、思路和进步；语气亲切专业。
5. 不要单独写「【后续建议】」段落。若课堂表现中有需要提升的点，在「【课堂表现】」对应条目里用温和、鼓励的方式带出即可，不写成说教或清单式建议。
6. 表现结尾按实际灵活收尾，不要每篇都用「继续保持 👏」。
7. 可以适量使用 emoji 点缀（如 👍 🌟 💪 ✨），但不要强加、不要堆砌，每条最多 1 个，全篇不超过 3 个；自然贴合语气再用。
8. 按用户给的素材写，不硬凑；素材不够时再自主补充。`,
  general: `【输出模板】
家长您好，以下是本次课堂内容分享：

上课时间：{日期}
✨上课主题：{主题}
🎯课程目标：
1、{目标1}
2、{目标2}

📌 课堂情况反馈
【课程知识点】：{根据本节课素材概括，不补写未提供的学习事实}
【课堂表现】：
· {学生的具体表现，以肯定和鼓励为主}

【风格规则】
1. 整体以鼓励表扬为主，语气亲切、具体、客观；缺少事实时不要编造。
2. 不要单独写「【后续建议】」段落。若课堂表现中有需要提升的点，在「【课堂表现】」对应条目里用温和、鼓励的方式带出即可。
3. 可以适量使用 emoji 点缀，但不要强加、不要堆砌，全篇不超过 3 个。`,
});

function courseTypeOf(value) {
  return Object.hasOwn(COURSE_NAMES, value) ? value : 'cpp';
}

// 抓取东方博宜 OJ 题目名称（可选增强，失败时静默返回 null）
async function fetchProblemTitle(id) {
  try {
    const resp = await axios.get(`https://oj.czos.cn/p/${id}`, {
      timeout: 8000,
      responseType: 'text',
      responseEncoding: 'utf-8',
    });
    const html = resp.data || '';
    const m = html.match(/<title>([^<]*)<\/title>/i);
    if (!m) return null;
    let title = m[1].trim();
    title = title.replace(/[-–—]\s*东方博宜\s*OJ\s*$/i, '').trim();
    title = title.replace(new RegExp(`^${id}\\s*[-–—]\\s*`), '').trim();
    return title || null;
  } catch {
    return null;
  }
}

// 健康检查
router.get('/health', (req, res) => {
  res.json({ ok: true, service: 'class-feedback' });
});

// 读取默认风格（前端本地保存的风格优先，这里只提供系统默认文案）
router.get('/style', (req, res) => {
  const courseType = courseTypeOf(req.query.course_type);
  res.json({
    defaultStyle: courseType === 'cpp' ? DEFAULT_STYLES.cpp : DEFAULT_STYLES.general,
  });
});

// 单独查询题目名称
router.get('/problem-title', async (req, res) => {
  const id = String(req.query.id || '').trim();
  if (!/^[A-Za-z0-9_-]{1,20}$/.test(id)) {
    return res.status(400).json({ error: '题号格式不正确' });
  }
  const title = await fetchProblemTitle(id);
  res.json({ id, title });
});

// 生成课后反馈（SSE 流式）
router.post('/generate', async (req, res) => {
  const {
    course_type: requestedCourseType,
    cpp_track: cppTrack,
    lesson_name: lessonName,
    lesson_objectives: lessonObjectives,
    date,
    student_name: studentName,
    topic,
    problemIds,
    performance,
    style,
  } = req.body || {};

  if (!topic || !performance) {
    return res.status(400).json({ error: '请填写上课主题和课堂表现' });
  }

  const courseType = courseTypeOf(requestedCourseType);
  const courseName = COURSE_NAMES[courseType];
  const trackLabel = TRACK_NAMES[cppTrack] || '';
  const cleanObjectives = String(lessonObjectives || '').replace(/\s+/g, ' ').trim();
  const cleanLessonName = String(lessonName || '').trim();

  const ids = (courseType === 'cpp' ? String(problemIds || '') : '')
    .split(/[,，、\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const titleMap = {};
  await Promise.all(
    ids.map(async (id) => {
      const t = await fetchProblemTitle(id);
      if (t) titleMap[id] = t;
    })
  );
  const titleList = ids.length
    ? ids
        .map((id) =>
          titleMap[id]
            ? `题号 ${id} 对应题目名称《${titleMap[id]}》`
            : `题号 ${id}（未获取到题目名称，正文中请用「第 ${id} 题」之类的说法代替，不要直接写数字题号）`
        )
        .join('\n')
    : '（本次未提供题号）';

  const styleRules =
    (style && String(style).trim()) ||
    (courseType === 'cpp' ? DEFAULT_STYLES.cpp : DEFAULT_STYLES.general);

  const sampleTopic = {
    cpp: 'GESP 二级 · 最大公约数与最小公倍数',
    robotics: '机器人 · 传感器与循线',
    graphical: '图形化编程 · 角色运动与条件判断',
    python: 'Python · 列表与循环',
  }[courseType];
  const samplePerformance =
    courseType === 'cpp'
      ? '· 子希在《最大公约数》一题中思路清晰，能独立写出辗转相除循环，基础很扎实 👍\n· 在《最小公倍数》一题中能套用公式 a*b/gcd 求解，慢慢上道了；如果写完再跑一遍样例验证边界，会更稳妥。'
      : '· 子希能根据课堂要求完成动手练习，遇到困难时愿意尝试调整，逐渐形成了检查结果的习惯 🌟';

  const prompt = `你是一位经验丰富的${courseName}课程老师，现在要为家长写一段课堂反馈（课评）。只能依据本次提供的课程和课堂素材，不要混入其他学科的术语。

本次课堂信息：
- 课程类别：${courseName}${trackLabel ? `｜方向：${trackLabel}` : ''}
- 上课时间：${date || '今天'}
- 上课主题：${topic}${cleanLessonName ? `（对应课程：${cleanLessonName}）` : ''}
- 题号与题目名称对照：
${titleList}
- 学生：${studentName || '未指定'}
- 本课官方课程目标（必须据此撰写「🎯课程目标」）：
${cleanObjectives || '（未提供官方目标，请根据上课主题合理概括 2 条）'}
- 教师补充的课堂表现素材：
${performance}

【课程目标写法要求】
1. 「🎯课程目标」必须基于上方官方课程目标提炼，不要另起炉灶编造。
2. 按输出格式压缩成 2 条，每条 ≤15 字、动词开头；若官方目标超过 2 条，合并同类项，保留最核心的两点。
3. 若官方目标不足 2 条，可从课堂主题合理补全第 2 条，但不得与官方目标矛盾。
4. 用「掌握 / 学会 / 熟练运用 / 理解」等动词，口吻面向家长，避免生硬罗列教材原文。

请只根据教师提供的素材撰写课堂表现；如果某些信息没有提供，不要编造学生表现或学习事实。

请严格遵守以下课评风格规则：
${styleRules}

【输出格式硬性要求】（必须逐条遵守，格式错误视为不合格）：
1. 每个字段单独成行；字段名后用全角冒号「：」，冒号后直接接内容，不要把多个字段挤在同一行。
2. 「上课时间：」「✨上课主题：」「🎯课程目标：」「📌 课堂情况反馈」各占独立一行。
3. 「✨上课主题：」后面只能写教师提供的上课主题本身（如「餐厅新秀」）。绝对不要在主题前加课程类别、课程阶段、方向或「·」分段（禁止出现「机器人 ·」「CS & AI 高级 ·」「C++ ·」这类前缀）。
4. 课程目标用「1、」「2、」编号（数字后是顿号「、」，不是英文点号），每条单独成行。
5. 段落之间用空行分隔：开头问候语、上课时间/主题/目标、课堂情况反馈 三大块之间各空一行。
6. 只保留「【课程知识点】：」「【课堂表现】：」两个小标题，各占独立一行，使用全角冒号「：」。绝不要输出「【后续建议】」。
7. 课堂表现的每一条以「· 」（间隔号 + 空格）开头，单独成行；以肯定鼓励为主，需要提升的点温和地写在表现条目里。
8. 正文中绝不出现数字题号，必须用上面给出的题目名称替换。
9. 只输出课评正文本身，不要任何解释、前言或 markdown 代码块包裹。

【参考范例】（请严格模仿它的换行与标点，不要照抄内容）：
家长您好，以下是本次课堂内容分享：

上课时间：7月21日
✨上课主题：${sampleTopic}
🎯课程目标：
1、理解本课的核心知识
2、完成对应的课堂练习

📌 课堂情况反馈
【课程知识点】：本节课围绕课堂主题学习相关知识与操作方法，具体内容以教师提供的素材为准。
【课堂表现】：
${samplePerformance}

现在请严格按上述格式输出本次课评正文。注意：「✨上课主题：」只写主题短名本身，不要加课程类别或阶段前缀；「🎯课程目标」两条必须来自上方官方课程目标的压缩提炼；不要输出「【后续建议】」；整体以鼓励为主，emoji 适量即可。`;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  try {
    const response = await chatStream(
      [
        {
          role: 'system',
          content:
            '你是一位温和、专业、善于鼓励的少儿编程老师，面向家长写课堂反馈。你必须严格遵守用户给出的输出格式：每个字段单独成行、使用全角冒号、课程目标用「1、」「2、」编号、段落之间空行分隔。',
        },
        { role: 'user', content: prompt },
      ],
      { temperature: 0.7, max_tokens: 1200 }
    );
    relaySSE(response.data, res);
  } catch (err) {
    const message =
      err.code === 'AI_NOT_CONFIGURED'
        ? '服务器未配置 AI API Key，请在 .env 中设置 DEEPSEEK_API_KEY 或 AI_API_KEY'
        : 'AI 服务暂时不可用';
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    res.end();
  }
});

module.exports = router;
module.exports.DEFAULT_STYLES = DEFAULT_STYLES;
module.exports.COURSE_NAMES = COURSE_NAMES;
