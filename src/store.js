/** Group configuration: defaults, normalization, and validation. Pure — this module performs no I/O. */

/** The two group kinds. */
export const KINDS = Object.freeze(['fold', 'aggregate'])

/** How a fold group presents its bound tools to the model. */
export const LISTING_FORMS = Object.freeze(['list', 'search'])

/** Upper bound for the idle-retract threshold, so a typo cannot outlive a session. */
export const MAX_ROUNDS = 200

/** Default idle-retract threshold in turns. */
export const DEFAULT_ROUNDS = 5

/** A query tool name is a tool name: letters, digits and underscores, not starting with a digit. */
const GROUP_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,47}$/

/** Tool name the harness reserves for the PTC presentation transport. */
const RESERVED_NAME = 'run_code'

/**
 * A configuration with no groups.
 * @returns a fresh, mutable configuration.
 */
export function emptyConfig() {
  return {
    version: 1,
    groups: [],
    defaults: { listingForm: 'list', idleRetract: { enabled: false, rounds: DEFAULT_ROUNDS } },
  }
}

/** Whether `value` is a non-empty string. */
function filled(value) {
  return typeof value === 'string' && value.trim() !== ''
}

/** Keep only the strings in an array of unknown values. */
function strings(value) {
  return Array.isArray(value) ? value.filter(item => typeof item === 'string') : []
}

/**
 * Normalize one stored group into the current shape.
 * Unknown fields are dropped so an older file cannot smuggle stale keys forward.
 * @param raw - one stored group.
 * @param fallback - defaults applied to absent fields.
 * @returns the normalized group.
 */
export function normalizeGroup(raw, fallback = emptyConfig().defaults) {
  const kind = KINDS.includes(raw?.kind) ? raw.kind : 'fold'
  const listingForm = LISTING_FORMS.includes(raw?.listingForm) ? raw.listingForm : fallback.listingForm
  const rounds = Number.isInteger(raw?.idleRetract?.rounds) ? raw.idleRetract.rounds : fallback.idleRetract.rounds
  return {
    id: filled(raw?.id) ? raw.id : '',
    name: filled(raw?.name) ? raw.name.trim() : '',
    kind,
    tools: [...new Set(strings(raw?.tools))],
    presets: [...new Set(strings(raw?.presets))],
    listingForm,
    idleRetract: {
      enabled: raw?.idleRetract?.enabled === true,
      rounds: Math.min(Math.max(rounds, 1), MAX_ROUNDS),
    },
    usageNote: typeof raw?.usageNote === 'string' ? raw.usageNote : '',
  }
}

/**
 * Normalize a stored configuration.
 * @param raw - the parsed file contents, or `undefined` for a missing file.
 * @returns a configuration whose every field has a usable value.
 */
export function normalizeConfig(raw) {
  const defaults = normalizeDefaults(raw?.defaults)
  const groups = Array.isArray(raw?.groups) ? raw.groups.map(group => normalizeGroup(group, defaults)) : []
  return { version: 1, groups, defaults }
}

/** Normalize the per-installation defaults. */
function normalizeDefaults(raw) {
  const base = emptyConfig().defaults
  return {
    listingForm: LISTING_FORMS.includes(raw?.listingForm) ? raw.listingForm : base.listingForm,
    idleRetract: {
      enabled: raw?.idleRetract?.enabled === true,
      rounds: Number.isInteger(raw?.idleRetract?.rounds)
        ? Math.min(Math.max(raw.idleRetract.rounds, 1), MAX_ROUNDS)
        : base.idleRetract.rounds,
    },
  }
}

/**
 * Validate a normalized configuration against the live registry.
 * @param config - the configuration to check.
 * @param context - current facts: every registered tool name and every preset id.
 * @returns one entry per problem; an empty array means the configuration is saveable.
 */
export function validateConfig(config, context) {
  const toolNames = context?.toolNames ?? new Set()
  const presetIds = context?.presetIds ?? new Set()
  const problems = []
  const seenNames = new Map()
  const boundBy = new Map()
  for (const group of config.groups) {
    const name = group.name
    const where = name === '' ? '(unnamed group)' : name
    if (name === '') {
      problems.push({ code: 'name-required', groupId: group.id, message: `A group needs a query tool name.` })
    } else if (!GROUP_NAME.test(name)) {
      problems.push({ code: 'name-invalid', groupId: group.id, message: `"${name}" is not a usable tool name: use letters, digits and underscores, starting with a letter or underscore.` })
    } else if (name === RESERVED_NAME) {
      problems.push({ code: 'name-reserved', groupId: group.id, message: `"${name}" is reserved by the harness for PTC mode.` })
    }
    if (name !== '' && seenNames.has(name)) {
      problems.push({ code: 'name-duplicate', groupId: group.id, message: `Two groups both want the query tool name "${name}".` })
    }
    if (name !== '') seenNames.set(name, group.id)
    if (name !== '' && name !== RESERVED_NAME && toolNames.has(name)) {
      problems.push({ code: 'name-collides-tool', groupId: group.id, message: `The query tool name "${name}" is already a registered tool; pick another name.` })
    }
    if (group.tools.length === 0) {
      problems.push({ code: 'tools-empty', groupId: group.id, message: `${where} binds no tools, so it would do nothing.` })
    }
    for (const tool of group.tools) {
      if (boundBy.has(tool)) {
        problems.push({ code: 'tool-duplicate', groupId: group.id, tool, message: `"${tool}" is already bound to "${boundBy.get(tool)}"; a tool belongs to one group only.` })
      } else {
        boundBy.set(tool, where)
      }
      if (tool === RESERVED_NAME) {
        problems.push({ code: 'tool-reserved', groupId: group.id, tool, message: `"${tool}" cannot be folded: the harness reserves it for PTC mode.` })
      }
      if (tool === name) {
        problems.push({ code: 'tool-self', groupId: group.id, tool, message: `"${tool}" is the group's own query tool and cannot also be bound.` })
      }
    }
    for (const preset of group.presets) {
      if (!presetIds.has(preset)) {
        problems.push({ code: 'preset-unknown', groupId: group.id, message: `${where} scopes to unknown preset "${preset}".` })
      }
    }
  }
  return problems
}

/**
 * The groups that apply to a session of the given preset.
 * A group with no 生效预设 applies nowhere: scoping is explicit, never a default.
 * @param config - the current configuration.
 * @param presetId - the session's composed preset id, if any.
 * @returns the matching groups.
 */
export function groupsForPreset(config, presetId) {
  if (presetId === undefined || presetId === '') return []
  return config.groups.filter(group => group.presets.includes(presetId))
}

/**
 * Map every bound tool name to the id of the group that owns it.
 * @param config - the current configuration.
 * @returns tool name to group id.
 */
export function boundToolNames(config) {
  const owned = new Map()
  for (const group of config.groups) {
    for (const tool of group.tools) owned.set(tool, group.id)
  }
  return owned
}
