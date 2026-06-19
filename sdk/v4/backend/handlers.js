import { readFileSync } from 'node:fs';
import { config, db } from './database.js';
import * as model from './model.js';

function getRequestbody(request) {
    if (request._rawBody !== undefined) return Promise.resolve(request._rawBody);
    return new Promise(function(resolve) {
        let body = '';
        request.on('data', chunk => body += chunk.toString());
        request.on('end', () => { request._rawBody = body; resolve(body); });
        // also handle errors
        request.on('error', () => { request._rawBody = ''; resolve(''); });
    });
}

async function logout_handler(request, response) {
    // Verificar que es POST; username comes from header 'x-user-id'
    if (request.method !== 'POST') {
        response.writeHead(400, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ exception: 'BadRequest', detail: ['Invalid method'] }));
    }
    try {
        const username = request.headers['x-user-id'];
        if (!username || typeof username !== 'string' || username.length === 0) {
            response.writeHead(401, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ exception: 'Unauthorized', detail: ['Missing or invalid x-user-id header'] }));
        }

        const output = model.logout(username);
        if (!output || !output.status) {
            const msg = output && output.message ? String(output.message) : 'No active session';
            response.writeHead(422, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ exception: 'DomainError', detail: [msg] }));
        }

        response.writeHead(200, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ message: 'Logged out', username }));
    } catch (err) {
        console.error('logout_handler error:', err);
        response.writeHead(500, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ exception: 'ServerError', detail: ['Internal server error'] }));
    }
}


async function register_handler(request, response) {
    // Verifica que el método es POST with body { username, accesskey }
    if (request.method !== 'POST') {
        response.writeHead(400, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ exception: 'BadRequest', detail: ['Invalid method'] }));
    }
    try {
        const data = await getRequestbody(request);
        let obj;
        try {
            obj = JSON.parse(data || '{}');
        } catch (e) {
            response.writeHead(400, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ exception: 'BadRequest', detail: ['Invalid JSON'] }));
        }

        if (!obj || typeof obj.username !== 'string' || typeof obj.accesskey !== 'string' || obj.username.length === 0 || obj.accesskey.length === 0) {
            response.writeHead(400, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ exception: 'BadRequest', detail: ['Missing username or accesskey'] }));
        }

        if (model.chequearUsuario(obj.username)) {
            // Error de Dominio: Usuario ya existe
            response.writeHead(422, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ exception: 'DomainError', detail: ['User already exists'] }));
        }

        const output = model.createUser(obj.username, obj.accesskey);
        response.writeHead(200, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ username: output.username, id: output.id }));
    } catch (err) {
        console.error('register_handler error:', err);
        response.writeHead(500, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ exception: 'ServerError', detail: ['Internal server error'] }));
    }
}

async function delete_user_handler(request, response) {
    // Validar si el metodo es POST with body { username }
    if (request.method !== 'POST') {
        response.writeHead(400, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ exception: 'BadRequest', detail: ['Invalid method'] }));
    }
    try {
        const data = await getRequestbody(request);
        let obj;
        try {
            obj = JSON.parse(data || '{}');
        } catch (e) {
            response.writeHead(400, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ exception: 'BadRequest', detail: ['Invalid JSON'] }));
        }

        if (!obj || typeof obj.username !== 'string' || obj.username.length === 0) {
            response.writeHead(400, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ exception: 'BadRequest', detail: ['Missing username'] }));
        }

        if (!model.chequearUsuario(obj.username)) {
            response.writeHead(422, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ exception: 'DomainError', detail: ['User not found'] }));
        }

        const deleted = model.deleteUser(obj.username);
        if (deleted > 0) {
            response.writeHead(200, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ username: obj.username }));
        }

        // Si no se borraron filas, tomarlo como error de dominio
        response.writeHead(422, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ exception: 'DomainError', detail: ['Could not delete user'] }));
    } catch (err) {
        console.error('delete_user_handler error:', err);
        response.writeHead(500, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ exception: 'ServerError', detail: ['Internal server error'] }));
    }
}

