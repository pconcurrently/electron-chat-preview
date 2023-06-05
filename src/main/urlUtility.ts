process.parentPort.once('message', (e) => {
  const [port] = e.ports
  // const urlScrape = require('./urlScrape.ts')

  // urlScrape.getMetaData(e.data).then(metaData => {
  //   process.parentPort.postMessage(metaData)
  // })
  process.parentPort.postMessage('Hello from child')
})
