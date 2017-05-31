'use strict'
var async = require('async')
var EventManager = require('ethereum-remix').lib.EventManager

class SystemFiles {
  constructor (remixd) {
    this.event = new EventManager()
    this.remixd = remixd
    this.files = null
    this.filesTree = null
    this.type = 'localhost'
  }

  close (cb) {
    this.remixd.close()
    this.files = null
    this.filesTree = null
    cb()
  }

  init (cb) {
    this.remixd.call('systemfiles', 'list', {}, (error, filesList) => {
      if (error) {
        cb(error)
      } else {
        this.files = {}
        for (var k in filesList) {
          this.files[this.type + '/' + k] = filesList[k]
        }
        listAsTree(this, this.files, (error, tree) => {
          this.filesTree = tree
          cb(error)
        })
      }
    })
  }

  exists (path) {
    path = this.removePrefix(path)
    if (!this.files) return false
    return this.files[path] !== undefined
  }

  get (path, cb) {
    path = this.removePrefix(path)
    this.remixd.call('systemfiles', 'get', {path: path}, (error, result) => {
      cb(error, result)
    })
  }

  set (path, content, cb) {
    var unprefixedpath = this.removePrefix(path)
    this.remixd.call('systemfiles', 'set', {path: unprefixedpath, content: content}, (error, result) => {
      if (cb) cb(error, result)
      this.event.trigger('fileChanged', [path])
    })
    return true
  }

  addReadOnly (path, content) {
    return false
  }

  isReadOnly (path) {
    if (this.files) return this.files[path]
    return true
  }

  remove (path) {
    var unprefixedpath = this.removePrefix(path)
    this.remixd.call('systemfiles', 'remove', {path: unprefixedpath}, (error, result) => {
      if (error) console.log(error)
      this.init(() => {
        this.event.trigger('fileRemoved', [path])
      })
    })
  }

  rename (oldPath, newPath) {
    var unprefixedoldPath = this.removePrefix(oldPath)
    var unprefixednewPath = this.removePrefix(newPath)
    this.remixd.call('systemfiles', 'rename', {oldPath: unprefixedoldPath, newPath: unprefixednewPath}, (error, result) => {
      if (error) console.log(error)
      this.init(() => {
        this.event.trigger('fileRenamed', [oldPath, newPath])
      })
    })
    return true
  }

  list () {
    return this.files
  }

  listAsTree () {
    return this.filesTree
  }

  removePrefix (path) {
    return path.indexOf(this.type + '/') === 0 ? path.replace(this.type + '/', '') : path
  }
}

//
// Tree model for files
// {
//   'a': { }, // empty directory 'a'
//   'b': {
//     'c': {}, // empty directory 'b/c'
//     'd': { '/readonly': true, '/content': 'Hello World' } // files 'b/c/d'
//     'e': { '/readonly': false, '/path': 'b/c/d' } // symlink to 'b/c/d'
//     'f': { '/readonly': false, '/content': '<executable>', '/mode': 0755 }
//   }
// }
//
function listAsTree (self, filesList, callback) {
  function hashmapize (obj, path, val) {
    var nodes = path.split('/')
    var i = 0

    for (; i < nodes.length - 1; i++) {
      var node = nodes[i]
      if (obj[node] === undefined) {
        obj[node] = {}
      }
      obj = obj[node]
    }

    obj[nodes[i]] = val
  }

  var tree = {}

  // This does not include '.remix.config', because it is filtered
  // inside list().
  async.eachSeries(Object.keys(filesList), function (path, cb) {
    self.get(path, (error, content) => {
      if (error) {
        console.log(error)
        cb(error)
      } else {
        hashmapize(tree, path, {
          '/readonly': filesList[path],
          '/content': content
        })
        cb()
      }
    })
  }, (error) => {
    callback(error, tree)
  })
}

module.exports = SystemFiles
