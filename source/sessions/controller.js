import { UnauthorizedError, BadRequestError } from '../errors.js'
import { database, hash, token } from '@tschtt/global'

const EXPIRATION_ACCESS = parseInt(process.env.TOKEN_ACCESS_EXPIRATION)
const EXPIRATION_REFRESH = parseInt(process.env.TOKEN_REFRESH_EXPIRATION)

const users = database.table('user')
const sessions = database.table('session')

export async function login(req, res) {
  const username = req.body.username
  const password = req.body.password

  if (!username) {
    throw new BadRequestError('Missing username')
  }

  if (!password) {
    throw new BadRequestError('Missing password')
  }

  const user = await users.find({ username })

  if (!user) {
    throw new BadRequestError('Could not fin user')
  }

  const match = await hash.check(password, user.password)

  if (!match) {
    throw new BadRequestError('Invalid password')
  }

  const access_token = token.generate({ fk_user: user.id, type: 'access' }, { expiration: EXPIRATION_ACCESS })
  const refresh_token = token.generate({ fk_user: user.id, type: 'refresh' }, { expiration: EXPIRATION_REFRESH })

  await sessions.remove({ fk_user: user.id })
  await sessions.create({ fk_user: user.id, refresh_token })

  delete user.password

  res.send({
    access_token,
    refresh_token,
    user,
  })
}

export async function logout(req, res) {
  const fk_user = req.auth.fk_user
  
  await sessions.remove({ fk_user })
  
  res.send({
    success: true,
    message: 'Se cerró la sesión',
  })
}

export async function refresh(req, res) {
  const authorization = req.headers.authorization

  const header_token = authorization.split(' ')[1]
  const payload = token.decode(header_token)

  if (payload.type !== 'refresh') {
    throw new UnauthorizedError('Token invalid')
  }

  const session = await sessions.find({ fk_user: payload.fk_user })

  if (!session || session.refresh_token !== header_token) {
    throw new UnauthorizedError('Token invalid')
  }

  const user = await users.find({ id: payload.fk_user })

  delete user.password

  const access_token = token.generate({ fk_user: user.id, type: 'access' }, { expiration: EXPIRATION_ACCESS })
  const refresh_token = token.generate({ fk_user: user.id, type: 'refresh' }, { expiration: EXPIRATION_REFRESH })

  await sessions.remove({ fk_user: payload.fk_user })
  await sessions.create({ fk_user: payload.fk_user, refresh_token })

  res.send({
    access_token,
    refresh_token,
    user,
  })
}