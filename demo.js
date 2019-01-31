const {client} = require('tre-client')
const Importer = require('tre-file-importer')
const h = require('mutant/html-element')
const setStyle = require('module-styles')('tre-images-demo')
const RenderStack = require('tre-render-stack')
const Abundance = require('.')

const Images = require('tre-images')
const Fonts = require('tre-fonts')
const Stylesheets = require('tre-stylesheets')
const Folders = require('tre-folders')

client( (err, ssb, config) => {
  if (err) return console.error(err)

  const importer = Importer(ssb, config)
          .use(Images)
          .use(Fonts)
          .use(Stylesheets)
          .use(Folders)

  const prototypes = config.tre.prototypes
  const renderImage = Images(ssb, {
    prototypes
  })
  const renderFont = Fonts(ssb, {
    prototypes
  })
  const renderStylesheet = Stylesheets(ssb, {
    prototypes
  })
  const renderFolder = Folders(ssb, {
    prototypes
  })

  const rendererStack = RenderStack(ssb)
    .use(renderImage)
    .use(renderFont)
    .use(renderStylesheet)
    .use(renderFolder)
  const render = rendererStack.render

  document.body.appendChild(Abundance(ssb, config, {
    importer,
    render
  }))
})

