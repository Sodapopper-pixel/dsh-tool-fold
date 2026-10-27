/** The runtime paths: folding keeps an aggregate group's targets hidden, while a proxied call still runs. */
import assert from 'node:assert/strict'
import test from 'node:test'
import { SessionRegistry } from '../src/session.js'

const BOUND = 'mcp__openviking__read'

/**
 * A tool registry that behaves like the Host one: restrictions hide names from the very view
 * executions resolve against, an unknown `restrict` name is rejected with the known list, and
 * a tool registered through it stays visible regardless of restrictions.
 */
function host({ tools = [BOUND, 'bash'] } = {}) {
  const globalNames = [...tools]
  const own = new Set()
  const denied = new Set()
  const calls = []
  const visibleNames = () => [...globalNames, ...own].filter(name => !denied.has(name))
  const api = {
    register(definition) {
      own.add(definition.name)
      return () => own.delete(definition.name)
    },
    restrict(filter) {
      const deny = [...(filter?.deny ?? [])]
      const known = visibleNames()
      const unknown = deny.filter(name => !known.includes(name))
      if (unknown.length > 0) {
        const quoted = unknown.map(name => `"${name}"`).join(', ')
        throw new Error(`tools.restrict() names unknown global tool${unknown.length > 1 ? 's' : ''} ${quoted}; known global tools: ${[...known].sort().join(', ') || '(none)'}`)
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
      calls.push(input.name)
      if (!visibleNames().includes(input.name)) {
        return { content: [{ type: 'text', text: `Error: unknown tool "${input.name}"` }], isError: true }
      }
      return { content: [{ type: 'text', text: `ok:${input.name}` }], isError: false }
    },
  }
  return { api, calls, own, visibleNames }
}

/** One aggregate group over `tools`, scoped to the standard preset. */
function aggregateConfig(tools) {
  return {
    version: 1,
    groups: [
      { id: 'g1', name: 'memory', kind: 'aggregate', tools, presets: ['standard'], listingForm: 'list', idleRetract: { enabled: false, rounds: 5 }, usageNote: '' },
    ],
  }
}

/** A registry over one world with one installed aggregate group. */
function installed(options = {}) {
  const world = host(options)
  const registry = new SessionRegistry({
    ctx: { tools: world.api },
    log: {},
    readConfig: () => aggregateConfig([BOUND]),
  })
  const agent = { ctx: { tools: world.api, effect: () => {} } }
  registry.install(agent, 'standard')
  const record = registry.sessions.get(agent)
  const state = [...record.groups.values()][0]
  return { world, registry, agent, record, state }
}

test('an installed aggregate group folds its bound tools', () => {
  const { world, record } = installed()
  assert.equal(world.visibleNames().includes(BOUND), false)
  assert.equal(world.own.has('memory'), true)
  assert.equal(record.available.has(BOUND), true, 'the folded tool is still known to the session')
})

test('a proxied call runs the folded tool and folds it again afterwards', async () => {
  const { world, registry, record, state } = installed()
  const result = await registry.call(record, state, BOUND, { q: 1 }, { callId: 'c1', token: 't1', agent: record.agent })
  assert.equal(result, `ok:${BOUND}`)
  assert.deepEqual(world.calls, [BOUND])
  assert.equal(world.visibleNames().includes(BOUND), false, 'the tool is hidden again after the call')
  assert.equal(record.proxying, 0)
})

test('a proxied call re-folds even when the target throws', async () => {
  const { world, registry, record, state } = installed()
  world.api.execute = async () => {
    throw new Error('boom')
  }
  await assert.rejects(() => registry.call(record, state, BOUND, {}, { callId: 'c2', token: 't2', agent: record.agent }), /boom/)
  assert.equal(world.visibleNames().includes(BOUND), false)
  assert.equal(record.proxying, 0)
})

test('a call to a tool that is not registered right now is refused with a readable message', async () => {
  const { registry, record, state } = installed()
  await assert.rejects(
    () => registry.call(record, state, 'mcp__openviking__write', {}, { callId: 'c3', token: 't3', agent: record.agent }),
    /not bound to this group/,
  )
})

test('dispose reveals folded tools and unregisters the query tool', () => {
  const { world, registry } = installed()
  registry.dispose()
  assert.equal(world.visibleNames().includes(BOUND), true)
  assert.equal(world.own.has('memory'), false)
  assert.equal(registry.sessions.size, 0)
})

test('forget lifts a session but leaves other sessions folded', () => {
  const { world, registry, agent, record } = installed()
  registry.forget(agent)
  assert.equal(registry.sessions.size, 0)
  assert.equal(world.visibleNames().includes(BOUND), true)
  assert.equal(record.proxying, 0)
})