async function update_user_handler(request, response) {
    // Verificar que el método sea POST y el body contenga { username, newUsername?, accesskey? }
    if (request.method !== 'POST') {
        response.writeHead(400, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ exception: 'BadRequest', detail: ['Invalid method'] }));
    }
    try {
        const data = await getRequestbody(request);
        let obj;
        try {
            obj = JSON.parse(data || '{}');
        } catch (e) {
            response.writeHead(400, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ exception: 'BadRequest', detail: ['Invalid JSON'] }));
        }

        if (!obj || typeof obj.username !== 'string' || obj.username.length === 0) {
            response.writeHead(400, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ exception: 'BadRequest', detail: ['Missing username'] }));
        }

        if (!model.chequearUsuario(obj.username)) {
            response.writeHead(422, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ exception: 'DomainError', detail: ['User not found'] }));
        }

        if (obj.newUsername && obj.newUsername !== obj.username) {
            if (model.chequearUsuario(obj.newUsername)) {
                response.writeHead(422, { 'Content-Type': 'application/json' });
                return response.end(JSON.stringify({ exception: 'DomainError', detail: ['New username already exists'] }));
            }
        }

        const updated = model.updateUser(obj.username, obj.newUsername, obj.accesskey);
        response.writeHead(200, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ updated }));
    } catch (err) {
        console.error('update_user_handler error:', err);
        response.writeHead(500, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ exception: 'ServerError', detail: ['Internal server error'] }));
    }
}

// Groups handlers
async function register_group_handler(request, response) {
    // Verificar que el método sea POST y el body contenga { groupname }
    if (request.method !== 'POST') {
        response.writeHead(400, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ exception: 'BadRequest', detail: ['Invalid method'] }));
    }
    try {
        const data = await getRequestbody(request);
        let obj;
        try {
            obj = JSON.parse(data || '{}');
        } catch (e) {
            response.writeHead(400, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ exception: 'BadRequest', detail: ['Invalid JSON'] }));
        }

        if (!obj || typeof obj.groupname !== 'string' || obj.groupname.length === 0) {
            response.writeHead(400, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ exception: 'BadRequest', detail: ['Missing groupname'] }));
        }

        if (model.checkGroup(obj.groupname)) {
            response.writeHead(422, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ exception: 'DomainError', detail: ['Group already exists'] }));
        }

        const inserted = model.insertarGrupo(obj.groupname);
        if (inserted > 0) {
            response.writeHead(200, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ nombre: obj.groupname }));
        }

        response.writeHead(422, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ exception: 'DomainError', detail: ['Could not create group'] }));
    } catch (err) {
        console.error('register_group_handler error:', err);
        response.writeHead(500, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ exception: 'ServerError', detail: ['Internal server error'] }));
    }
}

async function delete_group_handler(request, response) {
    // Verificar que el método sea POST y el body contenga { groupname }
    if (request.method !== 'POST') {
        response.writeHead(400, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ exception: 'BadRequest', detail: ['Invalid method'] }));
    }
    try {
        const data = await getRequestbody(request);
        let obj;
        try {
            obj = JSON.parse(data || '{}');
        } catch (e) {
            response.writeHead(400, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ exception: 'BadRequest', detail: ['Invalid JSON'] }));
        }

        if (!obj || typeof obj.groupname !== 'string' || obj.groupname.length === 0) {
            response.writeHead(400, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ exception: 'BadRequest', detail: ['Missing groupname'] }));
        }

        if (!model.checkGroup(obj.groupname)) {
            response.writeHead(422, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ exception: 'DomainError', detail: ['Group not found'] }));
        }

        const deleted = model.eliminarGrupo(obj.groupname);
        if (deleted > 0) {
            response.writeHead(200, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ nombre: obj.groupname }));
        }

        response.writeHead(422, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ exception: 'DomainError', detail: ['Could not delete group'] }));
    } catch (err) {
        console.error('delete_group_handler error:', err);
        response.writeHead(500, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ exception: 'ServerError', detail: ['Internal server error'] }));
    }
}

