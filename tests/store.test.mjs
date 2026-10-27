/** Behaviour of the pure configuration layer and the query tool definition. */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  boundToolNames, emptyConfig, groupsForPreset, normalizeConfig, normalizeGroup, validateConfig,
} from '../src/store.js'
import { createQueryTool, operationsOf } from '../src/tools.js'

/** A valid group used as the base for field-level edits. */
function group(overrides = {}) {
  return {
    id: 'g1',
    name: 'github',
    kind: 'fold',
    tools: ['mcp__github__list_issues'],
    presets: ['standard'],
    listingForm: 'list',
    idleRetract: { enabled: false, rounds: 5 },
    usageNote: '',
    ...overrides,
  }
}

/** The registry facts a save is validated against. */
function context(overrides = {}) {
  return {
    toolNames: new Set(['todo_write', 'mcp__github__list_issues']),
    presetIds: new Set(['standard', 'minimal']),
    ...overrides,
  }
}

test('an empty configuration is valid and has no groups', () => {
  const config = emptyConfig()
  assert.deepEqual(config.groups, [])
  assert.deepEqual(validateConfig(config, context()), [])
})

test('normalization drops unknown fields and clamps the idle threshold', () => {
  const config = normalizeConfig({
    groups: [group({ stale: true, idleRetract: { enabled: true, rounds: 0 } })],
    unknownTopLevel: 1,
  })
  assert.equal(config.groups.length, 1)
  assert.equal(config.groups[0].stale, undefined)
  assert.equal(config.groups[0].idleRetract.rounds, 1)
  assert.equal(config.unknownTopLevel, undefined)
})

test('normalization de-duplicates bound tools and presets', () => {
  const normalized = normalizeGroup(group({ tools: ['a', 'a', 'b'], presets: ['standard', 'standard'] }))
  assert.deepEqual(normalized.tools, ['a', 'b'])
  assert.deepEqual(normalized.presets, ['standard'])
})

test('an unnamed group cannot be saved', () => {
  const problems = validateConfig({ ...emptyConfig(), groups: [group({ name: '' })] }, context())
  assert.deepEqual(problems.map(problem => problem.code), ['name-required'])
})

test('an unusable tool name is rejected', () => {
  for (const name of ['has space', '1leading', 'dash-name']) {
    const problems = validateConfig({ ...emptyConfig(), groups: [group({ name })] }, context())
    assert.ok(problems.some(problem => problem.code === 'name-invalid'), `${name} should be invalid`)
  }
})

test('the PTC transport name is reserved for both the group and its bindings', () => {
  const reservedGroup = validateConfig({ ...emptyConfig(), groups: [group({ name: 'run_code' })] }, context())
  assert.ok(reservedGroup.some(problem => problem.code === 'name-reserved'))
  const reservedTool = validateConfig({
    ...emptyConfig(),
    groups: [group({ tools: ['run_code'] })],
  }, context())
  assert.ok(reservedTool.some(problem => problem.code === 'tool-reserved'))
})

test('two groups cannot share a query tool name', () => {
  const problems = validateConfig({
    ...emptyConfig(),
    groups: [group(), group({ id: 'g2', tools: ['todo_write'] })],
  }, context())
  assert.ok(problems.some(problem => problem.code === 'name-duplicate'))
})

test('a query tool name cannot collide with a registered tool', () => {
  const problems = validateConfig({ ...emptyConfig(), groups: [group({ name: 'todo_write' })] }, context())
  assert.ok(problems.some(problem => problem.code === 'name-collides-tool'))
})

test('a tool belongs to one group only, across both kinds', () => {
  const problems = validateConfig({
    ...emptyConfig(),
    groups: [
      group(),
      group({ id: 'g2', name: 'issues', kind: 'aggregate', tools: ['mcp__github__list_issues'] }),
    ],
  }, context())
  assert.deepEqual(problems.map(problem => problem.code), ['tool-duplicate'])
})

test('a group with no bound tools cannot be saved', () => {
  const problems = validateConfig({ ...emptyConfig(), groups: [group({ tools: [] })] }, context())
  assert.ok(problems.some(problem => problem.code === 'tools-empty'))
})

test('a group cannot bind its own query tool name', () => {
  const problems = validateConfig({
    ...emptyConfig(),
    groups: [group({ tools: ['github'] })],
  }, context())
  assert.ok(problems.some(problem => problem.code === 'tool-self'))
})

test('scoping to an unknown preset is rejected', () => {
  const problems = validateConfig({ ...emptyConfig(), groups: [group({ presets: ['ghost'] })] }, context())
  assert.deepEqual(problems.map(problem => problem.code), ['preset-unknown'])
})

test('a group applies only to the presets it names', () => {
  const config = { ...emptyConfig(), groups: [group()] }
  assert.equal(groupsForPreset(config, 'standard').length, 1)
  assert.equal(groupsForPreset(config, 'minimal').length, 0)
  assert.equal(groupsForPreset(config, undefined).length, 0)
  assert.equal(groupsForPreset(config, '').length, 0)
})

test('tool ownership is reported per bound tool', () => {
  const config = { ...emptyConfig(), groups: [group()] }
  assert.equal(boundToolNames(config).get('mcp__github__list_issues'), 'g1')
})

test('operations follow the group kind and the query form', () => {
  assert.deepEqual(operationsOf(group()), ['expand', 'retract', 'list'])
  assert.deepEqual(operationsOf(group({ listingForm: 'search' })), ['expand', 'retract', 'find'])
  assert.deepEqual(operationsOf(group({ kind: 'aggregate' })), ['find', 'call'])
})

test('the query tool advertises its bound tools and hides the aggregate batch', () => {
  const foldTool = createQueryTool({ group: group(), runtime: stubRuntime() })
  assert.equal(foldTool.name, 'github')
  assert.match(foldTool.description, /mcp__github__list_issues/)
  const aggregate = createQueryTool({ group: group({ kind: 'aggregate' }), runtime: stubRuntime() })
  assert.match(aggregate.description, /cannot call them directly/)
  assert.deepEqual(aggregate.parameters.properties.op.enum, ['find', 'call'])
  assert.ok(aggregate.parameters.properties.arguments !== undefined)
})

test('the query tool reports rendered text through its output contract', async () => {
  const tool = createQueryTool({ group: group(), runtime: stubRuntime() })
  assert.deepEqual(tool.output.render({}, { ok: true, text: 'hello' }), [{ type: 'text', text: 'hello' }])
  assert.deepEqual(await tool.execute({ op: 'list' }, {}), { ok: true, text: 'listing' })
  assert.deepEqual(await tool.execute({ op: 'expand', names: ['a'] }, {}), { ok: true, text: 'expanded a' })
  await assert.rejects(() => tool.execute({ op: 'call' }, {}), /op must be one of/)
})

/** A runtime whose operations answer with predictable text. */
function stubRuntime() {
  return {
    renderListing: () => 'listing',
    renderSearch: query => `search:${query}`,
    renderExpand: names => `expanded ${names.join(',')}`,
    renderRetract: names => `retracted ${names.join(',')}`,
    call: (name, args) => `called ${name} with ${JSON.stringify(args ?? null)}`,
  }
}
