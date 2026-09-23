/** 课堂表现维度与文案（取自离线 Python 反馈模板） */
export const PYTHON_DIMENSIONS = [
  {
    id: 'attention',
    name: '专注与投入',
    options: ['未记录', '主动投入，持续专注', '大部分时间认真参与', '提醒后能回到任务', '需要分段任务与陪伴'],
    text: [
      null,
      '上课时很投入，能认真观察示范，一步步跟进任务。',
      '大部分时间都能认真参与，愿意跟着步骤动手试一试。',
      '偶尔需要提醒来收回注意力，提醒后能重新投入任务，这份愿意继续尝试的态度很值得鼓励。',
      '在保持专注和持续操作上还需要一些陪伴，我们可以把任务拆小一点，一步一步来，不着急。',
    ],
  },
  {
    id: 'understanding',
    name: '知识理解',
    options: ['未记录', '能解释，并举例运用', '基本理解，能跟随运用', '借助例子逐步理解', '需要更多直观演示'],
    text: [
      null,
      '学习{topic}时，能用自己的话说清楚，还会结合例子来运用，真不错！',
      '对{topic}已经有了基本理解，能跟着例子尝试运用，再多练习几次会更熟悉。',
      '正在借助例子和提示慢慢理解{topic}，愿意停下来想一想、再试一次，很可贵。',
      '理解{topic}时还需要更多直观的演示，我们会从小例子开始，陪着孩子慢慢把思路理清。',
    ],
  },
  {
    id: 'practice',
    name: '任务完成',
    options: ['未记录', '独立完成主要任务', '少量提示后完成', '陪伴下完成关键步骤', '已尝试，任务尚未完成'],
    text: [
      null,
      '进行{focus}时，能独立完成主要环节，把想法一步步变成自己的成果，值得为这份努力点个赞！',
      '进行{focus}时，经过一点提示就能完成主要环节，正在积累自己解决问题的经验。',
      '进行{focus}时，能在陪伴下完成关键步骤；接下来可以先试着独立完成其中一个小环节。',
      '已经动手尝试了{focus}，虽然还没有完成全部环节，但已经有了一个起点，我们会从走通的步骤继续往前。',
    ],
  },
  {
    id: 'debug',
    name: '检查与调整',
    options: ['未记录', '主动检查，独立调整', '提示后能定位与修改', '愿意尝试，需要示范', '遇到困难时需要鼓励'],
    text: [
      null,
      '遇到结果不符合预期的情况，能主动检查并尝试调整，已经有了先观察、再验证的好习惯。',
      '在提示下能找一找问题出在哪里，修改后再看看结果，每一次尝试都在积累经验。',
      '愿意动手检查和调整，具体方法还需要示范，我们可以一起练习“一次改一点，再看看变化”。',
      '遇到困难时还需要一些鼓励和陪伴，先把卡住的地方说出来，再一起试一个小步骤就好。',
    ],
  },
  {
    id: 'expression',
    name: '表达与交流',
    options: ['未记录', '主动表达，认真倾听', '邀请后愿意分享', '表达较简短，逐渐尝试', '本次以观察倾听为主'],
    text: [
      null,
      '交流时愿意主动分享自己的想法，也能认真听别人说，讨论中有了更多发现。',
      '在邀请下愿意开口分享，尝试把自己的做法说给大家听，这样的小尝试值得肯定。',
      '表达还比较简短，但已经愿意试着说出自己的想法，我们可以从“我发现了什么”慢慢说起。',
      '更多是在观察和倾听，下一次可以试着分享一个小发现，慢慢找到自己表达的节奏。',
    ],
  },
  {
    id: 'transfer',
    name: '探索与迁移',
    options: ['未记录', '主动尝试新方案', '能替换条件继续尝试', '跟随示例完成体验', '暂未开展拓展'],
    text: [
      null,
      '还主动尝试了新的方案，这份好奇心很棒，期待看到更多有趣的想法！',
      '能在提示下换一个条件、改一改做法继续尝试，正在学着把知识用到新的情境里。',
      '目前主要跟着示例体验，先把方法熟悉起来，再尝试一个小变化就很好。',
      '暂时没有开展额外拓展，可以等核心步骤熟悉后再慢慢尝试。',
    ],
  },
];

export const PYTHON_STRENGTHS = [
  ['ask', '主动提问', '愿意主动提出自己的疑问'],
  ['persist', '耐心尝试', '愿意耐心多试一次、再想一想'],
  ['share', '分享发现', '愿意和大家分享自己的发现'],
  ['help', '帮助伙伴', '愿意帮助身边的小伙伴'],
];

export function examLinesOf(courseId, curriculum) {
  const map = (curriculum.examMap || {})[courseId] || {};
  const matches = map.matches || [];
  const exams = Object.fromEntries((curriculum.exams || []).map((x) => [x.id, x]));
  const groups = new Map();
  for (const m of matches) {
    const r = exams[m.id];
    if (!r) continue;
    const level = parseInt(r.grade, 10);
    const label = { 1: '一级', 2: '二级', 3: '三级' }[level] || r.grade;
    const key = `${r.name} ${label}`;
    if (!groups.has(key)) groups.set(key, new Set());
    groups.get(key).add(String(m.topic || r.meaning || '').replace(/[。；;]+$/, ''));
  }
  return Array.from(groups, ([name, topics]) => `• ${name}：${Array.from(topics).join('；')}。`);
}

export function standardLinesOf(courseId, curriculum) {
  const map = (curriculum.standardMap || {})[courseId] || {};
  const matches = map.matches || [];
  const standards = Object.fromEntries((curriculum.standards || []).map((x) => [x.id, x]));
  return matches
    .map((m) => {
      const r = standards[m.id];
      if (!r) return '';
      return `• ${r.name}${r.grade ? ' · ' + r.grade : ''}${r.code ? ' · ' + r.code : ''}：${String(m.topic || r.meaning || '').replace(/[。；;]+$/, '')}。`;
    })
    .filter(Boolean);
}

export function buildPerformanceMaterial({ student, behaviors, strengths, detail, topics, focus }) {
  const name = String(student || '').trim() || '孩子';
  const topic = Array.isArray(topics) && topics.length ? topics.slice(0, 2).join('、') : '本节课的核心知识';
  const focusText = focus || topic;
  const parts = [];
  for (const d of PYTHON_DIMENSIONS) {
    const n = Number(behaviors?.[d.id] || 0);
    if (n && d.text[n]) {
      parts.push(String(d.text[n]).replaceAll('{topic}', topic).replaceAll('{focus}', focusText));
    }
  }
  const selected = PYTHON_STRENGTHS.filter((s) => strengths?.includes(s[0]));
  if (selected.length) {
    parts.push(`${parts.length ? '还有一些小行动特别值得点赞：' : ''}${selected.map((x) => x[2]).join('，')}。`);
  }
  const detailText = String(detail || '').trim().replace(/\s+/g, ' ');
  if (!parts.length && !detailText) return '';
  let paragraph = parts.length ? `今天，${name}${parts.join('')}` : '';
  if (detailText) {
    paragraph += (paragraph ? '今天课堂上还有这样一个小片段：' : '今天想和您分享一个课堂小片段：') + (/[。！？!?]$/.test(detailText) ? detailText : detailText + '。');
  }
  paragraph += `让我们多给${name}一点鼓励，带着好奇心，慢慢积累属于自己的小进步！`;
  return paragraph;
}
