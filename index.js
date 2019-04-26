const Finder = require('tre-finder')
const PropertySheet = require('tre-property-sheet')
const StylePanel = require('tre-style-panel')
const Shell = require('tre-editor-shell')
const WatchMerged = require('tre-prototypes')
const {makePane, makeDivider, makeSplitPane} = require('tre-split-pane')
const h = require('mutant/html-element')
const Value = require('mutant/value')
const watch = require('mutant/watch')
const computed = require('mutant/computed')
const setStyle = require('module-styles')('abundance')
const RenderFonts = require('./render-fonts')
const MultiEditor = require('tre-multi-editor')
const Webapps = require('tre-webapps')
const Icons = require('./icons-by-name')
const RoleSelector = require('./role-selector')
const LanguageSwitch = require('./language-switch')
const IdleControl = require('./idle-control')
const UAParser = require('ua-parser-js')

const browserVersion = UAParser().browser

module.exports = function(ssb, config, opts) {
  const {importer} = opts
  const _render = opts.render || (function() {})

  styles()
  const renderFonts = RenderFonts(ssb, config)
  document.body.appendChild(renderFonts())

  const watchMerged = WatchMerged(ssb)
  const primarySelection = Value()
  const mergedKvObs = computed(primarySelection, kv => {
    const c = content(kv)
    if (!c) return
    return watchMerged(c.revisionRoot || kv.key, {allowAllAuthors: true})
  })

  function isIgnored(kv) {
    if (!kv) return false
    return kv.value.content.branch == config.tre.branches.trash
  }

  const renderStylePanel = StylePanel(ssb, {isIgnored})
  const iconByName = Icons(ssb, config)
  const renderFinder = Finder(ssb, {
    importer,
    skipFirstLevel: true,
    primarySelection,
    prolog: (kv, ctx) => {
      if (!kv) return []
      const meta = kv.meta
      return [
        h('div.indicators', [ 
          meta && meta["prototype-chain"] ? iconByName('gift', {title: 'Node has a prototype'}) : [],
          meta && meta.forked ? iconByName('git branch', {title: 'Node has multiple heads'}) : [],
          meta && meta.incomplete ? iconByName('alert', {title: 'Node has incomplete history'}) : [],
          meta && meta.change_requests ? iconByName('notifications', {title: 'Change requests'}) : []
        ])
      ]
    },
    details: (kv, ctx) => {
      if (!kv) return []
      return [
        h('div.actions', [ 
          //iconByName('add circle outline', {title: 'Add child node'}),
          iconByName('albums', {
            title: 'Clone',
            action: (e, ctx) => {
              e.preventDefault()
              const content = Object.assign({}, unmergeKv(kv).value.content)
              delete content.revisionRoot
              delete content.revisionBranch
              content.name = `Copy of ${content.name}`
              console.log('Cloning', content)
              ssb.publish(content, (err, msg) => {
                if (err) return console.error(err.message)
                console.log('cloned. New message:', msg)
              })
            }
          }),
          iconByName('trash', {
            title: 'Move to trash',
            action: (e, ctx) => {
              e.preventDefault()
              ssb.revisions.patch(kv.key, content => {
                content.branch = config.tre.branches.trash
              }, (err, msg) => {
                if (err) return console.error(err.message)
                console.log('moved to trash', msg)
              })
            }
          }),
          //iconByName('more', {title: 'more ...'})
        ])
      ]
    }
  })
  const renderRoleSelector = RoleSelector(ssb)
  const renderMultiEditor = MultiEditor(ssb, opts)

  const renderLanguageSwitch = LanguageSwitch(ssb, config)
  const {languagesObs, currentLanguageObs} = renderLanguageSwitch
  const renderIdleControl = IdleControl({paused: true, seconds: 30})

  const where = Value('editor')

  const modes = [   //    splitpane?  right?    editor?    fullscreen?
    {name: 'edit',        ui: true,  ri: true,  ed: true,  fs: false },
    {name: 'sidebar',     ui: true,  ri: true,  ed: false, fs: true  },
    {name: 'fullscreen',  ui: false, ri: false, ed: false, fs: true  },
    {name: 'overlay',     ui: true,  ri: false, ed: false, fs: true  }
  ]
  const mode = Value(0)

  window.addEventListener('keydown', e =>{
    if (e.key === 'Tab' && e.shiftKey) {
      mode.set( (mode() + 1) % modes.length)
      console.log('new view mode:', modes[mode()].name)
      e.preventDefault()
    }
  })

  const idleControls = renderIdleControl()
  const {idleTimer} = idleControls
  window.addEventListener('click', e =>{
    idleTimer.reset()
  })

  const isKiosk = computed([mode, primarySelection], (mode, kvm) =>{
    const isStation = kvm && kvm.value && kvm.value.content && kvm.value.content.type == 'station'
    return isStation && mode == 2
  })

  const abort = watch(isKiosk, kiosk => {
    if (kiosk) {
      console.log('KIOSK mode')
      if (idleControls.pausedObs()) {
        idleControls.pausedObs.set(false)
        idleTimer.resume()
      }
    }
  })

  const canAutoUpdate = computed([isKiosk, idleTimer.isIdleObs], (kiosk, idle) =>{
    return kiosk && idle
  })

  const renderWebapp = Webapps(ssb, {
    canAutoUpdate
  })

  const commonContext = {
    languagesObs,
    currentLanguageObs,
    idleTimer 
  }

  function render(kv, ctx) {
    return _render(kv, Object.assign({}, commonContext, ctx))
  }

  function renderStage() {
    return h('.abundance-stage', {}, [
      computed(mergedKvObs, kv => {
        if (!kv) return []
        return render(kv, {
          where: 'stage'
        })
      })
    ])
  }

  function display(obs) {
    return {
      display: computed(obs, s => s ? 'block' : 'none')
    } 
  }

  function renderTopBar() {
    const address = Value(h('span', 'getting address ...'))
    ssb.getAddress((err, addr)=>{
      if (err) {
        address.set(h('span.error', err.message))
      } else {
        const [schema, ip, port, id] = addr.split(':')
        address.set(h(`.${schema}`, [
          h('.ip', ip),
          h('.port', port),
          h('.id', id),
        ]))
      } 
    })
    const bootMsg = Value()
    const bootRev = config.bootMsgRevision
    if (bootRev) ssb.get(bootRev, (err, value) => {
      if (err) return console.error(err.message)
      bootMsg.set({key: bootRev, value})
    }) 
    return h('.abundance-topbar', [
      computed(bootMsg, kv => {
        if (!bootRev) return h('div.dev', 'dev version')
        if (!kv) return
        return renderWebapp(kv, {where: 'status'})
      }),
      h('.browser-version', [
        h('span.name', browserVersion.name),
        h('span.version', browserVersion.version),
      ]),
      renderRoleSelector(mode, primarySelection),
      renderLanguageSwitch(),
      computed(currentLanguageObs, l => {
        return h(`span.emoji.emoji-${l}`)
      }),
      idleControls,
      h('.sbot-address', address)
    ])
  }

  function renderSidebar() {
    return h('.abundance-sidebar', {
    }, [
      makeSplitPane({horiz: false}, [
        makePane('50%', [
          renderFinder(config.tre.branches.root, {path: []})
        ]),
        makeDivider(),
        makePane('50%', [
          renderStylePanel()
        ])
      ])
    ])
  }

  function whenVisible(aspect, a, b) {
    return computed(mode, mode => modes[mode][aspect] ? a : b)
  }

  return h('.abundance', {
    hooks: [el => abort],
    classList: computed(mode, mode => `viewmode-${[modes[mode].name]}`)
  }, [
    whenVisible('ri', [], whenVisible('fs', [
      renderStage(),
      h('div', {
        style: {
          display: 'none'
        }
      }, [ renderStylePanel()])
    ], [])),
    whenVisible('ui', [
      h('.abundance-ui', [
        makeSplitPane({horiz: false}, [
          makePane('4em', [renderTopBar()]),
          makeDivider(),
          makeSplitPane({horiz: true}, [
            makePane('25%', [renderSidebar()]),
            makeDivider(),
            makePane('70%',/* {
              style: {opacity: whenVisible('ri', 1, 0)}
            },*/ [
              whenVisible('fs', renderStage(), []),
              h('div.abundance-editor', {
                style: {display: whenVisible('ed', 'block',  'none')}
              }, computed(renderFinder.primarySelectionObs, kv => {
                if (!kv) return []
                return renderMultiEditor(kv, Object.assign({}, {
                  render,
                }, commonContext))
              }))
            ])
          ])
        ])
      ])
    ], [])
    
  ])
}

