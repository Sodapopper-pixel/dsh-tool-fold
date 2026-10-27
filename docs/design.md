# dsh-tool-fold 设计

把已注册工具从模型可见的工具面摘除，让代理按需查询、展开或代执行。术语见 [CONTEXT.md](../CONTEXT.md)。

## 目标与非目标

**目标**

- 在指定预设的会话里，把一批工具从工具面摘除，代理先查询、再展开或代执行。
- 兼容插件注册的工具与 MCP 注册的工具，包括会话开始后才连上的 MCP 服务器。
- 支持多个组，每组一个查询工具，组与组之间互不干扰。
- 在 Web 设置页里可视化编辑组、绑定与生效预设。

**非目标**

- 不改动被折叠工具自身的实现、审批或结果渲染。
- 不生成、不复制、不覆盖预设声明。
- 不做跨机器的配置同步。

## 两类组

| | 折叠组 | 聚合组 |
|---|---|---|
| 绑定工具的可见性 | 折叠，可展开 | 折叠，永不展开 |
| 模型接触方式 | 展开后原生直调 | 经查询工具 `call` 代执行 |
| 查询工具的操作 | 列举或检索、展开、收回 | 检索、代执行 |
| 展开状态 | 会话内可变，重启回全折叠 | 无 |

两类组共用"绑定"与"生效预设"语义：一个工具最多绑定一个组，不论组是哪一类；自定义查询工具名与任何已注册工具重名时保存即拒绝。

## 运行时结构

**挂载。** 插件在 profile 里挂全局一行（Host 半侧 + Client 半侧），不进入任何预设的 plugins 列表。生效范围由每个组自己的生效预设名单决定，见 [ADR-0002](adr/0002-global-plugin-with-preset-scope.md)。

**会话装配。** 监听 `agent/created`，读当前会话的预设（`ctx.get('agentPresets')?.composedPreset(agent.ctx)`，`packages/preset/agent-preset-registry/src/index.ts:317`）；命中的组做三件事，全部包在一个 `agent.ctx.effect()` 里以便随会话销毁：

1. 在 `agent.ctx` 上注册该组的查询工具。`agent.ctx` 自身注册的工具不受限制过滤（`packages/core/tools/src/index.ts:1212-1216`），所以折叠不会把查询工具自己摘掉。
2. 对绑定工具调 `agent.ctx.tools.restrict({ deny })`（`packages/core/tools/src/index.ts:1105`），拿到该条限制的 disposer 保存为"展开入口"。`restrict` 必须用 scoped ctx，全局调用会掩掉所有代理；`run_code` 不能被指定；名字在调用时刻对着 `restrictableNames` 校验，未知名直接抛错。
3. 登记该组的会话状态：哪些工具已展开、各自最后一次被调用是第几轮。

未被任何组命中的会话什么都不注册，工具面保持原样。

**展开与收回。** `restrict` 是叠加式的（每次调用往作用域层追加一条限制，`packages/core/tools/src/index.ts:1127-1131`），部分展开无法从一条 deny 里摘掉几个名字，所以实现上每组只维护一条限制、由插件自己重算：展开 = 从"已折叠"集合移出该名，收回 = 加回，然后释放旧限制、按新集合重新 `restrict` 一次。集合为空时不调用 `restrict`（空过滤器会抛 no-op）。工具 schema provider 每次装配重算（`packages/core/system-prompt/src/index.ts:545`），所以改动在下一轮装配生效。收回状态不落盘，进程重启后回到全折叠。

**工具清单的来源（第三方插件的边界）。** `restrict` 必须用 scoped ctx，但 `ToolRuntime.schemas(scope?)` 的 scope 由入参决定，插件拿不到 `ScopeKey`（`scopeOf()` 属于 `@deepseek-ai/dsh-scope`，未安装进 profile），于是无法直接枚举某个会话可见的预设作用域工具。实现用两条通道绕开：

