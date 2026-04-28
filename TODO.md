# TODO.md — nky-storage-editer 开发任务

> 状态标记：🔲 待开发 | 🔄 进行中 | ✅ 已完成 | ❌ 已取消
> 
> **规则**：Codex 仅处理 🔲 状态任务；每完成一个任务更新状态为 ✅；任务间有依赖时按顺序执行。

---

## Sprint 1：核心功能实现

### T01 — Content Script：读写 Storage
**状态**：✅  

### T02 — Popup：域名校验与初始化
**状态**：✅  

### T03 — Popup：加载并渲染配置列表
**状态**：✅  

### T04 — Popup：保存当前存储为配置
**状态**：✅  

### T05 — Popup：注入配置并刷新
**状态**：✅  

### T06 — Popup：删除配置
**状态**：✅  

---

## Sprint 2：增强功能

### T07 — Popup：重命名配置（F-07）
**状态**：✅  

### T08 — Popup：查看配置详情（F-08）
**状态**：✅  

### T11 — Shortcut：切换功能位26
**状态**：✅  

### T12 — Correction：切换功能位27 & 默认不刷新
**状态**：✅  

---

## Sprint 4：Localhost 支持与 UI 优化

### T13 — 扩展支持 Localhost (F-01 扩展)
**状态**：✅  

### T14 — UI 优化：紧凑型快捷工具栏
**状态**：✅  

---

## Sprint 5：空间利用优化

### T15 — UI 空间优化：移除冗余提示并集成快捷键到 Footer

**优先级**：P1  
**依赖**：T14  
**状态**：🔲  

**详细说明**：
1. **移除提示**：删除“已读取当前页面 Storage”的成功状态显示，减少视觉干扰和空间占用。
2. **位置调整**：将顶部的快捷工具栏移动到 Footer 区域，与主操作按钮并列。
3. **结构调整**：
   - 移除 `#shortcut-bar`。
   - 在 `footer.actions` 内部新增 `<div class="footer-shortcuts">`。
   - 将 `btn-toggle-f27` 放入该容器。

### Codex 执行命令

```
优化 UI 空间，移除冗余提示并将快捷键移动至 Footer。

要求：
1. 修改 popup/popup.html：
   - 删除底部的 <div id="status" ...></div>（或将其 style 设为 display:none）。
   - 删除顶部的 <div id="shortcut-bar" ...>...</div>。
   - 在 <footer class="actions"> 内部的 <button id="btn-save"> 之前增加 <div class="footer-shortcuts"><button id="btn-toggle-f27" class="btn-shortcut">F27</button></div>。
2. 修改 popup/popup.css：
   - 移除 .shortcut-bar 相关样式。
   - 修改 .btn-shortcut：使其背景色更淡一些（如 #e8f5e9），文字颜色 #2e7d32，去掉加粗，使其在 footer 中不喧宾夺主。
   - 调整 .actions：确保 .footer-shortcuts 和主按钮横向排列，间距紧凑。
3. 修改 popup/popup.js：
   - 在 readCurrentStorage 函数中，删除 setStatus('已读取当前页面 Storage', 'success') 这一行。
```

---

## 任务依赖关系

```
T14 -> T15 (空间优化)
```
