<template>
  <div class="feedback-page">
    <div class="fb-shell">
      <header class="fb-head">
        <h2>📝 课后反馈</h2>
        <button class="style-toggle" @click="showStyle = !showStyle">
          {{ showStyle ? '▲ 收起风格设置' : '⚙️ 课评风格设置' }}
        </button>
      </header>

      <div class="fb-layout">
        <!-- 左栏：表单 -->
        <div class="fb-left">
          <div v-if="showStyle" class="style-panel">
            <p class="style-hint">风格规则保存在当前浏览器，仅对自己生效；留空则使用系统默认规则。</p>
            <textarea v-model="styleText" rows="16" placeholder="课评风格规则（留空使用默认）"></textarea>
            <div class="style-actions">
              <button class="btn-save" @click="saveStyle">保存风格</button>
              <button class="btn-reset" @click="resetStyle">恢复默认</button>
              <span v-if="styleMsg" class="style-msg">{{ styleMsg }}</span>
            </div>
          </div>

          <div class="fb-form">
        <div class="form-row">
          <label>课程类别</label>
          <div class="course-type-row" role="tablist" aria-label="课程类别">
            <button
              v-for="c in COURSE_OPTIONS"
              :key="c.id"
              type="button"
              class="course-type-btn"
              :class="{ active: courseType === c.id }"
              @click="courseType = c.id"
            >
              {{ c.label }}
            </button>
          </div>
        </div>

        <div v-if="showTrackPicker" class="form-row">
          <label>{{ trackPickerLabel }}</label>
          <div class="course-type-row" role="tablist" aria-label="课程阶段">
            <button
              v-for="t in stageTracks"
              :key="t.id"
              type="button"
              class="course-type-btn"
              :class="{ active: cppTrack === t.id }"
              @click="cppTrack = t.id"
            >
              {{ t.label }}
            </button>
            <button
              type="button"
              class="course-type-btn"
              :class="{ active: cppTrack === 'other' }"
              @click="cppTrack = 'other'"
            >
              其他
            </button>
          </div>
        </div>

        <div v-if="showTrackPicker && cppTrack && cppTrack !== 'other'" class="form-row">
          <label for="cpp-lesson-search">选择课程主题</label>
          <div ref="lessonPickerRef" class="lesson-picker">
            <input
              id="cpp-lesson-search"
              v-model="lessonQuery"
              class="lesson-search"
              type="text"
              autocomplete="off"
              :placeholder="selectedLesson ? `${selectedLesson.index}. ${shortTopicName(selectedLesson.name)}` : '输入关键词搜索'"
              @focus="openLessonPicker"
              @input="onLessonQueryInput"
            />
            <div v-if="lessonPickerOpen" class="lesson-options">
              <p v-if="!filteredLessons.length" class="lesson-options-empty">没有匹配的课程</p>
              <button
                v-for="les in filteredLessons"
                :key="les.index"
                type="button"
                class="lesson-option"
                :class="{ active: selectedLesson && selectedLesson.index === les.index }"
                @mousedown.prevent="pickLesson(les)"
              >
                <span class="lesson-option-title">{{ les.index }}. {{ shortTopicName(les.name) }}</span>
                <span
                  v-if="les.name && les.name !== shortTopicName(les.name)"
                  class="lesson-option-name"
                >{{ les.name }}</span>
              </button>
            </div>
          </div>
          <p v-if="selectedLesson" class="track-hint">已选：{{ selectedLesson.index }}. {{ shortTopicName(selectedLesson.name) }}</p>
        </div>

        <section v-if="selectedLesson" class="lesson-objectives">
          <div class="lesson-objectives-head">
            <strong>课程目标</strong>
            <span class="lesson-objectives-name">{{ selectedLesson.name }}</span>
          </div>
          <pre class="lesson-objectives-body">{{ formatObjectives(selectedLesson.objectives) }}</pre>
          <p class="lesson-objectives-hint">生成课评时会把这些目标写入「🎯课程目标」，并按课评格式压缩措辞。</p>
        </section>

        <div class="form-row">
          <label>上课日期</label>
          <div class="date-picker">
            <button type="button" class="date-display" @click="showCalendar = !showCalendar">
              📅 {{ dateDisplay }}
              <span class="caret-icon">{{ showCalendar ? '▲' : '▼' }}</span>
            </button>
            <button type="button" class="today-btn" @click="gotoToday">回到今天</button>
          </div>
          <div v-if="showCalendar" class="calendar">
            <div class="cal-head">
              <button type="button" class="cal-nav" @click="prevMonth">‹</button>
              <span class="cal-title">{{ viewYear }}年{{ viewMonth }}月</span>
              <button type="button" class="cal-nav" @click="nextMonth">›</button>
            </div>
            <div class="cal-week">
              <span v-for="w in weekdays" :key="w" class="cal-weekday">{{ w }}</span>
            </div>
            <div class="cal-grid">
              <span
                v-for="(c, i) in calendarCells"
                :key="i"
                class="cal-cell"
                :class="{ blank: !c, today: c && isToday(c), selected: c && isSelected(c) }"
                @click="c && pickDay(c)"
              >{{ c || '' }}</span>
            </div>
          </div>
        </div>

        <div class="form-row">
          <label>上课主题</label>
          <input v-model="topic" :placeholder="topicPlaceholder" />
        </div>

        <div class="form-row">
          <label>学生姓名</label>
          <input v-model="studentName" placeholder="请填写学生姓名" />
        </div>

        <div v-if="courseType === 'cpp'" class="form-row">
          <label>题号 <span class="optional-tag">（可选）</span></label>
          <input v-model="problemIds" placeholder="没有题号可留空；多个用逗号分隔，例如：1106,1111,1129" />
        </div>

        <div class="form-row">
          <label>课堂表现</label>
          <textarea v-model="performance" rows="6" :placeholder="performancePlaceholder"></textarea>
        </div>

        <div class="form-row">
          <label>课堂图片 <span class="optional-tag">（可选，导出图文课评时用）</span></label>
          <div
            class="upload-zone"
            :class="{ dragging: isDragging }"
            @dragenter.prevent="isDragging = true"
            @dragover.prevent="isDragging = true"
            @dragleave.prevent="isDragging = false"
            @drop.prevent="onDrop"
            @click="fileInput?.click()"
          >
            <input
              ref="fileInput"
              type="file"
              accept="image/*"
              multiple
              hidden
              @change="onFileSelect"
            />
            <div class="upload-zone-body">
              <span class="upload-icon">🖼️</span>
              <p>点击选择，或拖拽图片到此处</p>
              <p class="upload-hint">支持多张，最多 9 张；导出图片时会排在课评下方</p>
            </div>
          </div>
          <div v-if="images.length" class="image-grid">
            <div v-for="(img, i) in images" :key="img.id" class="image-thumb">
              <img :src="img.dataUrl" :alt="img.name" />
              <button type="button" class="image-remove" title="移除" @click="removeImage(i)">×</button>
            </div>
          </div>
          <p v-if="imageMsg" class="image-msg">{{ imageMsg }}</p>
        </div>

        <button class="gen-btn" @click="generate" :disabled="generating || !canGenerate">
          {{ generating ? '生成中……' : '✨ 生成课后反馈' }}
        </button>
          </div>

          <p v-if="errorMsg" class="fb-error">{{ errorMsg }}</p>
        </div>

        <!-- 右栏：结果 -->
        <div class="fb-right">
          <div v-if="generating || result" class="fb-result">
            <div class="result-toolbar">
              <span class="result-status">{{ generating ? 'AI 正在生成……' : '已生成课评' }}</span>
              <span v-if="result && !generating" class="result-hint">可直接修改后再复制</span>
              <div class="toolbar-btns">
                <button v-if="result && !generating" class="copy-btn" @click="copyResult">
                  {{ copied ? '✓ 已复制' : '📋 复制' }}
                </button>
                <button
                  v-if="result && !generating"
                  class="export-btn"
                  :disabled="exporting"
                  @click="exportCard"
                >
                  {{ exporting ? '导出中……' : '🖼️ 导出图文课评' }}
                </button>
              </div>
            </div>
            <textarea
              v-model="result"
              class="result-editor"
              :readonly="generating"
              spellcheck="false"
              aria-label="课后反馈内容"
            ></textarea>
          </div>
          <div v-else class="result-empty">
            <div class="result-empty-icon">✨</div>
            <h3>课评将在这里显示</h3>
            <p>在左侧填写课程与课堂表现，点击「生成课后反馈」后，结果会实时出现在这里。</p>
          </div>
        </div>
      </div>

      <!-- 导出用图文卡片（离屏渲染） -->
      <div ref="exportCardEl" class="export-card" aria-hidden="true">
        <header class="export-card-head">
          <div class="export-card-title">📝 课后反馈</div>
          <div class="export-card-meta">
            <span>{{ courseLabel }}</span>
            <span v-if="topic">{{ topic }}</span>
          </div>
          <div class="export-card-sub">
            <span>{{ dateLabel }}</span>
            <span v-if="studentName">· {{ studentName }}</span>
          </div>
        </header>
        <article class="export-card-body">{{ result }}</article>
        <section v-if="images.length" class="export-card-gallery">
          <div class="export-gallery-title">📷 课堂记录</div>
          <div class="export-gallery-grid">
            <img v-for="img in images" :key="img.id" :src="img.dataUrl" :alt="img.name" />
          </div>
        </section>
        <footer class="export-card-foot">课后反馈 · 用心看见每一点成长</footer>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import html2canvas from 'html2canvas';
