/** Browser half: the Tool fold settings page (group list, tool picker, preset scoping). */

/** Locale namespace for this plugin. */
export const NS = 'toolFold'

/** Settings page copy; English is the key source. */
export const en = {
  nav: 'Tool fold',
  title: 'Tool fold',
  intro: 'Fold a batch of registered tools into one query tool, per agent preset. Folded tools leave the model\'s tool list until a session expands them; an aggregate group keeps them hidden and calls them on the model\'s behalf.',
  path: 'Configuration file',
  save: 'Save',
  saving: 'Saving…',
  reload: 'Reload',
  saved: 'Saved.',
  defaults: 'Defaults for new groups',
  listingForm: 'Query form',
  formList: 'List tool names',
  formSearch: 'Summary with search',
  idleRetract: 'Retract expanded tools after idle turns',
  idleRounds: 'Idle turns',
  groups: 'Groups',
  empty: 'No groups yet. A group folds a batch of tools; nothing is folded until a group claims a preset.',
  addFold: 'Add fold group',
  addAggregate: 'Add aggregate group',
  remove: 'Remove',
  name: 'Query tool name',
  nameHint: 'The model sees this name. Letters, digits and underscores.',
  kind: 'Kind',
  kindFold: 'Fold group (reveal on demand)',
  kindAggregate: 'Aggregate group (proxy only)',
  presets: 'Applies to presets',
  presetsEmpty: 'No presets reported by this Host. A group without a preset never applies.',
  tools: 'Bound tools',
  toolFilter: 'Filter tools',
  toolManual: 'Add a tool name',
  toolAdd: 'Add',
  toolsEmpty: 'Bind at least one tool.',
  usageNote: 'Extra usage note',
  usageNoteHint: 'Prepended to what the model reads for this group. Leave empty to use only the tool descriptions.',
  missing: 'Bound but not registered in this session',
  problems: 'Cannot save',
  loadFailed: 'Could not read the configuration',
  saveFailed: 'Could not save the configuration',
  bound: 'bound',
  noDescription: 'no description recorded yet',
}

/** Simplified Chinese copy. */
export const zh = {
  nav: '工具折叠',
  title: '工具折叠',
  intro: '按代理预设把一批已注册工具折叠成一个查询工具。被折叠的工具会离开模型的工具列表，直到会话把它们展开；聚合组则永不展开，由它代模型执行。',
  path: '配置文件',
  save: '保存',
  saving: '保存中…',
  reload: '重新读取',
  saved: '已保存。',
  defaults: '新组的默认值',
  listingForm: '查询形态',
  formList: '列举工具名',
  formSearch: '概括加搜索',
  idleRetract: '闲置若干轮后自动收回已展开的工具',
  idleRounds: '闲置轮数',
  groups: '折叠组',
  empty: '还没有组。组用来折叠一批工具；绑定预设之前不会生效。',
  addFold: '新增折叠组',
  addAggregate: '新增聚合组',
  remove: '删除',
  name: '查询工具名',
  nameHint: '模型看到的就是这个名字，只能用字母、数字与下划线。',
  kind: '类型',
  kindFold: '折叠组（按需展开）',
  kindAggregate: '聚合组（只代执行）',
  presets: '生效预设',
  presetsEmpty: '本宿主没有报告任何预设。不绑定预设的组不会生效。',
  tools: '绑定工具',
  toolFilter: '筛选工具',
  toolManual: '手动添加工具名',
  toolAdd: '添加',
  toolsEmpty: '至少绑定一个工具。',
  usageNote: '补充用法说明',
  usageNoteHint: '会加在模型读到的该组说明前面。留空则只用工具自身的描述。',
  missing: '已绑定但本会话未注册',
  problems: '无法保存',
  loadFailed: '读取配置失败',
  saveFailed: '保存配置失败',
  bound: '已绑定',
  noDescription: '尚无描述记录',
}

/** New group id; ids are local and never reach the model. */
let sequence = 0

/** A fresh group with the current defaults. */
function newGroup(kind, defaults) {
  sequence += 1
  return {
    id: `g${Date.now().toString(36)}${sequence}`,
    name: '',
    kind,
    tools: [],
    presets: [],
    listingForm: defaults.listingForm,
    idleRetract: { enabled: defaults.idleRetract.enabled, rounds: defaults.idleRetract.rounds },
    usageNote: '',
  }
}

