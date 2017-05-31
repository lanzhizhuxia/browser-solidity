'use strict'
var EventManager = require('ethereum-remix').lib.EventManager

class Remixd {
  constructor () {
    this.event = new EventManager()
    this.callbacks = {}
    this.callid = 0
    this.socket = null
  }

  online () {
    return this.socket !== null
  }

  close () {
    if (this.socket) {
      this.socket.close()
      this.socket = null
    }
  }

  start (cb) {
    if (this.socket) {
      try {
        this.socket.close()
      } catch (e) {}
    }
    this.event.trigger('connecting', [])
    this.socket = new WebSocket('ws://localhost:8887', 'echo-protocol') // eslint-disable-line

    this.socket.addEventListener('open', (event) => {
      this.event.trigger('connected', [event])
      cb()
    })

    this.socket.addEventListener('message', (event) => {
      var data = JSON.parse(event.data)
      if (this.callbacks[data.id]) {
        this.callbacks[data.id](data.error, data.result)
        delete this.callbacks[data.id]
      }
      this.event.trigger('messagging', [event])
    })

    this.socket.addEventListener('error', (event) => {
      this.socket = null
      this.event.trigger('errored', [event])
      cb(event)
    })

    this.socket.addEventListener('close', (event) => {
      if (event.wasClean) {
        this.event.trigger('closed', [event])
      } else {
        this.event.trigger('errored', [event])
      }
      this.socket = null
    })
  }

  call (service, fn, args, callback) {
    this.ensureSocket((error) => {
      if (error) return callback(error)
      if (this.socket && this.socket.readyState === this.socket.OPEN) {
        var data = this.format(service, fn, args)
        this.callbacks[data.id] = callback
        this.socket.send(JSON.stringify(data))
      }
    })
  }

  ensureSocket (cb) {
    if (this.socket) return cb(null, this.socket)
    this.start((error) => {
      if (error) {
        cb(error)
      } else {
        cb(null, this.socket)
      }
    })
  }

  format (service, fn, args) {
    var data = {
      id: this.callid,
      service: service,
      fn: fn,
      args: args
    }
    this.callid++
    return data
  }
}

module.exports = Remixd
