/** Per-agent installation: query tools, folded bindings, late registrations, and proxy calls. */

import { createQueryTool } from './tools.js'
import { collectPluginTools, describeProvider } from './origins.js'
import { groupsForPreset } from './store.js'

/** Sentinel denied name used to read the restrictable name set out of the registry's rejection message. */
const SENTINEL = 'tool_fold_probe'

/** Trailing clause of the registry's unknown-name rejection: the names that scope may restrict. */
const KNOWN_TOOLS = /; known global tools: (.*)$/s

/** Result text for a tool that produced no text block. */
const NO_TEXT = '(no text output)'

/** One description re-registration after a burst of registry changes settles, instead of one per change. */
const DESCRIPTION_DEBOUNCE_MS = 250

/**
 * Owns one record per live agent session.
 *
 * A session record holds the groups that apply to that session's preset, which bound tools
 * are folded out of the model-visible surface right now, and the cached catalog used to
 * describe them.
 */
export class SessionRegistry {
  /**
   * @param options - Host context, logger, the configuration reader, the profile's
   *   `node_modules` used to attribute tool registrations to packages, and an optional
   *   lifecycle trace sink (one line per register/release/forget decision).
   */
  constructor({ ctx, log, readConfig, nodeModules, trace = () => {} }) {
    this.ctx = ctx
    this.log = log
    this.readConfig = readConfig
    this.nodeModules = nodeModules
    this.trace = trace
    this.sessions = new Map()
    this.catalogByScope = new Map()
    this.providers = undefined
    this.depth = 0
    this.sessionCounter = 0
    this.descriptionTimer = undefined
  }

  /**
   * Tool names registered by installed packages, scanned once.
   * @returns tool name → package name, or an empty map when the scan cannot run.
   */
  pluginTools() {
    if (this.providers === undefined) {
      try {
        this.providers = collectPluginTools(this.nodeModules)
      } catch (error) {
        this.log.warn?.(`tool-fold: could not scan ${this.nodeModules} for tool providers: ${error?.message ?? error}`)
        this.providers = new Map()
      }
    }
    return this.providers
  }

  /** Whether a registry mutation is in flight, so our own `tools/change` echo is ignored. */
  get busy() {
    return this.depth > 0
  }

  /** Run a registry mutation without letting its `tools/change` echo re-enter. */
  mutating(action) {
    this.depth += 1
    try {
      return action()
    } finally {
      this.depth -= 1
    }
  }

  /**
   * Release every live session: reveal what each group folded and unregister its query tool.
   * Registrations and restrictions live on the agent's own context, which outlives this
   * plugin's fiber, so unloading the plugin must undo them here.
   */
  dispose() {
    clearTimeout(this.descriptionTimer)
    this.descriptionTimer = undefined
    for (const record of this.sessions.values()) {
      for (const id of [...record.groups.keys()]) this.releaseGroup(record, id, 'dispose')
    }
    this.sessions.clear()
  }

  /**
   * Install the groups that apply to one newly created agent session.
   * @param agent - the agent whose session was just created.
   * @param presetId - the composed preset id, if the harness named one.
   */
  install(agent, presetId) {
    if (this.sessions.has(agent)) return
    const groups = groupsForPreset(this.readConfig(), presetId)
    if (groups.length === 0) return
    const record = {
      agent,
      presetId,
      ordinal: ++this.sessionCounter,
      ownNames: new Set(),
      registered: new Set(),
      available: new Set(),
      proxying: 0,
      groups: new Map(),
    }
    this.sessions.set(agent, record)
    this.mutating(() => this.rebuild(record, groups))
    this.trace(`install session=(${agentId(record)}) options=${groups.length} groups=${groups.map(group => group.name).join(',') || '(none)'}`)
    this.log.info?.(`tool-fold: installed ${groups.length} group(s) for preset "${presetId}"`)
  }

