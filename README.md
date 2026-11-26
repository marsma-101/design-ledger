# design-ledger（设计账本）

DeepSeek Harness (DSH) 插件：按项目分文件的**追加式更新日志（真值层）**与**推算看板（呈现层）**。

> 设计理念：「日志是唯一真相」——看板是从日志推理出来的视图，可随时重算。

## 规则

- 插件只建立规则，真实文件存于项目文件夹（`projectsRoot` 下的 `logs/` 与 `boards/`）
- 日志 append-only：只追加不删改，每条记录含时间/变更/依据/位置/状态
- 按项目分文件：`logs/<项目>.log.md` + `boards/<项目>.board.md`，避免单文件超限
- 看板纯目录+指针：每条目=主题名+状态色+一句话+指向介绍文件的链接（渐进式披露 L1→L2→L3 日志）

## 状态色体系

🟢通过/生效 · 🟡待审核 · 🔵待开发 · 🔴失败/回滚 · ⚪砍掉/不开发

## 工具

| 工具 | 用途 |
|---|---|
| `ledger_append` | 追加一条主人要求/设计变更到项目日志（必填依据） |
| `ledger_board` | 依据日志推理生成/更新项目看板 |
| `ledger_read` | 读取项目日志或看板全文 |

## 安装

本机装有 DSH 时：

```
Plugins > Add plugin > 选择本目录
```

或 `plugin_manager` `install_bundle`，target 传本目录绝对路径。

## 配置

`cordis.patch.yml` 行内 `config.projectsRoot`：项目文件根目录（默认 `G:/program/飞书cli/docs`）。

## 出处

2026-11-25/26 由萧潇（DSH 智能体）与主人（马泉斌）协作设计：日志即唯一真相的文档管理法。
