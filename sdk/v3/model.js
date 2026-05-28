import { db } from './database.js';

let userSessions = new Map();

class UserSession {
    constructor() { this.status = 'disabled'; }
}

function authenticate(username, password) {
    const sql = "SELECT count(*) as total FROM `user` WHERE username=? AND password=?";
    const stmt = db.prepare(sql);
    const row = stmt.get(username, password);
    return row && row.total === 1;
}

function login(username, password) {
    const isAuthenticated = authenticate(username, password);
    if (!isAuthenticated) return null;
    let session = userSessions.get(username);
    if (!session) {
        session = new UserSession();
        session.status = 'enabled';
        userSessions.set(username, session);
        return session;
    }
    if (session.status === 'disabled') session.status = 'enabled';
    return session;
}

function logout(username) {
    if (!username) return { status: false, message: 'Error' };
    const session = userSessions.get(username);
    if (!session) return { status: false, message: 'Error' };
    if (session.status === 'disabled') return { status: false, message: 'Error' };
    session.status = 'disabled';
    return { status: true };
}

function chequearUsuario(username) {
    const sql = 'SELECT COUNT(*) as cnt FROM user WHERE username = ? COLLATE NOCASE';
    const stmt = db.prepare(sql);
    const row = stmt.get(username);
    return row && row.cnt > 0;
}

function createUser(username, password) {
    const stmt = db.prepare('INSERT INTO `user` (username, password) VALUES (?, ?)');
    const result = stmt.run(username, password);
    return { id: result.lastInsertRowid || null, username };
}

function deleteUser(username) {
    const stmt = db.prepare('DELETE FROM user WHERE username = ? COLLATE NOCASE');
    const res = stmt.run(username);
    return res.changes || 0;
}

function updateUser(username, newUsername, newPassword) {
    if (newUsername && newUsername !== username) {
        const stmt = db.prepare('UPDATE user SET username = ?' + (newPassword ? ', password = ?' : '') + ' WHERE username = ? COLLATE NOCASE');
        const params = newPassword ? [newUsername, newPassword, username] : [newUsername, username];
        const res = stmt.run(...params);
        return res.changes || 0;
    }
    if (newPassword) {
        const stmt = db.prepare('UPDATE user SET password = ? WHERE username = ? COLLATE NOCASE');
        const res = stmt.run(newPassword, username);
        return res.changes || 0;
    }
    return 0;
}

// Groups
function checkGroup(nombre) {
    const stmt = db.prepare('SELECT COUNT(*) as cnt FROM `group` WHERE name = ? COLLATE NOCASE');
    const row = stmt.get(nombre);
    return row && row.cnt > 0;
}

function insertarGrupo(nombre) {
    const stmt = db.prepare('INSERT INTO `group` (name) VALUES (?)');
    const res = stmt.run(nombre);
    return res.changes || 0;
}

function eliminarGrupo(nombre) {
    const stmt = db.prepare('DELETE FROM `group` WHERE name = ?');
    const res = stmt.run(nombre);
    return res.changes || 0;
}

function modificarGrupo(nombre, newNombre) {
    const updates = [];
    const params = [];
    if (typeof newNombre === 'string' && newNombre.length > 0 && newNombre !== nombre) {
        updates.push('name = ?'); params.push(newNombre);
    }
    if (updates.length === 0) return 0;
    params.push(nombre);
    const stmt = db.prepare(`UPDATE "group" SET ${updates.join(', ')} WHERE name = ?`);
    const res = stmt.run(...params);
    return res.changes || 0;
}

// Endpoints
function checkEndpoint(nombre) {
    const stmt = db.prepare('SELECT COUNT(*) as cnt FROM `endpoint` WHERE path = ? COLLATE NOCASE');
    const row = stmt.get(nombre);
    return row && row.cnt > 0;
}

function insertarEndpoint(path) {
    const stmt = db.prepare('INSERT INTO `endpoint` (path) VALUES (?)');
    const res = stmt.run(path);
    return res.changes || 0;
}

function eliminarEndpoint(path) {
    const stmt = db.prepare('DELETE FROM `endpoint` WHERE path = ?');
    const res = stmt.run(path);
    return res.changes || 0;
}

function modificarEndpoint(path, newPath) {
    const updates = [];
    const params = [];
    if (typeof newPath === 'string' && newPath.length > 0 && newPath !== path) { updates.push('path = ?'); params.push(newPath); }
    if (updates.length === 0) return 0;
    params.push(path);
    const stmt = db.prepare(`UPDATE "endpoint" SET ${updates.join(', ')} WHERE path = ?`);
    const res = stmt.run(...params);
    return res.changes || 0;
}