1. **名字集合**：`agent.ctx.tools.restrict({ deny: ['<哨兵>'] })` 的拒绝消息会列出该作用域可限制的全部名字（`packages/core/tools/src/index.ts:1125`，`known global tools: a, b, c`）。抛错发生在追加限制之前，所以探测不改变状态；解析这条消息即得到"迟到绑定"判定所需的名单。
2. **描述与参数**：注册一个 `ctx.systemPrompt.tools(provider)` 全局 provider，装配时它收到 `AssembleContext.scope`（`packages/core/system-prompt/src/index.ts:42`），据此调 `ctx.tools.schemas(context.scope)` 缓存该作用域的工具表。provider 必须返回 `{ schemas: [] }` 这个空 surface——装配对每个 provider 无条件读 `result.schemas`（同文件 `:641`），返回 `undefined` 会让每一轮 prompt 装配抛 `Cannot read properties of undefined (reading 'schemas')`。本插件只观察 scope，不贡献 schema。

代价：会话首次装配之前被折叠的工具没有描述缓存，`find` 会显示"尚无描述记录"，展开一次后自动补齐。页面选择器同理——预设作用域里的工具在缓存之前只能手动输入名字。

**闲置自动收回。** 按组开启，默认关闭。开启后统计展开后连续未被调用的轮数，超过阈值即收回。轮次以会话消息为界。

**迟到绑定。** 会话装配时解析不到的名字跳过，不让 `restrict` 抛错。插件在自身（全局）上下文监听 `tools/change`，对每个活会话重算一次：新出现的绑定名补 deny，消失的名字释放限制。

**代执行。** 聚合组的查询工具在 `call(args, exec)` 内发起 `ctx.tools.execute({ name, arguments, parent: exec.token, signal: exec.signal })`（`packages/core/tools/src/index.ts:1377`、`:419` TokenRunContext 的 `token`、`:350` `parent`）。带 `parent` 的嵌套调用在 PTC 模式下不被折叠、也不绕过限制，于是被代理的工具既享受完整管道，又保持折叠。

## 工具 schema

每组一个工具，用 `op` 判别，不拆成"每组三个工具"。

折叠组（列举形态）：描述里写出绑定工具名，`op` 取 `expand`、`retract`（可选 `list`）。
折叠组（搜索形态）：描述里只给一句概括，`op` 取 `find`、`expand`、`retract`。
聚合组：描述里给概括，`op` 取 `find`（返回用法说明）、`call`（带工具名与参数）。

查询工具名即组名，由用户起，受重名校验约束。

## 配置模型

存插件自己的存储命名空间，理由见 [ADR-0004](adr/0004-plugin-owned-configuration-storage.md)。

```text
groups[]:
  id, name（即查询工具名）, kind: fold | aggregate
  tools[]        绑定工具名，全局唯一
  presets[]      生效预设 id
  listingForm    列举 | 搜索（折叠组）
  idleRetract    { enabled, rounds }（折叠组）
  usageNote      手写补充（聚合组，可选）
config:
  defaultListingForm, defaultIdleRetract
```

保存时校验：组名不与被任何已注册工具重名；一个工具不跨组重复；预设 id 必须存在。

## 设置页

独立 Settings 页（`settings.section` 新条目，如"工具折叠"），不塞进插件配置表单：组 × 工具 × 预设名单的嵌套结构用 schema 表单表达不出来，且插件配置表单拿不到写回通道。

页面行为：

- **组面板可折叠**：面板头是开关加组名、一行摘要（类型 · 工具数 · 预设数）与「删除」；新建的组展开，已有组默认收起；面板之间留间距。
- **工具选择**：一行一个工具，给出名称、来源标签与详情开关。来源区分 MCP 服务器（名字是 `mcp__<server>__<tool>`）与内置或插件工具；详情面板再给出可见层（全局层 / 预设作用域）、描述与原始 JSON 参数结构，其中描述与原始结构各自折叠。已绑定到其他组的工具置灰，仍可手动输入名字补充。
- **生效预设**、每组的查询形态、折叠组的闲置收回选项。
- **保存结果贴着按钮**：成功是绿色的「已保存」，失败是红色原因，都在页脚按钮旁边；页面顶部的红色块只留给「无法保存」的校验问题列表。

