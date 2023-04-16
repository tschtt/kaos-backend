import database from '@tschtt/database'
import fs from 'fs'
import xlsx from 'xlsx'
import { BadRequestError } from '../errors.js'

const BATCHES = {
    TANDA_1: 1,
    TANDA_2: 2,
    TANDA_3: 3,
    PREVENTA: 4,
    STAFF: 8,
    FREE: 9,
}

export async function filter (req, res) {
    // get active event    
    const event = await database.find('event', { active: true })    
    
    // get tickets for event with person
    const tickets = await database.filter('ticket', { fk_event: event.id })

    if(!tickets.length) {
        return res.send([])
    }
    
    const persons = await database.filter('person', { id: tickets.map(t => t.fk_person) })
    for (const ticket of tickets) {
        ticket.person = persons.find(p => p.id === ticket.fk_person)
    }
    
    return res.send(tickets)
}

export async function find (req, res) {
    throw new Error('Not Implemented')
}

export async function create (req, res) {
    const name = req.body.person.name;
    const contact = req.body.person.contact;
    const fk_batch = req.body.fk_batch;
    const fk_ticket_status = req.body.fk_ticket_status;

    const event = await database.find('event', { active: true })
    const batch = await database.find('batch', { active: true, id: fk_batch })
    
    const fk_person = await database.upsert('person', { name }, { name, contact })

    const id = await database.create('ticket', {
        fk_event: event.id,
        fk_batch: batch.id,
        fk_person,
        fk_ticket_status,
        value: batch.value,
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

export async function exportXLSX (req, res) {
    const filename = `static/exports/${Date.now()}.xlsx`
    const workbook = xlsx.utils.book_new()
    
    const event = await database.find('event', { active: true })

    if(!event) {
        throw new BadRequestError('No active event')
    }
    
    const tickets = await database.filter('ticket', { fk_event: event.id })
    const people = await database.filter('person')

    const entradas = tickets.map(ticket => {
        const person = people.find(person => person.id === ticket.fk_person)
        let tanda = ticket.fk_batch
        if(tanda == 4) tanda = 'p'
        if(tanda == 5) tanda = 'f'
        return {
            tanda,
            nombre: person.name,
            contacto: person.contact,
            notas: ticket.notes,
        }
    })
    
    entradas.sort((a, b) => {
        if(a.nombre < b.nombre) { 
            return -1
        }
        if(a.nombre > b.nombre) {
            return 1
        }
        return 0
    })

    const sheet = xlsx.utils.json_to_sheet(entradas)

    xlsx.utils.book_append_sheet(workbook, sheet, 'Entradas')
    xlsx.writeFile(workbook, filename)

    res.download(filename)
}

export async function importXLSX (req, res) {
    const workbook = xlsx.readFile(req.file.path, { cellText:false, cellDates:true})
    const event = await database.find('event', { active: true })
    const batches = await database.filter('batch')
    
    const sheet_tickets = workbook.Sheets['Lista']
    const sheet_staff = workbook.Sheets['Staff']
    const sheet_free = workbook.Sheets['Free']

    const raw_tickets = xlsx.utils.sheet_to_json(sheet_tickets, { raw: false, dateNF:'yyyy-mm-dd' })
    const raw_staff = xlsx.utils.sheet_to_json(sheet_staff, { raw: false, dateNF:'yyyy-mm-dd' })
    const raw_free = xlsx.utils.sheet_to_json(sheet_free, { raw: false, dateNF:'yyyy-mm-dd' })
    
    // parse excel data
    
    const batch_staff = batches.find(batch => batch.id === BATCHES.STAFF)
    const batch_free = batches.find(batch => batch.id === BATCHES.FREE)
    
    const tickets_batches = raw_tickets.map(ticket => {
        const batch = batches.find(batch => batch.name.toLowerCase() == ticket.tanda.toLowerCase() || batch.id == ticket.tanda)
        return [
            {
                fk_event: event.id,
                fk_batch: batch.id,
                value: batch.value,
                notes: ticket.notas,
            },
            {
                name: ticket.nombre,
                contact: ticket.contacto,
            },
        ]
    })

    const tickets_staff = raw_staff.map(ticket => {
        return [
            {
                fk_event: event.id,
                fk_batch: batch_staff.id,
                value: batch_staff.value,
                notes: ticket.notas,
            },
            {
                name: ticket.nombre,
                contact: ticket.contacto,
            }
        ]
    })

    const tickets_free = raw_free.map(ticket => {
        return [
            {
                fk_event: event.id,
                fk_batch: batch_free.id,
                value: batch_free.value,
                notes: ticket.notas,
            },
            {
                name: ticket.nombre,
                contact: ticket.contacto,
            }
        ]
    })
    
    const tickets = [
        ...tickets_batches,
        ...tickets_staff,
        ...tickets_free,
    ]
    
    // insert data
    await database.query('START TRANSACTION')
        
    try {
        await database.remove('ticket', { fk_event: event.id })
        
        for (const [ticket, person] of tickets) {
            ticket.fk_person = await database.upsert('person', { name: person.name }, person)
            await database.create('ticket', ticket)
        }
        
        await database.query('COMMIT')

        fs.rmSync(req.file.path)
        
        res.send({
            success: true,
            message: 'Los datos se actualizaron correctamente'
        })   
    } catch (error) {
        await database.query('ROLLBACK')
        throw error
    }
}