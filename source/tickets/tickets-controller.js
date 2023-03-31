import database from '@tschtt/database'

const table = database.table('user')

export async function filter (req, res) {
    const event = await database.find('events', { active: true })
    
    if(!event) {
        throw new Error('No hay ningun evento activo')
    }
    
    let result
    result = await table.filter({ fk_event: event.id })
    res.send(result)
}

export async function find (req, res) {
    throw new Error('Not Implemented')
}

export async function create (req, res) {
    throw new Error('Not Implemented')
}

export async function update (req, res) {
    throw new Error('Not Implemented')
}
