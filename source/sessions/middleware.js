import token from '@tschtt/token'

const PAYLOAD_TYPE = process.env.TOKEN_PAYLOAD_TYPE

export function middleware (req, res, next) {
  const authorization = req.headers.authorization

  if (!authorization) {
    throw new AuthenticationFailedError('el header authorization no esta definido')
  }

  const auth_prefix = authorization.split(' ')[0]
  const auth_token = authorization.split(' ')[1]

  if (auth_prefix.toLowerCase() !== 'bearer') {
    throw new AuthenticationFailedError('el encabezado de autorizacion no cumple con el formato requerido')
  }

  const payload = token.decode(auth_token)


  if (PAYLOAD_TYPE && payload.type !== PAYLOAD_TYPE) {
    throw new AuthenticationFailedError('el token provisto no es valido')
  }

  req.auth = {}
  req.auth.payload = payload

  next()
}