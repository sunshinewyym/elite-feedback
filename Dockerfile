# 构建前端
FROM node:24-alpine AS web-build
WORKDIR /app/web
COPY web/package.json ./
RUN npm install
COPY web/ ./
RUN npm run build

# 运行后端（含前端静态文件）
FROM node:24-alpine
WORKDIR /app
COPY server/package.json ./server/package.json
RUN cd server && npm install --omit=dev
COPY server/ ./server/
COPY --from=web-build /app/web/dist ./web/dist
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server/app.js"]
