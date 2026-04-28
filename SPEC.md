# SPEC.md — nky-storage-editer 功能规格

## 版本：v1.0.0 | 状态：Draft | 日期：2026-04-24

---

## 1. 适用范围

本规格适用于 Chrome Extension（Manifest V3），目标域名为 `neikongyi.com` 及其全部子域名 (`*.neikongyi.com`)，以及本地开发环境 (`localhost`, `127.0.0.1`)。

---

## 2. 功能规格

### F-01 域名白名单校验

| 项 | 描述 |
|----|------|
| ID | F-01 |
| 优先级 | P0 |
| 描述 | Popup 打开时检查当前标签页 URL 是否匹配白名单。不匹配则展示「当前页面不支持」提示并禁用所有操作按钮。 |
| 白名单列表 | 1. `neikongyi.com` 及其所有子域名<br>2. `localhost`<br>3. `127.0.0.1` |
| 验收条件 | AC1: 在 `app.neikongyi.com` 或 `http://localhost:3000` 打开 Popup，功能区正常显示。AC2: 在 `google.com` 打开 Popup，显示不支持提示。 |

---

### F-02 读取当前存储

| 项 | 描述 |
|----|------|
| ID | F-02 |
| 优先级 | P0 |
| 描述 | 通过 Content Script 读取当前页面的 `window.localStorage` 和 `window.sessionStorage` 的全部键值对，返回给 Popup。 |
| 消息格式 | Request: `{ action: "READ_STORAGE" }` / Response: `{ localStorage: {...}, sessionStorage: {...} }` |
| 验收条件 | AC1: 读取结果与浏览器 DevTools 中显示的 Storage 内容一致。AC2: 存储为空时返回空对象 `{}`，不报错。 |

---

### F-03 保存配置

| 项 | 描述 |
|----|------|
| ID | F-03 |
| 优先级 | P0 |
| 描述 | 用户点击「保存当前存储」按钮，弹出输入框要求输入配置名称（1–50 字符），确认后将快照保存为新 `ConfigEntry` 存入 `chrome.storage.local`。 |
| 键名规则 | `"configs::" + hostname`（如 `configs::app.neikongyi.com`） |
| 验收条件 | AC1: 配置出现在列表中，显示名称和创建时间。AC2: 名称为空时不允许保存，显示校验提示。AC3: 名称超 50 字符时截断提示。AC4: 同一 hostname 可保存多条配置（无上限，建议 UI 超 20 条时滚动）。 |

---

### F-04 配置列表展示

| 项 | 描述 |
|----|------|
| ID | F-04 |
| 优先级 | P0 |
| 描述 | Popup 打开时加载当前 hostname 的所有配置，以列表形式展示。每条显示：配置名、创建时间（yyyy-MM-dd HH:mm）、localStorage 条数 + sessionStorage 条数摘要。 |
| 验收条件 | AC1: 列表按 `createdAt` 降序排列（最新在前）。AC2: 无配置时显示「暂无配置，点击保存当前存储创建第一个」占位文案。 |

---

### F-05 注入配置并刷新

| 项 | 描述 |
|----|------|
| ID | F-05 |
| 优先级 | P0 |
| 描述 | 用户点击某条配置的「注入并刷新」按钮，Popup 向 Content Script 发送写入指令，Content Script 清空并重写 localStorage 和 sessionStorage，完成后 Popup 调用 `chrome.tabs.reload`。 |
| 消息格式 | Request: `{ action: "WRITE_STORAGE", payload: { localStorage: {...}, sessionStorage: {...} } }` / Response: `{ success: true }` |
| 验收条件 | AC1: 刷新后页面 Storage 与所选配置完全一致（通过 DevTools 验证）。AC2: 写入前先清空原有 localStorage 和 sessionStorage（不保留旧 key）。AC3: 注入失败（如 Content Script 未加载）时展示错误提示，不刷新页面。 |

---

### F-06 删除配置

| 项 | 描述 |
|----|------|
| ID | F-06 |
| 优先级 | P1 |
| 描述 | 每条配置提供「删除」按钮，点击后弹出确认对话框（`confirm()`），确认后从 `chrome.storage.local` 移除该 ConfigEntry。 |
| 验收条件 | AC1: 删除后列表立即更新。AC2: 取消删除则无任何变化。 |

---

### F-07 重命名配置

| 项 | 描述 |
|----|------|
| ID | F-07 |
| 优先级 | P2 |
| 描述 | 每条配置提供「重命名」按钮，点击后内联编辑配置名称，回车或失焦保存。 |
| 验收条件 | AC1: 新名称写入 `chrome.storage.local` 并更新 `updatedAt`。AC2: 新名称为空或超长时不保存，恢复原名。 |

---

### F-08 查看配置详情

| 项 | 描述 |
|----|------|
| ID | F-08 |
| 优先级 | P2 |
| 描述 | 点击配置名称展开详情区，显示所有 localStorage 和 sessionStorage 键值对（只读）。 |
| 验收条件 | AC1: 展开/折叠动画流畅。AC2: 键值过长时截断显示并支持 `title` 悬停查看完整值。 |

---

### F-09 快捷切换功能

| 项 | 描述 |
|----|------|
| ID | F-09 |
| 优先级 | P1 |
| 描述 | 提供快捷按钮进行特定存储逻辑的翻转修改。 |
| 验收条件 | AC1: 按钮以紧凑模式（Compact Mode）排列在顶部快捷栏中。AC2: 点击后执行预设逻辑（如翻转 functionals 位）并刷新。 |

---

## 3. 非功能规格

| 项 | 要求 |
|----|------|
| NF-01 性能 | Popup 打开到内容渲染 ≤ 300ms（本地存储读取） |
| NF-02 体积 | 扩展总体积（含图标）≤ 200KB |
| NF-03 兼容性 | Chrome 114+，Edge 114+ |
| NF-04 无构建 | 不依赖 webpack/vite 等构建工具，直接加载 |
| NF-05 存储上限 | `chrome.storage.local` 上限 10MB，单 hostname 配置数不作硬限制 |
| NF-06 隐私 | 所有数据仅存本地，不发送任何网络请求 |

---

## 4. 消息协议（Content Script ↔ Popup）

```
READ_STORAGE
  Request:  { action: "READ_STORAGE" }
  Response: { localStorage: Record<string,string>, sessionStorage: Record<string,string> }

WRITE_STORAGE
  Request:  { action: "WRITE_STORAGE", payload: StorageSnapshot }
  Response: { success: boolean, error?: string }
```

---

## 5. 错误处理规范

| 场景 | 处理方式 |
|------|----------|
| Content Script 未加载（页面未完全刷新） | Popup 展示「请刷新页面后重试」 |
| `chrome.storage.local` 写入失败 | Toast 提示具体错误信息 |
| 配置名称校验失败 | 输入框下方红色提示文字 |
| 注入后 reload 失败 | Toast 提示「注入成功，请手动刷新页面」 |

---

## 6. UI 布局规范

- Popup 宽度：`360px`，高度：`auto`（最大 `580px`，超出滚动）
- 配色：跟随系统（支持 `prefers-color-scheme: dark`）
- 字体：系统默认 sans-serif
- 按钮：主操作蓝色（`#1a73e8`），危险操作红色（`#d93025`），**快捷按钮：绿色紧凑型 (`#34a853`)**
- **快捷栏**：位于顶部，支持多个小按钮横向排列，节省空间。
