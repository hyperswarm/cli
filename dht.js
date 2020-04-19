#!/usr/bin/env node

const createDht = require('@hyperswarm/dht')
const minimist = require('minimist')
const os = require('os')
const path = require('path')
const fs = require('fs')
const dhtrpc = require('dht-rpc')
const util = require('util')

const argv = minimist(process.argv, {
  boolean: [
    'ephemeral',
    'quiet',
    'help',
    'json'
  ],
  string: [
    'address',
    'id-file',
    'id'
  ],
  default: {
    ephemeral: true,
    'id-file': 'dht-rpc-id',
    quiet: false
  },
  alias: {
    ephemeral: 'e',
    bootstrap: 'b',
    quiet: 'q',
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
  --quiet, -q                Hide announce output
  --no-ephemeral             Host other peoples keys/values
  --bootstrap, -b            Specify bootstrap peers (optional)
`)
  process.exit(1)
}

const id = resolveId(argv.id, argv['id-file'])
const ephemeral = argv.ephemeral
const port = argv.port || process.env.PORT
const bootstrap = argv.boostrap ? [].concat(argv.bootstrap || []) : undefined
let exitCode = 0
const dht = createDht({ ephemeral, adaptive: ephemeral, id: id.id, bootstrap })

log(
  ({ start }) => `Starting Node:
${util.inspect(start, { colors: true })}
`,
  {
    start: {
      nodejsVersion: process.version,
      cliVersion: require('./package.json').version,
      dhtVersion: require('@hyperswarm/dht/package.json').version,
      node: {
        ...id,
        id: dht.id.toString('hex')
      },
      port: port || undefined,
      address: argv.address || undefined,
      bootstrap,
      ephemeral,
      quiet: argv.quiet
    }
  }
)

dht.on('listening', function () {
  log(({ listening: { address, port, family } }) => `Listening to ${address}:${port} (udp,${family})`, { listening: this.socket.address() })
})
dht.on('ready', function () {
  log(() => 'DHT node fully bootstrapped.', { state: 'bootstrapped' })
})
dht.on('persistent', function () {
  log(() => 'DHT is now persistent', { state: 'persitent' })
})
dht.on('warning', function (warning) {
  log(() => `Warning: ${warning.message}`, { warning })
})
dht.on('error', function (error) {
  log(() => `Error: ${error.message}`, { error })
  exitCode = 1
  close()
})
dht.on('close', function () {
  log(() => 'DHT node fully closed.', { state: 'closed' })
  process.exit(exitCode)
})
if (port) {
  dht.listen(port, argv.address)
}

if (!argv.quiet) {
  for (const event of ['announce', 'unannounce', 'lookup']) {
    dht.on(event, function (target, peer) {
      log(({ target, peer }) => `Received ${event}:\n${util.inspect({ target: target.toString('hex'), peer }, { colors: true })}`, { event, target, peer })
    })
  }
}

process.on('SIGINT', close)

function close () {
  log(() => '\nClosing DHT Node.', { state: 'closing' })
  dht.destroy()
}

function log (toString, obj) {
  if (argv.json) {
    console.log(JSON.stringify(obj))
  } else {
    console.log(toString(obj))
  }
}

function resolveId (id, idFile) {
  if (id !== undefined) {
    // Skip writing the id to disc as passing in the id is supposed to increase the startup speed.
    return { id: Buffer.from(id, 'hex'), method: 'argv' }
  }
  // Allowing temporary files as relative paths but also supporting absolute paths.
  idFile = path.resolve(os.tmpdir(), idFile)
  let rndId
  if (!fs.existsSync(idFile)) {
    rndId = dhtrpc.id().slice(0, 32)
    fs.writeFileSync(idFile, rndId)
  }
  id = fs.readFileSync(idFile).slice(0, 32)
  return {
    id,
    method: rndId && rndId.equals(id) ? 'rnd' : 'fs',
    store: idFile
  }
}