/** POST/GET JSON, raising the Host's own message on failure. */
async function requestJson(url, init) {
  const response = await fetch(url, init)
  const text = await response.text()
  let body = {}
  if (text.trim() !== '') {
    try {
      body = JSON.parse(text)
    } catch {
      throw new Error(`${url}: response was not JSON`)
    }
  }
  if (!response.ok) throw new Error(body?.message ?? `${url}: ${response.status}`)
  return body
}

/** Element id of the injected stylesheet. */
const STYLE_ID = 'dsh-tool-fold/style'

/** Inject the page stylesheet once per document; the returned disposer removes it. */
function injectStyle() {
  const existing = document.getElementById(STYLE_ID)
  if (existing !== null) return () => {}
  const element = document.createElement('style')
  element.id = STYLE_ID
  element.textContent = CSS
  document.head.append(element)
  return () => { element.remove() }
}

/** Client plugin entry points. */
export const inject = ['slots', 'locale']

/**
 * Mount the settings page.
 * @param ctx - browser plugin context with the slot registry and locale service.
 */
export function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'tool-fold: dictionaries')
  ctx.effect(() => injectStyle(), 'tool-fold: styles')
  const copy = () => {
    const active = ctx.locale.getSnapshot().active
    return String(active).toLowerCase().startsWith('zh') ? zh : en
  }
  const t = key => copy()[key] ?? en[key] ?? key
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'tool-fold',
    order: 45,
    label: () => t('nav'),
    locale: NS,
    inject: () => ({ t, requestJson }),
  }, ToolFoldSection))
}

/**
 * The settings page: defaults, group cards, and a save that re-derives every live session.
 * @param props - injected copy lookup and JSON request helper.
 */
function ToolFoldSection(props) {
  const { t, requestJson } = props
  const [state, setState] = React.useState(null)
  const [draft, setDraft] = React.useState(null)
  const [busy, setBusy] = React.useState(false)
  const [notice, setNotice] = React.useState('')

  const adopt = (next) => {
    setState(next)
    setDraft(next.config)
    setNotice('')
  }

  const fail = (error) => setNotice(`${error?.message ?? String(error)}`)

  const reload = () => {
    requestJson('/tool-fold/state').then(adopt).catch(error => fail(new Error(`${t('loadFailed')}: ${error.message}`)))
  }

  React.useEffect(reload, [])

  if (draft === null) {
    return React.createElement('div', { className: 'tf-page' },
      React.createElement('h2', { className: 'tf-title' }, t('title')),
      React.createElement('p', { className: 'tf-muted' }, notice === '' ? t('intro') : notice))
  }

  const update = (patch) => setDraft(current => ({ ...current, ...patch }))
  const updateGroup = (id, patch) => update({
    groups: draft.groups.map(group => (group.id === id ? { ...group, ...patch } : group)),
  })
  const updateDefaults = (patch) => update({ defaults: { ...draft.defaults, ...patch } })

  const save = () => {
    setBusy(true)
    requestJson('/tool-fold/config', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(draft),
    }).then((next) => {
      adopt(next)
      setNotice(t('saved'))
    }).catch(error => fail(new Error(`${t('saveFailed')}: ${error.message}`)))
      .finally(() => setBusy(false))
  }

  return React.createElement('div', { className: 'tf-page' },
    React.createElement('h2', { className: 'tf-title' }, t('title')),
    React.createElement('p', { className: 'tf-muted' }, t('intro')),
    React.createElement('p', { className: 'tf-muted' }, `${t('path')}: ${state?.path ?? ''}`),
    notice === '' ? null : React.createElement('p', { className: 'tf-notice' }, notice),
    problemsOf(state, t),

    React.createElement('section', { className: 'tf-defaults' },
      React.createElement('h3', null, t('defaults')),
      React.createElement('label', { className: 'tf-field' },
        React.createElement('span', null, t('listingForm')),
        select(draft.defaults.listingForm, [
          ['list', t('formList')],
          ['search', t('formSearch')],
        ], value => updateDefaults({ listingForm: value }))),
      React.createElement('label', { className: 'tf-field tf-inline' },
        React.createElement('input', {
          type: 'checkbox',
          checked: draft.defaults.idleRetract.enabled,
          onChange: event => updateDefaults({
            idleRetract: { ...draft.defaults.idleRetract, enabled: event.target.checked },
          }),
        }),
        React.createElement('span', null, t('idleRetract'))),
      React.createElement('label', { className: 'tf-field' },
        React.createElement('span', null, t('idleRounds')),
        number(draft.defaults.idleRetract.rounds, 1, 200, value => updateDefaults({
          idleRetract: { ...draft.defaults.idleRetract, rounds: value },
        })))),

    React.createElement('section', null,
      React.createElement('h3', null, t('groups')),
      draft.groups.length === 0
        ? React.createElement('p', { className: 'tf-muted' }, t('empty'))
        : draft.groups.map(group => React.createElement(GroupCard, {
          key: group.id,
          group,
          state,
          t,
          onChange: patch => updateGroup(group.id, patch),
          onRemove: () => update({ groups: draft.groups.filter(item => item.id !== group.id) }),
        })),
      React.createElement('div', { className: 'tf-actions' },
        React.createElement('button', {
          type: 'button',
          className: 'tf-button',
          onClick: () => update({ groups: [...draft.groups, newGroup('fold', draft.defaults)] }),
        }, t('addFold')),
        React.createElement('button', {
          type: 'button',
          className: 'tf-button',
          onClick: () => update({ groups: [...draft.groups, newGroup('aggregate', draft.defaults)] }),
        }, t('addAggregate')))),

    React.createElement('div', { className: 'tf-actions tf-footer' },
      React.createElement('button', {
        type: 'button',
        className: 'tf-button tf-primary',
        disabled: busy,
        onClick: save,
      }, busy ? t('saving') : t('save')),
      React.createElement('button', {
        type: 'button',
        className: 'tf-button',
        disabled: busy,
        onClick: reload,
      }, t('reload'))))
}

