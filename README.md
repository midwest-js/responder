# Midwest Responder

One of the main concepts behind Midwest is a global responder middleware.
Basically no other middleware should be sending the response, they should
simply call `next()` until the responder is reached. The responder then either
send the contents of `res.locals` as JSON or renders a template.

Only the global responder should ever be terminating a request (ie. send a response).

The responder is a very short and simple middleware that decides what to send
back to the client.

## Usage

```js
const errorHandler = require('@midwest/error-handler')(config.errorHandler)

server.use([
  require('midwest/middleware/ensure-found'),
  // format and log error
  errorHandler,
  // respond
  require('@midwest/responder')({
    errorHandler,
    logError: require('@midwest/error-handler/log'),
  }),
])
```

## Rendering

When the responder renders, calls the the render method:

```js
res.render(res.master, ...(res.templates || []))
```

### Master vs Template

The master is the template that contains the `<html>, <head> and <body>` tags. It includes
scripts, styles etc. 

## Prevent Flattening

If there is only a single property on the `res.locals` object,
the responder will send that property directly. Ie. if `res.locals = { poopsicle: {...} }`
`{...}` will be sent instead of `{ poopsicle: {...} }`.

## Caveats

### Static routes also matching dynamic routes

Since no middleware except the responder should be sending the response,
dynamic routes that match static routes will clash.

Ie. if you have 

```js
server.get('/api/users/me', mw.getCurrent)
server.get('/api/users/:id', isAdmin, mw.findById)
```

and make a request to `/api/users/me`, the isAdmin
and `mw.findById` middleware will always be called after `mw.getCurrent`.
If the user is not an admin, all requests to `/api/users/me` will return
the `401` response from `isAdmin` middleware.

To prevent this, create a `Express#param` function like so:

```js
router.param(':id', (req, res, next, id) => {
  if (id === 'me')
    return next('route')

  next()
})
```
