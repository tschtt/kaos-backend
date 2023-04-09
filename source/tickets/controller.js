import database from '@tschtt/database'
import fs from 'fs'
import xlsx from 'xlsx'
import { BadRequestError } from '../errors.js'

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
        return {
            tanda: ticket.fk_batch,
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
    try {
        await database.query('START TRANSACTION')

        const event = await database.find('event', { active: true })
        const batches = await database.filter('batch')

        const sheet = workbook.Sheets['Entradas']
        const entradas = xlsx.utils.sheet_to_json(sheet, { raw: false, dateNF:'yyyy-mm-dd' })
        const tickets = entradas.map(entrada => {
            return [
                {
                    fk_event: event.id,
                    fk_batch: entrada.tanda,
                    fk_ticket_status: 1,
                    value: batches.find(b => b.id == entrada.tanda).value,
                    notes: entrada.notas
                },
                {
                    name: entrada.nombre,
                    contact: entrada.contacto,
                }
            ]
        }) 

        for (const [ticket, person] of tickets) {
            const exists_person = await database.find('person', { name: person.name })
            if(exists_person) {
                await database.update('person', { name: person.name }, person)
                ticket.fk_person = exists_person.id
            } else {
                ticket.fk_person = await database.create('person', person)
            }
            
            const exists = await database.find('ticket', { fk_event: event.id, fk_batch: ticket.fk_batch, fk_person: ticket.fk_person })
            if(exists) {
                await database.update('ticket', { id: exists.id }, ticket)
            } else {
                await database.create('ticket', ticket)
            }
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