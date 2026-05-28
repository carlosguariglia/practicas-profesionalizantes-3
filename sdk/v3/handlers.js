import { readFileSync } from 'node:fs';
import { config, db } from './database.js';
import * as model from './model.js';

function getRequestbody(request) {
    return new Promise(function(resolve) {
        let body = '';
        request.on('data', chunk => body += chunk.toString());
        request.on('end', () => resolve(body));
    });
}

async function login_handler(request, response) {
    if (request.method !== 'POST') {
        response.writeHead(405, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ status: 'error', message: 'Error' }));
    }
    try {
        const data = await getRequestbody(request);
        const obj = JSON.parse(data);
        const output = model.login(obj.username, obj.password);
        if (output == null) {
            response.writeHead(401, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ status: 'error', message: 'Error' }));
        }
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify(output));
    } catch (err) {
        response.writeHead(400, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: 'Error' }));
    }
}

async function logout_handler(request, response) {
    if (request.method !== 'POST') {
        response.writeHead(405, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ status: 'error', message: 'Error' }));
    }
    try {
        const data = await getRequestbody(request);
        const obj = JSON.parse(data);
        const r = model.logout(obj.username);
        if (!r.status) {
            response.writeHead(404, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ status: 'error', message: 'Error' }));
        }
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'success' }));
    } catch (err) {
        response.writeHead(400, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'error', message: 'Error' }));
    }
}

function default_handler(request, response) {
    try {
        const html = readFileSync(config.server.default_path, 'utf-8');
        response.writeHead(200, { 'Content-Type': 'text/html' });
        response.end(html);
    } catch (error) {
        response.writeHead(500);
        response.end('Error');
    }
}

async function register_handler(request, response) {
    if (request.method !== 'POST') {
        response.writeHead(405, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ status: 'error', message: 'Error' }));
    }
    try {
        const data = await getRequestbody(request);
        const obj = JSON.parse(data);
        if (model.chequearUsuario(obj.username)) {
            response.writeHead(409, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ status: 'error', message: 'Error' }));
        }
        const r = model.createUser(obj.username, obj.password);
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'success', username: r.username }));
    } catch (err) {
        response.writeHead(500, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'error', message: 'Error' }));
    }
}

async function delete_user_handler(request, response) {
    if (request.method !== 'POST') {
        response.writeHead(405, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ status: 'error', message: 'Error' }));
    }
    try {
        const data = await getRequestbody(request);
        const obj = JSON.parse(data);
        if (!model.chequearUsuario(obj.username)) {
            response.writeHead(404, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ status: 'error', message: 'Error' }));
        }
        const deleted = model.deleteUser(obj.username);
        if (deleted > 0) {
            response.writeHead(200, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ status: 'success', username: obj.username }));
        }
        response.writeHead(404, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ status: 'error', message: 'Error' }));
    } catch (err) {
        response.writeHead(500, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ status: 'error', message: 'Error' }));
    }
}

async function update_user_handler(request, response) {
    if (request.method !== 'POST') {
        response.writeHead(405, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ status: 'error', message: 'Error' }));
    }
    try {
        const data = await getRequestbody(request);
        const obj = JSON.parse(data);
        if (!model.chequearUsuario(obj.username)) {
            response.writeHead(404, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ status: 'error', message: 'Error' }));
        }
        if (obj.newUsername && obj.newUsername !== obj.username) {
            if (model.chequearUsuario(obj.newUsername)) {
                response.writeHead(409, { 'Content-Type': 'application/json' });
                return response.end(JSON.stringify({ status: 'error', message: 'Error' }));
            }
        }
        const updated = model.updateUser(obj.username, obj.newUsername, obj.newPassword);
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'success', updated }));
    } catch (err) {
        response.writeHead(500, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'error', message: 'Error' }));
    }
}

// Groups handlers
async function register_group_handler(request, response) {
    if (request.method !== 'POST') {
        response.writeHead(405, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ status: 'error', message: 'Error' }));
    }
    try {
        const data = await getRequestbody(request);
        const obj = JSON.parse(data);
        if (model.checkGroup(obj.groupname)) {
            response.writeHead(409, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ status: 'error', message: 'Error' }));
        }
        model.insertarGrupo(obj.groupname);
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'success', nombre: obj.groupname }));
    } catch (err) {
        response.writeHead(500, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'error', message: 'Error' }));
    }
}