  /**
   * Rebuild one record's group set from the current configuration.
   * Tools that stop being bound are revealed; tools that become bound are folded.
   */
  rebuild(record, groups) {
    const desired = new Map(groups.map(group => [group.id, group]))
    record.ownNames = new Set(groups.map(group => group.name))
    for (const [id, state] of record.groups) {
      if (!desired.has(id)) {
        this.releaseGroup(record, id, 'config-removed')
        this.trace(`rebuild session=(${agentId(record)}) dropped group=${state.group.name} (no longer in the configuration)`)
      }
    }
    for (const group of groups) {
      const existing = record.groups.get(group.id)
      if (existing !== undefined && existing.group.name === group.name) {
        existing.group = group
        continue
      }
      // A renamed group keeps its id but needs a new registration: the old tool name is gone.
      if (existing !== undefined) this.releaseGroup(record, group.id, 'renamed')
      const state = { group, folded: new Set(), expanded: new Set(), restrictOff: undefined, disposeTool: undefined, described: undefined, rounds: new Map() }
      record.groups.set(group.id, state)
    }
    // Probe and fold first: a registration must describe the surface as it is, and a group
    // whose bindings are all absent must not put a query tool on the surface at all.
    this.refreshBindings(record)
    for (const state of record.groups.values()) {
      if (state.described === undefined) this.registerQueryTool(record, state, 'created')
    }
  }

  /**
   * Register one group's query tool, describing only the bindings this session actually carries.
   * A tool whose plugin is uninstalled stops being callable, so leaving it in the description
   * would advertise a name that can only fail. With no bound tool present the tool is held off
   * the surface entirely: a facade with nothing behind it is noise on the model's tool list.
   * @param record - the session record owning the group.
   * @param state - the group state to register for.
   */
  registerQueryTool(record, state, reason = 'new') {
    const present = state.group.tools.filter(tool => record.available.has(tool))
    if (present.length === 0) {
      // No bound tool exists in this session: the query tool has nothing to list, search,
      // expand or call, so it stays off the model's tool surface until one shows up.
      state.disposeTool?.()
      state.disposeTool = undefined
      record.registered.delete(state.group.name)
      state.described = undefined
      this.trace(`hold session=(${agentId(record)}) group=${state.group.name} reason=${reason} bindings=0/${state.group.tools.length}`)
      return
    }
    state.disposeTool?.()
    this.trace(`register session=(${agentId(record)}) group=${state.group.name} reason=${reason} present=${present.length}/${state.group.tools.length} [${present.join(',')}]`)
    state.disposeTool = record.agent.ctx.tools.register(createQueryTool({
      group: state.group,
      runtime: this.runtimeFor(record, state),
      present,
    }))
    record.registered.add(state.group.name)
    state.described = present.join('\n')
  }

  /**
   * Re-register a group's query tool when the set of registered bindings changed.
   * A group whose last binding disappeared drops its query tool; the first binding to
   * come back puts it up again.
   * @param record - the session record owning the group.
   * @param state - the group state to check.
   * @param names - the names the session surface carries right now.
   */
  syncDescription(record, state, names) {
    const present = state.group.tools.filter(tool => names.has(tool))
    if (present.length === 0 && state.described === undefined) return
    const before = state.described === undefined || state.described === '' ? 0 : state.described.split('\n').length
    if (state.described === present.join('\n')) return
    this.trace(`describe session=(${agentId(record)}) group=${state.group.name} bindings ${before}->${present.length}`)
    this.registerQueryTool(record, state, 'bindings-changed')
  }

  /**
   * Drop one installed group: reveal what it folded and unregister its query tool.
   * @param record - the session record owning the group.
   * @param id - the group id to release.
   */
  releaseGroup(record, id, reason = 'drop') {
    const state = record.groups.get(id)
    if (state === undefined) return
    this.trace(`release session=(${agentId(record)}) group=${state.group.name} reason=${reason}`)
    this.lift(state)
    state.disposeTool?.()
    record.registered.delete(state.group.name)
    record.groups.delete(id)
  }

