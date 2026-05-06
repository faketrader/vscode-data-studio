# JSON Lines Explorer（VS Code 扩展）

一个面向大文件 JSONL/NDJSON 的表格化编辑器，支持懒加载、筛选统计、批量修改、导入导出与中英文切换。

## 功能特性

- ✅ 自定义编辑器打开 `*.jsonl` / `*.ndjson`
- ✅ 表格预览 + 底部自动懒加载（滚动到接近底部自动请求更多）
- ✅ 行新增 / 删除 / 内联编辑 / 弹窗编辑
- ✅ 统一“保存”提交（避免逐条落盘）
- ✅ 行/列拖拽排序
- ✅ 筛选 + 列统计
- ✅ 导入导出（CSV / JSONL）
- ✅ 中英文 i18n（默认英文）

## 目录结构（重构后）

```text
src/
  extension.ts                     # 扩展入口：命令注册 + provider 注册
  editor/
    JsonlEditorProvider.ts         # 编排层（接消息、调服务、回传 UI）
  services/
    FileService.ts                 # JSONL 读取/写回（纯服务）
    ExportService.ts               # CSV/JSONL 导入导出（纯函数）
  i18n/
    index.ts                       # i18n 工厂：getLocale/t/getAllLocales
    locales/
      en.json
      zh.json
  types/
    index.ts                       # 共享类型
  webview/
    WebviewContent.ts              # HTML 组装（CSP + 资源 URI 注入）

media/
  index.html                       # Webview 骨架（仅结构）
  styles/main.css                  # 样式层
  scripts/
    app.js                         # Webview 入口与消息路由
    state.js                       # 状态容器
    renderer.js                    # 渲染层
    editor.js                      # 编辑行为
    modals.js                      # 弹窗行为
    toolbar.js                     # 工具栏行为
    colManager.js                  # 列/行拖拽与列菜单
    lazyLoader.js                  # 无限滚动懒加载
    i18n.js                        # Webview i18n 运行时
```

## 分层说明（设计要点）

- **Extension 层**（`src/extension.ts`）
  - 只做生命周期与命令注册，不混入业务细节。
- **Provider 编排层**（`src/editor/JsonlEditorProvider.ts`）
  - 负责 Webview 消息分发（load/save/import/export/reorder）。
  - 不直接写复杂算法；通过服务层完成文件与转换逻辑。
- **Service 领域层**（`src/services/*`）
  - 与 VS Code API 解耦，便于测试与复用。
- **Webview 视图层**（`media/*`）
  - `index.html` 只保留结构；样式与脚本模块化。
  - 脚本按“状态/渲染/交互”拆分，降低耦合。

## i18n 扩展（如何新增语言）

### 扩展端（Node）

1. 在 `src/i18n/locales/` 新增语言文件（例如 `ja.json`）。
2. 在 `src/i18n/index.ts` 中导入并注册到 locale map。
3. 确保 key 与 `en.json` 保持一致。

### Webview 端（Browser）

- 无需改动核心逻辑。
- `window.I18n.load(locales)` 会接收扩展端下发的完整词条表。

## 懒加载机制

- 监听表格容器滚动；
- 使用轻量 debounce；
- 当距离底部阈值内时触发 `loadMore` 消息；
- Provider 再按 `offset + count` 从服务层读取下一批。

## 开发与构建

```bash
bun install
bun run build
bun run watch
```

## 打包 VSIX

```bash
bun run vsix
```

> 当前脚本已包含 `--no-dependencies`，避免 Bun 项目在 `vsce` 下被 `npm list` 误判 extraneous 依赖。

## 常见维护入口

- 想改 UI 结构：`media/index.html`
- 想改样式：`media/styles/main.css`
- 想改渲染行为：`media/scripts/renderer.js`
- 想改保存策略：`src/services/FileService.ts`
- 想加后端能力：`src/services/*.ts` + Provider 消息路由

## 后续建议

- 补充单元测试（FileService / ExportService）
- 增加 E2E（打开文件、编辑、保存、导入导出回归）
- 补全 `repository` 与 `LICENSE` 元数据，减少打包警告
