/** Catalog rows the settings page renders: origin classification, layer, and the raw schema. */
import assert from 'node:assert/strict'
import test from 'node:test'
import { SessionRegistry } from '../src/session.js'
import { en, originLabel, zh } from '../src/client.js'

/** A registry whose global layer and captured assemblies answer with fixed schemas. */
function registryWith({ global = [], scoped = [] } = {}) {
  const registrations = []
  const ctx = {
    tools: {
      schemas: scope => (scope === undefined ? global : scoped),
      register: definition => {
        registrations.push(definition.name)
        return () => registrations.splice(registrations.indexOf(definition.name), 1)
      },
      restrict: () => () => {},
      execute: async () => ({ content: [], isError: false }),
    },
  }
  const registry = new SessionRegistry({ ctx, log: {}, readConfig: () => ({ groups: [] }) })
  registry.registrations = registrations
  return registry
}

/** One agent whose context registers tools through the same stub. */
function agentOf(registry) {
  return {
    ctx: {
      tools: registry.ctx.tools,
      effect: () => {},
    },
  }
}

/** One configuration with a single fold group named `name`. */
function oneGroup(name) {
  return {
    version: 1,
    groups: [{ id: 'g1', name, kind: 'fold', tools: ['bash'], presets: ['standard'], listingForm: 'list', idleRetract: { enabled: false, rounds: 5 }, usageNote: '' }],
  }
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

test('a query tool the plugin registered itself is not offered back as a bindable tool', () => {
  const registry = registryWith({ global: [schema('bash')], scoped: [schema('bash'), schema('ov')] })
  registry.capture({}, registry.ctx.tools.schemas({}))
  registry.readConfig = () => oneGroup('ov')
  registry.install(agentOf(registry), 'standard')
  assert.deepEqual(registry.catalog().map(entry => entry.name), ['bash'])
})

test('a real tool keeps its name even when a group wants to use it', () => {
  const registry = registryWith({ global: [schema('ov'), schema('bash')] })
  assert.deepEqual(registry.catalog().map(entry => entry.name), ['bash', 'ov'])
})

test('renaming a group re-registers its query tool under the new name', () => {
  const registry = registryWith({ global: [schema('bash')] })
  const agent = agentOf(registry)
  registry.readConfig = () => oneGroup('ov')
  registry.install(agent, 'standard')
  assert.deepEqual(registry.registrations, ['ov'])
  registry.readConfig = () => oneGroup('ov_tools')
  registry.refresh(oneGroup('ov_tools'))
  assert.deepEqual(registry.registrations, ['ov_tools'])
  assert.deepEqual([...registry.sessions.get(agent).registered], ['ov_tools'])
})
