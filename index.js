const Finder = require('tre-finder')
const PropertySheet = require('tre-property-sheet')
const StylePanel = require('tre-style-panel')
const Shell = require('tre-editor-shell')
const WatchMerged = require('tre-prototypes')
const {makePane, makeDivider, makeSplitPane} = require('tre-split-pane')
const h = require('mutant/html-element')
const Value = require('mutant/value')
const computed = require('mutant/computed')
const setStyle = require('module-styles')('tre-images-demo')

styles()

module.exports = function(ssb, config, opts) {
  const {importer, render} = opts

  const watchMerged = WatchMerged(ssb)
  const primarySelection = Value()
  const merged_kv = computed(primarySelection, kv => {
    const c = content(kv)
    if (!c) return
    return watchMerged(c.revisionRoot || kv.key)
  })

  const renderPanel = StylePanel(ssb, {
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
  const renderEditor = Editor(ssb, where, merged_kv, render)

  return h('.abundane', [
    makeSplitPane({horiz: true}, [
      makePane('25%', [
        makeSplitPane({horiz: false}, [
          makePane('50%', [
            renderFinder(config.tre.branches.root, {path: []})
          ]),
          makeDivider(),
          makePane('50%', [
            renderPanel()
          ])
        ])
      ]),
      makeDivider(),
      makePane('70%', [
        renderBar(where),
        renderEditor()
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

function Editor(ssb, whereObs, mergedKvObs, renderEditor) {
  let current_kv
  const contentObs = Value({})

  const renderPropertySheet = PropertySheet()
  const renderShell = Shell(ssb, {
    save: (kv, cb) => {
      ssb.publish(kv.value.content, (err, msg) => {
        console.log('pyblish:', err, msg)
        cb(err, msg)
      })
    }
  })

  return function() {
    return h('.tre-images-editor', [
      makeSplitPane({horiz: true}, [
        makePane('60%', shellOrStage()),
        makeDivider(),
        makePane('40%', sheet())
      ])
    ])
  }

  function stage(where) {
    return computed(mergedKvObs, kv => {
      if (!kv) return []
      contentObs.set(Object.assign({}, unmergeKv(kv).value.content))
      return renderEditor(kv, {where})  
    })
  }

  function shellOrStage() {
    return computed(whereObs, where => {
      if (where !== 'editor' && where !== 'compact-editor') {
        current_kv = null
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
      contentObs.set(unmergeKv(kv).value.content)
      return renderShell(kv, {
        renderEditor,
        contentObs,
        where
      })
    })
  }

  function sheet() {
    return computed(mergedKvObs, kv => {
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
    body, html, .abundance {
      height: 100%;
      margin: 0;
      padding: 0;
    }
    body {
      --tre-selection-color: green;
      --tre-secondary-selection-color: yellow;
      font-family: sans-serif;
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
    .tre-images-editor {
      max-width: 1000px;
    }
    .tre-property-sheet {
      font-size: 9pt;
      background: #4a4a4b;
      color: #b6b6b6;
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