import { generateFeedback } from '../utils/stream.js';
import { CPP_TRACKS, lessonsOfTrack, shortTopicName } from '../data/cppCourses.js';
import { GRAPHICAL_TRACKS, graphicalLessonsOfTrack } from '../data/graphicalCourses.js';
import { ROBOTICS_TRACKS, roboticsLessonsOfTrack } from '../data/roboticsCourses.js';

const STYLE_STORAGE_PREFIX = 'class-feedback-style:';

const COURSE_NAMES = {
  l1: 'L1 课程',
  robotics: '机器人',
  graphical: '图形化',
  python: 'Python',
  cpp: 'C++',
};

const COURSE_OPTIONS = [
  { id: 'l1', label: 'L1 课程' },
  { id: 'robotics', label: '机器人' },
  { id: 'graphical', label: '图形化' },
  { id: 'python', label: 'Python' },
  { id: 'cpp', label: 'C++' },
];

const DEFAULT_STYLES = {
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
};

const courseType = ref('');
const cppTrack = ref('');
const lessonIndex = ref('');
const studentName = ref('');
const topic = ref('');
const problemIds = ref('');
const performance = ref('');
const result = ref('');
const generating = ref(false);
const errorMsg = ref('');
const copied = ref(false);

const showStyle = ref(false);
const styleText = ref('');
const styleMsg = ref('');

