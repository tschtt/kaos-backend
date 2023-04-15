import { database } from '@tschtt/global'

export async function filter(req, res) {
  const batches = await database.filter('batch')
  res.send(batches)
}