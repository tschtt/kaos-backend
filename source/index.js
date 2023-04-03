import express from 'express'
import * as controllers from './controllers.js'

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

app.delete('/sessions', handler(controllers.sessions.logout))
app.patch('/sessions', handler(controllers.sessions.refresh))
app.post('/sessions', handler(controllers.sessions.login))

app.patch('/tickets/:id', handler(controllers.tickets.update));
app.post('/tickets', handler(controllers.tickets.create));
app.get('/tickets', handler(controllers.tickets.filter));

app.all('*', (req, res) => {
    res.status(404).send({ success: false, message: 'Resource not found' })
})

app.use(errorHandler)

// start

app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`)
})