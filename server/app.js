require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const feedbackRouter = require('./routes/feedback');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use('/api/feedback', feedbackRouter);
app.get('/api/health', (req, res) => res.json({ ok: true }));

// 生产环境：托管前端构建产物，单进程即可对外服务
const webDist = path.join(__dirname, '..', 'web', 'dist');
app.use(express.static(webDist));
app.get(/^(?!\/api\/).*/, (req, res) => {
  res.sendFile(path.join(webDist, 'index.html'), (err) => {
    if (err) {
      res.status(404).send('前端尚未构建，请先在 web/ 目录执行 npm run build');
    }
  });
});

app.listen(PORT, () => {
  console.log(`[class-feedback] API listening on http://localhost:${PORT}`);
  if (!process.env.DEEPSEEK_API_KEY && !process.env.AI_API_KEY) {
    console.warn('[class-feedback] 警告：未配置 DEEPSEEK_API_KEY / AI_API_KEY，AI 生成将不可用');
  }
});