async function delete_group_handler(request, response) {
    if (request.method !== 'POST') {
        response.writeHead(405, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ status: 'error', message: 'Error' }));
    }
    try {
        const data = await getRequestbody(request);
        const obj = JSON.parse(data);
        if (!model.checkGroup(obj.groupname)) {
            response.writeHead(404, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ status: 'error', message: 'Error' }));
        }
        const deleted = model.eliminarGrupo(obj.groupname);
        if (deleted > 0) {
            response.writeHead(200, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ status: 'success', nombre: obj.groupname }));
        }
        response.writeHead(404, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ status: 'error', message: 'Error' }));
    } catch (err) {
        response.writeHead(500, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'error', message: 'Error' }));
    }
}

async function update_group_handler(request, response) {
    if (request.method !== 'POST') {
        response.writeHead(405, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ status: 'error', message: 'Error' }));
    }
    try {
        const data = await getRequestbody(request);
        const obj = JSON.parse(data);
        if (!model.checkGroup(obj.groupname)) {
            response.writeHead(404, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ status: 'error', message: 'Error' }));
        }
        if (obj.newGroupname && obj.newGroupname !== obj.groupname) {
            if (model.checkGroup(obj.newGroupname)) {
                response.writeHead(409, { 'Content-Type': 'application/json' });
                return response.end(JSON.stringify({ status: 'error', message: 'Error' }));
            }
        }
        const updated = model.modificarGrupo(obj.groupname, obj.newGroupname);
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'success', updated }));
    } catch (err) {
        response.writeHead(500, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'error', message: 'Error' }));
    }
}

// Endpoints handlers
async function register_endpoint_handler(request, response) {
    if (request.method !== 'POST') {
        response.writeHead(405, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ status: 'error', message: 'Error' }));
    }
    try {
        const data = await getRequestbody(request);
        const obj = JSON.parse(data);
        if (model.checkEndpoint(obj.endpointname)) {
            response.writeHead(409, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ status: 'error', message: 'Error' }));
        }
        model.insertarEndpoint(obj.endpointname);
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'success', nombre: obj.endpointname }));
    } catch (err) {
        response.writeHead(500, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'error', message: 'Error' }));
    }
}

async function delete_endpoint_handler(request, response) {
    if (request.method !== 'POST') {
        response.writeHead(405, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ status: 'error', message: 'Error' }));
    }
    try {
        const data = await getRequestbody(request);
        const obj = JSON.parse(data);
        if (!model.checkEndpoint(obj.endpointname)) {
            response.writeHead(404, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ status: 'error', message: 'Error' }));
        }
        const deleted = model.eliminarEndpoint(obj.endpointname);
        if (deleted > 0) {
            response.writeHead(200, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ status: 'success', nombre: obj.endpointname }));
        }
        response.writeHead(404, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ status: 'error', message: 'Error' }));
    } catch (err) {
        response.writeHead(500, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'error', message: 'Error' }));
    }
}

async function update_endpoint_handler(request, response) {
    if (request.method !== 'POST') {
        response.writeHead(405, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ status: 'error', message: 'Error' }));
    }
    try {
        const data = await getRequestbody(request);
        const obj = JSON.parse(data);
        if (!model.checkEndpoint(obj.endpointname)) {
            response.writeHead(404, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ status: 'error', message: 'Error' }));
        }
        if (obj.newEndpointname && obj.newEndpointname !== obj.endpointname) {
            if (model.checkEndpoint(obj.newEndpointname)) {
                response.writeHead(409, { 'Content-Type': 'application/json' });
                return response.end(JSON.stringify({ status: 'error', message: 'Error' }));
            }
        }
        const updated = model.modificarEndpoint(obj.endpointname, obj.newEndpointname);
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'success', updated }));
    } catch (err) {
        response.writeHead(500, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'error', message: 'Error' }));
    }
}

// Assignment handlers
async function assign_user_to_group_handler(request, response) {
    if (request.method !== 'POST') {
        response.writeHead(405, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ status: 'error', message: 'Error' }));
    }
    try {
        const data = await getRequestbody(request);
        const obj = JSON.parse(data);
        model.insertarUsuarioGrupo(obj.username, obj.groupname);
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'success', nombre: obj.username }));
    } catch (err) {
        response.writeHead(500, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'error', message: 'Error' }));
    }
}