// 课堂图片
const MAX_IMAGES = 9;
const images = ref([]);
const isDragging = ref(false);
const fileInput = ref(null);
const imageMsg = ref('');
const exporting = ref(false);
const exportCardEl = ref(null);

const courseLabel = computed(() => {
  const base = COURSE_NAMES[courseType.value] || '课后反馈';
  if (showTrackPicker.value && currentTrack.value) {
    return `${base} · ${currentTrack.value.label}`;
  }
  return base;
});

const stageTracks = computed(() => {
  if (courseType.value === 'cpp') return CPP_TRACKS;
  if (courseType.value === 'graphical') return GRAPHICAL_TRACKS;
  if (courseType.value === 'robotics') return ROBOTICS_TRACKS;
  return [];
});
const showTrackPicker = computed(
  () => courseType.value === 'cpp' || courseType.value === 'graphical' || courseType.value === 'robotics'
);
const trackPickerLabel = computed(() => {
  if (courseType.value === 'cpp') return 'C++ 课程阶段';
  if (courseType.value === 'graphical') return '图形化课程阶段';
  if (courseType.value === 'robotics') return '机器人课程阶段';
  return '课程阶段';
});
const currentTrack = computed(() => stageTracks.value.find((t) => t.id === cppTrack.value) || null);
const trackLessons = computed(() => {
  if (!cppTrack.value || cppTrack.value === 'other') return [];
  if (courseType.value === 'cpp') return lessonsOfTrack(cppTrack.value);
  if (courseType.value === 'graphical') return graphicalLessonsOfTrack(cppTrack.value);
  if (courseType.value === 'robotics') return roboticsLessonsOfTrack(cppTrack.value);
  return [];
});
const selectedLesson = computed(() => {
  if (!cppTrack.value || cppTrack.value === 'other' || lessonIndex.value === '' || lessonIndex.value === null) return null;
  const idx = Number(lessonIndex.value);
  return trackLessons.value.find((les) => les.index === idx) || null;
});

