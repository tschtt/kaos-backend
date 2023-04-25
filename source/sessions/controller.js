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
    throw new BadRequestError('El campo "Usuario" es obligatorio.')
  }

  if (!password) {
    throw new BadRequestError('El campo "Contraseña" es obligatorio.')
  }

  const user = await users.find({ username })

  if (!user) {
    throw new BadRequestError('No hay ningún usuario con este nombre.')
  }

  const match = await hash.check(password, user.password)

  if (!match) {
    throw new BadRequestError('La contraseña no es correcta.')
  }

  if (user.password_update) {
    const reset_token = token.generate({ fk_user: user.id, fk_role: user.fk_role, type: 'reset' }, { expiration: EXPIRATION_ACCESS })
    return res.status(403).send({ success: false, message: 'Must reset password', reset_token })
  }
  
  user.role = await database.find('role', { id: user.fk_role })
  
  const access_token = token.generate({ fk_user: user.id, fk_role: user.fk_role, type: 'access' }, { expiration: EXPIRATION_ACCESS })
  const refresh_token = token.generate({ fk_user: user.id, fk_role: user.fk_role, type: 'refresh' }, { expiration: EXPIRATION_REFRESH })

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
    throw new UnauthorizedError('Invalid Token')
  }

  const session = await sessions.find({ fk_user: payload.fk_user })

  if (!session || session.refresh_token !== header_token) {
    throw new UnauthorizedError('Invalid Token')
  }

  const user = await users.find({ id: payload.fk_user })

  if (user.password_update) {
    const reset_token = token.generate({ fk_user: user.id, fk_role: user.fk_role, type: 'reset' }, { expiration: EXPIRATION_ACCESS })
    return res.status(403).send({ success: false, message: 'Must reset password', reset_token })
  }
  
  user.role = await database.find('role', { id: user.fk_role })
  
  delete user.password

  const access_token = token.generate({ fk_user: user.id, fk_role: user.fk_role, type: 'access' }, { expiration: EXPIRATION_ACCESS })
  const refresh_token = token.generate({ fk_user: user.id, fk_role: user.fk_role, type: 'refresh' }, { expiration: EXPIRATION_REFRESH })

  await sessions.remove({ fk_user: payload.fk_user })
  await sessions.create({ fk_user: payload.fk_user, refresh_token })

  res.send({
    access_token,
    refresh_token,
    user,
  })
}

export async function password_reset(req, res) {
  const header_token = req.headers.authorization.split(' ')[1]
  const payload = token.decode(header_token)
  const password = req.body.password

  if (payload.type !== 'reset') {
    throw new UnauthorizedError('Invalid Token')
  }

  if (!req.body.password) {
    throw new BadRequestError('Missing password in body')
  }

  const password_hash = await hash.make(password)
  
  await users.update(
    { id: payload.fk_user }, 
    { password_update: false, password: password_hash }
  )

  res.send({
    success: true,
    message: 'La contraseña se actualizó correctamente.'
  })
}