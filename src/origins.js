/**
 * Tool provenance for the settings page: which part of the deployment registers a tool.
 *
 * The Host tool registry keeps no owner for a registration, so a builtin is recognized by a
 * static name table and a plugin tool is recognized by scanning the installed packages'
 * entry modules for the name they register. Anything neither table nor scan explains is
 * reported as unattributed rather than guessed.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/** Builtin tool name → the capability it belongs to. Names outside this table come from plugins. */
const BUILTIN = new Map([
  ['pwsh', '命令执行'],
  ['bash', '命令执行'],
  ['shell', '命令执行'],
  ['read', '文件系统'],
  ['write', '文件系统'],
  ['edit', '文件系统'],
  ['glob', '文件系统'],
  ['grep', '文件系统'],
  ['working_directory', '工作区'],
  ['job_list', '后台任务'],
  ['job_output', '后台任务'],
  ['job_kill', '后台任务'],
  ['schedule_create', '定时提醒'],
  ['schedule_update', '定时提醒'],
  ['schedule_delete', '定时提醒'],
  ['schedule_list', '定时提醒'],
  ['ask_user_question', '人机交互'],
  ['todo_write', '待办'],
  ['skill', '技能'],
  ['present', '交付物'],
  ['exit_plan_mode', '计划'],
  ['create_goal', '目标'],
  ['get_goal', '目标'],
  ['update_goal', '目标'],
  ['subagent', '子代理'],
  ['subagent_fork', '子代理'],
  ['list_agents', '子代理'],
  ['send_message', '子代理'],
  ['interrupt_agent', '子代理'],
  ['workflow', '工作流'],
  ['ralph', 'Ralph 循环'],
  ['web_search', '网络'],
  ['web_fetch', '网络'],
  ['session_search', '会话检索'],
  ['session_trace', '会话检索'],
  ['session_event_search', '会话检索'],
  ['session_event_read', '会话检索'],
  ['session_event_trace', '会话检索'],
  ['task_board_create', '任务板'],
  ['task_board_get', '任务板'],
  ['task_board_list', '任务板'],
  ['task_board_manage', '任务板'],
  ['task_board_run', '任务板'],
  ['task_board_schedule', '任务板'],
  ['task_board_set_parent', '任务板'],
  ['task_board_update', '任务板'],
  ['create_worktree', '工作树'],
  ['plugin_manager', '插件管理'],
  ['plugin_market', '插件市场'],
])

/** Package directories that never register tools on our behalf. */
const SKIP = new Set(['.bin', '@deepseek-ai'])

/** The largest entry module worth reading while looking for one plugin's tool names. */
const MAX_FILE_BYTES = 4 * 1024 * 1024

/** How far past a `tools.register(` call a literal name may sit. */
const NAME_WINDOW = 800

/**
 * The capability a builtin tool belongs to.
 * @param name - tool name.
 * @returns the capability label, or undefined for a name the table does not cover.
 */
export function builtinCapability(name) {
  return BUILTIN.get(name)
}

/**
 * Package names of the installed profile's directories, including scoped ones.
 * @param nodeModules - absolute path of the profile's `node_modules`.
 * @returns package directories as paths relative to `nodeModules`.
 */
function packageDirs(nodeModules) {
  let top
  try {
    top = readdirSync(nodeModules, { withFileTypes: true })
  } catch {
    return []
  }
  const dirs = []
  for (const entry of top) {
    if (!entry.isDirectory() || SKIP.has(entry.name)) continue
    if (entry.name.startsWith('@')) {
      let scoped
      try {
        scoped = readdirSync(join(nodeModules, entry.name), { withFileTypes: true })
      } catch {
        continue
      }
      for (const child of scoped) if (child.isDirectory()) dirs.push(join(entry.name, child.name))
      continue
    }
    dirs.push(entry.name)
  }
  return dirs
}

/**
 * Module files worth reading for one package: its declared entry points.
 * @param packageDir - absolute package directory.
 * @param manifest - parsed `package.json`, when it could be read.
 * @returns existing file paths, at most four.
 */
function entryFiles(packageDir, manifest) {
  const candidates = []
  const main = typeof manifest?.main === 'string' ? manifest.main : undefined
  if (main !== undefined) candidates.push(main)
  const exported = manifest?.exports?.['.']
  if (typeof exported === 'string') candidates.push(exported)
  else if (typeof exported === 'object' && exported !== null) {
    for (const value of Object.values(exported)) {
      if (typeof value === 'string') candidates.push(value)
      else if (typeof value === 'object' && value !== null) {
        for (const nested of Object.values(value)) if (typeof nested === 'string') candidates.push(nested)
      }
    }
  }
  candidates.push('lib/index.js', 'dist/index.js', 'index.js')
  const files = []
  for (const candidate of candidates) {
    const path = join(packageDir, candidate)
    try {
      if (!statSync(path).isFile()) continue
    } catch {
      continue
    }
    if (!files.includes(path)) files.push(path)
    if (files.length === 4) break
  }
  return files
}

/**
 * Read one module and pair every literal tool name it registers with its package.
 * @param path - module file.
 * @param packageName - package that owns the module.
 * @param into - map receiving `name → package`.
 */
function collectFromModule(path, packageName, into) {
  let text
  try {
    if (statSync(path).size > MAX_FILE_BYTES) return
    text = readFileSync(path, 'utf8')
  } catch {
    return
  }
  if (!text.includes('tools.register')) return
  const pattern = /name\s*:\s*['"]([A-Za-z_][\w-]*)['"]/g
  let cursor = 0
  while (cursor < text.length) {
    const call = text.indexOf('tools.register', cursor)
    if (call === -1) return
    cursor = call + 1
    const window = text.slice(call, call + NAME_WINDOW)
    pattern.lastIndex = 0
    const match = pattern.exec(window)
    if (match === null) continue
    if (!into.has(match[1])) into.set(match[1], packageName)
  }
}

/**
 * Tool names registered by the profile's installed packages.
 *
 * Reads only each package's declared entry modules, and only files that mention
 * `tools.register`, so the scan stays bounded. Bundled or dynamically named tools are
 * simply absent from the result; the page reports them as unattributed instead of guessing.
 * @param nodeModules - absolute path of the profile's `node_modules`.
 * @returns tool name → package name.
 */
export function collectPluginTools(nodeModules) {
  const tools = new Map()
  for (const relative of packageDirs(nodeModules)) {
    const packageDir = join(nodeModules, relative)
    let manifest
    try {
      manifest = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'))
    } catch {
      manifest = undefined
    }
    const packageName = typeof manifest?.name === 'string' ? manifest.name : relative
    for (const file of entryFiles(packageDir, manifest)) collectFromModule(file, packageName, tools)
  }
  return tools
}

/**
 * Who provides one tool, as the settings page shows it.
 * @param name - tool name.
 * @param context - MCP server name and the plugin scan result for this deployment.
 * @returns the kind and its user-facing label.
 */
export function describeProvider(name, context) {
  const { server, pluginTools } = context
  if (server !== undefined) return { kind: 'mcp', provider: `MCP 服务器 · ${server}` }
  const capability = BUILTIN.get(name)
  if (capability !== undefined) return { kind: 'builtin', provider: `内置 · ${capability}` }
  const pkg = pluginTools?.get(name)
  if (pkg !== undefined) return { kind: 'plugin', provider: `插件 · ${pkg}` }
  return { kind: 'unknown', provider: '内置或插件工具' }
}