async function update_group_handler(request, response) {
    // Verificar que el método sea POST y el body contenga { groupname }
        if (request.method !== 'POST') {
            response.writeHead(400, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ exception: 'BadRequest', detail: ['Invalid method'] }));
        }
        try {
            const data = await getRequestbody(request);
            let obj;
            try {
                obj = JSON.parse(data || '{}');
            } catch (e) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                return response.end(JSON.stringify({ exception: 'BadRequest', detail: ['Invalid JSON'] }));
            }

            if (!obj || typeof obj.groupname !== 'string' || obj.groupname.length === 0) {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                return response.end(JSON.stringify({ exception: 'BadRequest', detail: ['Missing groupname'] }));
            }

            if (!model.checkGroup(obj.groupname)) {
                response.writeHead(422, { 'Content-Type': 'application/json' });
                return response.end(JSON.stringify({ exception: 'DomainError', detail: ['Group not found'] }));
            }

            if (obj.newGroupname && obj.newGroupname !== obj.groupname) {
                if (model.checkGroup(obj.newGroupname)) {
                    response.writeHead(422, { 'Content-Type': 'application/json' });
                    return response.end(JSON.stringify({ exception: 'DomainError', detail: ['New group name already exists'] }));
                }
            }

            const updated = model.modificarGrupo(obj.groupname, obj.newGroupname);
            response.writeHead(200, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ updated }));
        } catch (err) {
            console.error('update_group_handler error:', err);
            response.writeHead(500, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ exception: 'ServerError', detail: ['Internal server error'] }));
            }
}


// Endpoints handlers
async function register_endpoint_handler(request, response) {
    // Verificar que el método sea POST y el body contenga { endpointname }
    if (request.method !== 'POST') {
        response.writeHead(400, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ exception: 'BadRequest', detail: ['Invalid method'] }));
    }
    try {
        const data = await getRequestbody(request);
        let obj;
        try {
            obj = JSON.parse(data || '{}');
        } catch (e) {
            response.writeHead(400, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ exception: 'BadRequest', detail: ['Invalid JSON'] }));
        }

        if (!obj || typeof obj.endpointname !== 'string' || obj.endpointname.length === 0) {
            response.writeHead(400, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ exception: 'BadRequest', detail: ['Missing endpointname'] }));
        }

        if (model.checkEndpoint(obj.endpointname)) {
            response.writeHead(422, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ exception: 'DomainError', detail: ['Endpoint already exists'] }));
        }

        const inserted = model.insertarEndpoint(obj.endpointname);
        if (inserted > 0) {
            response.writeHead(200, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ nombre: obj.endpointname }));
        }

        response.writeHead(422, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ exception: 'DomainError', detail: ['Could not create endpoint'] }));
    } catch (err) {
        console.error('register_endpoint_handler error:', err);
        response.writeHead(500, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ exception: 'ServerError', detail: ['Internal server error'] }));
    }
}

async function delete_endpoint_handler(request, response) {
    // Verificar que el método sea POST y el body contenga { endpointname }
    if (request.method !== 'POST') {
        response.writeHead(400, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ exception: 'BadRequest', detail: ['Invalid method'] }));
    }
    try {
        const data = await getRequestbody(request);
        let obj;
        try {
            obj = JSON.parse(data || '{}');
        } catch (e) {
            response.writeHead(400, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ exception: 'BadRequest', detail: ['Invalid JSON'] }));
        }

        if (!obj || typeof obj.endpointname !== 'string' || obj.endpointname.length === 0) {
            response.writeHead(400, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ exception: 'BadRequest', detail: ['Missing endpointname'] }));
        }

        if (!model.checkEndpoint(obj.endpointname)) {
            response.writeHead(422, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ exception: 'DomainError', detail: ['Endpoint not found'] }));
        }

        const deleted = model.eliminarEndpoint(obj.endpointname);
        if (deleted > 0) {
            response.writeHead(200, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ nombre: obj.endpointname }));
        }

        response.writeHead(422, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ exception: 'DomainError', detail: ['Could not delete endpoint'] }));
    } catch (err) {
        console.error('delete_endpoint_handler error:', err);
        response.writeHead(500, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ exception: 'ServerError', detail: ['Internal server error'] }));
    }
}

