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

2. （可选）人机对弈需配置 DeepSeek API Key：

```bash
export DEEPSEEK_API_KEY=sk-你的密钥
```

也可在 `backend/src/main/resources/application.properties` 中设置 `deepseek.api-key=`（勿把密钥提交进仓库）。未配置时人机模式仍可用启发式走子。

AI 推理日志开关（同文件）：

```properties
# 控制台打印完整 prompt / 原始回复 / 所选动作
deepseek.log-detail=true
# 要求模型返回 reason，并在接口与页面提示中展示
deepseek.show-reasoning=true
```

均为 `false` 时仅保留简要落子日志。改完需重启后端。

3. 使用 Maven 启动 Spring Boot 应用（第一次运行会自动下载依赖）：

```bash
./mvnw spring-boot:run
```

4. 启动成功后，后端服务运行在：

```text
http://localhost:8080
```

主要接口（供前端调用）：

- `POST /api/rooms/solo`：自己对弈
- `POST /api/rooms/vs-ai`：人机对弈（玩家 A，DeepSeek 执 B）
- `GET /api/games/{id}`：获取当前对局状态
- `POST /api/games/{id}/flip`：翻指定格未翻面棋子
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

- 输入用户名后点击「自己对弈」或「人机对弈」开局；
- 点击未翻开棋翻牌；先选中已翻开己方棋，再点相邻目标格走子/吃子；
- 「人机对弈」中你固定执 A，对手回合由后端调用 DeepSeek（失败则启发式）自动落子。

