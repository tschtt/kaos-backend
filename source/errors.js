
export class BadRequestError extends Error {
  constructor(message) {
    super(message)
    this.name = 'BadRequestError'
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, BadRequestError)
    }
  }
}

export class UnauthorizedError extends Error {
  constructor(message) {
    super(message)
    this.name = 'UnauthorizedError'
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, UnauthorizedError)
    }
  }
}

export class ForbiddenError extends Error {
  constructor() {
    super('You dont have permission to this resource')
    this.name = 'ForbiddenError'
    if(Error.captureStackTrace) {
      Error.captureStackTrace(this, ForbiddenError)
    }
  }
}