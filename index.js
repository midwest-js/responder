/*
 * The responder. Should handle sending response for most routes,
 * including errored requests.
 *
 * Will send `res.locals` as JSON if JSON is requested, otherwise
 * it will render res.template (with res.locals, obviously).
 *
 * @module @midwest/responder
 */

'use strict'

// modules > 3rd party
const _ = require('lodash')
const debug = require('debug')('midwest:responder')

const responses = {
  json (res) {
    // TODO now this function is also called by '*/*'
    debug('ACCEPTS json, returning json')

    /* if preventFlatten is not truthy and there is only a
     * single property on `res.locals` then we should only return that
     * property.
     *
     * this is to prevent api routes from sending nested json object. (eg
     * `/api/employees` returning { employees: [Employee] } or /api/employees/:id
     * returning { employee: Employee }
     */
    res.json(!res.preventFlatten &&
      Object.keys(res.locals).length === 1 ? _.values(res.locals)[0] : res.locals ||
      {})
  },

  html (res) {
    debug('ACCEPTS html, returning html')

    if (res.templates || res.master) {
      debug('res.templates or res.master set, rendering.')

      const templates = res.templates || []

      return void res.render(res.master, ...templates)
    }

    debug('res.template or res.master not set, sending <pre>.')

    res.send(`<pre>${JSON.stringify(res.locals, null, '  ')}</pre>`)
  },
}

module.exports = function responderFactory ({ errorHandler, logError = console.error } = {}) {
  return function responder (req, res) {
    if (res.template && !res.templates) {
      res.templates = [ res.template ]
    }

    res.set('Vary', 'accept')

    try {
      req.accepts([ 'json', '*/*' ]) === 'json' ? responses.json(res) : responses.html(res)
    } catch (e) {
      if (errorHandler && !res.locals.error) {
        errorHandler(e, req, res, () => {
          responder(req, res)
        })
      } else {
        console.error('[!!!] ERROR IN RESPONDER, RESPONDER ERROR')
        logError(e)

        let locals

        if (res.locals.error) {
          console.error('[!!!] ERROR IN RESPONDER, ORIGINAL ERROR')

          logError(res.locals.error)

          locals = {
            responderError: _.pick(e, 'name', 'message'),
            originalError: _.pick(res.locals.error, 'name', 'message'),
          }
        } else {
          locals = { e }
        }

        responses[req.accepts(['json', '*/*'])]({
          locals,
          send: (...args) => res.send(...args),
        })
      }
    }
  }
}