// 课程主题搜索
const lessonQuery = ref('');
const lessonPickerOpen = ref(false);
const lessonPickerRef = ref(null);

const filteredLessons = computed(() => {
  const q = lessonQuery.value.trim().toLowerCase();
  if (!q) return trackLessons.value;
  return trackLessons.value.filter((les) => {
    const short = shortTopicName(les.name).toLowerCase();
    return (
      String(les.index).includes(q) ||
      short.includes(q) ||
      les.name.toLowerCase().includes(q) ||
      String(les.objectives || '').toLowerCase().includes(q) ||
      String(les.unit || '').toLowerCase().includes(q)
    );
  });
});

function openLessonPicker() {
  lessonPickerOpen.value = true;
}

function onLessonQueryInput() {
  lessonPickerOpen.value = true;
  if (selectedLesson.value && lessonQuery.value.trim() !== shortTopicName(selectedLesson.value.name)) {
    lessonIndex.value = '';
  }
}

function pickLesson(lesson) {
  lessonIndex.value = lesson.index;
  lessonQuery.value = shortTopicName(lesson.name);
  lessonPickerOpen.value = false;
}

function onDocClick(event) {
  if (!lessonPickerRef.value?.contains(event.target)) {
    lessonPickerOpen.value = false;
  }
}

onMounted(() => document.addEventListener('mousedown', onDocClick));
onUnmounted(() => document.removeEventListener('mousedown', onDocClick));

watch(cppTrack, () => {
  lessonIndex.value = '';
  lessonQuery.value = '';
  lessonPickerOpen.value = false;
});

watch(selectedLesson, (lesson) => {
  if (lesson) {
    topic.value = shortTopicName(lesson.name) || lesson.name;
    lessonQuery.value = shortTopicName(lesson.name);
  }
});

function formatObjectives(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('只支持图片文件'));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      reject(new Error(`${file.name} 超过 10MB`));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // 压缩到最长边 1600，避免导出图过大
        const maxSide = 1600;
        let { width, height } = img;
        if (Math.max(width, height) > maxSide) {
          const scale = maxSide / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: file.name,
          dataUrl: canvas.toDataURL('image/jpeg', 0.88),
        });
      };
      img.onerror = () => reject(new Error(`${file.name} 无法读取`));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error(`${file.name} 读取失败`));
    reader.readAsDataURL(file);
  });
}

async function addImageFiles(fileList) {
  imageMsg.value = '';
  const files = Array.from(fileList || []);
  if (!files.length) return;
  const room = MAX_IMAGES - images.value.length;
  if (room <= 0) {
    imageMsg.value = `最多 ${MAX_IMAGES} 张图片`;
    return;
  }
  const accepted = files.slice(0, room);
  if (files.length > room) {
    imageMsg.value = `最多 ${MAX_IMAGES} 张，已忽略多出的 ${files.length - room} 张`;
  }
  const loaded = await Promise.allSettled(accepted.map(loadImageFile));
  for (const item of loaded) {
    if (item.status === 'fulfilled') {
      images.value.push(item.value);
    } else {
      imageMsg.value = item.reason?.message || '部分图片添加失败';
    }
  }
}

function onFileSelect(event) {
  addImageFiles(event.target.files);
  event.target.value = '';
}

function onDrop(event) {
  isDragging.value = false;
  addImageFiles(event.dataTransfer?.files);
}

function removeImage(index) {
  images.value.splice(index, 1);
  imageMsg.value = '';
}