async function remove_user_from_group_handler(request, response) {
    if (request.method !== 'POST') {
        response.writeHead(405, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ status: 'error', message: 'Error' }));
    }
    try {
        const data = await getRequestbody(request);
        const obj = JSON.parse(data);
        const idu = model.retornarIdUsuario(obj.username);
        const idg = model.retornarIdGrupo(obj.groupname);
        const exists = model.chequearUsuarioEnGrupo(idu, idg);
        if (!exists) {
            response.writeHead(404, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ status: 'error', message: 'Error' }));
        }
        const removed = model.removerUsuarioDeGrupo(idu, idg);
        if (removed > 0) {
            response.writeHead(200, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ status: 'success', username: obj.username }));
        }
        response.writeHead(404, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ status: 'error', message: 'Error' }));
    } catch (err) {
        response.writeHead(500, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'error', message: 'Error' }));
    }
}

async function assign_endpoint_to_group_handler(request, response) {
    if (request.method !== 'POST') {
        response.writeHead(405, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ status: 'error', message: 'Error' }));
    }
    try {
        const data = await getRequestbody(request);
        const obj = JSON.parse(data);
        model.insertarGrupoEndpoint(obj.groupname, obj.endpointname);
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'success', nombre: obj.groupname }));
    } catch (err) {
        response.writeHead(500, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'error', message: 'Error' }));
    }
}

async function remove_endpoint_from_group_handler(request, response) {
    if (request.method !== 'POST') {
        response.writeHead(405, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ status: 'error', message: 'Error' }));
    }
    try {
        const data = await getRequestbody(request);
        const obj = JSON.parse(data);
        const removed = model.removerGrupoEndpoint(obj.groupname, obj.endpointname);
        if (!removed) {
            response.writeHead(404, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ status: 'error', message: 'Error' }));
        }
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'success', groupname: obj.groupname, endpointname: obj.endpointname, removed }));
    } catch (err) {
        response.writeHead(500, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'error', message: 'Error' }));
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
        const data = await getRequestbody(request);
        const obj = JSON.parse(data);
        const output = model.isAuthorized(obj.username, request.url.slice(1));
        let respuesta;
        if (output) { respuesta = 'Autorizado'; }
        else { respuesta = 'No Autorizado'; }

        console.log(`Usuario ${obj.username}, acceso al endpoint ${request.url}. Autorizacion: ${respuesta}`);
        
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'success', message: 'Check server console for log' }));
    } catch (err) {
        response.writeHead(400, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: 'Error' }));
    }
}

async function say_hello_handler(request, response) {
    // request.url esta el endpoint
    // request.url.slice(1) para sacar el / y quedarnos solo con el endpoint que lo usa la BD

    if (request.method !== 'POST') {
        response.writeHead(405, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ status: 'error', message: 'Error' }));
    }
    try {
        const data = await getRequestbody(request);
        const obj = JSON.parse(data);
        const output = model.isAuthorized(obj.username, request.url.slice(1));  // se modifica request.url para que no muestre / y solo endpoint        
        let respuesta;
        if (output) { respuesta = 'Autorizado'; }
        else { respuesta = 'No Autorizado'; } 

        console.log(`Usuario ${obj.username}, acceso al endpoint ${request.url}. Autorizacion: ${respuesta}`);

        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'success', message: 'Check server console for log' }));
    } catch (err) {
        response.writeHead(400, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: 'Error' }));
    }
}


export {
    login_handler, logout_handler, default_handler,
    register_handler, delete_user_handler, update_user_handler,
    register_group_handler, delete_group_handler, update_group_handler,
    register_endpoint_handler, delete_endpoint_handler, update_endpoint_handler,
    assign_user_to_group_handler, remove_user_from_group_handler,
    assign_endpoint_to_group_handler, remove_endpoint_from_group_handler,
    log_handler, say_hello_handler
};
// exportacion de handlers usados solo por el frontend en etapa de desarrollo
// luego una vez bien implementados se deberian borrar
export {
    check_group_handler, check_endpoint_handler,
    list_users_handler, list_groups_handler, list_endpoints_handler,
    list_user_groups_handler, list_group_endpoints_handler
};
