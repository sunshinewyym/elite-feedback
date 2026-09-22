# 课后反馈独立系统

一套可独立部署的课后反馈生成工具。老师打开网页即可使用，无需注册或登录。选择 C++ / 机器人 / 图形化编程 / Python 课程，填写学生、日期、主题和课堂表现，一键生成可编辑、可复制的家长课评。

AI 密钥只保存在服务器环境变量中，前端通过后端 API 调用生成，不会暴露给浏览器。

## 功能

- 四种课程类别：C++、机器人、图形化编程、Python
- C++ 选阶段（基础篇 / 算法篇 / 数据结构篇 / GESP 考级 / 其他）后，可再选课程主题；选中后自动展示学习目标，并压缩写入课评「🎯课程目标」。主题只取短名（如「并查集应用--最小生成树」）；选「其他」时手动填写主题
- 可选学生姓名、上课日期（日历）、上课主题、课堂表现
- C++ 可填题号，自动抓取题目名称写入课评（失败时用「第 N 题」代替）
- AI 流式生成课评，生成后可直接编辑、一键复制
- 支持点击/拖拽上传课堂图片（最多 9 张），一键导出图文并茂的课评 PNG 卡片
- 课评风格规则按课程分别保存在本机浏览器（localStorage）
- 完全公开访问，无账号体系

## 目录结构

```
├── server/                 # Express 后端
│   ├── app.js              # 入口，生产环境同时托管前端 dist
│   ├── routes/feedback.js  # 生成 / 风格 / 题目名称接口
│   ├── services/ai.js      # AI 流式调用与 SSE 转发
│   ├── package.json
│   └── .env.example
└── web/                    # Vue 3 + Vite 前端
    └── src/
        ├── App.vue
        ├── components/ClassFeedback.vue
        ├── data/cppCourses.js   # 英荔 C++ 四方向课程目录
        └── utils/stream.js
```

## 环境要求

- Node.js 20+（推荐 24）
- 一个 OpenAI 兼容的 AI 服务（默认 DeepSeek）

## 快速开始

### 1. 配置后端

```powershell
cd server
copy .env.example .env
# 编辑 .env，填入你的 AI API Key
npm install
```

`.env` 至少配置：

```dotenv
PORT=3000
DEEPSEEK_API_KEY=sk-你的密钥
```

也可使用任意 OpenAI 兼容接口：

```dotenv
AI_BASE_URL=https://api.deepseek.com
AI_MODEL=deepseek-chat
AI_API_KEY=sk-你的密钥
```

### 2. 构建前端

```powershell
cd ../web
npm install
npm run build
```

### 3. 启动服务

```powershell
cd ../server
npm start
```

浏览器打开 `http://localhost:3000` 即可使用。后端会自动托管 `web/dist` 静态文件。

### 开发模式（热更新）

两个终端分别执行：

```powershell
# 终端 1：后端
cd server
npm run dev

# 终端 2：前端（自动代理 /api 到 3000）
cd web
npm run dev
```

然后打开 `http://localhost:5173`。

## API

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 健康检查 |
| GET | `/api/feedback/health` | 反馈服务健康检查 |
| GET | `/api/feedback/style?course_type=cpp` | 读取系统默认风格文案 |
| GET | `/api/feedback/problem-title?id=1106` | 查询题目名称 |
| POST | `/api/feedback/generate` | 生成课评（SSE 流式） |

### POST /api/feedback/generate

请求体：

```json
{
  "course_type": "cpp",
  "cpp_track": "basic",
  "lesson_name": "C++ 变量的使用",
  "lesson_objectives": "1. 了解什么是变量；2. 学习 C++ 变量的定义和使用。",
  "date": "9月22日",
  "student_name": "子希",
  "topic": "C++ 变量的使用",
  "problemIds": "1106,1111",
  "performance": "思路清晰，能独立完成练习",
  "style": "（可选，自定义风格规则）"
}
```

响应为 SSE 流：

```
data: {"content":"家长您好"}

data: {"content":"，以下是本次课堂内容分享："}

data: [DONE]
```

## 部署到服务器

### 方式一：直接运行

1. 在服务器安装 Node.js 20+
2. 上传本项目（不含 `node_modules`、`.env`、`web/dist` 可后构建）
3. 按「快速开始」配置 `.env`、安装依赖、构建前端
4. 用 pm2 / systemd 守护 `node app.js`
5. Nginx 反向代理到 `localhost:3000`（可选 HTTPS）

Nginx 示例：

```nginx
server {
    listen 443 ssl;
    server_name feedback.example.com;

    # ssl_certificate ...;
    # ssl_certificate_key ...;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
        chunked_transfer_encoding off;
    }
}
```

> SSE 流式生成需要关闭 `proxy_buffering`，否则内容会攒满缓冲区才返回。

### 方式二：Docker

```powershell
# 先在 server/.env 配置好 API Key
docker compose up -d --build
```

默认映射 `3000` 端口。数据无状态（风格存在浏览器本地），无需挂载卷。

## 安全说明

- AI API Key 只放在服务器 `.env`，不要写入前端代码或提交到仓库
- 系统完全公开，请部署在可信网络或加上 Nginx Basic Auth / IP 白名单
- 课评内容会发给 AI 服务商，请遵守当地隐私与数据合规要求

## 与原增量包的差异

| 项目 | 原增量包 | 本独立系统 |
|---|---|---|
| 运行方式 | 依附 C++ AI 教学系统 | 单独部署，单进程 |
| 访问控制 | 管理员发放专属链接 + JWT | 完全公开 |
| 学生数据 | 数据库，按老师隔离 | 可选姓名输入框，不入库 |
| 历史课评 / 阶段分析 | 有 | 已移除 |
| C++ 当天做题摘要 | 有（依赖原系统） | 已移除 |
| 课评风格 | 服务端按老师×课程 | 浏览器 localStorage 按课程 |
| AI 调用 | 后端代理 | 后端代理（相同） |