async function update_endpoint_handler(request, response) {
    // Verificar que el método sea POST y el body contenga { endpointname, newEndpointname? }
    if (request.method !== 'POST') {
        response.writeHead(400, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ exception: 'BadRequest', detail: ['Invalid method'] }));
    }
    try {
        const data = await getRequestbody(request);
        let obj;
        try {
            obj = JSON.parse(data || '{}');
        } catch (e) {
            response.writeHead(400, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ exception: 'BadRequest', detail: ['Invalid JSON'] }));
        }

        if (!obj || typeof obj.endpointname !== 'string' || obj.endpointname.length === 0) {
            response.writeHead(400, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ exception: 'BadRequest', detail: ['Missing endpointname'] }));
        }

        if (!model.checkEndpoint(obj.endpointname)) {
            response.writeHead(422, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ exception: 'DomainError', detail: ['Endpoint not found'] }));
        }

        if (obj.newEndpointname && obj.newEndpointname !== obj.endpointname) {
            if (model.checkEndpoint(obj.newEndpointname)) {
                response.writeHead(422, { 'Content-Type': 'application/json' });
                return response.end(JSON.stringify({ exception: 'DomainError', detail: ['New endpoint name already exists'] }));
            }
        }

        const updated = model.modificarEndpoint(obj.endpointname, obj.newEndpointname);
        if (updated > 0) {
            response.writeHead(200, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ updated }));
        }

        response.writeHead(422, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ exception: 'DomainError', detail: ['Could not update endpoint'] }));
    } catch (err) {
        console.error('update_endpoint_handler error:', err);
        response.writeHead(500, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ exception: 'ServerError', detail: ['Internal server error'] }));
    }
}

// Assignment handlers
async function assign_user_to_group_handler(request, response) {
    if (request.method !== 'POST') {
        response.writeHead(400, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ exception: 'BadRequest', detail: ['Invalid method'] }));
    }
    try {
        const data = await getRequestbody(request);
        let obj;
        try {
            obj = JSON.parse(data || '{}');
        } catch (e) {
            response.writeHead(400, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ exception: 'BadRequest', detail: ['Invalid JSON'] }));
        }

        if (!obj || typeof obj.username !== 'string' || typeof obj.groupname !== 'string' || obj.username.length === 0 || obj.groupname.length === 0) {
            response.writeHead(400, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ exception: 'BadRequest', detail: ['Missing username or groupname'] }));
        }

        if (!model.chequearUsuario(obj.username)) {
            response.writeHead(422, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ exception: 'DomainError', detail: ['User not found'] }));
        }
        if (!model.checkGroup(obj.groupname)) {
            response.writeHead(422, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ exception: 'DomainError', detail: ['Group not found'] }));
        }

        const idu = model.retornarIdUsuario(obj.username);
        const idg = model.retornarIdGrupo(obj.groupname);
        if (model.chequearUsuarioEnGrupo(idu, idg)) {
            response.writeHead(422, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ exception: 'DomainError', detail: ['User already in group'] }));
        }

        const inserted = model.insertarUsuarioGrupo(obj.username, obj.groupname);
        if (inserted > 0) {
            response.writeHead(200, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ username: obj.username, groupname: obj.groupname }));
        }

        response.writeHead(422, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ exception: 'DomainError', detail: ['Could not add user to group'] }));
    } catch (err) {
        console.error('assign_user_to_group_handler error:', err);
        response.writeHead(500, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ exception: 'ServerError', detail: ['Internal server error'] }));
    }
}

