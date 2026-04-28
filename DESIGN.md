# DESIGN.md – NKY-Storage-Editor Browser Extension

## 1. 项目概述

本插件面向 **neikongyi.com** 及其所有二级域名（如 `nky.neikongyi.com`、`xn.neikongyi.com`），以及 **localhost** 本地开发环境，提供 **localStorage** 与 **sessionStorage** 的多配置管理能力。管理员可以在插件 UI 中保存当前页面的存储快照为命名配置，随后一键注入该配置并自动刷新页面，从而无需手动修改后端或重新登录。

## 2. 核心目标

- **快速保存**：在任意符合域名的页面点击 “保存配置”，将 `localStorage` 与 `sessionStorage` 的完整快照保存到 Chrome 本地存储 (`chrome.storage.local`)。
- **一键注入**：从已保存的配置列表中选择目标配置，插件向当前标签页发送注入指令，Content Script 清空现有 storage 并写入快照，随后页面自动刷新。
- **多配置管理**：支持创建、重命名、删除、导入/导出 JSON 配置文件。
- **域名隔离**：每个二级域名拥有独立的配置集合，防止跨站点污染。
- **快捷工具栏**：支持一键修改特定存储字段（如功能位），并集成在 **Footer** 中以节省垂直空间。

## 3. 技术栈

- **Manifest V3**（Chrome/Edge）
- **HTML / CSS / Vanilla JavaScript**（无框架）
- **Chrome Storage API** (`chrome.storage.local`) 用于持久化配置
- **Content Script** 与 **Popup UI** 通过消息传递 (`chrome.runtime.sendMessage` / `chrome.tabs.sendMessage`) 进行交互

## 4. 文件结构

```
nky-storage-editer/
├── manifest.json
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── content_scripts/
│   └── content.js
├── utils/
│   └── storage-utils.js
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── DESIGN.md
├── SPEC.md
└── TODO.md
```

## 5. 数据模型

```typescript
// 单条存储快照
interface StorageSnapshot {
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
}

// 配置项（持久化在 chrome.storage.local）
interface ConfigEntry {
  id: string; // UUID v4
  name: string; // 用户自定义名称
  hostname: string; // location.hostname（域名）
  createdAt: number; // Unix 时间戳（ms）
  updatedAt: number; // Unix 时间戳（ms）
  snapshot: StorageSnapshot;
}

// chrome.storage.local 中的键名约定
// `configs::<hostname>` => ConfigEntry[]
```

## 6. 关键交互流程

1. **保存配置**
   - Popup 调用 `chrome.tabs.query({active:true, currentWindow:true})` 获取当前 `tabId`。
   - 通过 `chrome.scripting.executeScript` 在页面注入临时脚本读取 `window.localStorage` 与 `window.sessionStorage`，返回快照。
   - 将快照包装为 `ConfigEntry`，写入 `chrome.storage.local["configs::<hostname>"]`。
2. **注入配置并刷新**
   - 用户在 Popup 中选择目标配置并点击 “注入并刷新”。
   - Popup 向 Content Script 发送 `{action:"WRITE_STORAGE", payload:snapshot}`。
   - Content Script 清空 storage，遍历 `snapshot` 写入 `localStorage` 与 `sessionStorage`，完成后回复 `{success:true}`。
   - Popup 收到成功回执后调用 `chrome.tabs.reload(tabId)`。
3. **导入/导出**（可选扩展）
   - 导出：将 `ConfigEntry[]` 序列化为 JSON，触发下载。
   - 导入：读取本地 JSON 文件，合并到对应 `hostname` 的配置列表。
4. **快捷切换功能位** (Shortcut Toggle)
   - 快捷按钮集成在 **Footer** 操作栏中。
   - Popup 向 Content Script 发送对应指令（如 `TOGGLE_FUNCTIONAL_27`）。
   - Content Script 修改存储并通知成功。
   - 成功后 Popup 调用 `chrome.tabs.reload(tabId)`。

## 7. 安全与权限

- **host_permissions**: 
  - `"*://*.neikongyi.com/*"`
  - `"http://localhost/*"`
  - `"http://127.0.0.1/*"`
- **permissions**: `"storage"`, `"tabs"`, `"activeTab"`, `"scripting"`
- 仅在匹配的域名下注入 Content Script，避免对其他站点产生副作用。

## 8. 可扩展性考虑

- 支持 **Firefox**（MV3 兼容） via `browser` 命名空间。
- 将 `chrome.storage.local` 替换为 `chrome.storage.sync`（配额 100KB）以实现跨设备同步。
- 为每个配置增加 **标签**（标签功能），便于在大量配置中快速检索。

---

_此文档为项目设计稿，后续实现应严格遵循上述架构与交互流程。_
