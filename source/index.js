import express from 'express'
import * as controllers from './controllers.js'
import { token } from '@tschtt/global'
import { UnauthorizedError } from './errors.js'

const PORT = process.env.PORT
const ORIGINS = process.env.ORIGINS.split(',')

// middleware

function cors(req, res, next) {
    if (ORIGINS.includes(req.headers.origin)) {
        res.header('Access-Control-Allow-Origin', req.headers.origin)
        res.header('Access-Control-Allow-Headers', 'Authorization, X-API-KEY, Origin, X-Requested-With, Content-Type, Accept, Access-Control-Allow-Request-Method')
        res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE')
        res.header('Allow', 'GET, POST, OPTIONS, PUT, PATCH, DELETE')
    }
    next()   
}

function handler(endpoint){
    return async function(req, res, next) {
        await endpoint(req, res, next).catch(next)
    }
} 

function authed (req, res, next) {
    const authorization = req.headers.authorization

    if (!authorization) {
        throw new UnauthorizedError('el header authorization no esta definido')
    }

    const auth_prefix = authorization.split(' ')[0]
    const auth_token = authorization.split(' ')[1]

    if (auth_prefix.toLowerCase() !== 'bearer') {
        throw new UnauthorizedError('el encabezado de autorizacion no cumple con el formato requerido')
    }

    const payload = token.decode(auth_token)


    if (payload.type !== 'access') {
        throw new AuthenticationFailedError('el token provisto no es valido')
    }

    req.auth = payload

    next()
}

function errorHandler(error, req, res, next) {
    console.log(error)
    switch (error.name) {
      case 'BadRequestError': 
        return res.status(400).send({ success: false, message: error.message })
      case 'UnauthorizedError':
      case 'AuthenticationFailedError':
        return res.status(401).send({ success: false, message: error.message })
      default:
        return res.status(500).send({ success: false, message: error.message || 'Error interno' })
    }
}
  
// app

const app = express()

app.use(express.json())
app.use(cors)

app.delete('/session', authed, handler(controllers.sessions.logout))
app.patch('/session', handler(controllers.sessions.refresh))
app.post('/session', handler(controllers.sessions.login))

app.patch('/tickets/:id', authed, handler(controllers.tickets.update));
app.post('/tickets', authed, handler(controllers.tickets.create));
app.get('/tickets', authed, handler(controllers.tickets.filter));

// app.all('*', (req, res) => {
//     res.status(404).send({ success: false, message: 'Resource not found' })
// })

app.use(errorHandler)

// start

app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`)
})