import { BadRequestError } from "../errors.js"
import { database } from "@tschtt/global"
import xlsx from 'xlsx'
import fs from 'fs'

// constants

const BATCHES = {
    TANDA_1: 1,
    TANDA_2: 2,
    TANDA_3: 3,
    PREVENTA: 4,
    STAFF: 8,
    FREE: 9,
}

// formatters

function format_event({ id, active, fk_location, name, date }) {
    return {
        id,
        id_lugar: fk_location,
        nombre: name,
        fecha: date.toLocaleDateString('es-AR'),
        activo: active ? 'SI' : 'NO'
    }
}

function format_location({ id, name, address, link }) {
    return {
        id,
        nombre: name,
        direccion: address,
        link
    }
}

function format_batch({ id, name, value }) {
    return {
        id,
        nombre: name,
        precio: value,
    }
}

function format_ticket({ id, fk_event, fk_batch, fk_person, value, notes }, people) {
    const person = people.find(person => person.id === fk_person)
    return {
        id,
        id_evento: fk_event,
        id_tanda: fk_batch,
        nombre: person.name,
        contacto: person.contact,
        precio: value,
        notas: notes,
    }
}

function format_staff({ id, fk_person }, people) {
    const person = people.find(person => person.id === fk_person)
    return {
        id,
        nombre: person.name,
        contacto: person.contact,
    }
}

function format_user({ id, username, fk_person }, people) {
    const person = people.find(person => person.id === fk_person)
    return {
        id,
        usuario: username,
        nombre: person.name,
        contacto: person.contact,
    }
}

// parsers

function parse_event({ id, id_lugar, nombre, fecha, activo }) {
    const [year, month, date] = fecha.split('-')
    return {
        id: parseInt(id),
        fk_location: parseInt(id_lugar),
        name: nombre,
        slug: nombre.toLowerCase().replaceAll(' ', '-'),
        date: new Date(year, month - 1, date),
        active: activo === 'SI' ? true : false,
    }
}

function parse_location({ id, nombre, direccion, link }) {
    return {
        id: parseInt(id),
        name: nombre,
        address: direccion,
        link,
    }
}

function parse_batch({ id, nombre, precio }) {
    return {
        id: parseInt(id),
        name: nombre, 
        value: parseInt(precio),
    }
}

function parse_ticket({ id, id_evento, id_tanda, nombre, contacto, precio, notas }) {
    return [
        {
            id: parseInt(id),
            fk_event: id_evento,
            fk_batch: id_tanda,
            value: precio,
            notes: notas,
        },
        {
            name: nombre.toLowerCase(),
            contact: contacto,
        }
    ]
}

function parse_staff({ id, nombre, contacto }) {
    return [
        {
            id: parseInt(id),
        },
        {
            name: nombre.toLowerCase(),
            contact: contacto,
        }
    ]
}

function parse_user({ id, usuario, nombre, contacto }) {
    return [
        {
            id: parseInt(id),
            username: usuario.toLowerCase(),
        },
        {
            name: nombre.toLowerCase(),
            contact: contacto,
        },
    ]
}

export async function global_export(req, res) {
    const filename = `static/exports/${Date.now()}.xlsx`
    const workbook = xlsx.utils.book_new()
    
    const people = await database.filter('person')

    // Eventos
    
    const events = await database.filter('event')
    const events_parsed = events.map(event => format_event(event))
    const events_sheet = xlsx.utils.json_to_sheet(events_parsed)
    xlsx.utils.book_append_sheet(workbook, events_sheet, 'Eventos')

    // Lugares
    
    const locations = await database.filter('location')
    const locations_parsed = locations.map(event => format_location(event))
    const locations_sheet = xlsx.utils.json_to_sheet(locations_parsed)
    xlsx.utils.book_append_sheet(workbook, locations_sheet, 'Lugares')

    // Tandas

    const batches = await database.filter('batch')
    const batches_parsed = batches.map(batch => format_batch(batch))
    const batches_sheet = xlsx.utils.json_to_sheet(batches_parsed)
    xlsx.utils.book_append_sheet(workbook, batches_sheet, 'Tandas')

    // Entradas

    const tickets = await database.filter('ticket')
    const tickets_parsed = tickets.map(ticket => format_ticket(ticket, people))
    const tickets_sheet = xlsx.utils.json_to_sheet(tickets_parsed)
    xlsx.utils.book_append_sheet(workbook, tickets_sheet, 'Entradas')

    // Staff

    const staffs = await database.filter('staff')
    const staffs_parsed = staffs.map(staff => format_staff(staff, people))
    const staffs_sheet = xlsx.utils.json_to_sheet(staffs_parsed)
    xlsx.utils.book_append_sheet(workbook, staffs_sheet, 'Staff')

    // Usuarios
    
    const users = await database.filter('user')
    const users_parsed = users.map(user => format_user(user, people))
    const users_sheet = xlsx.utils.json_to_sheet(users_parsed)
    xlsx.utils.book_append_sheet(workbook, users_sheet, 'Usuarios')

    xlsx.writeFile(workbook, filename)

    // const locations = (await database.filter('location')).map(format_location)
    
    // const batches = (await database.filter('batch')).map(format_batch)
    
    // const people = await database.filter('people')
    // const tickets = (await database.filter('ticket')).map(ticket => format_ticket(ticket, people))
    // const staff = (await database.filter('staff')).map(staff => format_staff(staff, people))
    // const users = (await database.filter('users')).map(user => format_user(user, people))

    // const path = spreadsheet.write({
    //   to: '/static/exports',
    //   name: `${Date.now()}`,
    //   sheets: [
    //     { name: 'Eventos'  , data: events    },
    //     { name: 'Lugares'  , data: locations },
    //     { name: 'Tandas'   , data: batches   },
    //     { name: 'Tickets'  , data: tickets   },
    //     { name: 'Staff'    , data: staff     },
    //     { name: 'Usuarios' , data: users     },
    //   ]
    // })

    res.download(filename)
}