async function exportCard() {
  if (!result.value || exporting.value || !exportCardEl.value) return;
  exporting.value = true;
  try {
    await document.fonts?.ready;
    const node = exportCardEl.value;
    node.style.position = 'fixed';
    node.style.left = '0';
    node.style.top = '0';
    node.style.zIndex = '-1';
    node.style.opacity = '1';
    node.style.pointerEvents = 'none';
    node.style.width = '720px';

    const canvas = await html2canvas(node, {
      backgroundColor: '#f3f0ff',
      scale: 2,
      useCORS: true,
      logging: false,
      windowWidth: 720,
    });

    const nameBase = (topic.value || '课后反馈').replace(/[\\/:*?"<>|]/g, '_').slice(0, 40);
    const link = document.createElement('a');
    link.download = `${dateLabel.value || '课评'}-${nameBase}-图文课评.png`;
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('图片生成失败');
    link.href = URL.createObjectURL(blob);
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 0);
  } catch (error) {
    alert(error.message || '导出失败，请重试');
  } finally {
    const node = exportCardEl.value;
    if (node) {
      node.style.position = '';
      node.style.left = '';
      node.style.top = '';
      node.style.zIndex = '';
      node.style.opacity = '';
      node.style.width = '';
    }
    exporting.value = false;
  }
}

const topicPlaceholder = computed(
  () =>
    ({
      '': '请先选择课程类别',
      l1: '例如：认识顺序结构、趣味小项目',
      cpp: '例如：String 类、字符串应用',
      robotics: '例如：传感器与循线任务',
      graphical: '例如：角色运动与条件判断',
      python: '例如：列表与循环',
    })[courseType.value] || '请先选择课程类别'
);

const performancePlaceholder = computed(() =>
  courseType.value === 'cpp'
    ? '描述学生表现，例如：思路清晰、能独立完成练习、遇到困难时如何处理'
    : '描述课堂上实际观察到的操作、思考、合作及需要改进的地方'
);

const canGenerate = computed(
  () => Boolean(courseType.value && topic.value && performance.value && studentName.value.trim())
);

// 月视图日历
const showCalendar = ref(false);
const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
const initNow = new Date();
const viewYear = ref(initNow.getFullYear());
const viewMonth = ref(initNow.getMonth() + 1);
const selected = ref({
  year: initNow.getFullYear(),
  month: initNow.getMonth() + 1,
  day: initNow.getDate(),
});
const dateLabel = ref(`${initNow.getMonth() + 1}月${initNow.getDate()}日`);

const dateKey = computed(() => {
  const year = selected.value.year;
  const month = String(selected.value.month).padStart(2, '0');
  const day = String(selected.value.day).padStart(2, '0');
  return `${year}-${month}-${day}`;
});

const dateDisplay = computed(() => {
  const t = new Date();
  const isToday =
    selected.value.year === t.getFullYear() &&
    selected.value.month === t.getMonth() + 1 &&
    selected.value.day === t.getDate();
  return dateLabel.value + (isToday ? '（今天）' : '');
});

const calendarCells = computed(() => {
  const firstWeekday = new Date(viewYear.value, viewMonth.value - 1, 1).getDay();
  const daysInMonth = new Date(viewYear.value, viewMonth.value, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
});

function prevMonth() {
  if (viewMonth.value === 1) {
    viewMonth.value = 12;
    viewYear.value--;
  } else {
    viewMonth.value--;
  }
}

function nextMonth() {
  if (viewMonth.value === 12) {
    viewMonth.value = 1;
    viewYear.value++;
  } else {
    viewMonth.value++;
  }
}

function isToday(day) {
  const t = new Date();
  return (
    viewYear.value === t.getFullYear() &&
    viewMonth.value === t.getMonth() + 1 &&
    day === t.getDate()
  );
}

function isSelected(day) {
  return (
    selected.value.year === viewYear.value &&
    selected.value.month === viewMonth.value &&
    selected.value.day === day
  );
}

function pickDay(day) {
  selected.value = { year: viewYear.value, month: viewMonth.value, day };
  dateLabel.value = `${viewMonth.value}月${day}日`;
  showCalendar.value = false;
}

function gotoToday() {
  const t = new Date();
  viewYear.value = t.getFullYear();
  viewMonth.value = t.getMonth() + 1;
  selected.value = { year: t.getFullYear(), month: t.getMonth() + 1, day: t.getDate() };
  dateLabel.value = `${t.getMonth() + 1}月${t.getDate()}日`;
}

function defaultStyleFor(type) {
  return type === 'cpp' ? DEFAULT_STYLES.cpp : DEFAULT_STYLES.general;
}

function loadStyle() {
  try {
    const saved = localStorage.getItem(STYLE_STORAGE_PREFIX + courseType.value);
    styleText.value = saved || '';
  } catch {
    styleText.value = '';
  }
}

function saveStyle() {
  try {
    localStorage.setItem(STYLE_STORAGE_PREFIX + courseType.value, styleText.value);
    styleMsg.value = '已保存 ✓';
    setTimeout(() => (styleMsg.value = ''), 2500);
  } catch {
    styleMsg.value = '保存失败';
    setTimeout(() => (styleMsg.value = ''), 2500);
  }
}

function resetStyle() {
  styleText.value = defaultStyleFor(courseType.value);
  styleMsg.value = '已填入默认规则，记得点「保存风格」';
  setTimeout(() => (styleMsg.value = ''), 3000);
}

async function generate() {
  if (!canGenerate.value || generating.value) return;
  generating.value = true;
  result.value = '';
  errorMsg.value = '';
  copied.value = false;
  try {
    await generateFeedback(
      {
        course_type: courseType.value,
        cpp_track: cppTrack.value || '',
        lesson_name: selectedLesson.value?.name || '',
        lesson_objectives: selectedLesson.value?.objectives || '',
        date: dateDisplay.value,
        date_key: dateKey.value,
        student_name: studentName.value.trim(),
        topic: topic.value,
        problemIds: problemIds.value,
        performance: performance.value,
        style: styleText.value,
      },
      (chunk) => {
        result.value += chunk;
      },
      (err) => {
        errorMsg.value = err;
      }
    );
    if (!result.value && !errorMsg.value) {
      errorMsg.value = 'AI 没有返回内容，请重试';
    }
  } catch (e) {
    errorMsg.value = e.message || '生成失败，请确认后端已启动后重试';
  }
  generating.value = false;
}

async function copyResult() {
  try {
    await navigator.clipboard.writeText(result.value);
    copied.value = true;
    setTimeout(() => (copied.value = false), 2000);
  } catch {
    /* 忽略 */
  }
}

watch(courseType, () => {
  topic.value = '';
  performance.value = '';
  problemIds.value = '';
  result.value = '';
  cppTrack.value = '';
  lessonIndex.value = '';
  lessonQuery.value = '';
  loadStyle();
});

onMounted(loadStyle);
</script>

<style scoped>
.feedback-page {
  height: 100vh;
  overflow: hidden;
  padding: 16px 24px 20px;
  background: #f7f9fc;
  box-sizing: border-box;
}

.fb-shell {
  max-width: 1280px;
  height: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.fb-head {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 14px;
  flex-shrink: 0;
}

.fb-head h2 {
  margin: 0;
  color: #4f46e5;
  font-size: 22px;
}

.fb-layout {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(360px, 1fr) minmax(360px, 1fr);
  gap: 20px;
  align-items: stretch;
}

.fb-left {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 4px;
  box-sizing: border-box;
}

.fb-right {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: hidden;
}

.result-empty {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 32px;
  text-align: center;
  background: #fff;
  border: 1px dashed #c7d2fe;
  border-radius: 12px;
  color: #64748b;
}

.result-empty-icon {
  font-size: 36px;
}

.result-empty h3 {
  margin: 0;
  color: #4f46e5;
  font-size: 18px;
}

.result-empty p {
  margin: 0;
  max-width: 320px;
  font-size: 14px;
  line-height: 1.7;
}

@media (max-width: 960px) {
  .feedback-page {
    height: auto;
    overflow: auto;
  }

  .fb-shell {
    height: auto;
  }

  .fb-layout {
    grid-template-columns: 1fr;
  }

  .fb-left {
    overflow: visible;
  }

  .fb-right {
    overflow: visible;
  }

  .result-empty {
    min-height: 240px;
  }
}

.style-toggle {
  padding: 8px 14px;
  border: 1px solid #c7d2fe;
  border-radius: 6px;
  background: #fff;
  color: #4338ca;
  font-size: 13px;
  cursor: pointer;
}

.style-toggle:hover {
  background: #eef2ff;
}

.style-panel {
  padding: 16px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-left: 4px solid #f59e0b;
  border-radius: 10px;
}

.style-hint {
  margin: 0 0 10px;
  color: #9a3412;
  font-size: 13px;
}

.style-panel textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 13px;
  font-family: inherit;
  line-height: 1.6;
  resize: vertical;
}

.style-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
}

.btn-save {
  padding: 8px 18px;
  border: none;
  border-radius: 6px;
  background: linear-gradient(135deg, #4f46e5, #6366f1);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.btn-reset {
  padding: 8px 14px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  color: #64748b;
  font-size: 13px;
  cursor: pointer;
}

.btn-reset:hover {
  background: #f1f5f9;
}

.style-msg {
  color: #16a34a;
  font-size: 13px;
}

.fb-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-row label {
  font-size: 14px;
  font-weight: 600;
  color: #334155;
}

.optional-tag {
  font-size: 12px;
  font-weight: 400;
  color: #94a3b8;
}

.form-row input,
.form-row select,
.form-row textarea {
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
}

.form-row input:focus,
.form-row select:focus,
.form-row textarea:focus {
  outline: none;
  border-color: #4f46e5;
  box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.1);
}

.course-type-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.course-type-btn {
  flex: 1 1 100px;
  min-width: 96px;
  max-width: 100%;
  padding: 12px 14px;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  background: #fff;
  color: #334155;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  text-align: center;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}

.course-type-btn:hover {
  border-color: #60a5fa;
  color: #1d4ed8;
}

.course-type-btn.active {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  border-color: transparent;
  color: #fff;
}

@media (max-width: 720px) {
  .course-type-btn {
    flex: 1 1 calc(50% - 10px);
    min-width: calc(50% - 10px);
  }
}

.track-hint {
  margin: 0;
  color: #64748b;
  font-size: 12px;
  line-height: 1.5;
}

/* 可搜索课程主题 */
.lesson-picker {
  position: relative;
}

.lesson-search {
  width: 100%;
  box-sizing: border-box;
}

.lesson-options {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 4px);
  z-index: 20;
  max-height: 280px;
  overflow-y: auto;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.12);
  padding: 6px;
}

