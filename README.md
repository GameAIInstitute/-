# 图像相似度核查插件 / 本地桌面工具（V1）

这是一个可本地运行的增量式图片相似度核查桌面工具（Electron + SQLite）。

## 首版闭环

- 选择目录并构建图片索引（SQLite）。
- 上传单图或拖拽多图进行检测（新图 vs 当前目录已索引图）。
- 支持完全重复（文件哈希）和近似重复（aHash/dHash/pHash）。
- 展示 TopN 命中候选、相似度分级、推荐动作。
- 用户执行动作后写入历史记录。
- 重启后复用设置与索引。
- 支持目录新增图片监听并自动触发检测。

## 技术栈

- Electron（桌面容器）
- better-sqlite3（本地数据库）
- sharp + imghash（图像信息与感知哈希）
- chokidar（目录监听）

## 项目结构

```text
src/
  main/
    main.js                    # Electron 主进程与 IPC
    preload.js                 # 安全桥接 API
    db/database.js             # SQLite 初始化与连接
    services/
      constants.js
      file-system-service.js   # 扫描/过滤/监听
      index-service.js         # 索引创建/更新/失效标记
      image-feature-service.js # 文件哈希/感知哈希/深度接口预留
      similarity-service.js    # 候选比对/评分/等级判定
      decision-service.js      # 推荐动作与动作执行
      history-service.js       # 历史写入/查询
      detection-service.js     # 新图检测编排
  renderer/
    index.html                 # 四大页面视图（首页/检测/历史/设置）
    app.js                     # 仅负责交互与展示
    styles.css
scripts/
  setup-deps.sh                # 依赖安装 setup script（网络受限场景建议用）
```

## 数据库表

自动初始化以下表：

- `images`
- `scan_jobs`
- `detection_records`
- `detection_matches`
- `app_settings`

数据库默认路径：`~/.image-similarity-checker/app.db`。

## 运行

### 1) 依赖安装（建议通过 setup script）

```bash
npm run setup:deps
```

> 如果当前环境访问 npm registry 返回 403，这属于网络/权限限制，不是项目代码错误。可通过企业镜像、私有 npm 源或放通网络后重试 setup script。

### 2) 启动应用

```bash
npm start
```

### 3) 代码检查

```bash
npm test
```

### 4) 打包

```bash
npm run package:app
```

- 若本地已安装 `electron-builder`（`node_modules/.bin/electron-builder`），会输出 `dist/` 下的可分发应用目录。
- 若当前环境无法安装依赖（例如 npm registry 403），脚本会自动生成 `dist/*.tar.gz` 源码归档包作为可交付产物，并提示后续在可联网环境执行原生安装包构建。

## 业务规则（V1）

- 默认仅当前目录比对。
- 阈值全可配置：
  - 完全重复：100
  - 高度相似：95+
  - 中度相似：85+
- 不自动删除任何图片。
- 替换与移动动作均需用户点击。

## 异常处理

UI 与历史记录可查看以下问题：

- 非法格式 / 损坏图片
- 目录不存在或不可读
- 监听失效
- 数据写入或索引失败
- 重复监听与文件未稳定写入

## 被环境阻塞与继续方式

- **已完成且不依赖新增安装包的部分**：目录结构、数据库设计与初始化、service 分层、页面骨架、配置与历史持久化逻辑。
- **受 npm registry 403 阻塞的部分**：首次安装依赖与本机运行 Electron 二进制。
- **建议 setup script**：`npm run setup:deps`（可配合 `NPM_REGISTRY=<your-mirror>` 使用）。

## 后续扩展

`image-feature-service.extractDeepFeatureVector()` 已预留，可接入 CLIP/CNN/ViT；`similarity-service` 支持后续融合深度向量相似度。
