# Agent 路由规则

## 角色分工

| 角色 | 工具 | 模型 | 职责 |
|------|------|------|------|
| **Architect** | Claude Code | Claude Opus 4.6 / Sonnet 4.6 | 需求分析、架构设计、文档生成、代码 Review、验收 |
| **Developer** | Codex | codex (OpenAI) | 功能实现、单元测试编写 |
| **Tester** | OpenCode | 按项目配置 | 测试执行、覆盖率检查、回归测试 |
| **Orchestrator** | Antigravity | Gemini 3.1 Pro | 任务调度、状态追踪、冲突仲裁、环境检测 |

### 模型绑定规则

- 每个角色**必须**使用指定工具和模型，不得替换
- Orchestrator 调度时**必须**明确指定目标工具名称，不得使用"合适的工具"等模糊表述
- 如需更换模型，须在本文件中修改并经人工确认

## 路由规则

### → Claude Code 处理

- 用户描述新需求或功能变更
- 需要更新 DESIGN.md / TODO.md / SPEC.md
- PR/diff 需要 Review
- 验收检查（对照 SPEC.md）
- 架构决策讨论
- 发布流程

### → Codex 处理  

- TODO.md 中标记为 🔲 的开发任务
- 单元测试编写
- Bug 修复（非架构性）
- 性能优化

### → 等待人工确认

- 删除文件或重大重构
- 修改 DESIGN.md 中的架构设计
- 发布到 App Store / TestFlight

## 工作流协议

### 新项目启动

1. Orchestrator 调用 Claude Code → 需求澄清 → 生成三份文件
2. Claude Code 搭项目骨架（可编译空壳）
3. Orchestrator 读 TODO.md → 分配可并行任务给 Codex
4. 每个 Codex 任务完成 → 自动触发 Claude Code Review
5. Review 通过 → 更新 TODO.md 状态

### 需求变更

1. 用户描述 → Orchestrator → Claude Code 更新文档
2. 文档更新后 → Orchestrator 重新分配受影响的任务

### Codex 命令生成规则（关键）

**Architect 在 TODO.md 中写好命令体，Orchestrator 原文转发，不做二次推断。**

理由：Orchestrator 是调度者，不是技术专家。由 Orchestrator 从模糊描述自行推断 `codex exec` 内容，准确性低且浪费其推理 Token。

- Architect 在每个 Sprint 的任务 **详细说明** 末尾附上 `### Codex 执行命令` 区块
- Orchestrator 读取该区块，**原文**传入 `codex exec "..."` 执行，不修改内容
- 若一个批次包含多个任务（如 T54+T55+T56），Architect 合并为一条命令
- 若任务间有依赖，Architect 拆成多个顺序命令，Orchestrator 按顺序执行

### 禁止事项

- Codex 不得修改 DESIGN.md
- Codex 不得直接 push 到 main（必须经 Claude Code Review）
- 未经确认不得删除文件
- Orchestrator 不得自行改写或简化 Architect 在 TODO.md 中写好的 Codex 命令


## 设计规范

根据DESIGN-UI.md的规范来设计页面ui和规范