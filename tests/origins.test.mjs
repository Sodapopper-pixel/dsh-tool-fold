import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { builtinCapability, collectPluginTools, describeProvider } from '../src/origins.js'

test('builtin tools resolve to the capability that owns them', () => {
  assert.equal(builtinCapability('read'), '文件系统')
  assert.equal(builtinCapability('task_board_run'), '任务板')
  assert.equal(builtinCapability('compress'), undefined)
})

test('an MCP tool is attributed to its server', () => {
  const origin = describeProvider('mcp__openviking__find', {
    server: 'openviking',
    pluginTools: new Map(),
  })
  assert.equal(origin.kind, 'mcp')
  assert.equal(origin.provider, 'MCP 服务器 · openviking')
})

test('a builtin tool is attributed to its capability', () => {
  const origin = describeProvider('read', { server: undefined, pluginTools: new Map() })
  assert.equal(origin.kind, 'builtin')
  assert.equal(origin.provider, '内置 · 文件系统')
})

test('a plugin tool is attributed to the package the scan found', () => {
  const origin = describeProvider('sidebar_open', {
    server: undefined,
    pluginTools: new Map([['sidebar_open', 'dsh-better-sidebar']]),
  })
  assert.equal(origin.kind, 'plugin')
  assert.equal(origin.provider, '插件 · dsh-better-sidebar')
})

test('an unexplained tool stays unattributed rather than guessed', () => {
  const origin = describeProvider('mystery_tool', { server: undefined, pluginTools: new Map() })
  assert.equal(origin.kind, 'unknown')
  assert.equal(origin.provider, '内置或插件工具')
})

test('the scan pairs registered literals with their package and skips modules that register nothing', () => {
  const root = mkdtempSync(join(tmpdir(), 'tool-fold-origins-'))
  const nodeModules = join(root, 'node_modules')

  const plain = join(nodeModules, 'pkg-a')
  mkdirSync(join(plain, 'lib'), { recursive: true })
  writeFileSync(join(plain, 'package.json'), JSON.stringify({ name: 'pkg-a', main: 'lib/index.js' }))
  writeFileSync(
    join(plain, 'lib', 'index.js'),
    "export const name = 'pkg-a'\nexport function apply(ctx) {\n  ctx.effect(() => ctx.tools.register(defineTool({ name: 'alpha_tool', description: 'a' })))\n}\n",
  )

  const scoped = join(nodeModules, '@scope', 'pkg-b')
  mkdirSync(join(scoped, 'lib'), { recursive: true })
  writeFileSync(join(scoped, 'package.json'), JSON.stringify({ name: '@scope/pkg-b', main: 'lib/index.js' }))
  writeFileSync(
    join(scoped, 'lib', 'index.js'),
    "export function apply(ctx) {\n  ctx.tools.register({ name: 'beta_tool', description: 'b' })\n}\n",
  )

  const quiet = join(nodeModules, 'pkg-c')
  mkdirSync(join(quiet, 'lib'), { recursive: true })
  writeFileSync(join(quiet, 'package.json'), JSON.stringify({ name: 'pkg-c', main: 'lib/index.js' }))
  writeFileSync(join(quiet, 'lib', 'index.js'), "export function apply() {}\n")

  const tools = collectPluginTools(nodeModules)
  assert.equal(tools.get('alpha_tool'), 'pkg-a')
  assert.equal(tools.get('beta_tool'), '@scope/pkg-b')
  assert.equal(tools.size, 2)
})