export async function global_import(req, res) {
    const workbook = xlsx.readFile(req.file.path, { cellText:false, cellDates:true})
    try {
        await database.query('START TRANSACTION')
        // locations
        
        const locations_sheet = workbook.Sheets['Lugares']
        const locations_raw = xlsx.utils.sheet_to_json(locations_sheet, { raw: false })
        const locations = locations_raw.map(parse_location)
    
        for (const location of locations) {
            const location_existing = await database.find('location', { id: location.id })
            if(location_existing) {
                await database.update('location', { id: location.id }, location)
            } else {
                await database.create('location', location)
            }
        }
        
        // eventos
        
        const events_sheet = workbook.Sheets['Eventos']
        const events_raw = xlsx.utils.sheet_to_json(events_sheet, { raw: false, dateNF:'yyyy-mm-dd' })
        const events = events_raw.map(parse_event)
    
        for (const event of events) {
            const exists = await database.find('event', { id: event.id })
            if(exists) {
                await database.update('event', { id: event.id }, event)
            } else {
                await database.create('event', event)
            }
        }
        
        // batches
    
        const batches_sheet = workbook.Sheets['Tandas']
        const batches_raw = xlsx.utils.sheet_to_json(batches_sheet, { raw: false })
        const batches = batches_raw.map(parse_batch)
    
        for (const batch of batches) {
            const exists = await database.find('batch', { id: batch.id })
            if(exists) {
                await database.update('batch', { id: batch.id }, batch)
            } else {
                await database.create('batch', batch)
            }
        }
        
        // tickets
        
        const tickets_sheet = workbook.Sheets['Entradas']
        const tickets_raw = xlsx.utils.sheet_to_json(tickets_sheet, { raw: false })
        const tickets = tickets_raw.map(parse_ticket)
    
        for (const [ticket, person] of tickets) {
            const exists_person = await database.find('person', { name: person.name })
            if(exists_person) {
                await database.update('person', { name: person.name }, person)
                ticket.fk_person = exists_person.id
            } else {
                ticket.fk_person = await database.create('person', person)
            }
            
            const exists = await database.find('ticket', { id: ticket.id })
            if(exists) {
                await database.update('ticket', { id: ticket.id }, ticket)
            } else {
                await database.create('ticket', ticket)
            }
        }
        
        // staff
    
        const staffs_sheet = workbook.Sheets['Staff']
        const staffs_raw = xlsx.utils.sheet_to_json(staffs_sheet, { raw: false })
        const staffs = staffs_raw.map(parse_staff)
    
        for (const [staff, person] of staffs) {
            const exists_person = await database.find('person', { name: person.name })
            if(exists_person) {
                await database.update('person', { name: person.name }, person)
                staff.fk_person = exists_person.id
            } else {
                staff.fk_person = await database.create('person', person)
            }
            
            const exists = await database.find('staff', { id: staff.id })
            if(exists) {
                await database.update('staff', { id: staff.id }, staff)
            } else {
                await database.create('staff', staff)
            }
        }
        
        // users
        
        const users_sheet = workbook.Sheets['Usuarios']
        const users_raw = xlsx.utils.sheet_to_json(users_sheet, { raw: false })
        const users = users_raw.map(parse_user)
    
        for (const [user, person] of users) {
            const exists_person = await database.find('person', { name: person.name })
            if(exists_person) {
                await database.update('person', { name: person.name }, person)
                user.fk_person = exists_person.id
            } else {
                user.fk_person = await database.create('person', person)
            }
            
            const exists = await database.find('user', { id: user.id })
            if(exists) {
                await database.update('user', { id: user.id }, user)
            } else {
                await database.create('user', user)
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
        fs.rmSync(req.file.path)
        throw error
    }
}

export async function ticket_export (req, res) {
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

export async function ticket_import (req, res) {
    // read xlsx file
    
    const workbook = xlsx.readFile(req.file.path, { cellText:false, cellDates:true})
    
    // get base data
    
    const event = await database.find('event', { active: true })
    const batches = await database.filter('batch')
    
    // get sheets
    
    const sheet_tickets = workbook.Sheets['Lista']
    const sheet_staff = workbook.Sheets['Staff']
    const sheet_free = workbook.Sheets['Free']

    if(!sheet_tickets) {
        throw new BadRequestError('El archivo no es valido')
    }

    if(!sheet_staff) {
        throw new BadRequestError('El archivo no es valido')
    }

    if(!sheet_free) {
        throw new BadRequestError('El archivo no es valido')
    }
    
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