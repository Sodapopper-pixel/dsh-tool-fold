/** Generated from src/client.js and src/client.css; rebuild with scripts/build.mjs. */
window.__ModuleLoader__.load({
  id: 'dsh-tool-fold',
  factory: (require) => {
    const React = require('react')
    const CSS = "/* Tool fold settings page. Neutral tokens so the page reads correctly in both themes. */\n\n.tf-page {\n  display: flex;\n  flex-direction: column;\n  gap: 12px;\n  padding: 4px 2px 24px;\n  max-width: 760px;\n}\n\n.tf-title {\n  margin: 0;\n  font-size: 15px;\n  font-weight: 600;\n}\n\n.tf-muted {\n  margin: 0;\n  font-size: 12px;\n  line-height: 1.55;\n  opacity: 0.72;\n}\n\n.tf-problems {\n  font-size: 12px;\n  line-height: 1.5;\n  padding: 8px 10px;\n  border-radius: 6px;\n  background: rgba(216, 88, 88, 0.12);\n}\n\n.tf-problems ul {\n  margin: 4px 0 0;\n  padding-left: 18px;\n}\n\n.tf-page h3 {\n  margin: 6px 0 0;\n  font-size: 13px;\n  font-weight: 600;\n}\n\n/* Group panels: one column, spaced, each collapsible from its header. */\n.tf-groups {\n  display: flex;\n  flex-direction: column;\n  gap: 10px;\n}\n\n.tf-card {\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n  border: 1px solid rgba(127, 127, 127, 0.28);\n  border-radius: 10px;\n  padding: 10px 12px;\n}\n\n.tf-card-head {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  font-size: 13px;\n}\n\n.tf-card-title {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.tf-card-summary {\n  flex: 1;\n  overflow: hidden;\n  font-size: 11px;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.tf-card-body {\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n  padding-top: 2px;\n}\n\n.tf-disclosure {\n  flex: none;\n  width: 18px;\n  height: 18px;\n  padding: 0;\n  font: inherit;\n  font-size: 11px;\n  line-height: 1;\n  border: 1px solid rgba(127, 127, 127, 0.32);\n  border-radius: 5px;\n  background: transparent;\n  color: inherit;\n  cursor: pointer;\n}\n\n.tf-disclosure:hover {\n  background: rgba(127, 127, 127, 0.14);\n}\n\n.tf-field {\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n  font-size: 12px;\n}\n\n.tf-field > span {\n  opacity: 0.82;\n}\n\n.tf-field input[type='text'],\n.tf-field input[type='number'],\n.tf-field select,\n.tf-field textarea {\n  font: inherit;\n  font-size: 12px;\n  padding: 4px 6px;\n  border-radius: 6px;\n  border: 1px solid rgba(127, 127, 127, 0.34);\n  background: transparent;\n  color: inherit;\n}\n\n/*\n * The native dropdown popup is painted by the browser, not by our transparent\n * input rule, so its rows fall back to the platform palette. Pin both the\n * popup background and its text to the active theme's tokens; without this the\n * dark theme lists dark text on a dark popup.\n */\n.tf-field select {\n  color-scheme: light;\n  background: var(--dsw-alias-bg-layer-2, transparent);\n  color: var(--dsw-alias-label-primary, inherit);\n}\n\nbody[data-ds-dark-theme] .tf-field select {\n  color-scheme: dark;\n}\n\n.tf-field select option {\n  background: var(--dsw-alias-bg-layer-2, #1c2028);\n  color: var(--dsw-alias-label-primary, inherit);\n}\n\n.tf-field textarea {\n  resize: vertical;\n  line-height: 1.5;\n}\n\n.tf-inline {\n  flex-direction: row;\n  align-items: center;\n  gap: 6px;\n}\n\n.tf-chips {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 6px;\n}\n\n.tf-chip {\n  display: inline-flex;\n  align-items: center;\n  gap: 4px;\n  font-size: 12px;\n  padding: 2px 8px 2px 6px;\n  border-radius: 999px;\n  border: 1px solid rgba(127, 127, 127, 0.28);\n  cursor: pointer;\n}\n\n/* Tool picker: one row per tool, each row can open its own details panel. */\n.tf-tools {\n  display: flex;\n  flex-direction: column;\n  gap: 1px;\n  max-height: 260px;\n  overflow: auto;\n  padding: 4px;\n  border-radius: 6px;\n  border: 1px solid rgba(127, 127, 127, 0.2);\n}\n\n.tf-tool {\n  border-radius: 5px;\n}\n\n.tf-tool-detailed {\n  background: rgba(127, 127, 127, 0.08);\n}\n\n.tf-tool-row {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  font-size: 12px;\n  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;\n}\n\n.tf-tool-label {\n  display: flex;\n  flex: 1;\n  align-items: center;\n  gap: 6px;\n  min-width: 0;\n  cursor: pointer;\n}\n\n.tf-tool-name {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.tf-tool-origin {\n  flex: none;\n  font-family: inherit;\n  font-size: 10px;\n  padding: 0 5px;\n  border-radius: 999px;\n  border: 1px solid rgba(127, 127, 127, 0.28);\n  opacity: 0.75;\n}\n\n.tf-tool-owned {\n  flex: none;\n  font-family: inherit;\n  opacity: 0.6;\n}\n\n.tf-tool-taken {\n  opacity: 0.55;\n  cursor: not-allowed;\n}\n\n.tf-tool-info {\n  flex: none;\n  font: inherit;\n  font-family: inherit;\n  font-size: 10px;\n  padding: 0 6px;\n  border-radius: 5px;\n  border: 1px solid rgba(127, 127, 127, 0.3);\n  background: transparent;\n  color: inherit;\n  opacity: 0.72;\n  cursor: pointer;\n}\n\n.tf-tool-info:hover {\n  opacity: 1;\n}\n\n.tf-tool-details {\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n  padding: 4px 6px 8px 24px;\n  font-family: system-ui, sans-serif;\n}\n\n.tf-tool-meta {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 10px;\n  font-size: 11px;\n  opacity: 0.78;\n}\n\n.tf-details > summary {\n  font-size: 11px;\n  opacity: 0.82;\n  cursor: pointer;\n}\n\n.tf-tool-description {\n  margin: 4px 0 0;\n  font-size: 11px;\n  line-height: 1.6;\n  white-space: pre-wrap;\n  opacity: 0.86;\n}\n\n.tf-schema {\n  margin: 4px 0 0;\n  max-height: 220px;\n  overflow: auto;\n  padding: 6px 8px;\n  border-radius: 6px;\n  border: 1px solid rgba(127, 127, 127, 0.22);\n  background: rgba(127, 127, 127, 0.06);\n  font-size: 11px;\n  line-height: 1.5;\n}\n\n.tf-bound {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 4px;\n}\n\n.tf-bound-chip {\n  display: inline-flex;\n  align-items: center;\n  gap: 4px;\n  padding: 1px 2px 1px 7px;\n  border-radius: 999px;\n  border: 1px solid rgba(127, 127, 127, 0.28);\n  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;\n  font-size: 11px;\n}\n\n.tf-bound-remove {\n  font: inherit;\n  font-size: 13px;\n  line-height: 1;\n  padding: 0 4px;\n  border: none;\n  border-radius: 999px;\n  background: none;\n  color: inherit;\n  opacity: 0.6;\n  cursor: pointer;\n}\n\n.tf-bound-remove:hover {\n  opacity: 0.95;\n}\n\n.tf-idle-rounds {\n  gap: 8px;\n}\n\n.tf-idle-rounds input[type='number'] {\n  width: 76px;\n}\n\n.tf-actions {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 8px;\n}\n\n/* Save row: the outcome sits beside the buttons, not above the page. */\n.tf-footer {\n  display: flex;\n  flex-wrap: wrap;\n  align-items: center;\n  gap: 10px;\n  padding-top: 4px;\n}\n\n.tf-saved {\n  font-size: 12px;\n  font-weight: 500;\n  color: #1f9254;\n}\n\nbody[data-ds-dark-theme] .tf-saved {\n  color: #5ddb92;\n}\n\n.tf-dirty {\n  font-size: 12px;\n  font-weight: 500;\n  color: #b7791f;\n}\n\nbody[data-ds-dark-theme] .tf-dirty {\n  color: #e5b567;\n}\n\n.tf-save-error {\n  font-size: 12px;\n  color: #c2413f;\n  white-space: pre-wrap;\n}\n\nbody[data-ds-dark-theme] .tf-save-error {\n  color: #f08b8a;\n}\n\n.tf-button {\n  font: inherit;\n  font-size: 12px;\n  padding: 5px 12px;\n  border-radius: 7px;\n  border: 1px solid rgba(127, 127, 127, 0.34);\n  background: transparent;\n  color: inherit;\n  cursor: pointer;\n}\n\n.tf-button:disabled {\n  opacity: 0.5;\n  cursor: default;\n}\n\n.tf-primary {\n  border-color: rgba(70, 130, 220, 0.62);\n  background: rgba(70, 130, 220, 0.16);\n}\n\n.tf-link {\n  font: inherit;\n  font-size: 12px;\n  border: none;\n  background: none;\n  color: inherit;\n  opacity: 0.68;\n  cursor: pointer;\n  text-decoration: underline;\n}\n"
/** Browser half: the Tool fold settings page (group list, tool picker, preset scoping). */

/** Locale namespace for this plugin. */
const NS = 'toolFold'

/** Settings page copy; English is the key source. */
const en = {
  nav: 'Tool fold',
  title: 'Tool fold',
  intro: 'Fold a batch of registered tools into one query tool, per agent preset. Folded tools leave the model\'s tool list until a session expands them; an aggregate group keeps them hidden and calls them on the model\'s behalf.',
  path: 'Configuration file',
  save: 'Save',
  saving: 'Saving…',
  reload: 'Reload',
  saved: 'Saved.',
  unsaved: 'Unsaved changes',
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
  kind: 'Kind',
  kindFold: 'Fold group (reveal on demand)',
  kindAggregate: 'Aggregate group (proxy only)',
  presets: 'Applies to presets',
  presetsEmpty: 'No presets reported by this Host. A group without a preset never applies.',
  presetStandard: 'Standard mode',
  presetPtc: 'PTC mode',
  presetMinimal: 'Minimal mode',
  presetCordis: 'Creator mode',
  tools: 'Bound tools',
  toolFilter: 'Filter tools',
  toolManual: 'Add a tool name',
  toolManualHint: 'For a tool the picker cannot see yet. Remove a binding with ×.',
  toolAdd: 'Add',
  unbind: 'Unbind',
  toolsEmpty: 'Bind at least one tool.',
  usageNote: 'Extra usage note',
  usageNoteHint: 'Prepended to what the model reads for this group. Leave empty to use only the tool descriptions.',
  missing: 'Bound but not registered in this session',
  problems: 'Cannot save',
  loadFailed: 'Could not read the configuration',
  saveFailed: 'Could not save the configuration',
  bound: 'bound',
  noDescription: 'no description recorded yet',
  expandPanel: 'Expand',
  collapsePanel: 'Collapse',
  toolDetails: 'Details',
  hideDetails: 'Hide details',
  source: 'Source',
  originMcp: 'MCP server',
  originTool: 'Built-in or plugin tool',
  layerGlobal: 'global layer',
  layerPreset: 'preset scope',
  description: 'Description',
  rawSchema: 'Raw JSON schema',
  noSchema: 'No parameter schema recorded yet',
}

/** Simplified Chinese copy. */
const zh = {
  nav: '工具折叠',
  title: '工具折叠',
  intro: '按代理预设把一批已注册工具折叠成一个查询工具。被折叠的工具会离开模型的工具列表，直到会话把它们展开；聚合组则永不展开，由它代模型执行。',
  path: '配置文件',
  save: '保存',
  saving: '保存中…',
  reload: '重新读取',
  saved: '已保存。',
  unsaved: '当前配置未保存',
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
  kind: '类型',
  kindFold: '折叠组（按需展开）',
  kindAggregate: '聚合组（只代执行）',
  presets: '生效预设',
  presetsEmpty: '本宿主没有报告任何预设。不绑定预设的组不会生效。',
  presetStandard: '标准模式',
  presetPtc: 'PTC 模式',
  presetMinimal: '极简模式',
  presetCordis: '创造模式',
  tools: '绑定工具',
  toolFilter: '筛选工具',
  toolManual: '手动添加工具名',
  toolManualHint: '用于工具选择器还看不到的工具；已绑定的工具点 × 移除。',
  toolAdd: '添加',
  unbind: '移出绑定',
  toolsEmpty: '至少绑定一个工具。',
  usageNote: '补充用法说明',
  usageNoteHint: '会加在模型读到的该组说明前面。留空则只用工具自身的描述。',
  missing: '已绑定但本会话未注册',
  problems: '无法保存',
  loadFailed: '读取配置失败',
  saveFailed: '保存配置失败',
  bound: '已绑定',
  noDescription: '尚无描述记录',
  expandPanel: '展开',
  collapsePanel: '收起',
  toolDetails: '详情',
  hideDetails: '收起详情',
  source: '来源',
  originMcp: 'MCP 服务器',
  originTool: '内置或插件工具',
  layerGlobal: '全局层',
  layerPreset: '预设作用域',
  description: '描述',
  rawSchema: '原始 JSON 结构',
  noSchema: '尚无参数结构记录',
}

/** New group id; ids are local and never reach the model. */
let sequence = 0

/**
 * Dictionary keys carrying one shipped preset's display name. The Harness resolves the same four
 * ids through its own client dictionary; this plugin cannot import that dictionary, so it carries
 * the names itself. A preset that publishes its own name is never translated.
 */
const BUILT_IN_PRESET_NAMES = {
  standard: 'presetStandard',
  ptc: 'presetPtc',
  minimal: 'presetMinimal',
  cordis: 'presetCordis',
}

/**
 * The name to show for one roster preset.
 * @param preset - one preset row from the Host snapshot.
 * @param t - active copy lookup.
 * @returns the localized built-in name, or the preset's declared name / id.
 */
function presetLabel(preset, t) {
  const key = preset.name === undefined ? BUILT_IN_PRESET_NAMES[preset.id] : undefined
  if (key !== undefined) return t(key)
  return preset.name ?? preset.id
}

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
const inject = ['slots', 'locale']

/**
 * Mount the settings page.
 * @param ctx - browser plugin context with the slot registry and locale service.
 */
function apply(ctx) {
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
  const [notice, setNotice] = React.useState(null)
  const [baseline, setBaseline] = React.useState(null)

  const adopt = (next) => {
    setState(next)
    setDraft(next.config)
    setBaseline(JSON.stringify(next.config))
    setNotice(null)
  }

  const fail = (error) => setNotice({ tone: 'error', text: `${error?.message ?? String(error)}` })

  const reload = () => {
    requestJson('/tool-fold/state').then(adopt).catch(error => fail(new Error(`${t('loadFailed')}: ${error.message}`)))
  }

  React.useEffect(reload, [])

  if (draft === null) {
    return React.createElement('div', { className: 'tf-page' },
      React.createElement('h2', { className: 'tf-title' }, t('title')),
      React.createElement('p', { className: 'tf-muted' }, notice === null ? t('intro') : notice.text))
  }

  const update = (patch) => setDraft(current => ({ ...current, ...patch }))
  const updateGroup = (id, patch) => update({
    groups: draft.groups.map(group => (group.id === id ? { ...group, ...patch } : group)),
  })
  /** Edits made since the configuration on disk was last read or saved. */
  const dirty = baseline !== null && JSON.stringify(draft) !== baseline
  const statusOf = () => {
    if (notice !== null && notice.tone === 'error') {
      return React.createElement('span', { className: 'tf-save-error', role: 'status' }, notice.text)
    }
    if (dirty) return React.createElement('span', { className: 'tf-dirty', role: 'status' }, t('unsaved'))
    if (notice !== null) return React.createElement('span', { className: 'tf-saved', role: 'status' }, notice.text)
    return null
  }

  const save = () => {
    setBusy(true)
    requestJson('/tool-fold/config', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(draft),
    }).then((next) => {
      adopt(next)
      setNotice({ tone: 'ok', text: t('saved') })
    }).catch(error => setNotice({
      tone: 'error',
      text: `${t('saveFailed')}: ${error.message}`,
    }))
      .finally(() => setBusy(false))
  }

  return React.createElement('div', { className: 'tf-page' },
    React.createElement('h2', { className: 'tf-title' }, t('title')),
    React.createElement('p', { className: 'tf-muted' }, t('intro')),
    React.createElement('p', { className: 'tf-muted' }, `${t('path')}: ${state?.path ?? ''}`),
    problemsOf(state, t),

    React.createElement('section', { className: 'tf-groups' },
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

    React.createElement('div', { className: 'tf-footer' },
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
      }, t('reload')),
      statusOf()))
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
  /** Bind a hand-typed name; the picker cannot offer tools it has never seen. */
  const addManual = () => {
    const name = manual.trim()
    if (name === '' || group.tools.includes(name)) return
    onChange({ tools: [...group.tools, name] })
    setManual('')
  }

  const summary = [
    fold ? t('kindFold') : t('kindAggregate'),
    `${group.tools.length} ${t('tools')}`,
    `${group.presets.length} ${t('presets')}`,
  ].join(' · ')
  const [open, setOpen] = React.useState(group.name === '')
  const [openTool, setOpenTool] = React.useState('')

  return React.createElement('article', { className: open ? 'tf-card tf-card-open' : 'tf-card' },
    React.createElement('header', { className: 'tf-card-head' },
      React.createElement('button', {
        type: 'button',
        className: 'tf-disclosure',
        'aria-expanded': open ? 'true' : 'false',
        'aria-label': `${open ? t('collapsePanel') : t('expandPanel')}: ${group.name === '' ? t('name') : group.name}`,
        title: open ? t('collapsePanel') : t('expandPanel'),
        onClick: () => setOpen(current => !current),
      }, open ? '▾' : '▸'),
      React.createElement('strong', { className: 'tf-card-title' }, group.name === '' ? t('name') : group.name),
      React.createElement('small', { className: 'tf-card-summary' }, summary),
      React.createElement('button', { type: 'button', className: 'tf-link', onClick: onRemove }, t('remove'))),

    open ? React.createElement('div', { className: 'tf-card-body' },

    React.createElement('label', { className: 'tf-field' },
      React.createElement('span', null, t('name')),
      React.createElement('input', {
        type: 'text',
        value: group.name,
        placeholder: 'github',
        onChange: event => onChange({ name: event.target.value }),
      })),

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
            React.createElement('span', null, presetLabel(preset, t)))))),

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
          const details = openTool === entry.name
          const detailsLabel = details ? t('hideDetails') : t('toolDetails')
          return React.createElement('div', {
            key: entry.name,
            className: details ? 'tf-tool tf-tool-detailed' : 'tf-tool',
          },
          React.createElement('div', { className: 'tf-tool-row' },
            React.createElement('label', {
              className: owned === undefined ? 'tf-tool-label' : 'tf-tool-label tf-tool-taken',
              title: entry.description,
            },
            React.createElement('input', {
              type: 'checkbox',
              checked,
              disabled: owned !== undefined && !checked,
              onChange: () => toggleTool(entry.name),
            }),
            React.createElement('span', { className: 'tf-tool-name' }, entry.name)),
            React.createElement('span', { className: 'tf-tool-origin' }, originLabel(entry, t)),
            owned === undefined ? null : React.createElement('small', { className: 'tf-tool-owned' }, `${t('bound')}: ${owned}`),
            React.createElement('button', {
              type: 'button',
              className: 'tf-tool-info',
              'aria-expanded': details ? 'true' : 'false',
              'aria-label': `${detailsLabel}: ${entry.name}`,
              onClick: () => setOpenTool(details ? '' : entry.name),
            }, detailsLabel)),
          details ? React.createElement('div', { className: 'tf-tool-details' },
            React.createElement('div', { className: 'tf-tool-meta' },
              React.createElement('span', null, `${t('source')}: ${originLabel(entry, t)}`),
              entry.layer === undefined ? null : React.createElement('span', null,
                entry.layer === 'global' ? t('layerGlobal') : t('layerPreset'))),
            React.createElement('details', { className: 'tf-details' },
              React.createElement('summary', null, t('description')),
              React.createElement('p', { className: 'tf-tool-description' },
                entry.description === '' ? t('noDescription') : entry.description)),
            React.createElement('details', { className: 'tf-details' },
              React.createElement('summary', null, t('rawSchema')),
              entry.parameters === undefined
                ? React.createElement('p', { className: 'tf-muted' }, t('noSchema'))
                : React.createElement('pre', { className: 'tf-schema' }, JSON.stringify(entry.parameters, null, 2)))) : null)
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
          onClick: addManual,
        }, t('toolAdd'))),
      React.createElement('small', { className: 'tf-muted' }, t('toolManualHint')),
      group.tools.length === 0
        ? React.createElement('small', { className: 'tf-muted' }, t('toolsEmpty'))
        : React.createElement('div', { className: 'tf-bound' }, group.tools.map(name =>
          React.createElement('span', { key: name, className: 'tf-bound-chip' },
            React.createElement('span', null, name),
            React.createElement('button', {
              type: 'button',
              className: 'tf-bound-remove',
              title: t('unbind'),
              'aria-label': `${t('unbind')}: ${name}`,
              onClick: () => onChange({ tools: group.tools.filter(item => item !== name) }),
            }, '×'))))),

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
        React.createElement('small', { className: 'tf-muted' }, t('usageNoteHint'))
    )) : null)
}

/**
 * The source label one catalog entry shows in the picker.
 * The Host resolves the provider — builtin capability or the package that registers a plugin
 * tool. A page served by an older Host has no provider, so the name's `mcp__<server>__` prefix
 * still classifies MCP tools and everything else falls back to the generic label.
 * @param entry - one catalog row from the Host snapshot.
 * @param t - active copy lookup.
 * @returns the provider label the Host resolved, else a prefix-derived one.
 */
function originLabel(entry, t) {
  if (typeof entry.provider === 'string' && entry.provider !== '') return entry.provider
  const server = entry.server ?? /^mcp__(.+?)__/.exec(entry.name)?.[1]
  if (entry.origin === 'tool' || server === undefined) return t('originTool')
  return `${t('originMcp')}: ${server}`
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

    return { name: 'dsh-tool-fold', inject, apply }
  },
})