async function remove_user_from_group_handler(request, response) {
    if (request.method !== 'POST') {
        response.writeHead(400, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ exception: 'BadRequest', detail: ['Invalid method'] }));
    }
    try {
        const data = await getRequestbody(request);
        let obj;
        try {
            obj = JSON.parse(data || '{}');
        } catch (e) {
            response.writeHead(400, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ exception: 'BadRequest', detail: ['Invalid JSON'] }));
        }

        if (!obj || typeof obj.username !== 'string' || typeof obj.groupname !== 'string' || obj.username.length === 0 || obj.groupname.length === 0) {
            response.writeHead(400, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ exception: 'BadRequest', detail: ['Missing username or groupname'] }));
        }

        const idu = model.retornarIdUsuario(obj.username);
        const idg = model.retornarIdGrupo(obj.groupname);
        if (idu === null || idg === null) {
            response.writeHead(422, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ exception: 'DomainError', detail: ['User or group not found'] }));
        }

        if (!model.chequearUsuarioEnGrupo(idu, idg)) {
            response.writeHead(422, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ exception: 'DomainError', detail: ['User not a member of group'] }));
        }

        const removed = model.removerUsuarioDeGrupo(idu, idg);
        if (removed > 0) {
            response.writeHead(200, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ username: obj.username, groupname: obj.groupname }));
        }

        response.writeHead(422, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ exception: 'DomainError', detail: ['Could not remove user from group'] }));
    } catch (err) {
        console.error('remove_user_from_group_handler error:', err);
        response.writeHead(500, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ exception: 'ServerError', detail: ['Internal server error'] }));
    }
}

async function assign_endpoint_to_group_handler(request, response) {
    if (request.method !== 'POST') {
        response.writeHead(400, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ exception: 'BadRequest', detail: ['Invalid method'] }));
    }
    try {
        const data = await getRequestbody(request);
        let obj;
        try {
            obj = JSON.parse(data || '{}');
        } catch (e) {
            response.writeHead(400, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ exception: 'BadRequest', detail: ['Invalid JSON'] }));
        }

        if (!obj || typeof obj.groupname !== 'string' || typeof obj.endpointname !== 'string' || obj.groupname.length === 0 || obj.endpointname.length === 0) {
            response.writeHead(400, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ exception: 'BadRequest', detail: ['Missing groupname or endpointname'] }));
        }

        if (!model.checkGroup(obj.groupname)) {
            response.writeHead(422, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ exception: 'DomainError', detail: ['Group not found'] }));
        }
        if (!model.checkEndpoint(obj.endpointname)) {
            response.writeHead(422, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ exception: 'DomainError', detail: ['Endpoint not found'] }));
        }

        const inserted = model.insertarGrupoEndpoint(obj.groupname, obj.endpointname);
        if (inserted > 0) {
            response.writeHead(200, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ groupname: obj.groupname, endpointname: obj.endpointname }));
        }

        response.writeHead(422, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ exception: 'DomainError', detail: ['Could not assign endpoint to group'] }));
    } catch (err) {
        console.error('assign_endpoint_to_group_handler error:', err);
        response.writeHead(500, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ exception: 'ServerError', detail: ['Internal server error'] }));
    }
}

async function remove_endpoint_from_group_handler(request, response) {
    if (request.method !== 'POST') {
        response.writeHead(400, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ exception: 'BadRequest', detail: ['Invalid method'] }));
    }
    try {
        const data = await getRequestbody(request);
        let obj;
        try {
            obj = JSON.parse(data || '{}');
        } catch (e) {
            response.writeHead(400, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ exception: 'BadRequest', detail: ['Invalid JSON'] }));
        }

        if (!obj || typeof obj.groupname !== 'string' || typeof obj.endpointname !== 'string' || obj.groupname.length === 0 || obj.endpointname.length === 0) {
            response.writeHead(400, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ exception: 'BadRequest', detail: ['Missing groupname or endpointname'] }));
        }

        const idg = model.retornarIdGrupo(obj.groupname);
        const ide = model.retornarIdEndpoint(obj.endpointname);
        if (idg === null || ide === null) {
            response.writeHead(422, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ exception: 'DomainError', detail: ['Group or endpoint not found'] }));
        }

        const removed = model.removerGrupoEndpoint(obj.groupname, obj.endpointname);
        if (removed > 0) {
            response.writeHead(200, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ groupname: obj.groupname, endpointname: obj.endpointname }));
        }

        response.writeHead(422, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ exception: 'DomainError', detail: ['Could not remove endpoint from group'] }));
    } catch (err) {
        console.error('remove_endpoint_from_group_handler error:', err);
        response.writeHead(500, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ exception: 'ServerError', detail: ['Internal server error'] }));
    }
}

