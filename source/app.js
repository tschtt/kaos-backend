import express from 'express'
import multer from 'multer'
import * as controllers from './controllers.js'
import { token } from '@tschtt/global'
import { ForbiddenError, UnauthorizedError } from './errors.js'

const ALLOWED_ORIGINS = process.env.APP_ALLOWED_ORIGINS.split(',')

const upload = multer({ dest: 'static/uploads' })

// middleware

function cors(req, res, next) {
    if (ALLOWED_ORIGINS.includes(req.headers.origin)) {
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
        throw new UnauthorizedError('Authorization header missing')
    }

    const auth_prefix = authorization.split(' ')[0]
    const auth_token = authorization.split(' ')[1]

    if (auth_prefix.toLowerCase() !== 'bearer') {
        throw new UnauthorizedError('Authorization header malformed')
    }

    const payload = token.decode(auth_token)

    if (payload.type !== 'access') {
        throw new AuthenticationFailedError('Invalid token')
    }

    req.auth = payload

    next()
}

function admin(req, res, next) {
    const authorization = req.headers.authorization

    if (!authorization) {
        throw new UnauthorizedError('Authorization header missing')
    }

    const auth_prefix = authorization.split(' ')[0]
    const auth_token = authorization.split(' ')[1]

    if (auth_prefix.toLowerCase() !== 'bearer') {
        throw new UnauthorizedError('Authorization header malformed')
    }

    const payload = token.decode(auth_token)

    if (payload.type !== 'access' || ![1].includes(payload.fk_role)) {
        throw new ForbiddenError()
    }

    req.auth = payload

    next()
}

function producer(req, res, next) {
    const authorization = req.headers.authorization

    if (!authorization) {
        throw new UnauthorizedError('Authorization header missing')
    }

    const auth_prefix = authorization.split(' ')[0]
    const auth_token = authorization.split(' ')[1]

    if (auth_prefix.toLowerCase() !== 'bearer') {
        throw new UnauthorizedError('Authorization header malformed')
    }

    const payload = token.decode(auth_token)

    if (payload.type !== 'access' || ![1, 2].includes(payload.fk_role)) {
        throw new ForbiddenError()
    }

    req.auth = payload

    next()
}

function staff(req, res, next) {
    const authorization = req.headers.authorization

    if (!authorization) {
        throw new UnauthorizedError('Authorization header missing')
    }

    const auth_prefix = authorization.split(' ')[0]
    const auth_token = authorization.split(' ')[1]

    if (auth_prefix.toLowerCase() !== 'bearer') {
        throw new UnauthorizedError('Authorization header malformed')
    }

    const payload = token.decode(auth_token)

    if (payload.type !== 'access' || ![1, 2, 3].includes(payload.fk_role)) {
        throw new ForbiddenError()
    }

    req.auth = payload

    next()
}

function errorHandler(error, req, res, next) {
    switch (error.name) {
        case 'BadRequestError': 
            return res.status(400).send({ success: false, message: error.message })
        case 'InvalidTokenError':
        case 'UnauthorizedError':
            return res.status(401).send({ success: false, message: error.message })
        default:
            console.log(error)
            return res.status(500).send({ success: false, message: 'Internal error' })
    }
}
  
// app

const app = express()

app.use(express.json())
app.use(cors)

app.route('/session/password')
    .post(handler(controllers.sessions.password_reset))

app.route('/session')
    .post(handler(controllers.sessions.login))
    .patch(handler(controllers.sessions.refresh))
    .delete(authed, handler(controllers.sessions.logout));

app.route('/xlsx/tickets')
    .post(producer, upload.single('file'), handler(controllers.xlsx.ticket_import))
    .get(producer, handler(controllers.xlsx.ticket_export));

app.route('/xlsx')
    .post(admin, upload.single('file'), handler(controllers.xlsx.global_import))
    .get(admin, handler(controllers.xlsx.global_export));

app.route('/batches')
    .get(staff, handler(controllers.batches.filter));

app.route('/tickets/:id')
    .patch(staff, handler(controllers.tickets.update));

app.route('/tickets')
    .post(staff, handler(controllers.tickets.create))
    .get(staff, handler(controllers.tickets.filter));

// health
app.get('/', (req, res) => res.send({ success: true, message: 'Bienvenido a la API de Kaos Rave!'}))

app.use(errorHandler)

export default app