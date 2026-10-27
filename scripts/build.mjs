/** Build the installed Host entry and the single-file browser factory from src/. */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const hostModules = ['index.js', 'store.js', 'session.js', 'tools.js', 'http.js']

/** Read one browser source and strip module syntax inside the factory scope. */
function factorySource(name) {
  const source = readFileSync(join(root, 'src', name), 'utf8').replace(/^export /gm, '')
  if (/^\s*(?:import|export)\s/m.test(source)) throw new Error(`${name}: browser sources must not use module syntax`)
  return source
}

mkdirSync(join(root, 'lib'), { recursive: true })
for (const name of hostModules) copyFileSync(join(root, 'src', name), join(root, 'lib', name))

const css = readFileSync(join(root, 'src', 'client.css'), 'utf8')
const client = `/** Generated from src/client.js and src/client.css; rebuild with scripts/build.mjs. */
window.__ModuleLoader__.load({
  id: 'dsh-tool-fold',
  factory: (require) => {
    const React = require('react')
    const CSS = ${JSON.stringify(css)}
${factorySource('client.js')}
    return { name: 'dsh-tool-fold', inject, apply }
  },
})
`
writeFileSync(join(root, 'lib', 'client.js'), client)
console.log(`Built dsh-tool-fold: ${hostModules.length} Host modules and one browser factory.`)
