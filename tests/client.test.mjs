/** Settings-page copy and the preset-name resolution it renders. */
import assert from 'node:assert/strict'
import test from 'node:test'
import { en, presetLabel, zh } from '../src/client.js'

/** A copy lookup over one dictionary, mirroring how the page resolves keys. */
const lookup = dictionary => key => dictionary[key] ?? key

test('a shipped preset without its own name renders the localized name', () => {
  for (const [id, enName, zhName] of [
    ['standard', 'Standard mode', '标准模式'],
    ['ptc', 'PTC mode', 'PTC 模式'],
    ['minimal', 'Minimal mode', '极简模式'],
    ['cordis', 'Creator mode', '创造模式'],
  ]) {
    assert.equal(presetLabel({ id }, lookup(en)), enName)
    assert.equal(presetLabel({ id }, lookup(zh)), zhName)
  }
})

test('a preset that publishes its own name keeps it untranslated', () => {
  const named = { id: 'standard', name: 'Our own mode' }
  assert.equal(presetLabel(named, lookup(zh)), 'Our own mode')
})

test('an unknown preset without a name falls back to its id', () => {
  assert.equal(presetLabel({ id: 'study' }, lookup(zh)), 'study')
})

test('both dictionaries carry every key the page reads', () => {
  const keys = Object.keys(en).sort()
  assert.deepEqual(Object.keys(zh).sort(), keys, 'zh must translate every en key')
  for (const key of keys) assert.match(zh[key], /\S/, `zh.${key} is empty`)
})
