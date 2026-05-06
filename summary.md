JsonL Table Explorer 对话整理（2026-05-06）

一、目标与需求
1) 开发 VSCode 插件：高效预览/编辑 JSONL（JSON Lines）。
2) 核心要求：
   - 表格视图展示 JSONL，支持懒加载（大文件按需加载）。
   - 支持新增/删除/编辑行；底部“添加”按钮。
   - 支持“在 Editor 中打开”切换原生编辑器。
   - 支持单条 JSON 完整预览。
3) 升级需求：
   - 行列拖拽排序。
   - 筛选与基础统计（计数/求和/平均）。
   - 导入导出（CSV/JSONL；需求中提及 XLSX，当前实现为 CSV/JSONL）。
   - 多语言支持（中英文），默认英文。
   - 性能优先，界面简洁，符合 VSCode 插件规范。

二、已完成功能（代码实现）
1) 扩展主体
   - 注册 JSONL 自定义编辑器（custom editor）。
   - 注册命令：
     - jsonlTableExplorer.openInEditor
     - jsonlTableExplorer.refresh
2) JSONL 数据处理
   - 按行读取并解析 JSONL。
   - 分批加载（初始页 + 滚动加载更多）。
   - 行更新、追加、删除、重排后写回文档并保存。
3) WebView UI（表格编辑界面）
   - 动态列渲染。
   - 行/列拖拽排序（前端交互 + 后端落盘）。
   - 单元格编辑（含多行输入）。
   - 行级操作（新增、删除、编辑弹窗）。
   - 筛选与统计展示。
   - 选中行完整 JSON 预览（含复制）。
   - 导入/导出（CSV / JSONL）。
4) 多语言
   - 新增配置项：jsonlTableExplorer.language（en/zh，默认 en）。
   - 扩展端将语言配置下发到 WebView。
   - WebView 支持 EN/ZH 文案切换。

三、构建体系与工程改造
1) 从 webpack 迁移到 Bun + tsup（esbuild）
   - 删除旧 webpack 配置。
   - 新增 tsup.config.ts。
   - 使用 Bun 作为包管理/脚本执行。
2) 当前 package.json 关键脚本
   - build: bun run compile
   - compile: bunx tsup
   - watch: bunx tsup --watch
   - package: bunx tsup --minify
   - vsix: bunx @vscode/vsce package --no-dependencies --allow-missing-repository --skip-license
3) 打包策略
   - package.json 已添加 files 字段，仅包含 dist/**、media/**、package.json。
   - 解决 Bun 项目在 vsce 下 npm 依赖校验报错（--no-dependencies）。

四、构建与打包结果
1) 构建验证
   - bun run build 成功（tsup 编译通过）。
2) VSIX 打包
   - 通过 bun run vsix 成功生成。
   - 产物：jsonl-table-explorer-26.5.0.vsix
   - 路径：/Users/whan/Documents/GitHub/faketrader/vscode-jsonl-editor/jsonl-table-explorer-26.5.0.vsix

五、过程中解决的关键问题
1) webviewContent.ts 曾残留整段 HTML，导致 TypeScript 编译异常。
   - 已修复为“从 media/webview.html 读取内容”。
2) vsce 在 Bun 项目中触发 npm list 依赖树误报（extraneous/invalid）。
   - 已通过 --no-dependencies 处理。
3) vsce 打包交互提示（repository/license）。
   - 已通过参数改为无交互脚本。
4) 同时使用 .vscodeignore 与 package.json files 冲突。
   - 最终保留 files 方案，移除 .vscodeignore。

六、当前状态结论
- 插件已可构建、可打包、可安装测试。
- 已生成可安装的 .vsix 文件。
- 多语言已接入（默认英文，可切换中文）。

七、建议后续（可选）
1) 补全 repository / LICENSE，去除打包警告并满足发布规范。
2) 导入导出补齐 XLSX（当前为 CSV/JSONL）。
3) 增加自动化测试（解析/编辑/导入导出/大文件性能基线）。
4) 优化打包体积与发布元数据（README、icon、publisher 流程）。
