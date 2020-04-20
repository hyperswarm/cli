#!/usr/bin/env node

const createDht = require('@hyperswarm/dht')
const minimist = require('minimist')
const os = require('os')
const path = require('path')
const fs = require('fs')
const dhtrpc = require('dht-rpc')

const argv = minimist(process.argv, {
  boolean: [
    'adaptive',
    'verbose',
    'help',
    'json'
  ],
  string: [
    'address',
    'id-file',
    'id'
  ],
  default: {
    adaptive: true,
    'id-file': path.join(os.tmpdir(), 'dht-rpc-id'),
    verbose: false,
    port: 49737,
    address: '0.0.0.0'
  },
  alias: {
    bootstrap: 'b',
    verbose: 'V',
    address: 'a',
    port: 'p',
    'id-file': 'f',
    id: 'i',
    help: 'h',
    json: 'j'
  }
})

if (argv.help) {
  console.error(`Usage: ${process.argv[1]} [options]

  --id, -i           [key]   ID for this dht node
  --id-file, -f      [path]  Path to store a random id for this node (ignored if id is given)
  --port, -p         [port]  Specify port to listen to (optional, as dht-nodes don't require listening)
  --address, -a      [addr]  Specify address to listen to (optional, only used if port is given)
  --json                     Output all messages as json.
  --verbose, -V              Print all lookups,announces,unannounces
  --bootstrap, -b            Specify bootstrap peers (optional)
  --no-adaptive              Disable adaptive ephemerality
`)
  process.exit(1)
}

const idFile = argv['id-file']
const id = resolveId(argv.id, idFile)
const adaptive = argv.adaptive
const port = argv.port
const address = argv.address
const bootstrap = argv.boostrap ? [].concat(argv.bootstrap || []) : undefined
const version = require('@hyperswarm/dht/package.json').version
const verbose = argv.verbose

const dht = createDht({ adaptive: adaptive, ephemeral: adaptive, id, bootstrap })

const msg = `DHT version ${version}

  id=${id.toString('hex')}
  id-file=${idFile}
  port=${port}
  address=${address}
  adaptive=${adaptive}
  bootstrap=${bootstrap || '(default)'}
  verbose=${verbose}
`

log(msg, { version, id: id.toString('hex'), idFile, port, address, adaptive, bootstrap, verbose })

if (adaptive) {
  if (!argv.json) log('Running in adaptive mode. Will go persistent once running for ~30 min and holepunchable')
}

dht.on('listening', function () {
  const { address, port, family } = this.socket.address()
  log(`Listening on ${address}:${port} (udp,${family})`, { state: 'listening', address, port, family })
})

dht.on('ready', function () {
  log('DHT node fully bootstrapped', { state: 'bootstrapped' })
})

dht.on('initial-nodes', function () {
  const holepunchable = dht.holepunchable()
  const remoteAddress = dht.remoteAddress()
  log(holepunchable ? `Network appears holepunchable (remote address is ${remoteAddress.host}:${remoteAddress.port})` : 'Warning: Network does not appear holepunchable', { holepunchable, remoteAddress })
})

dht.on('persistent', function () {
  log('DHT appears holepunchable and stable. Now persistent', { state: 'persistent' })
})

dht.on('warning', function (warning) {
  log(`Warning: ${warning.message}`, { warning: { message: warning.message, stack: warning.stack } })
})

dht.on('error', function (error) {
  log(`Error: ${error.stack}`, { error: { message: error.message, stack: error.stack } })
  process.exit(1)
})

dht.listen(port, address)

if (argv.verbose) {
  for (const event of ['announce', 'unannounce', 'lookup']) {
    dht.on(event, function (target, peer) {
      log(`Received ${event}: ${peer.host}:${peer.port} @ ${target.toString('hex')}`, { event, target: target.toString('hex'), peer })
    })
  }
}

function log (s, obj) {
  if (argv.json) {
    console.log(JSON.stringify(obj))
  } else {
    console.log(s)
  }
}

function resolveId (id, idFile) {
  if (id !== undefined) {
    // Skip writing the id to disc as passing in the id is supposed to increase the startup speed.
    return Buffer.from(id, 'hex')
  }

  if (!fs.existsSync(idFile)) fs.writeFileSync(idFile, dhtrpc.id().slice(0, 32))
  return fs.readFileSync(idFile).slice(0, 32)
}