/** One group card. */
function GroupCard(props) {
  const { group, state, t, onChange, onRemove } = props
  const catalog = state?.catalog ?? []
  const presets = state?.presets ?? []
  const [filter, setFilter] = React.useState('')
  const [manual, setManual] = React.useState('')
  const fold = group.kind === 'fold'
  const needle = filter.trim().toLowerCase()
  const entries = catalog.filter(entry => needle === '' || entry.name.toLowerCase().includes(needle))
  const boundElsewhere = boundNames(state, group.id)

  const toggleTool = (name) => {
    onChange({
      tools: group.tools.includes(name)
        ? group.tools.filter(item => item !== name)
        : [...group.tools, name],
    })
  }
  const togglePreset = (id) => {
    onChange({
      presets: group.presets.includes(id)
        ? group.presets.filter(item => item !== id)
        : [...group.presets, id],
    })
  }

  return React.createElement('article', { className: 'tf-card' },
    React.createElement('header', { className: 'tf-card-head' },
      React.createElement('strong', null, group.name === '' ? t('name') : group.name),
      React.createElement('button', { type: 'button', className: 'tf-link', onClick: onRemove }, t('remove'))),

    React.createElement('label', { className: 'tf-field' },
      React.createElement('span', null, t('name')),
      React.createElement('input', {
        type: 'text',
        value: group.name,
        placeholder: 'github',
        onChange: event => onChange({ name: event.target.value }),
      }),
      React.createElement('small', { className: 'tf-muted' }, t('nameHint'))),

    React.createElement('label', { className: 'tf-field' },
      React.createElement('span', null, t('kind')),
      select(group.kind, [['fold', t('kindFold')], ['aggregate', t('kindAggregate')]], value => onChange({ kind: value }))),

    fold
      ? React.createElement('label', { className: 'tf-field' },
        React.createElement('span', null, t('listingForm')),
        select(group.listingForm, [['list', t('formList')], ['search', t('formSearch')]], value => onChange({ listingForm: value })))
      : null,

    React.createElement('div', { className: 'tf-field' },
      React.createElement('span', null, t('presets')),
      presets.length === 0
        ? React.createElement('small', { className: 'tf-muted' }, t('presetsEmpty'))
        : React.createElement('div', { className: 'tf-chips' }, presets.map(preset =>
          React.createElement('label', { key: preset.id, className: 'tf-chip' },
            React.createElement('input', {
              type: 'checkbox',
              checked: group.presets.includes(preset.id),
              onChange: () => togglePreset(preset.id),
            }),
            React.createElement('span', null, preset.name))))),

    React.createElement('div', { className: 'tf-field' },
      React.createElement('span', null, t('tools')),
      React.createElement('input', {
        type: 'text',
        value: filter,
        placeholder: t('toolFilter'),
        onChange: event => setFilter(event.target.value),
      }),
      React.createElement('div', { className: 'tf-tools' }, entries.length === 0
        ? React.createElement('small', { className: 'tf-muted' }, t('noDescription'))
        : entries.map(entry => {
          const owned = boundElsewhere.get(entry.name)
          const checked = group.tools.includes(entry.name)
          return React.createElement('label', {
            key: entry.name,
            className: owned === undefined ? 'tf-tool' : 'tf-tool tf-tool-taken',
            title: entry.description,
          },
          React.createElement('input', {
            type: 'checkbox',
            checked,
            disabled: owned !== undefined && !checked,
            onChange: () => toggleTool(entry.name),
          }),
          React.createElement('span', null, entry.name),
          owned === undefined ? null : React.createElement('small', null, `${t('bound')}: ${owned}`))
        })),
      React.createElement('div', { className: 'tf-inline' },
        React.createElement('input', {
          type: 'text',
          value: manual,
          placeholder: t('toolManual'),
          onChange: event => setManual(event.target.value),
        }),
        React.createElement('button', {
          type: 'button',
          className: 'tf-button',
          onClick: () => {
            const name = manual.trim()
            if (name === '' || group.tools.includes(name)) return
            onChange({ tools: [...group.tools, name] })
            setManual('')
          },
        }, t('toolAdd'))),
      group.tools.length === 0
        ? React.createElement('small', { className: 'tf-muted' }, t('toolsEmpty'))
        : React.createElement('small', { className: 'tf-muted' }, group.tools.join(', '))),

    fold
      ? React.createElement('div', { className: 'tf-field' },
        React.createElement('label', { className: 'tf-inline' },
          React.createElement('input', {
            type: 'checkbox',
            checked: group.idleRetract.enabled,
            onChange: event => onChange({ idleRetract: { ...group.idleRetract, enabled: event.target.checked } }),
          }),
          React.createElement('span', null, t('idleRetract'))),
        number(group.idleRetract.rounds, 1, 200, value => onChange({ idleRetract: { ...group.idleRetract, rounds: value } })))
      : React.createElement('label', { className: 'tf-field' },
        React.createElement('span', null, t('usageNote')),
        React.createElement('textarea', {
          rows: 3,
          value: group.usageNote,
          onChange: event => onChange({ usageNote: event.target.value }),
        }),
        React.createElement('small', { className: 'tf-muted' }, t('usageNoteHint'))))
}