  /**
   * Re-read which bound tools the session's surface currently carries, then re-fold.
   * Folding is re-derived rather than accumulated so a removed binding cannot stay hidden.
   */
  refreshBindings(record) {
    if (record.agent.ctx === undefined) return
    const names = this.restrictable(record)
    record.available = names
    for (const state of record.groups.values()) {
      const bound = new Set(state.group.tools)
      for (const tool of [...state.folded]) {
        if (!bound.has(tool) || !names.has(tool)) state.folded.delete(tool)
      }
      for (const tool of state.group.tools) {
        if (!names.has(tool) || record.ownNames.has(tool)) continue
        if (!state.expanded.has(tool)) state.folded.add(tool)
      }
      for (const tool of [...state.expanded]) {
        if (!bound.has(tool) || !names.has(tool)) state.expanded.delete(tool)
      }
    }
    this.apply(record)
    this.scheduleDescriptionSync()
  }

  /**
   * Queue one description re-derivation for every session after the current burst settles.
   * An MCP server registers its tools one by one, and each step fires `tools/change`; re-registering
   * the query tool per step disposes and recreates it over and over, which reads as the query tool
   * being repeatedly unloaded. Coalescing bursts keeps one re-registration per burst instead.
   */
  scheduleDescriptionSync() {
    if (this.descriptionTimer !== undefined) return
    this.descriptionTimer = setTimeout(() => {
      this.descriptionTimer = undefined
      this.flushDescriptions()
    }, DESCRIPTION_DEBOUNCE_MS)
  }

  /** Re-derive every session's query-tool descriptions now, skipping sessions mid forwarded call. */
  flushDescriptions() {
    for (const record of this.sessions.values()) {
      if (record.proxying > 0 || record.agent.ctx === undefined) continue
      const names = record.available
      for (const state of record.groups.values()) this.syncDescription(record, state, names)
    }
  }

  /**
   * The names this agent's scope may restrict: its inherited surface before our own folding.
   * The registry validates `restrict` names against exactly this set and lists them in its
   * rejection message, which is the only enumeration a third-party plugin can reach. A Host
   * that words that rejection differently leaves us with no names, so say so loudly instead of
   * silently unfolding everything.
   * @param record - the session whose agent scope is probed.
   * @returns the restrictable names; empty when the Host's rejection could not be read.
   */
  restrictable(record) {
    try {
      const off = record.agent.ctx.tools.restrict({ deny: [SENTINEL] })
      // A tool genuinely named like the sentinel: nothing to learn, and the probe must not fold it.
      off()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const match = KNOWN_TOOLS.exec(message)
      if (match === null) {
        this.trace(`probe session=(${agentId(record)}) unreadable returning empty: ${message.slice(0, 300)}`)
        if (!record.enumerationWarned) {
          record.enumerationWarned = true
          this.log.warn?.(`tool-fold: cannot read the restrictable tool list from this Host; folding is inactive for this session (expected a "; known global tools: ..." clause): ${message}`)
        }
        return new Set()
      }
      const names = match[1].trim()
      if (names === '(none)' || names === '') return new Set()
      return new Set(names.split(',').map(name => name.trim()))
    }
    return new Set()
  }

  /** Lift every restriction this record owns. */
  liftAll(record) {
    for (const state of record.groups.values()) this.lift(state)
  }

  /** Lift one group's restriction. */
  lift(state) {
    state.restrictOff?.()
    state.restrictOff = undefined
  }

