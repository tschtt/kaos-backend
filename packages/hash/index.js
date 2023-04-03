import bcrypt from 'bcrypt'

const rounds = process.env.HASH_ROUNDS || 10

export async function make(plain, options = {}) {
  return bcrypt.hash(plain, options.rounds || rounds)
}

export async function check(plain, hashed) {
  return bcrypt.compare(plain, hashed)
}

export default {
  make,
  check
}
