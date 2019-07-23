/*
 * The responder. Should handle sending response for most routes,
 * including errored requests.
 *
 * Will send `res.locals` as JSON if JSON is requested, otherwise
 * it will render res.template (with res.locals, obviously).
 *
 * @module @midwest/responder
 */

// modules > 3rd party
import _ from 'lodash'
import Debug from 'debug'
import { ErrorRequestHandler, Request, Response } from 'express'

const debug = Debug('midwest:responder')

const responses = {
  json (res: IResponse): void {
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

  html (res: IResponse): void {
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

interface IResponse extends Response {
  master: Function
  preventFlatten?: boolean
  render: (view: string | Function, options?: object | undefined, callback?: ((err: Error, html: string) => void) | undefined) => void
  template: Function
  templates: Function[]
}

export default function responderFactory ({ errorHandler, logError = console.error }: { errorHandler?: ErrorRequestHandler, logError?: Function }) {
  return function responder (req: Request, res: IResponse) {
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

        let locals: any

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

        const fakeRes = {
          locals,
          send: (...args: any[]) => res.send(...args),
        } as IResponse

        req.accepts([ 'json', '*/*' ]) === 'json' ? responses.json(fakeRes) : responses.html(fakeRes)
      }
    }
  }
}
