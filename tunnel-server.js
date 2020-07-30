#!/usr/bin/env node

const minimist = require('minimist')
const { Remote } = require('@hyperswarm/tunnel')
const argv = minimist(process.argv, {
  boolean: [
    'verbose',
    'help'
  ],
  string: [
    'announce'
  ],
  default: {
    port: 0
  },
  alias: {
    announce: 'a',
    verbose: 'V',
    port: 'p',
    help: 'h'
  }
})

if (argv.help) {
  console.error(`Usage: ${process.argv[1]} [options]

  --announce, -a     [key]   Announce a key immediately at start of the tunnel
  --port, -p         [port]  Specify port to listen to tunnel
  --verbose, -V              Print all lookups,announces,unannounces
`)
  process.exit(1)
}

const r = new Remote()

r.listen(argv.port)

if (argv.verbose) {
  r.on('forward-listening', function (port, topic) {
    console.log('Announcing ' + topic.toString('hex') + ' ' + port)
  })
  r.on('forward-close', function (port, topic) {
    console.log('Unannouncing ' + topic.toString('hex') + ' ' + port)
  })
  r.on('forward-connect', function (_, topic) {
    console.log('Doing a lookup for ' + topic.toString('hex'))
  })
}

r.on('listening', function () {
  console.log('Listening on port ' + r.address().port)
})

if (argv.announce) r.announce(Buffer.from(argv.announce, 'hex'))

r.on('network-close', () => process.exit())

process.once('SIGINT', function () {
  r.destroy()
})

process.once('SIGTERM', function () {
  r.destroy()
})