  /** Re-fold every group of one record from its folded sets. */
  apply(record) {
    for (const state of record.groups.values()) {
      this.lift(state)
      const deny = [...state.folded].filter(name => record.available.has(name) && !record.ownNames.has(name))
      if (deny.length === 0) continue
      try {
        state.restrictOff = record.agent.ctx.tools.restrict({ deny })
      } catch (error) {
        this.log.warn?.(`tool-fold: could not fold ${deny.join(', ')}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }

  /** Re-derive every live session after the configuration changed. */
  refresh(config) {
    for (const record of this.sessions.values()) {
      const groups = groupsForPreset(config, record.presetId)
      this.mutating(() => this.rebuild(record, groups))
    }
  }

  /** Re-derive every live session after the registry changed (late MCP registrations, disconnects). */
  reconcile() {
    if (this.busy) return
    for (const record of this.sessions.values()) {
      // A forwarded call reveals its target for the length of that call; re-folding now would
      // deny it again mid-flight and turn the proxy result into `UNKNOWN_TOOL`.
      if (record.proxying > 0) {
        this.trace(`skip session=(${agentId(record)}) while a forwarded call is in flight`)
        continue
      }
      this.mutating(() => this.refreshBindings(record))
    }
  }

  /** Drop a session record; the agent's own context disposes the registrations and restrictions. */
  forget(agent) {
    const record = this.sessions.get(agent)
    if (record !== undefined) {
      this.trace(`forget session=(${agentId(record)}) groups=${[...record.groups.values()].map(state => state.group.name).join(',') || '(none)'}`)
      this.liftAll(record)
    }
    this.sessions.delete(agent)
  }

  /**
   * Cache one assembly's visible tool schemas, keyed by the assembly scope.
   * Registered through `systemPrompt.tools`, which is the only place the host hands a
   * third-party plugin the scope key needed to read another scope's tool definitions.
   */
  capture(scope, schemas) {
    if (scope === undefined) return
    const catalog = new Map()
    for (const schema of schemas) catalog.set(schema.name, schema)
    this.catalogByScope.set(scope, catalog)
  }

  /** Every tool definition this plugin can currently describe, from the global layer and captured assemblies. */
  knownSchemas() {
    const merged = new Map()
    for (const schema of this.ctx.tools.schemas()) merged.set(schema.name, schema)
    for (const catalog of this.catalogByScope.values()) {
      for (const [name, schema] of catalog) if (!merged.has(name)) merged.set(name, schema)
    }
    return merged
  }

  /**
   * Query tool names this plugin registered itself across live sessions.
   * A group's own tool lands in the session scope, so the assembly captures it; the page must not
   * offer it back as a bindable tool, and a group must not be rejected for colliding with itself.
   */
  ownRegistered() {
    const names = new Set()
    for (const record of this.sessions.values()) {
      for (const name of record.registered) names.add(name)
    }
    return names
  }

  /**
   * Bound tools that no live session running this group can see.
   * A tool the group folds is absent from the assembler's view but still restrictable, so the
   * catalog cannot answer this; the per-session restriction probe can.
   * @param group - the configured group.
   * @returns the names no matching session carries, or undefined when no session runs the group yet.
   */
  unregistered(group) {
    const matching = [...this.sessions.values()].filter(record => record.groups.has(group.id))
    if (matching.length === 0) return undefined
    return group.tools.filter(tool => matching.every(record => !record.available.has(tool)))
  }

  /**
   * The catalog the settings page offers.
   * Each row carries what the page shows: the tool's own description, its raw parameter schema,
   * the protocol origin (`mcp__<server>__<tool>` names come from an MCP server), and whether the
   * assembler saw it in the global layer or only inside a preset scope. Descriptions and schemas
   * are absent for tools folded out before their first capture (expanding one teaches them).
   */
  catalog() {
    const globalSchemas = new Map()
    for (const schema of this.ctx.tools.schemas()) globalSchemas.set(schema.name, schema)
    const presetSchemas = new Map()
    for (const catalog of this.catalogByScope.values()) {
      for (const [name, schema] of catalog) {
        if (globalSchemas.has(name) || presetSchemas.has(name)) continue
        presetSchemas.set(name, schema)
      }
    }
    const entries = []
    const own = this.ownRegistered()
    const pluginTools = this.pluginTools()
    for (const [name, schema] of [...globalSchemas, ...presetSchemas]) {
      if (name === 'run_code' || own.has(name)) continue
      const server = mcpServerOf(name)
      const { kind, provider } = describeProvider(name, { server, pluginTools })
      entries.push({
        name,
        description: schema?.description ?? '',
        parameters: schema?.parameters,
        origin: server === undefined ? 'tool' : 'mcp',
        server,
        layer: globalSchemas.has(name) ? 'global' : 'preset',
        providerKind: kind,
        provider,
      })
    }
    return entries.sort((left, right) => left.name.localeCompare(right.name))
  }

  /** The per-session runtime one query tool dispatches through. */
  runtimeFor(record, state) {
    return {
      renderListing: () => this.renderListing(record, state),
      renderSearch: query => this.renderSearch(record, state, query),
      renderExpand: names => this.renderExpand(record, state, names),
      renderRetract: names => this.renderRetract(record, state, names),
      call: (name, args, exec) => this.call(record, state, name, args, exec),
    }
  }

  /** Resolve requested names against one group's bound tools. */
  resolve(state, names) {
    const bound = new Set(state.group.tools)
    const candidates = names.length === 0 ? state.group.tools : names
    const known = []
    const unknown = []
    for (const name of candidates) {
      if (bound.has(name)) known.push(name)
      else unknown.push(name)
    }
    return { known, unknown }
  }

  /** `op=list`: bound tools, expanded tools, and bindings the session surface does not carry. */
  renderListing(record, state) {
    const bound = state.group.tools
    const missing = bound.filter(tool => !record.available.has(tool))
    const expanded = [...state.expanded]
    const folded = [...state.folded]
    const lines = [
      `${state.group.name}: ${bound.length} bound tool(s).`,
      `Bound: ${bound.join(', ')}.`,
      folded.length === 0 ? 'Nothing is folded right now.' : `Folded: ${folded.join(', ')}.`,
      expanded.length === 0 ? 'Nothing is expanded right now.' : `Expanded: ${expanded.join(', ')}.`,
    ]
    if (missing.length > 0) lines.push(`Not currently registered in this session: ${missing.join(', ')}.`)
    return lines.join('\n')
  }

  /** `op=find`: search bound tools by name and description. */
  renderSearch(record, state, query) {
    const needle = query.trim().toLowerCase()
    const schemas = this.knownSchemas()
    const lines = []
    for (const tool of state.group.tools) {
      const schema = schemas.get(tool)
      const description = schema?.description ?? ''
      const haystack = `${tool}\n${description}`.toLowerCase()
      if (needle !== '' && !haystack.includes(needle)) continue
      const status = record.available.has(tool) ? 'available' : 'not registered here'
      lines.push(`- ${tool} (${status}): ${description === '' ? '(no description recorded yet — expand it once to teach this plugin)' : description}`)
    }
    if (lines.length === 0) {
      return needle === ''
        ? `${state.group.name} binds no tools.`
        : `No bound tool of ${state.group.name} matches "${query}".`
    }
    return `${lines.length} match(es) in ${state.group.name}:\n${lines.join('\n')}`
  }

  /** `op=expand`: put bound tools back on the tool surface. */
  renderExpand(record, state, names) {
    const { known, unknown } = this.resolve(state, names)
    const changed = []
    const absent = [...unknown]
    for (const tool of known) {
      if (!record.available.has(tool)) {
        absent.push(tool)
        continue
      }
      if (!state.folded.has(tool)) continue
      state.folded.delete(tool)
      state.expanded.add(tool)
      changed.push(tool)
    }
    this.mutating(() => this.apply(record))
    const lines = []
    lines.push(changed.length === 0
      ? 'Nothing to expand.'
      : `Expanded ${changed.join(', ')}. They appear on your tool list from the next request and are callable there.`)
    if (absent.length > 0) lines.push(`Not bound to ${state.group.name} or not registered in this session: ${absent.join(', ')}.`)
    return lines.join('\n')
  }

  /** `op=retract`: fold expanded tools back out. */
  renderRetract(record, state, names) {
    const { known, unknown } = this.resolve(state, names)
    const changed = []
    for (const tool of known) {
      if (!state.folded.has(tool) && !state.expanded.has(tool)) continue
      state.expanded.delete(tool)
      state.folded.add(tool)
      changed.push(tool)
    }
    this.mutating(() => this.apply(record))
    const lines = [changed.length === 0 ? 'Nothing to retract.' : `Retracted ${changed.join(', ')}.`]
    if (unknown.length > 0) lines.push(`Not bound to ${state.group.name}: ${unknown.join(', ')}.`)
    return lines.join('\n')
  }

  /**
   * `op=call`: run one bound tool through the registry on the model's behalf.
   *
   * The bound tool is folded by this plugin, and the registry resolves an execution against
   * the same agent view it folds, so a folded name would report `UNKNOWN_TOOL`. The name is
   * therefore revealed for exactly the duration of the forwarded call and folded again after,
   * whether the call succeeded or threw. The call also carries this tool's execution token as
   * `parent`, so it is a legal sub-dispatch and the target's pre-execute handlers, guards and
   * post-execute steps all run.
   */
  async call(record, state, name, args, exec) {
    if (!state.group.tools.includes(name)) {
      throw new Error(`${state.group.name}: "${name}" is not bound to this group`)
    }
    if (!record.available.has(name)) {
      throw new Error(`${state.group.name}: "${name}" is not registered in this session right now`)
    }
    const input = {
      callId: `${exec.callId}#fold`,
      name,
      arguments: args ?? {},
      agent: exec.agent ?? record.agent,
      parent: exec.token,
      signal: exec.signal,
    }
    const wasFolded = state.folded.delete(name)
    if (wasFolded) this.mutating(() => this.apply(record))
    record.proxying += 1
    try {
      const outcome = await record.agent.ctx.tools.execute(input)
      const text = textOf(outcome)
      return outcome.isError ? `Failed: ${text}` : text
    } finally {
      record.proxying -= 1
      if (wasFolded) {
        if (record.available.has(name)) state.folded.add(name)
        this.mutating(() => this.apply(record))
      }
    }
  }
}

/**
 * Short printable identity of an agent session. Agent objects do not expose stable ids, so the
 * trace tags each record with the preset it was installed for plus a per-registry ordinal —
 * enough to tell sessions apart in one log without leaking anything else.
 * @param record - the session record carrying `presetId` and `ordinal`.
 * @returns the trace label for this session.
 */
function agentId(record) {
  return `${record?.ordinal ?? '?'}/${record?.presetId ?? '?'}`
}

/**
 * The MCP server name an MCP tool name carries.
 * The client publishes MCP tools as `mcp__<server>__<tool>`, so anything else is a plugin or
 * built-in tool without a server.
 * @param name - the registered tool name.
 * @returns the server name, or undefined when the name is not an MCP tool name.
 */
function mcpServerOf(name) {
  const match = /^mcp__(.+?)__/.exec(name)
  return match === null ? undefined : match[1]
}

/** Join a tool result's text blocks, falling back to its structured value. */
function textOf(outcome) {  const blocks = Array.isArray(outcome?.content) ? outcome.content : []
  const text = blocks
    .map(block => (block?.type === 'text' ? String(block.text ?? '') : `[${String(block?.type ?? 'block')}]`))
    .join('\n')
    .trim()
  if (text !== '') return text
  try {
    return JSON.stringify(outcome?.value ?? null)
  } catch {
    return NO_TEXT
  }
}