// Assignments
function retornarIdUsuario(username) {
    const stmt = db.prepare('SELECT id FROM user WHERE username = ? COLLATE NOCASE');
    const r = stmt.get(username);
    return r ? r.id : null;
}

function retornarIdGrupo(nombre) {
    const stmt = db.prepare('SELECT id FROM `group` WHERE name = ? COLLATE NOCASE');
    const r = stmt.get(nombre);
    return r ? r.id : null;
}

function retornarIdEndpoint(nombre) {
    const stmt = db.prepare('SELECT id FROM `endpoint` WHERE path = ? COLLATE NOCASE');
    const r = stmt.get(nombre);
    return r ? r.id : null;
}

function insertarUsuarioGrupo(nombreusuario, nombregrupo) {
    const idusuario = retornarIdUsuario(nombreusuario);
    const idgrupo = retornarIdGrupo(nombregrupo);
    const stmt = db.prepare('INSERT OR IGNORE INTO `members` (id_user, id_group) VALUES (?, ?)');
    const res = stmt.run(idusuario, idgrupo);
    return res.changes || 0;
}

function removerUsuarioDeGrupo(idusuario, idgrupo) {
    const stmt = db.prepare('DELETE FROM members WHERE id_user = ? AND id_group = ?');
    const res = stmt.run(idusuario, idgrupo);
    return res.changes || 0;
}

function chequearUsuarioEnGrupo(idusuario, idgrupo) {
    const stmt = db.prepare('SELECT COUNT(*) as cnt FROM members WHERE id_user = ? AND id_group = ?');
    const row = stmt.get(idusuario, idgrupo);
    return row && row.cnt > 0;
}

function insertarGrupoEndpoint(nombregrupo, nombreendpoint) {
    const idgrupo = retornarIdGrupo(nombregrupo);
    const idendpoint = retornarIdEndpoint(nombreendpoint);
    const stmt = db.prepare('INSERT OR IGNORE INTO `access` (id_group, id_endpoint) VALUES (?, ?)');
    const res = stmt.run(idgrupo, idendpoint);
    return res.changes || 0;
}

function removerGrupoEndpoint(groupname, endpointname) {
    const idgrupo = retornarIdGrupo(groupname);
    const idendpoint = retornarIdEndpoint(endpointname);
    if (idgrupo === null || idendpoint === null) throw new Error('Error');
    const stmt = db.prepare('DELETE FROM access WHERE id_group = ? AND id_endpoint = ?');
    const res = stmt.run(idgrupo, idendpoint);
    return res.changes || 0;
}

function isAuthorized( username, endpointPath )
{   
    const sql = `
        SELECT count(*) as total
        FROM access a
        JOIN members m ON a.id_group = m.id_group
        JOIN user u ON m.id_user = u.id
        JOIN endpoint e ON a.id_endpoint = e.id
        WHERE u.username = ? 
          AND e.path = ?
    `;

    try {
        const stmt = db.prepare(sql);
        // Pasamos los parámetros en el orden de los signos de interrogación
        const row = stmt.get(username, endpointPath);

        // Si el conteo es mayor a 0, tiene permiso
        return row.total > 0;
    } catch (err) {
        console.error("Error consultando permisos:", err);
        throw err;
    }
}


/*
function isAuthorized(username, endpoint) {
    const sql = `
    SELECT COUNT(*) as cnt
    FROM user u
    JOIN members m ON u.id = m.id_user
    JOIN access a ON m.id_group = a.id_group
    JOIN endpoint e ON a.id_endpoint = e.id
    WHERE u.username = ? COLLATE NOCASE AND e.path = ? COLLATE NOCASE
    `;
    const stmt = db.prepare(sql);
    const row = stmt.get(username, endpoint);
    return row && row.cnt > 0;
}
*/

export {
    login, logout, chequearUsuario, createUser, deleteUser, updateUser,
    checkGroup, insertarGrupo, eliminarGrupo, modificarGrupo,
    checkEndpoint, insertarEndpoint, eliminarEndpoint, modificarEndpoint,
    retornarIdUsuario, retornarIdGrupo, retornarIdEndpoint,
    insertarUsuarioGrupo, removerUsuarioDeGrupo,
    chequearUsuarioEnGrupo,
    insertarGrupoEndpoint, removerGrupoEndpoint,
    isAuthorized
};
