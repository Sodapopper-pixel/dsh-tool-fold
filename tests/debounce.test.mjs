/** The description re-derivation coalesces a burst of registry changes into one re-registration. */
import assert from 'node:assert/strict'
import test from 'node:test'
import { SessionRegistry } from '../src/session.js'

const TOOLS = ['mcp__openviking__read', 'mcp__openviking__write', 'mcp__openviking__list', 'mcp__openviking__search']

/** A tool registry that behaves like the Host one, counting query-tool registrations. */
function host() {
  const globalNames = [TOOLS[0]]
  const own = new Set()
  const denied = new Set()
  let registrations = 0
  const visibleNames = () => [...globalNames, ...own].filter(name => !denied.has(name))
  return {
    visibleNames,
    registrations: () => registrations,
    add(name) {
      if (!globalNames.includes(name)) globalNames.push(name)
    },
    api: {
      register(definition) {
        own.add(definition.name)
        registrations += 1
        return () => {
          own.delete(definition.name)
        }
      },
      restrict(filter) {
        // The Host lists the inheritable surface before this plugin's own folding, so `known`
        // ignores `denied`: an MCP registration is visible to the probe the moment it exists.
        const deny = [...(filter?.deny ?? [])]
        const unknown = deny.filter(name => !globalNames.includes(name))
        if (unknown.length > 0) {
          const quoted = unknown.map(name => `"${name}"`).join(', ')
          throw new Error(`tools.restrict() names unknown global tools ${quoted}; known global tools: ${[...globalNames].sort().join(', ') || '(none)'}`)
        }
        for (const name of deny) denied.add(name)
        return () => {
          for (const name of deny) denied.delete(name)
        }
      },
      schemas() {
        return visibleNames().map(name => ({ name, description: name, parameters: { type: 'object' } }))
      },
      async execute(input) {
        return { content: [{ type: 'text', text: `ok:${input.name}` }], isError: false }
      },
    },
  }
}

test('a burst of registry changes re-registers the query tool once', () => {
  const world = host()
  const registry = new SessionRegistry({
    ctx: { tools: world.api },
    log: {},
    readConfig: () => ({
      version: 1,
      groups: [
        { id: 'g1', name: 'memory', kind: 'fold', tools: TOOLS, presets: ['standard'], listingForm: 'list', idleRetract: { enabled: false, rounds: 5 }, usageNote: '' },
      ],
    }),
  })
  const agent = { ctx: { tools: world.api, effect: () => {} } }
  registry.install(agent, 'standard')
  registry.flushDescriptions()
  const before = world.registrations()
  // One MCP server registering its tools one by one: each step fires `tools/change`.
  for (const tool of TOOLS.slice(1)) {
    world.add(tool)
    registry.reconcile()
  }
  registry.flushDescriptions()
  assert.equal(world.registrations() - before, 1, `expected one coalesced registration, got ${world.registrations() - before}`)
})
