# dsh-tool-fold

把一批已注册工具折叠成一个查询工具：需要时展开直调，或交给聚合组代执行。折叠按**代理预设**生效——同一批工具可以只在某个预设的会话里消失。

本插件是 `D:/deepseek-harness/local-plugins/` 下的本地插件，与 `dsh-cot-translator-plus`、`dsh-mobile-sidebar-overlay` 同构（源码与安装副本分离，用包内脚本镜像）。

## 两种组

| 类型 | 模型看到什么 | 模型怎么用工具 |
| --- | --- | --- |
| **折叠组**（`fold`） | 一个查询工具，`op` 可取 `list`/`find`、`expand`、`retract` | `expand` 后工具回到工具列表，下一轮直接调用；`retract` 收回 |
| **聚合组**（`aggregate`） | 一个查询工具，`op` 可取 `find`、`call` | 从不展开；`call` 由宿主代执行，走完整审批与 guard 管道 |

- 一个工具最多绑一个组（跨两类也互斥）；查询工具名与任何已注册工具重名时**保存即拒绝**。
- 绑定的工具在会话创建时不存在（MCP 未连上、插件晚注册）时跳过并标记；晚注册后由 `tools/change` 补折叠。
- 自动收回默认关闭；开启后按"闲置轮数"收回已展开的工具。重启后回到全折叠初始状态。

## 目录

```
src/index.js    Host：配置读写、按预设装载、HTTP 路由
src/session.js  每个 agent 一条记录：注册查询工具、折叠/展开、代执行
src/tools.js    查询工具的 schema、描述与 op 分发（纯函数，可单测）
src/store.js    配置归一化与校验（纯函数，可单测）
src/http.js     路由的 JSON 收发与连接准入
src/client.js   设置页（`settings.section`）与样式
tests/          store/tools 的行为测试
docs/           设计文档与 ADR（文档先行）
```

## 构建、测试、安装

```sh
node scripts/build.mjs                    # 生成 lib/（Host 模块逐个复制 + 单文件浏览器工厂）
node --test "tests/*.test.mjs"            # 单元测试
node scripts/sync-installed.mjs --check   # 只读：安装副本是否过期（过期退 1）
node scripts/sync-installed.mjs --apply   # 把本源目录镜像进 web profile 的安装副本
```

装进 web profile（首次）：

```sh
dsh plugin --profile web add file:D:/deepseek-harness/local-plugins/dsh-tool-fold
```

Host 侧改动需重启 Host；只有客户端（`lib/client.js`）改动时刷新页面即可。

## 配置文件

`~/.dsh/tool-fold/config.json`（遵循 `DSH_HOME`）。页面写入，Host 校验后才落盘；写入是临时文件 + 重命名，崩溃不会留下半个文件。

## 当前状态（骨架）

已完成：配置层（归一化 + 校验 + 单测）、查询工具的 schema/描述/dispatch、按预设置装、折叠与展开、聚合组代执行、晚注册补折叠、设置页（可折叠的组面板、带来源分类与原始 JSON 结构的工具选择、预设白名单、形态与闲置收回、页脚内联的保存结果、校验错误回显）、构建与镜像脚本。

设置页的验收脚本：`python tests/verify_page.py "<带 token 的界面地址>"`，它打开设置页→工具折叠，断言面板折叠/展开、面板间距、无"新组的默认值"、工具详情里"描述"与"原始 JSON 结构"各自折叠，并检查保存结果是否出现在页脚按钮旁。

尚未完成，按设计文档推进：

1. **闲置自动收回的轮次信号**：配置项与页面已就位，`session.js` 还没有接到"轮"的来源（未找到第三方插件可用的 turn 边界事件）。在接上之前该项设置不改变行为。
2. **页面工具目录对预设作用域工具的完整性**：第三方插件拿不到 `ScopeKey`，`tools.schemas()` 只能看到 global 层。当前实现通过 `systemPrompt.tools` 的装配回调缓存各作用域的工具表，并对仍未缓存到的工具提供手动输入名字的入口；详见 `docs/design.md`「工具清单的来源（第三方插件的边界）」。
3. **测试覆盖**：目前只有纯逻辑单测，Host 侧装载/展开/代执行与浏览器侧设置页还需按设计文档补集成测试。

## 文档

- [CONTEXT.md](CONTEXT.md)：术语表（折叠、展开、收回、折叠组、聚合组、查询工具）
- [docs/design.md](docs/design.md)：机制、宿主事实与实现路径
- [docs/adr/](docs/adr/)：架构决策记录

## 许可

MIT，见 [LICENSE](LICENSE)。
