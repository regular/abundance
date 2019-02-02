const Finder = require('tre-finder')
const PropertySheet = require('tre-property-sheet')
const StylePanel = require('tre-style-panel')
const Shell = require('tre-editor-shell')
const WatchMerged = require('tre-prototypes')
const {makePane, makeDivider, makeSplitPane} = require('tre-split-pane')
const h = require('mutant/html-element')
const Value = require('mutant/value')
const computed = require('mutant/computed')
const setStyle = require('module-styles')('abundance')
const RenderFonts = require('./render-fonts')

module.exports = function(ssb, config, opts) {
  const {importer, render} = opts

  styles()
  const renderFonts = RenderFonts(ssb, config)
  document.body.appendChild(renderFonts())

  const watchMerged = WatchMerged(ssb)
  const primarySelection = Value()
  const mergedKvObs = computed(primarySelection, kv => {
    const c = content(kv)
    if (!c) return
    return watchMerged(c.revisionRoot || kv.key)
  })

  const renderStylePanel = StylePanel(ssb, {
  })

  const renderFinder = Finder(ssb, {
    importer,
    skipFirstLevel: true,
    primarySelection,
    details: (kv, ctx) => {
      return kv && kv.meta && kv.meta["prototype-chain"] ? h('i', '(has proto)') : []
    }
  })

  const where = Value('editor')
  const renderEditor = Editor(ssb, where, mergedKvObs, render)

  const modes = [   //    splitpane?  right?    editor?    fullscreen?
    {name: 'edit',        ui: true,  ri: true,  ed: true,  fs: false },
    {name: 'sidebar',     ui: true,  ri: true,  ed: false, fs: true  },
    {name: 'fullscreen',  ui: false, ri: false, ed: false, fs: true  },
    {name: 'overlay',     ui: true,  ri: false, ed: false, fs: true  }
  ]
  const mode = Value(0)

  window.addEventListener('keydown', (e)=>{
    if (e.key === 'Tab' && e.shiftKey) {
      mode.set( (mode() + 1) % modes.length)
      console.log('new view mode:', modes[mode()].name)
      e.preventDefault()
    }
  })

  function renderStage() {
    return h('.abundance-stage', {}, [
      computed(mergedKvObs, kv => {
        if (!kv) return []
        return render(kv)
      })
    ])
  }

  function display(obs) {
    return {
      display: computed(obs, s => s ? 'block' : 'none')
    } 
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
    classList: computed(mode, mode => `viewmode-${[modes[mode].name]}`)
  }, [
    whenVisible('ri', [], whenVisible('fs', renderStage(), [])),
    h('.abundance-ui', {
      style: { display: whenVisible('ui', 'block', 'none') }
    }, [
      makeSplitPane({horiz: true}, [
        makePane('25%', [renderSidebar()]),
        makeDivider(),
        makePane('70%', /*{
          style: {opacity: whenVisible('ri', 1, 0)}
        },*/ [
          whenVisible('fs', renderStage(), []),
          renderEditor({
            style: {display: whenVisible('ed', 'block',  'none')}
          })
        ])
      ])
    ])
  ])
}

function renderBar(where) {
  return h('.bar', [
    h('select', {
      'ev-change': e => {
        where.set(e.target.value)
      }
    }, [
      h('option', 'editor'),
      h('option', 'stage'),
      h('option', 'thumbnail')
    ])
  ])
}


function Editor(ssb, whereObs, mergedKvObs, render) {
  let current_kv
  const watchMerged = WatchMerged(ssb)
  const contentObs = Value()
  const liveDraftKvObs = liveDraftKv(contentObs)

  const renderPropertySheet = PropertySheet()
  const renderShell = Shell(ssb, {
    save: (kv, cb) => {
      ssb.publish(kv.value.content, (err, msg) => {
        console.log('pyblish:', err, msg)
        cb(err, msg)
      })
    }
  })

  return function(opts) {
    opts = opts || {}
    return h('.tre-multi-editor', opts, [
      makeSplitPane({horiz: true}, [
        makePane('60%', [
          renderBar(whereObs),
          shellOrStage()
        ]),
        makeDivider(),
        makePane('40%', sheet())
      ])
    ])
  }

  function liveDraftKv(contentObs) {
    const editing_kv = computed(contentObs, content => {
      if (!content) return null
      return {
        key: 'fake key',
        value: {
          content
        }
      }
    })
    return watchMerged(editing_kv)
  }

  function stage(where) {
    current_kv = null
    return computed(mergedKvObs, kv => {
      if (!kv) return []
      return render(kv, {where})  
    })
  }

  function shellOrStage() {
    return computed(whereObs, where => {
      if (where !== 'editor' && where !== 'compact-editor') {
        return stage(where)
      }
      return shell(where)
    })
  }

  function shell(where) {
    return computed(mergedKvObs, kv => {
      if (
        revisionRoot(kv) == revisionRoot(current_kv)
      ) return computed.NO_CHANGE
      current_kv = kv
      if (!kv) return []
      return renderShell(unmergeKv(kv), {
        renderEditor: render,
        contentObs,
        where
      })
    })
  }

  function sheet() {
    return computed(liveDraftKvObs, kv => {
      return renderPropertySheet(kv, {contentObs})
    })
  }
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
  `)
}
