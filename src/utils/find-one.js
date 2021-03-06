
const Parse = require('parse/node')
const _debug = require('./output/debug')

module.exports = async (val, ParseClass, _token, { key = 'name', key2 = false, val2 = false, throwENOENT = false, debug = false } = {}) => {
  const query = new Parse.Query(ParseClass)

  _debug(debug, `Querying ${ParseClass.className} for ${key}=${val}`)
  if (key !== 'sha') {
    query.equalTo(key, val)
  } else {
    query.startsWith(key, val)
  }

  if (key2 && val2) {
    query.equalTo(key2, val2)
  }

  const results = await query.find({ sessionToken: _token })

  _debug(debug, `Found ${results.length} results for ${key}=${val}`)

  // if there is a result, return it
  if (results.length > 0) {
    return results[0]
  }

  if (throwENOENT) {
    const error = new Error(`No ${ParseClass.className} called ${val}, or you don't have permission.`)
    error.userError = true
    throw error
  } else {
    return null
  }
}
