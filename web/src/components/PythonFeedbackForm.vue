<template>
  <div class="py-form">
    <section class="py-panel">
      <h3 class="py-section-title"><span class="py-step">01</span>选择本节课</h3>
      <div class="stage-pills" role="group" aria-label="课程阶段">
        <button
          v-for="s in stages"
          :key="s"
          type="button"
          :class="{ active: stage === s }"
          @click="setStage(s)"
        >
          {{ s }}
        </button>
      </div>
      <label class="py-field">
        <span>课程</span>
        <select v-model="lessonId" @change="emitChange">
          <option v-for="c in lessons" :key="c.id" :value="c.id">
            第 {{ c.number }} 课 · {{ c.title }}
          </option>
        </select>
      </label>
      <div class="py-row">
        <label class="py-field">
          <span>学生称呼</span>
          <input v-model="student" type="text" maxlength="40" placeholder="如：小宇（可留空）" @input="emitChange" />
        </label>
        <label class="py-field">
          <span>上课日期</span>
          <input v-model="date" type="date" @change="emitChange" />
        </label>
      </div>
      <div v-if="currentLesson" class="lesson-meta">
        <span class="tag">{{ currentLesson.age }} 岁</span>
        <span class="tag">{{ currentLesson.duration }} 分钟 / 课</span>
        <span class="tag">{{ lessons.length }} 节课程</span>
      </div>
      <div v-if="currentLesson" class="topic-list">
        <span v-for="t in currentLesson.topics.slice(0, 6)" :key="t">{{ t }}</span>
      </div>
    </section>

    <section class="py-panel">
      <h3 class="py-section-title"><span class="py-step">02</span>记录课堂表现</h3>
      <p class="py-helper">按实际观察选择；未记录的项目不会写入反馈。</p>
      <div class="presets">
        <button type="button" data-preset="independent" @click="applyPreset(1)">独立完成任务</button>
        <button type="button" data-preset="steady" @click="applyPreset(2)">提示后完成</button>
        <button type="button" data-preset="support" @click="applyPreset(3)">陪伴下完成</button>
        <button type="button" @click="clearBehavior">清空表现</button>
      </div>
      <div class="behavior">
        <label v-for="d in PYTHON_DIMENSIONS" :key="d.id" :for="'py-' + d.id">
          <span>{{ d.name }}</span>
          <select :id="'py-' + d.id" v-model="behaviors[d.id]" @change="emitChange">
            <option v-for="(opt, i) in d.options" :key="opt" :value="String(i)">{{ opt }}</option>
          </select>
        </label>
      </div>
      <div class="checks">
        <label v-for="s in PYTHON_STRENGTHS" :key="s[0]">
          <input v-model="strengths" type="checkbox" :value="s[0]" @change="emitChange" />
          {{ s[1] }}
        </label>
      </div>
      <div v-if="!hasObservation" class="empty-note">尚未选择课堂表现。选好后会自动生成具体描述。</div>
    </section>

    <section class="py-panel">
      <h3 class="py-section-title"><span class="py-step">03</span>补充课堂细节</h3>
      <label class="py-field">
        <span>今天的具体瞬间（选填）</span>
        <textarea v-model="detail" rows="3" placeholder="如：先画出 3 个步骤，再逐步完成程序；尝试两次后找到了缩进问题。" @input="emitChange"></textarea>
      </label>
      <label class="py-field">
        <span>下一步的小目标（选填）</span>
        <textarea v-model="nextGoal" rows="2" placeholder="如：下次先口头说出思路，再动手编写代码。" @input="emitChange"></textarea>
      </label>
      <div class="checks">
        <label><input v-model="useEmoji" type="checkbox" @change="emitChange" /> 添加表情符号</label>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { PYTHON_CURRICULUM } from '../data/pythonCourses.js';
import { PYTHON_DIMENSIONS, PYTHON_STRENGTHS, examLinesOf, standardLinesOf, buildPerformanceMaterial } from '../data/pythonLessonForm.js';

const stages = ['L5', 'L6', 'L7'];
const stage = ref('L5');
const lessonId = ref('');
const student = ref('');
const detail = ref('');
const nextGoal = ref('');
const useEmoji = ref(true);
const behaviors = reactive(Object.fromEntries(PYTHON_DIMENSIONS.map((d) => [d.id, '0'])));
const strengths = ref([]);

