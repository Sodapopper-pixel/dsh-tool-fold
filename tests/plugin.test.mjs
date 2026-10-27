/** Host-entry contract: the prompt provider, and the tool definitions the registry accepts. */
import assert from 'node:assert/strict'
import test from 'node:test'
import { apply } from '../src/index.js'
import { createQueryTool } from '../src/tools.js'

/** A Host context stub that records the `systemPrompt.tools` provider the plugin registers. */
function hostStub() {
  const registered = []
  const stub = {
    logger: { warn() {}, info() {} },
    get(name) {
      if (name === 'systemPrompt') {
        return { tools(provider) { registered.push(provider); return () => {} } }
      }
      return undefined
    },
    effect(run) { return run() },
    on() { return () => {} },
    tools: { schemas: () => [], register: () => () => {}, restrict: () => () => {} },
    webServer: { register: () => () => {} },
    connection: { requestRejection: () => undefined },
  }
  return { stub, registered }
}

test('the prompt provider contributes an empty surface instead of undefined', () => {
  const { stub, registered } = hostStub()
  apply(stub)
  assert.equal(registered.length, 1, 'the plugin registers exactly one tool provider')
  const result = registered[0]({ scope: {} })
  assert.notEqual(result, undefined, 'the registry reads result.schemas unconditionally')
  assert.deepEqual(result.schemas, [])
})

test('the provider tolerates a scope-less assembly', () => {
  const { stub, registered } = hostStub()
  apply(stub)
  assert.deepEqual(registered[0]({}), { schemas: [] })
})

test('the query tool declares required keys as a schema-level array', () => {
  const tool = createQueryTool({
    group: {
      id: 'g1', name: 'github', kind: 'fold', tools: ['a'], presets: ['standard'],
      listingForm: 'list', idleRetract: { enabled: false, rounds: 5 }, usageNote: '',
    },
    runtime: {},
  })
  assert.deepEqual(tool.output.schema.required, ['ok', 'text'])
  assert.equal(tool.output.schema.properties.text.required, undefined)
  assert.equal(tool.output.schema.properties.ok.required, undefined)
})