function content(kv) {
  return kv && kv.value && kv.value.content
}

function unmergeKv(kv) {
  // if the message has prototypes and they were merged into this message value,
  // return the unmerged/original value
  return kv && kv.meta && kv.meta['prototype-chain'] && kv.meta['prototype-chain'][0] || kv
}
function revisionRoot(kv) {
  return kv && kv.value.content && kv.value.content.revisionRoot || kv && kv.key
}

function styles() {
  setStyle(`
    body, html, .abundance, .abundance-ui, .abundance-stage, .tre-multi-editor {
      height: 100%;
      margin: 0;
      padding: 0;
    }
    body {
      --tre-selection-color: green;
      --tre-secondary-selection-color: yellow;
      font-family: sans-serif;
    }
    .abundance {
      position: relative;
    }
    .abundance-sidebar {
      height: 100%;
    }
    .tre-style-panel {
      height: 100%;
    }
    .abundance.viewmode-overlay > .abundance-ui {
      opacity: 0.7;
      position: absolute;
      z-index: 2;
      top: 0;
    }
    .abundance.viewmode-overlay > .abundance-ui > .horizontal-split-pane > .pane:nth-child(3) {
      opacity: 0;
    }
    h1 {
      font-size: 18px;
    }
    .pane {
      background: #eee;
    }
    .tre-finder .summary select {
      font-size: 9pt;
      background: transparent;
      border: none;
      width: 50px;
    }
    .tre-finder summary {
      white-space: nowrap;
    }
    .tre-finder summary:focus {
      outline: 1px solid rgba(255,255,255,0.1);
    }
    .tre-property-sheet {
      font-size: 9pt;
      background: #4a4a4b;
      color: #b6b6b6;
      height: 100%;
    }
    .tre-property-sheet summary {
      font-weight: bold;
      text-shadow: 0 0 4px black;
      margin-top: .3em;
      padding-top: .4em;
      background: #555454;
      border-top: 1px solid #807d7d;
      margin-bottom: .1em;
    }
    .tre-property-sheet input {
      background: #D0D052;
      border: none;
      margin-left: .5em;
    }
    .tre-property-sheet .inherited input {
      background: #656464;
    }
    .tre-property-sheet .new input {
      background: white;
    }
    .tre-property-sheet details > div {
      padding-left: 1em;
    }
    .tre-property-sheet [data-schema-type="number"] input {
      width: 4em;
    }
    .property[data-schema-type=string] {
      grid-column: span 3;
    }
    .tre-property-sheet .properties {
      width: 100%;
      display: grid;
      grid-template-columns: repeat(auto-fill, 5em);
    }
    .tre-property-sheet details {
      grid-column: 1/-1;
    }
    .tre-folders {
      background-color: #777;
    }
    .tre-folders .tile {
      border: 1px solid #444;
      background: #666;
    }
    .tre-folders .tile > .name {
      font-size: 9pt;
      background: #444;
      color: #aaa;
    }
    .tile>.tre-image-thumbnail {
      max-width: 100%;
      max-height: 100%;
      width: auto;
      height: auto;
    }
  `)
}