const today = new Date();
const date = ref(
  `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
);

const lessons = computed(() => PYTHON_CURRICULUM.courses.filter((c) => c.stage === stage.value));
const currentLesson = computed(() => lessons.value.find((c) => c.id === lessonId.value) || lessons.value[0] || null);

const hasObservation = computed(() => {
  const anyDim = PYTHON_DIMENSIONS.some((d) => Number(behaviors[d.id]) > 0);
  return anyDim || strengths.value.length > 0 || Boolean(detail.value.trim());
});

function setStage(s) {
  if (stage.value === s) return;
  stage.value = s;
  lessonId.value = lessons.value[0]?.id || '';
  emitChange();
}

function applyPreset(n) {
  behaviors.practice = String(n);
  emitChange();
}

function clearBehavior() {
  for (const d of PYTHON_DIMENSIONS) behaviors[d.id] = '0';
  strengths.value = [];
  emitChange();
}

function buildPayload() {
  const c = currentLesson.value;
  if (!c) return null;
  const behaviorLabels = PYTHON_DIMENSIONS.map((d) => {
    const n = Number(behaviors[d.id]) || 0;
    return n ? `${d.name}：${d.options[n]}` : '';
  }).filter(Boolean);
  const strengthLabels = PYTHON_STRENGTHS.filter((s) => strengths.value.includes(s[0])).map((s) => s[1]);
  const perf = buildPerformanceMaterial({
      student: student.value,
      behaviors,
      strengths: strengths.value,
      detail: detail.value,
      topics: c.topics,
      focus: c.focus,
    });
  return {
    course_type: 'python',
    template: 'python-lab',
    stage: c.stage,
    lesson_number: c.number,
    lesson_title: c.title,
    duration: c.duration,
    age: c.age,
    goals: c.goals,
    topics: c.topics,
    focus: c.focus,
    exam_lines: examLinesOf(c.id, PYTHON_CURRICULUM),
    standard_lines: standardLinesOf(c.id, PYTHON_CURRICULUM),
    student_name: student.value.trim(),
    date: date.value,
    date_key: date.value,
    topic: c.title,
    performance_material: perf,
    behavior_labels: behaviorLabels,
    strength_labels: strengthLabels,
    detail: detail.value.trim(),
    next_goal: nextGoal.value.trim(),
    use_emoji: useEmoji.value,
    performance: perf || '（未选择课堂表现）',
  };
}

const emit = defineEmits(['change']);
function emitChange() {
  emit('change', buildPayload());
}

watch(
  currentLesson,
  () => {
    emitChange();
  },
  { immediate: true }
);

defineExpose({ buildPayload });
</script>

<style scoped>
.py-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.py-panel {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 18px;
}

.py-section-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 14px;
  font-size: 16px;
  color: #142d4a;
}

.py-step {
  font-size: 12px;
  font-weight: 700;
  border-radius: 6px;
  background: #eaf1fa;
  color: #385879;
  padding: 3px 7px;
  letter-spacing: 1px;
}

.py-field {
  display: block;
  margin-bottom: 12px;
}

.py-field:last-child {
  margin-bottom: 0;
}

.py-field > span {
  display: block;
  font-size: 14px;
  font-weight: 650;
  margin-bottom: 6px;
  color: #213248;
}

.py-field select,
.py-field input,
.py-field textarea {
  width: 100%;
  box-sizing: border-box;
  background: #fff;
  border: 1px solid #cbd6e2;
  border-radius: 8px;
  padding: 10px 11px;
  color: #213248;
  font: inherit;
}

.py-field select {
  min-height: 45px;
}

.py-field textarea {
  resize: vertical;
  line-height: 1.7;
}

.py-row {
  display: flex;
  gap: 12px;
}

.py-row > * {
  min-width: 0;
  flex: 1;
}

.stage-pills {
  display: flex;
  gap: 9px;
  margin-bottom: 15px;
}

.stage-pills button {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid #dce4ed;
  border-radius: 9px;
  background: #fff;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.stage-pills button.active {
  background: #142d4a;
  color: #fff;
  border-color: #142d4a;
}

.lesson-meta {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 12px;
}

.tag {
  background: #eef4f8;
  border-radius: 5px;
  padding: 2px 8px;
  font-size: 13px;
  color: #425a70;
}

.topic-list {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 12px;
}

.topic-list span {
  font-size: 13px;
  border: 1px solid #d7e6e4;
  color: #23736e;
  background: #f4fbfa;
  padding: 2px 7px;
  border-radius: 5px;
}

.py-helper {
  font-size: 13px;
  color: #596b7e;
  margin: -4px 0 14px;
}

.presets {
  display: flex;
  gap: 7px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.presets button {
  font-size: 13px;
  padding: 6px 9px;
  border: 1px solid #dce4ed;
  border-radius: 9px;
  background: #fff;
  cursor: pointer;
}

.behavior {
  display: grid;
  gap: 11px;
}

.behavior label {
  display: grid;
  grid-template-columns: 94px minmax(0, 1fr);
  align-items: center;
  font-size: 14px;
  gap: 8px;
}

.behavior select {
  font-size: 14px;
  padding: 8px;
  min-height: 40px;
  border: 1px solid #cbd6e2;
  border-radius: 8px;
  background: #fff;
}

.checks {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 15px;
  margin-top: 14px;
  font-size: 14px;
}

.empty-note {
  margin-top: 14px;
  padding: 12px;
  border-radius: 8px;
  background: #fff7e8;
  color: #cc7022;
  font-size: 13px;
}
</style>