保存被拒时页面保留用户输入，不回滚。

## 失败模式

| 情况 | 行为 |
|---|---|
| 绑定工具在会话装配时不存在 | 跳过并记入迟到绑定，`tools/change` 时补上 |
| 绑定工具被卸载后再也不出现 | 保留配置，页面标黄，不阻塞其它工具 |
| 组名与现有工具重名 | 保存被拒，页面报出冲突的工具名 |
| 同一工具被两个组绑定 | 保存被拒 |
| 预设被删除 | 该组在该预设上不再生效，配置保留 |
| 查询工具执行代调用但目标不可见 | 返回明确失败，不静默吞掉 |
| 插件自身卸载 | 所有 `agent.ctx` 注册与限制随 `effect` 释放，工具面复原 |

## 验收标准

1. 命中预设的会话里，绑定工具不出现在工具面，查询工具出现。
2. 展开后下一轮工具面出现该工具，模型直调可用。
3. 收回后工具面再次消失。
4. 聚合组的 `call` 走完整管道：目标工具的审批、guard、pre-execute 均触发。
5. 未命中预设的会话里，查询工具与折叠都不存在。
6. MCP 服务器在会话开始后才连上时，其工具被补折叠。
7. 进程重启后所有组回到全折叠。
8. 重名与跨组重复在保存时被拒。
9. 卸载插件后工具面完全复原。

## 宿主事实

已验证（出处见上文）：

- `restrict` 只能挂在 scoped ctx 上，沿作用域链求交集，未知名在调用时刻抛错；`run_code` 不可被限制。
- `agent.ctx` 自身注册的工具不受限制过滤，所以查询工具不会被自己折叠掉。
- 工具 schema 每次装配重算，摘/上限制在下一轮立即生效。
- `ToolRunContext.token` 可直接作为 `parent` 传回 `ctx.tools.execute`，带 `parent` 的调用在 PTC 模式下不被折叠。
- `agentPresets.composedPreset(agent.ctx)` 给出会话的预设 id。
- `AssembleContext.scope` 是插件能拿到的唯一作用域入口。

待验证：

- `tools/change` 在全局上下文是否覆盖每个 scoped 层的变化，还是需要按会话再去重（当前实现在该事件上全量重算，成本可接受）。
- PTC 模式下被折叠工具的代执行（`parent` 已设）与 `collapses()` 的实际交互。
- 闲置自动收回的轮次来源：会话事件里有 `turn/start`、`turn/end`，但未找到第三方插件可订阅的入口，暂未接。
## 本地验收

页面改动要验证的是"Cordis 装配出来的真实页面"，不是浏览器 bundle 自己，所以验收跑在真 Host 上：

1. `node scripts/build.mjs && node scripts/sync-installed.mjs --apply`，刷新页面（只改客户端时不必重启 Host）。
2. `python tests/verify_page.py <token URL>`：量面板折叠、间距、工具行数与详情块（不写入配置）。
3. `python tests/verify_save.py <token URL>`：新增一个组、勾一个工具、保存，读页脚提示。
4. `python tests/probe_details.py <token URL>`：读一个工具详情里的来源、层、描述与原始 JSON 结构。

Host 侧改动（例如 `catalog()` 的字段、保存校验）不在客户端 bundle 里，必须重启 Host 才生效。会话中途不能自己重启 Host——本会话的 shell 是 Host 的后代进程，杀 Host 会连会话一起结束；重启交给用户（`dsh-web-stop.bat` 再 `dsh-web.bat`）。

不想动真 Host 的配置时，可以另起一个隔离 `DSH_HOME`：`dsh plugin --profile web add "file:<本仓库>"`，再 `dsh web --no-open --port 3091`（默认 3080 被真 Host 占着）。隔离实例的目录里留过一份：`C:\Users\21621\dsh-backups\tool-fold-verify-home`。