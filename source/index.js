import express from 'express'
import * as controllers from './controllers.js'

const PORT = process.env.PORT
const ORIGINS = process.env.ORIGINS.split(',')

const app = express()

app.use((req, res, next) => {
    if (ORIGINS.includes(req.headers.origin)) {
        res.header('Access-Control-Allow-Origin', req.headers.origin)
        res.header('Access-Control-Allow-Headers', 'Authorization, X-API-KEY, Origin, X-Requested-With, Content-Type, Accept, Access-Control-Allow-Request-Method')
        res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE')
        res.header('Allow', 'GET, POST, OPTIONS, PUT, PATCH, DELETE')
    }
    next()
})

app.get('/tickets', controllers.tickets.filter);

app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`)
})