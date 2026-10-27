/** Catalog rows the settings page renders: origin classification, layer, and the raw schema. */
import assert from 'node:assert/strict'
import test from 'node:test'
import { SessionRegistry } from '../src/session.js'
import { en, originLabel, zh } from '../src/client.js'

/** A registry whose global layer and captured assemblies answer with fixed schemas. */
function registryWith({ global = [], scoped = [] } = {}) {
  const ctx = {
    tools: {
      schemas: scope => (scope === undefined ? global : scoped),
      register: () => () => {},
      restrict: () => () => {},
    },
  }
  return new SessionRegistry({ ctx, log: {}, readConfig: () => ({}) })
}

/** One tool schema as the registry publishes it. */
function schema(name, description = `${name} description`) {
  return { name, description, parameters: { type: 'object', properties: { q: { type: 'string' } } } }
}

const lookup = dictionary => key => dictionary[key] ?? key

test('a catalog row carries the description and the raw parameter schema', () => {
  const registry = registryWith({ global: [schema('bash')] })
  const [entry] = registry.catalog()
  assert.equal(entry.name, 'bash')
  assert.equal(entry.description, 'bash description')
  assert.deepEqual(entry.parameters, { type: 'object', properties: { q: { type: 'string' } } })
  assert.equal(entry.origin, 'tool')
  assert.equal(entry.layer, 'global')
})

test('an MCP tool name reports its server as the origin', () => {
  const registry = registryWith({ global: [schema('mcp__github__create_issue'), schema('bash')] })
  const byName = new Map(registry.catalog().map(entry => [entry.name, entry]))
  assert.equal(byName.get('mcp__github__create_issue').origin, 'mcp')
  assert.equal(byName.get('mcp__github__create_issue').server, 'github')
  assert.equal(byName.get('bash').server, undefined)
})

test('a tool seen only inside a captured assembly reports the preset layer', () => {
  const registry = registryWith({ global: [schema('bash')], scoped: [schema('bash'), schema('deploy')] })
  registry.capture({}, registry.ctx.tools.schemas({}))
  const byName = new Map(registry.catalog().map(entry => [entry.name, entry]))
  assert.equal(byName.get('bash').layer, 'global', 'a globally registered tool keeps the global layer')
  assert.equal(byName.get('deploy').layer, 'preset')
})

test('the PTC transport name never appears in the catalog', () => {
  const registry = registryWith({ global: [schema('bash'), schema('run_code')] })
  assert.deepEqual(registry.catalog().map(entry => entry.name), ['bash'])
})

test('the picker classifies an MCP tool even when the Host omits the source fields', () => {
  const legacy = { name: 'mcp__github__create_issue' }
  assert.equal(originLabel(legacy, lookup(zh)), 'MCP 服务器: github')
  assert.equal(originLabel(legacy, lookup(en)), 'MCP server: github')
  assert.equal(originLabel({ name: 'bash' }, lookup(zh)), '内置或插件工具')
  assert.equal(originLabel({ name: 'bash', origin: 'tool', server: 'x' }, lookup(zh)), '内置或插件工具')
})
