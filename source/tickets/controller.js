import database from '@tschtt/database'

export async function filter (req, res) {
    // get active event    
    const event = await database.find('event', { active: true })    
    
    // get tickets for event with person
    const tickets = await database.filter('ticket', { fk_event: event.id })
    const persons = await database.filter('person', { id: tickets.map(t => t.fk_person) })
    for (const ticket of tickets) {
        ticket.person = persons.find(p => p.id === ticket.fk_person)
    }
    
    res.send({
        tickets,
    })
}

export async function find (req, res) {
    throw new Error('Not Implemented')
}

export async function create (req, res) {
    const name = req.body.person.name;
    const contact = req.body.person.contact;
    const pronouns = req.body.person.pronouns;
    const fk_ticket_status = req.body.fk_ticket_status;

    const event = await database.find('event', { active: true })
    const batch = await database.find('batch', { fk_event: event.id, active: true })
    
    const fk_person = await database.upsert('person', { name }, { name, contact, pronouns })

    const id = await database.create('ticket', {
        fk_event: event.id,
        fk_batch: batch.id,
        fk_person,
        fk_ticket_status,
    })

    res.send({
        id
    })
}

export async function update (req, res) {
    const id = req.params.id
    const fk_ticket_status = req.body.fk_ticket_status;

    const count = await database.update('ticket', { id }, { fk_ticket_status })

    res.send({
        count
    })    
}
