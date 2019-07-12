#!/usr/bin/env node

const hyperswarm = require('hyperswarm')
const sodium = require('sodium-universal')
const minimist = require('minimist')
const pump = require('pump')

const argv = minimist(process.argv, {
  boolean: [
    'hash'
  ],
  alias: {
    hash: 'h',
    announce: 'a',
    lookup: 'l',
    key: 'k'
  }
})

if (!argv.lookup && !argv.announce) {
  console.error(`Usage: hyperswarm-swarm [options]

  --announce, -a
  --lookup, -l
  --hash, -h
  --key, -k
`)
  process.exit(1)
}

const swarm = hyperswarm()

let id = 0

swarm.on('connection', function (connection, info) {
  const i = id++
  console.error('[connection start id=' + i + ' type=' + info.type + ' client=' + info.client + ']')
  pump(process.stdin, connection, process.stdout, function (err) {
    console.error('[connection end id=' + i + ' err=' + (err || null) + ']')
  })
})

swarm.join(key(), {
  lookup: argv.lookup,
  announce: argv.announce
})

process.once('SIGINT', function () {
  console.error('[swarm destroying ...]')
  swarm.destroy()
})

function key () {
  const k = argv.key || argv.announce || argv.lookup
  if (argv.hash) return hash(Buffer.from(k))
  return Buffer.from(k, 'hex')
}

function hash (data) {
  const out = Buffer.allocUnsafe(32)
  sodium.crypto_generichash(out, data)
  return out
}
