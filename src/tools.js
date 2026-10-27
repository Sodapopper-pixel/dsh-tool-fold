/** The model-facing query tool for one group: schema, description, and operation dispatch. */

/** Operations a fold group in 列举 form offers. */
const OPS_LIST = ['expand', 'retract', 'list']

/** Operations a fold group in 搜索 form offers. */
const OPS_SEARCH = ['expand', 'retract', 'find']

/** Operations an aggregate group offers. */
const OPS_AGGREGATE = ['find', 'call']

/**
 * The operations one group offers, derived from its kind and 查询形态.
 * @param group - the configured group.
 * @returns operation names in the order the description should mention them.
 */
export function operationsOf(group) {
  if (group.kind === 'aggregate') return [...OPS_AGGREGATE]
  return group.listingForm === 'search' ? [...OPS_SEARCH] : [...OPS_LIST]
}

/**
 * Build the query tool definition for one group.
 * @param options - the group plus the per-session runtime that owns its folded tools.
 * @returns a registry-ready tool definition.
 */
export function createQueryTool({ group, runtime }) {
  const operations = operationsOf(group)
  return {
    name: group.name,
    description: describeTool(group, operations),
    parameters: parameterSchema(group, operations),
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          text: { type: 'string', required: true },
          ok: { type: 'boolean', required: true },
        },
      },
      render(_args, value) {
        return [{ type: 'text', text: value.text }]
      },
    },
    async execute(args, exec) {
      const payload = typeof args === 'object' && args !== null ? args : {}
      if (!operations.includes(payload.op)) {
        throw new Error(`${group.name}: op must be one of ${operations.join(', ')}`)
      }
      switch (payload.op) {
        case 'list':
          return result(true, runtime.renderListing())
        case 'find':
          return result(true, runtime.renderSearch(String(payload.query ?? '')))
        case 'expand':
          return result(true, runtime.renderExpand(named(payload.names)))
        case 'retract':
          return result(true, runtime.renderRetract(named(payload.names)))
        case 'call':
          return result(true, await runtime.call(String(payload.tool ?? ''), payload.arguments, exec))
        default:
          throw new Error(`${group.name}: op "${String(payload.op)}" is not implemented`)
      }
    },
  }
}

/** One tool result carrying rendered text. */
function result(ok, text) {
  return { ok, text }
}

/** Read a names array without trusting the model's JSON. */
function named(value) {
  return Array.isArray(value) ? value.filter(item => typeof item === 'string') : []
}

/**
 * The description the model reads before choosing this tool.
 * Fold groups advertise their bound tools inline when the form is 列举; the 搜索 form
 * deliberately keeps the list out so a wide batch costs one short line.
 * @param group - the configured group.
 * @param operations - the operations it offers.
 * @returns the tool description.
 */
function describeTool(group, operations) {
  const ops = operations.map(op => `op="${op}"`).join(', ')
  const note = group.usageNote.trim() === '' ? '' : `\n\n${group.usageNote.trim()}`
  if (group.kind === 'aggregate') {
    return [
      `${group.name} is a folded batch of ${group.tools.length} tool(s). They are hidden from your tool list and you cannot call them directly.`,
      '',
      'Use op="find" (with an optional query) to read the usage of a bound tool, then op="call" with its name and arguments to run it — the harness executes it for you.',
      '',
      `Bound tools: ${group.tools.join(', ')}.`,
      '',
      `Available operations: ${ops}.`,
      note,
    ].filter(line => line !== '').join('\n')
  }
  const exposure = group.listingForm === 'search'
    ? 'This batch is described by a summary only; use op="find" to search it before expanding.'
    : `Bound tools: ${group.tools.join(', ')}.`
  return [
    `${group.name} holds ${group.tools.length} folded tool(s) that are not on your tool list right now.`,
    '',
    'Use op="expand" to put tools back on the tool list — they become callable on your next request, not in this turn — then op="retract" to hide them again.',
    '',
    exposure,
    '',
    `Available operations: ${ops}.`,
    note,
  ].filter(line => line !== '').join('\n')
}

/**
 * The JSON Schema for one group's arguments.
 * @param group - the configured group.
 * @param operations - the operations it offers.
 * @returns the parameter schema.
 */
function parameterSchema(group, operations) {
  const properties = {
    op: {
      type: 'string',
      enum: operations,
      description: operationsDescription(group, operations),
    },
  }
  if (operations.includes('expand') || operations.includes('retract')) {
    properties.names = {
      type: 'array',
      items: { type: 'string' },
      description: 'Tool names to act on. Omit to act on every bound tool of this group.',
    }
  }
  if (operations.includes('find')) {
    properties.query = {
      type: 'string',
      description: 'Case-insensitive text matched against tool names and descriptions. Omit to list every bound tool.',
    }
  }
  if (operations.includes('call')) {
    properties.tool = { type: 'string', description: 'The bound tool to run.' }
    properties.arguments = { type: 'object', description: "Arguments for that tool, matching the schema op=\"find\" shows." }
  }
  return { type: 'object', additionalProperties: false, properties, required: ['op'] }
}

/** One line per operation, used as the `op` field description. */
function operationsDescription(group, operations) {
  const lines = []
  for (const op of operations) {
    if (op === 'list') lines.push('list: show bound tools and which are expanded')
    if (op === 'find') lines.push('find: search bound tools by name or description')
    if (op === 'expand') lines.push('expand: put bound tools back on the tool list for your next request')
    if (op === 'retract') lines.push('retract: hide expanded tools again')
    if (op === 'call') lines.push('call: run one bound tool with the given arguments')
  }
  if (group.kind === 'aggregate') lines.push('Bound tools stay hidden; call is the only way to use them.')
  return lines.join('; ')
}