/** Tool name to the group id that already owns it, excluding `currentId`. */
function boundNames(state, currentId) {
  const owned = new Map()
  for (const group of state?.config?.groups ?? []) {
    if (group.id === currentId) continue
    for (const tool of group.tools) owned.set(tool, group.name === '' ? group.id : group.name)
  }
  return owned
}

/** The problems block, or null when the configuration is saveable. */
function problemsOf(state, t) {
  const problems = state?.problems ?? []
  if (problems.length === 0) return null
  return React.createElement('div', { className: 'tf-problems' },
    React.createElement('strong', null, t('problems')),
    React.createElement('ul', null, problems.map((problem, index) =>
      React.createElement('li', { key: `${problem.code}:${index}` }, problem.message))))
}

/** A select control over `[value, label]` pairs. */
function select(value, options, onChange) {
  return React.createElement('select', {
    value,
    onChange: event => onChange(event.target.value),
  }, options.map(([optionValue, label]) => React.createElement('option', { key: optionValue, value: optionValue }, label)))
}

/** A bounded integer input. */
function number(value, min, max, onChange) {
  return React.createElement('input', {
    type: 'number',
    min,
    max,
    value,
    onChange: event => {
      const parsed = Number.parseInt(event.target.value, 10)
      onChange(Number.isFinite(parsed) ? Math.min(Math.max(parsed, min), max) : min)
    },
  })
}