// ----- Check endpoints -----
async function check_group_handler(request, response) {
    if (request.method !== 'POST') {
        response.writeHead(405, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ status: 'error', message: 'Error' }));
    }
    try {
        const data = await getRequestbody(request);
        const obj = JSON.parse(data);
        const exists = model.checkGroup(obj.groupname);
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ exists }));
    } catch (err) {
        response.writeHead(500, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'error', message: 'Error' }));
    }
}

async function check_endpoint_handler(request, response) {
    if (request.method !== 'POST') {
        response.writeHead(405, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ status: 'error', message: 'Error' }));
    }
    try {
        const data = await getRequestbody(request);
        const obj = JSON.parse(data);
        const exists = model.checkEndpoint(obj.endpointname);
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ exists }));
    } catch (err) {
        response.writeHead(500, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'error', message: 'Error' }));
    }
}

// ----- Lists -----
function list_users_handler(request, response) {
    const stmt = db.prepare('SELECT * FROM user');
    const rows = stmt.all();
    console.log('Users in DB:');
    rows.forEach(r => console.log(`ID: ${r.id}, Username: ${r.username}`));
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ status: 'success', message: 'Users listed in console' }));
}

function list_groups_handler(request, response) {
    const stmt = db.prepare('SELECT * FROM "group"');
    const rows = stmt.all();
    console.log('Groups in DB:');
    rows.forEach(r => console.log(`ID: ${r.id}, Name: ${r.name}`));
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ status: 'success', message: 'Groups listed in console' }));
}

function list_endpoints_handler(request, response) {
    const stmt = db.prepare('SELECT * FROM endpoint');
    const rows = stmt.all();
    console.log('Endpoints in DB:');
    rows.forEach(r => console.log(`ID: ${r.id}, Path: ${r.path}`));
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ status: 'success', message: 'Endpoints listed in console' }));
}

function list_user_groups_handler(request, response) {
    const stmt = db.prepare('SELECT * FROM members');
    const rows = stmt.all();
    console.log('Members in DB:');
    rows.forEach(r => console.log(`User ID: ${r.id_user}, Group ID: ${r.id_group}`));
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ status: 'success', message: 'Members listed in console' }));
}

function list_group_endpoints_handler(request, response) {
    const stmt = db.prepare('SELECT * FROM access');
    const rows = stmt.all();
    console.log('Access in DB:');
    rows.forEach(r => console.log(`Group ID: ${r.id_group}, Endpoint ID: ${r.id_endpoint}`));
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ status: 'success', message: 'Access listed in console' }));
}


// ----- Handlers de prueba -----
async function log_handler(request, response) {
    if (request.method !== 'POST') {
        response.writeHead(405, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ status: 'error', message: 'Error' }));
    }
    try {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'success', message: 'Check server console for log' }));
    } catch (err) {
        response.writeHead(400, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: 'Error' }));
    }
}

async function say_hello_handler(request, response) {
    // en request.url esta el endpoint
    // con request.url.slice(1) para sacar el / y quedarnos solo con el endpoint que lo usa la BD

    if (request.method !== 'POST') {
        response.writeHead(405, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ status: 'error', message: 'Error' }));
    }
    try {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'success', message: 'Check server console for log' }));
    } catch (err) {
        response.writeHead(400, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: 'Error' }));
    }
}


export {
    getRequestbody,
    logout_handler,
    register_handler, delete_user_handler, update_user_handler,
    register_group_handler, delete_group_handler, update_group_handler,
    register_endpoint_handler, delete_endpoint_handler, update_endpoint_handler,
    assign_user_to_group_handler, remove_user_from_group_handler,
    assign_endpoint_to_group_handler, remove_endpoint_from_group_handler
};
// exportacion de handlers usados solo por el frontend en etapa de desarrollo
// luego una vez bien implementados se deberian borrar
export {
    check_group_handler, check_endpoint_handler,
    list_users_handler, list_groups_handler, list_endpoints_handler,
    list_user_groups_handler, list_group_endpoints_handler
};