.lesson-options-empty {
  margin: 0;
  padding: 12px;
  text-align: center;
  color: #94a3b8;
  font-size: 13px;
}

.lesson-option {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.lesson-option:hover,
.lesson-option.active {
  background: #eef2ff;
}

.lesson-option-title {
  color: #1e293b;
  font-size: 14px;
  font-weight: 600;
}

.lesson-option-name {
  color: #94a3b8;
  font-size: 12px;
  line-height: 1.4;
  word-break: break-all;
}

.lesson-objectives {
  padding: 14px 16px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-left: 4px solid #16a34a;
  border-radius: 9px;
}

.lesson-objectives-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.lesson-objectives-head strong {
  color: #15803d;
  font-size: 14px;
}

.lesson-objectives-name {
  color: #166534;
  font-size: 13px;
  font-weight: 600;
}

.lesson-objectives-body {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.7;
  color: #14532d;
}

.lesson-objectives-hint {
  margin: 10px 0 0;
  color: #15803d;
  font-size: 12px;
  opacity: 0.85;
}

.gen-btn {
  align-self: flex-start;
  padding: 11px 26px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #4f46e5, #6366f1);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}

.gen-btn:hover:not(:disabled) {
  opacity: 0.85;
}

.gen-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 日历 */
.date-picker {
  display: flex;
  align-items: center;
  gap: 10px;
}

.date-display {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #fff;
  color: #1e293b;
  font-size: 14px;
  cursor: pointer;
}

.date-display:hover {
  border-color: #4f46e5;
}

.caret-icon {
  color: #94a3b8;
  font-size: 11px;
}

.today-btn {
  width: 110px;
  padding: 10px 0;
  border: 1px solid #c7d2fe;
  border-radius: 8px;
  background: #eef2ff;
  color: #4338ca;
  font-size: 13px;
  font-weight: 600;
  text-align: center;
  cursor: pointer;
  white-space: nowrap;
}

.today-btn:hover {
  background: #e0e7ff;
}

.calendar {
  margin-top: 8px;
  padding: 12px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  box-shadow: 0 8px 22px rgba(15, 23, 42, 0.08);
  max-width: 340px;
}

.cal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.cal-title {
  font-size: 15px;
  font-weight: 700;
  color: #334155;
}

.cal-nav {
  width: 30px;
  height: 30px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #fff;
  color: #475569;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}

.cal-nav:hover {
  background: #f1f5f9;
}

.cal-week {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  margin-bottom: 4px;
}

.cal-weekday {
  text-align: center;
  font-size: 12px;
  color: #94a3b8;
  padding: 4px 0;
}

.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.cal-cell {
  display: grid;
  place-items: center;
  height: 38px;
  border-radius: 7px;
  font-size: 14px;
  color: #334155;
  cursor: pointer;
  transition: background 0.12s;
}

.cal-cell:hover:not(.blank) {
  background: #eef2ff;
}

.cal-cell.blank {
  cursor: default;
}

.cal-cell.today {
  border: 1px solid #4f46e5;
  color: #4f46e5;
  font-weight: 700;
}

.cal-cell.selected {
  background: linear-gradient(135deg, #4f46e5, #6366f1);
  color: #fff;
  font-weight: 700;
}

.cal-cell.selected.today {
  border-color: transparent;
}

.fb-error {
  padding: 12px 14px;
  color: #b91c1c;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  font-size: 14px;
}

.fb-result {
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
  flex: 1;
  min-height: 0;
}

.result-toolbar {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  gap: 10px;
}

.result-status {
  color: #4f46e5;
  font-size: 14px;
  font-weight: 600;
}

.result-hint {
  margin-left: auto;
  color: #64748b;
  font-size: 12px;
}

.toolbar-btns {
  display: flex;
  gap: 8px;
}

.copy-btn {
  padding: 7px 14px;
  border: 1px solid #c7d2fe;
  border-radius: 6px;
  background: #fff;
  color: #4338ca;
  font-size: 13px;
  cursor: pointer;
}

.copy-btn:hover {
  background: #eef2ff;
}

.result-editor {
  display: block;
  flex: 1;
  width: 100%;
  min-height: 0;
  margin: 0;
  padding: 20px;
  border: 0;
  resize: none;
  outline: none;
  box-sizing: border-box;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  overflow-y: auto;
  font-family: inherit;
  font-size: 15px;
  line-height: 1.9;
  color: #1e293b;
}

.result-editor:focus {
  box-shadow: inset 0 0 0 2px rgba(79, 70, 229, 0.2);
}

.result-editor[readonly] {
  background: #f8fafc;
}

/* 课堂图片上传 */
.upload-zone {
  border: 2px dashed #c7d2fe;
  border-radius: 10px;
  background: #f8faff;
  padding: 18px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.upload-zone:hover,
.upload-zone.dragging {
  border-color: #4f46e5;
  background: #eef2ff;
}

.upload-zone-body {
  color: #64748b;
  font-size: 13px;
  line-height: 1.6;
}

.upload-icon {
  display: block;
  font-size: 28px;
  margin-bottom: 6px;
}

.upload-hint {
  margin-top: 4px;
  color: #94a3b8;
  font-size: 12px;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
  gap: 10px;
  margin-top: 10px;
}

.image-thumb {
  position: relative;
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  background: #f1f5f9;
}

.image-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.image-remove {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 50%;
  background: rgba(15, 23, 42, 0.65);
  color: #fff;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}

.image-msg {
  margin-top: 8px;
  color: #b45309;
  font-size: 12px;
}

.export-btn {
  padding: 7px 14px;
  border: 1px solid #c7d2fe;
  border-radius: 6px;
  background: #fff;
  color: #4338ca;
  font-size: 13px;
  cursor: pointer;
}

.export-btn:hover:not(:disabled) {
  background: #eef2ff;
}

.export-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 导出图文卡片（离屏） */
.export-card {
  width: 720px;
  box-sizing: border-box;
  background: linear-gradient(180deg, #eef2ff 0%, #f8fafc 180px);
  color: #1e293b;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  border-radius: 0;
  overflow: hidden;
  position: fixed;
  left: -10000px;
  top: 0;
  z-index: -1;
  opacity: 0;
  pointer-events: none;
}

.export-card-head {
  padding: 36px 40px 20px;
  border-bottom: 1px solid #e0e7ff;
}

.export-card-title {
  font-size: 28px;
  font-weight: 700;
  color: #4338ca;
  margin-bottom: 10px;
}

.export-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 14px;
  font-size: 16px;
  color: #3730a3;
  font-weight: 600;
}

.export-card-sub {
  margin-top: 8px;
  font-size: 14px;
  color: #64748b;
}

.export-card-body {
  padding: 28px 40px;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 16px;
  line-height: 1.9;
  color: #1e293b;
  background: #fff;
}

.export-card-gallery {
  padding: 8px 40px 28px;
  background: #fff;
}

.export-gallery-title {
  font-size: 16px;
  font-weight: 700;
  color: #4338ca;
  margin: 16px 0 12px;
}

.export-gallery-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.export-gallery-grid img {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  border-radius: 10px;
  display: block;
  background: #f1f5f9;
}

.export-card-foot {
  padding: 16px 40px 28px;
  text-align: center;
  font-size: 13px;
  color: #94a3b8;
  background: #fff;
}
</style>
