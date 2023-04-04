import { UnauthorizedError, BadRequestError } from '../errors.js'
import { database, hash, token } from '@tschtt/global'

const users = database.table('user')
const sessions = database.table('session')

export async function login(req, res) {
  const username = req.body.username
  const password = req.body.password

  if (!username) {
    throw new BadRequestError('Falta el nombre de usuario')
  }

  if (!password) {
    throw new BadRequestError('Falta la contraseña')
  }

  const user = await users.find({ username })

  if (!user) {
    throw new BadRequestError('No hay ningun usuario con este nombre')
  }

  const match = await hash.check(password, user.password)

  if (!match) {
    throw new BadRequestError('La contraseña es incorrecta')
  }

  const access_token = token.generate({ id: user.id, type: 'access' }, { expiration: 3600 })
  const refresh_token = token.generate({ id: user.id, type: 'refresh' }, { expiration: 6000 })

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
  const fk_user = req.auth.id
  
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
    throw new UnauthorizedError('El token provisto es invalido')
  }

  const session = await sessions.find({ fk_user: payload.id })

  if (!session || session.refresh_token !== header_token) {
    throw new UnauthorizedError('El token provisto esta vencido')
  }

  const user = await users.find({ id: payload.id })

  delete user.contraseña

  const access_token = token.generate({ id: payload.id, type: 'access' }, { expiration: 3600 })
  const refresh_token = token.generate({ id: payload.id, type: 'refresh' }, { expiration: 6000 })

  await sessions.remove({ fk_user: payload.id })
  await sessions.create({ fk_user: payload.id, refresh_token })

  res.send({
    access_token,
    refresh_token,
    user,
  })
}