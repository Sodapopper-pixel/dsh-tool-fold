/** Host-entry contract: the prompt provider, and the tool definitions the registry accepts. */
import assert from 'node:assert/strict'
import test from 'node:test'
import { apply } from '../src/index.js'
import { createQueryTool } from '../src/tools.js'

/** A Host context stub that records the `systemPrompt.tools` provider the plugin registers. */
function hostStub(options = {}) {
  const registered = []
  const routes = []
  const stub = {
    logger: { warn() {}, info() {} },
    get(name) {
      if (name === 'systemPrompt') {
        return { tools(provider) { registered.push(provider); return () => {} } }
      }
      if (name === 'agentPresets' && options.presets !== undefined) {
        return { list: async () => options.presets, composedPreset: () => undefined }
      }
      return undefined
    },
    effect(run) { return run() },
    on() { return () => {} },
    tools: { schemas: () => [], register: () => () => {}, restrict: () => () => {} },
    webServer: { register: route => { routes.push(route); return () => {} } },
    connection: { requestRejection: () => undefined },
  }
  return { stub, registered, routes }
}

/** Answer one registered route with a fake request. */
async function callRoute(routes, path) {
  const route = routes.find(item => item.path === path)
  assert.notEqual(route, undefined, `no route registered for ${path}`)
  let resolve
  const done = new Promise((done) => { resolve = done })
  const res = {
    statusCode: 0,
    setHeader() {},
    end(payload) { resolve(payload) },
  }
  await route.handler({ method: 'GET', headers: { host: '127.0.0.1:3080' } }, res)
  return { status: res.statusCode, body: JSON.parse(await done) }
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

test('a preset that declares no name keeps it absent, so the page localizes it', async () => {
  const { stub, routes } = hostStub({
    presets: [
      { id: 'standard' },
      { id: 'minimal' },
      { id: 'study', name: '学习模式' },
    ],
  })
  apply(stub)
  const { status, body } = await callRoute(routes, '/tool-fold/state')
  assert.equal(status, 200)
  assert.deepEqual(body.presets, [
    { id: 'standard' },
    { id: 'minimal' },
    { id: 'study', name: '学习模式' },
  ], 'substituting the id for an absent name would disable the page localization')
})
