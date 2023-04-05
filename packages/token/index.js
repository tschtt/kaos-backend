import jwt from 'jsonwebtoken'

const KEY = process.env.TOKEN_KEY
const EXPIRATION = process.env.TOKEN_EXPIRATION
const ALGORITHM = process.env.TOKEN_ALGORITHM || 'HS256'

class InvalidTokenError extends Error {
  constructor(message) {
    super(message || 'Invalid Token')
    this.name = 'InvalidTokenError'
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, InvalidTokenError)
    }
  }
}

export function generate(payload = {}, options = {}) {
  const key = options.key || KEY
  const jwt_options = {}

  if (options.expiration !== false) {
    jwt_options.expiresIn = options.expiration || EXPIRATION
  }
  
  jwt_options.algorithm = options.algorithm || ALGORITHM

  return jwt.sign(payload, key, jwt_options)
}

export function decode(token, options = {}) {
  const key = options.key || KEY
  const jwt_options = {}

  jwt_options.algorithms = []
  jwt_options.algorithms.push(options.algorithm || ALGORITHM)

  try {
    return jwt.verify(token, key, jwt_options)
  } catch {
    throw new InvalidTokenError()
  }
}

export default {
  generate,
  decode,
}
