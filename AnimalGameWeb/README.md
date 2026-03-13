## AnimalGameWeb 项目说明

本目录下是基于你设计的动物棋规则实现的 **前后端分离 Web 系统**：

- `backend`：Java + Spring Boot，负责对局管理和完整游戏规则逻辑。
- `frontend`：静态 Web 页面（HTML + 原生 JS），负责渲染棋盘和处理用户操作，通过 HTTP 调用后端接口。

---

## 后端服务启动方式（Spring Boot）

1. 打开终端，进入后端目录：

```bash
cd AnimalGameWeb/backend
```

2. 使用 Gradle 启动 Spring Boot 应用（第一次运行会自动下载依赖）：

```bash
./gradlew bootRun
```

3. 启动成功后，后端服务运行在：

```text
http://localhost:8080
```

主要接口（供前端调用）：

- `POST /api/games`：新建一盘对局，返回 `gameId` 和初始 `GameState`
- `GET /api/games/{id}`：获取当前对局状态
- `POST /api/games/{id}/flip`：随机翻一张未翻面的棋子
- `POST /api/games/{id}/move`：提交一步走子（由后端判定是否合法并更新状态）

---

## 前端页面启动方式（静态页面）

1. 打开另一个终端，进入前端目录：

```bash
cd AnimalGameWeb/frontend
```

2. 使用任意静态文件服务器启动前端（示例：使用 Python 自带的简单 HTTP 服务）：

```bash
python3 -m http.server 3000
```

3. 在浏览器中访问：

```text
http://localhost:3000/index.html
```

确保后端服务已在 `http://localhost:8080` 运行，此时你可以在页面上：

- 点击“新建对局”创建一盘新棋，并看到随机布局的 7×8 棋盘；
- 点击“随机翻牌”让后端随机翻开一个未翻面的棋子；
- 点击棋盘格：先选中当前阵营已翻开的棋子，再点目标格，前端会把走子请求发送给后端，由后端根据游戏规则处理并返回最新棋盘状态。

