/** Host half: persist the group configuration, fold tools per agent session, and serve the settings API. */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { emptyConfig, normalizeConfig, validateConfig } from './store.js'
import { SessionRegistry } from './session.js'
import { HttpError, readJsonBody, refused, sendJson } from './http.js'

/** Cordis function-plugin name. */
export const name = 'tool-fold'

/** Host services this plugin cannot work without; `systemPrompt` and `agentPresets` are optional. */
export const inject = ['tools', 'webServer', 'connection']

const ROUTE_STATE = '/tool-fold/state'
const ROUTE_CONFIG = '/tool-fold/config'

/** The Harness home directory, honouring the same override the rest of the Host uses. */
function dshHome() {
  const configured = process.env.DSH_HOME
  return configured !== undefined && configured !== '' ? configured : join(homedir(), '.dsh')
}

/**
 * Where this plugin keeps its configuration.
 * Settings live beside the other Harness home state, never inside the installation.
 * @returns the directory and configuration file paths.
 */
export function dataPaths() {
  const directory = join(dshHome(), 'tool-fold')
  return { directory, config: join(directory, 'config.json') }
}

/**
 * Mount the fold runtime, the assembly capture hook, and the settings routes.
 * @param ctx - Host context providing the tool registry, the Web carrier, and connection admission.
 */
export function apply(ctx) {
  const log = ctx.logger ?? console
  const paths = dataPaths()
  const registry = new SessionRegistry({ ctx, log, readConfig: () => config })
  let config = emptyConfig()
  const ready = load().catch((error) => {
    log.warn?.(`tool-fold: could not read ${paths.config}: ${messageOf(error)}`)
    return config
  })

  /** Read the configuration file, falling back to an empty configuration. */
  async function load() {
    try {
      const text = await readFile(paths.config, 'utf8')
      config = normalizeConfig(JSON.parse(text))
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
      config = emptyConfig()
    }
    return config
  }

  /** Write the configuration atomically so a crash cannot leave a half-written file. */
  async function persist(next) {
    await mkdir(dirname(paths.config), { recursive: true })
    const temporary = `${paths.config}.tmp`
    await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
    await rename(temporary, paths.config)
    config = next
  }

  const presets = () => ctx.get('agentPresets')

  /**
   * The presets the page may scope a group to.
   * `name` is omitted for a preset that declares none: those are the shipped presets, whose
   * display copy the page localizes. Substituting the id here would erase that distinction.
   */
  async function presetList() {
    const service = presets()
    if (service === undefined) return []
    try {
      const list = await service.list()
      return list.map(preset => ({
        id: preset.id,
        ...preset.name === undefined ? {} : { name: preset.name },
      }))
    } catch (error) {
      log.warn?.(`tool-fold: could not list presets: ${messageOf(error)}`)
      return []
    }
  }

  /** One page snapshot: configuration, selectable tools, presets, and current problems. */
  async function state() {
    const presetsAvailable = await presetList()
    const catalog = registry.catalog()
    const problems = validateConfig(config, {
      toolNames: new Set(catalog.map(entry => entry.name)),
      presetIds: new Set(presetsAvailable.map(preset => preset.id)),
    })
    return {
      config,
      catalog,
      presets: presetsAvailable,
      problems,
      path: paths.config,
      livePresets: [...registry.sessions.values()].map(record => record.presetId),
    }
  }

  /** Accept a page edit: normalize, validate against the live registry, persist, and re-derive sessions. */
  async function save(body) {
    const next = normalizeConfig(body)
    const presetsAvailable = await presetList()
    const problems = validateConfig(next, {
      toolNames: new Set(registry.knownSchemas().keys()),
      presetIds: new Set(presetsAvailable.map(preset => preset.id)),
    })
    if (problems.length > 0) throw new HttpError(400, 'config-invalid', problems.map(problem => problem.message).join('\n'))
    await persist(next)
    registry.refresh(next)
    return state()
  }

  if (ctx.get('systemPrompt') !== undefined) {
    const prompt = ctx.get('systemPrompt')
    ctx.effect(() => prompt.tools((context) => {
      if (context.scope !== undefined) registry.capture(context.scope, ctx.tools.schemas(context.scope))
      // The registry reads `result.schemas` unconditionally on every assembly, so a provider
      // that observes the scope must still contribute an empty surface rather than `undefined`.
      return { schemas: [] }
    }), 'tool-fold: capture assembled tool surfaces')
  }

  ctx.effect(() => {
    const off = ctx.on('agent/created', ({ agent }) => {
      void (async () => {
        try {
          await ready
          const presetId = presets()?.composedPreset(agent.ctx)
          registry.install(agent, presetId)
        } catch (error) {
          log.warn?.(`tool-fold: could not install folds for a new session: ${messageOf(error)}`)
        }
      })()
    })
    return off
  }, 'tool-fold: agent/created')

  ctx.effect(() => ctx.on('tools/change', () => {
    registry.reconcile()
  }), 'tool-fold: tools/change')

  ctx.effect(() => () => {
    registry.sessions.clear()
  }, 'tool-fold: release session records')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: ROUTE_STATE,
    handler: async (req, res) => {
      if (refused(ctx, req, res)) return
      if (req.method !== 'GET') {
        sendJson(res, 405, { code: 'method-not-allowed', message: 'use GET' })
        return
      }
      try {
        await ready
        sendJson(res, 200, await state())
      } catch (error) {
        log.warn?.(`tool-fold: state read failed: ${messageOf(error)}`)
        sendJson(res, 500, { code: 'state-failed', message: 'could not read the tool fold configuration' })
      }
    },
  }), `tool-fold: GET ${ROUTE_STATE}`)

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: ROUTE_CONFIG,
    handler: async (req, res) => {
      if (refused(ctx, req, res)) return
      if (req.method !== 'POST') {
        sendJson(res, 405, { code: 'method-not-allowed', message: 'use POST' })
        return
      }
      try {
        await ready
        sendJson(res, 200, await save(await readJsonBody(req)))
      } catch (error) {
        if (error instanceof HttpError) {
          sendJson(res, error.status, { code: error.code, message: error.message })
          return
        }
        log.warn?.(`tool-fold: save failed: ${messageOf(error)}`)
        sendJson(res, 500, { code: 'save-failed', message: 'could not save the tool fold configuration' })
      }
    },
  }), `tool-fold: POST ${ROUTE_CONFIG}`)
}

/** Read a message out of an unknown thrown value. */
function messageOf(error) {
  return error instanceof Error ? error.message : String(error)
}
