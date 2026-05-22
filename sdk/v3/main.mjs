import { createServer } from 'node:http';
import { URL } from 'node:url';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';


// ****************   BLOQUE DE CONFIGURACIÓN DE LA CONEXIÓN   ****************
// Funcion para cargar la configuración por defecto
function default_config() 
{
    const config =   // se crea el obj config con los sig valores 
    {
        server: 
        {
            ip: '127.0.0.1',
            port: 3000,
            default_path: './index.html'
        },
        database:
        {
            path: './db.sqlite3'
        }
    };
    return config;    // se retorna el obj config
}

// Función para cargar la configuración desde un archivo JSON (si falla, se usan los 
// valores por defecto cargados por la función default_config)
function load_config() 
{
    let config = null;    // se declara la variable config y se inicializa con null
    try   // se intenta cargar la configuración desde el archivo config.json
    {
        const data = readFileSync('./config.json', 'utf-8');  // se lee el archivo config.json y se guarda su contenido en la variable data
        config = JSON.parse(data);                            // se parsea el contenido de data como JSON y se asigna a la variable config
        console.log("Configuración cargada correctamente."); 
    } 
    catch (error)  // si ocurre un error al cargar el archivo config.json, se captura 
    // la excepción y se muestra un mensaje de error, luego se carga la configuración por defecto
    // llamando a la función default_config para obtener los valores por defecto y asignarlos a la variable config
    {
        console.error("Error cargando config.json. Usando valores por defecto.");
        config = default_config();
    }
    return config;   // se retorna la variable config, que contiene la configuración cargada desde el archivo o los valores por defecto
}

let config = load_config();  // se llama a la función load_config para cargar la configuración y se asigna a la variable config


// ****************   BLOQUE DE CONEXIÓN A LA BASE DE DATOS   ****************


function connect_db( path )  // se define la función connect_db que recibe como parámetro la ruta del archivo de la base de datos
                             // y devuelve una instancia de la base de datos conectada.
{
    const dbPath = resolve(path);   // se resuelve la ruta del archivo de la base de datos utilizando la función resolve del módulo 
                                  // path y se asigna a la variable dbPath

    // se crea una nueva instancia de DatabaseSync utilizando la ruta resuelta.
    const db = new DatabaseSync(dbPath);

    console.log(`Conexión a la base de datos ${dbPath} establecida.`);
    return db;   // se retorna la instancia de la base de datos para que pueda ser utilizada en otras partes del código

}

const db = connect_db(config.database.path);




// ****************   BLOQUE DE LÓGICA DE NEGOCIO   ****************

// *****************   FUNCIONES DE AUTENTICACIÓN   ****************
//TODO Hacer esta funcion siguiendo la consigna, usando autorizador, autenticador
let userSessions = new Map();  //clave-valor  -> clave: id_user,  valor: sessionObj

class UserSession
{
    constructor()
    {
    this.status = 'disabled';
    }

}



function authenticate(username, password)
{
    //Debería ir a la base de datos y buscar si existe (1) registro  username/password coincidente
    //Si es verdadero entonces significa que estoy autenticado, sino no.

    const sql = "SELECT count(*) as total FROM `user` WHERE username=? AND password=?";

    const stmt = db.prepare(sql);
    const row = stmt.get(username, password);
    return row && row.total === 1;
}

function login( username, password )
{
    
    let isAuthenticated = authenticate(username, password);

    if ( isAuthenticated )
    {
        let havePreviousSession = userSessions.get(username);

        if ( havePreviousSession == null )
        {
            //Significa que está ingresando por primera vez. Entonces, creo y persisto el objeto de sesión
            let newSession = new UserSession();
            newSession.status = 'enabled';
            userSessions.set(username, newSession );
            return newSession;
        }
        else
        {
            //Significa que ya ingresó en algún momento y tiene ya un objeto de sesión creado y guardado en el mapa.
            let previusSession = userSessions.get(username);

            if ( previusSession.status == 'disabled')
            {
                previusSession.status = 'enabled';
            }
    
            return previusSession;
        }
    }
    else
    {
        return null;
    }

    //El retorno de esta función está representando si se devuelve o no un objeto de sesión.
}

function logout(username)
{
    if (!username)
    {
        return { status: false, message: 'Usuario requerido' };
    }

    let currentSession = userSessions.get(username);
    if (!currentSession)
    {
        return { status: false, message: 'Sesion no encontrada' };
    }

    if (currentSession.status === 'disabled')
    {
        return { status: false, message: 'Sesion ya cerrada' };
    }

    currentSession.status = 'disabled';
    return { status: true };
}

function authorize( username, endpointPath )
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

    const stmt = db.prepare(sql);
    const row = stmt.get(username, endpointPath);
    return row && row.total > 0;
}

async function logout_handler(request, response)
{
    if (request.method === 'POST')
    {
        try
        {
            let data = await getRequestbody(request);
            let obj = JSON.parse(data);
            const username = obj.username;
            if (!username)
            {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ status: 'error', message: 'Usuario requerido' }));
                return;
            }

            const result = logout(username);
            if (!result.status)
            {
                response.writeHead(404, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ status: 'error', message: result.message }));
                return;
            }

            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ status: 'success' }));
        }
        catch (err)
        {
            response.writeHead(400, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ status: 'error', message: 'Formato JSON inválido' }));
        }
    }
    else
    {
        response.writeHead(405, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'error', message: 'Method not allowed' }));
    }
}


// ****************   BLOQUE DE RUTEO Y DESPACHO   ****************




async function login_handler(request, response)
{   
    if (request.method === 'POST')    // chequeo si el metodo es POST 
    {
        try
        {
            let data = await getRequestbody(request); // el request llega como un stream, por eso hay que esperar a que llegue todo el body para 
            let obj = JSON.parse(data);               // poder parsearlo, por eso se hace una función getRequestbody que devuelve una promesa que se 
            const username = obj.username;              // resuelve cuando llega todo el body, y luego se parsea el body como JSON para obtener los datos de username y password.     
            const password = obj.password;
        
            const output = login(username, password);

            if (output == null)
            {
                response.writeHead(401, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ status: 'error', message: 'Usuario o contraseña inválidos' }));
                return;
            }
            
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify(output));
        }
        catch (err)
        {
            response.writeHead(400, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: 'Formato JSON inválido' }));
        }
    }
    else
    {
        response.writeHead(405, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: 'Method not allowed' }));
    }
}


// ******************** Default handler es la que muestra la vista principal *******

function default_handler(request, response)
{
	try 
	{
        const html = readFileSync(config.server.default_path, 'utf-8');
        response.writeHead(200, { 'Content-Type': 'text/html' });
        response.end(html);
    } 
    catch (error) 
    {
        response.writeHead(500);
        response.end('Error interno: No se pudo cargar la vista principal.');
    }
}

//  -----------------  Funcion auxiliar para el manejo de JSON entre cliente y servidor  -----------------
// esta funcion es la que "arma" el paquete que se envia por JSON
function getRequestbody(request)  
{
    return new Promise(function(resolve, reject)
    {
        let body = '';
        request.on('data', function(chunk)
        {
            body += chunk.toString();
        });
        request.on('end', function()
        {
            resolve(body);
        });
    });
}

// ******* FUNCION AUXILIAR PARA CHEQUEAR EXISTENCIA DE USUARIOS *******
function chequearUsuario(db, username) {
    const sql = 'SELECT COUNT(*) as cnt FROM user WHERE username = ? COLLATE NOCASE';
    const stmt = db.prepare(sql);
    const row = stmt.get(username);
    return row && row.cnt > 0;
}

// ************ FUNCIONES DE USUARIOS  --------------

async function register_handler(request, response) // hay que hacer que reciba los datos desde el html y lo agrgue a la base de datos,
                                                   //  para eso hay que hacer un formulario en el html y luego parsear los datos que 
                                                   // llegan por query params (o por body si se hace un POST) y luego llamar a la función 
                                                   // register con esos datos para que los inserte en la base de datos.
                                                   // ACA hay que poner los 2 casos el de GET y el de POST (esto si se usa formato REST)
                                                   // yo no voy a usar REST
{
    if (request.method === 'POST')    // chequeo si el metodo es POST
    {  
        let data = await getRequestbody(request); // el request llega como un stream, por eso hay que esperar a que llegue todo el body para 
        let obj = JSON.parse(data);               // poder parsearlo, por eso se hace una función getRequestbody que devuelve una promesa que se 
        const username = obj.username;              // resuelve cuando llega todo el body, y luego se parsea el body como JSON para obtener los datos de username y password.     
        const password = obj.password;
        // chequear existencia
        const exists = chequearUsuario(db, username);
        if (exists) 
        {
            response.writeHead(409, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ status: 'error', message: 'El usuario ya existe' }));
            return;
        }
        // insertar
        try
        {
            const stmt = db.prepare('INSERT INTO `user` (username, password) VALUES (?, ?)');
            stmt.run(username, password);

            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ status: 'success', username: username }));  // se responde con un JSON indicando que el registro fue exitoso y se incluye el username registrado.
        }
        catch (err)
        {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ status: 'error', message: err.message }));
        }
    }  
    else 
    {  
        response.writeHead(405, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'error', message: 'Método no permitido' })); // si el método no es POST, se responde con un error indicando que el método no está permitido.
    }
}


async function delete_user_handler(request, response)
{   
    if (request.method === 'POST') 
    {
        try {
            let data = await getRequestbody(request);
            let obj = JSON.parse(data);
            const username = obj.username;

            //chequear existencia
            const exists = chequearUsuario(db, username);
            if (exists) {
                const stmt = db.prepare('DELETE FROM user WHERE username = ? COLLATE NOCASE');
                const result = stmt.run(username);
                if (result.changes && result.changes > 0) {
                    response.writeHead(200, { 'Content-Type': 'application/json' });
                    return response.end(JSON.stringify({ status: 'success', username: username }));
                }
                response.writeHead(404, { 'Content-Type': 'application/json' });
                return response.end(JSON.stringify({ status: 'error', message: 'No se pudo borrar' }));
            } else {
                response.writeHead(404, { 'Content-Type': 'application/json' });
                return response.end(JSON.stringify({ status: 'error', message: 'Usuario no encontrado' }));
            }
        } catch (err) {
            console.error('delete_user_handler error:', err);
            response.writeHead(500, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ status: 'error', message: err.message }));
        }
    }
    else
    {
        response.writeHead(405, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'error', message: 'Método no permitido' }));
    }
}

//TODO: preguntar acerca del manejo de errores
async function update_user_handler(request, response)
{
    if (request.method === 'POST')
    {
        try {
            let data = await getRequestbody(request);
            let obj = JSON.parse(data);
            let username = obj.username;
            let newUsername = obj.newUsername;
            let newPassword = obj.newPassword;

            const exists = chequearUsuario(db, username);
            if (!exists) {
                response.writeHead(404, { 'Content-Type': 'application/json' });
                return response.end(JSON.stringify({ status: 'error', message: 'Usuario no encontrado' }));
            }

            // Case 1: Rename user (and maybe change password)
            if (newUsername && newUsername !== username) {
                const targetExists = chequearUsuario(db, newUsername);
                if (targetExists) {
                    response.writeHead(409, { 'Content-Type': 'application/json' });
                    return response.end(JSON.stringify({ status: 'error', message: 'Nombre de usuario ya existe' }));
                }

                let sql = 'UPDATE user SET username = ?' + (newPassword ? ', password = ?' : '') + ' WHERE username = ? COLLATE NOCASE';
                let params = newPassword ? [newUsername, newPassword, username] : [newUsername, username];

                const stmt = db.prepare(sql);
                const result = stmt.run(...params);
                response.writeHead(200, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ status: 'success', username: newUsername, updated: result.changes }));

            // Case 2: Only change password
            } else if (newPassword) {
                const stmt = db.prepare('UPDATE user SET password = ? WHERE username = ? COLLATE NOCASE');
                const result = stmt.run(newPassword, username);
                response.writeHead(200, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ status: 'success', username: username, updated: result.changes }));

            // Case 3: Nothing to do
            } else {
                response.writeHead(200, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ status: 'success', message: 'No se modificó nada', updated: 0 }));
            }
        } catch (err) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ status: 'error', message: err.message }));
        }
    }
    else
    {
        response.writeHead(405, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'error', message: 'Método no permitido' }));
    }
}


// listar usuarios de la base de datos (solo para verificar que se haya insertado el usuario admin correctamente)

function list_user_handler(request, response)
{
    const stmt = db.prepare('SELECT * FROM user');
    const rows = stmt.all();
    console.log('Usuarios en la base de datos:');
    rows.forEach((row) => 
                    {
                    console.log(`ID: ${row.id}, Username: ${row.username}, Password: ${row.password}`);
                    });
    
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ status: 'success', message: 'Usuarios listados en consola' }));
}


// funcion deprecada ya que la verificacion de la existencia de usuario 
//sera responsabilidad del servidor no del frontend
/*
async function check_user_handler(request, response) {
    if (request.method === 'POST') {
        try {
            const data = await getRequestbody(request);
            const obj = JSON.parse(data);
            const username = obj.username;
            const exists = await chequearUsuario(db, username);
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ exists }));
        } catch (err) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ status: 'error', message: err.message }));
        
        }
    } else {
        response.writeHead(405, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'error', message: 'Método no permitido' }));
    }
}
*/

// ------------- FUNCIONES DE GRUPOS  --------------

// *************** FUNCION AUXILIAR PARA CHEQUEAR EXISTENCIA DE GRUPOS *******

function checkGroup(db, nombre) {
    const sql = 'SELECT COUNT(*) as cnt FROM `group` WHERE name = ? COLLATE NOCASE';
    const stmt = db.prepare(sql);
    const row = stmt.get(nombre);
    return row && row.cnt > 0;
}




function insertarGrupo(db, nombre) 
{
    // group es una palabra reservada de SQLite
    // si se usa ` ` se evitan problemas
    let sql = 'INSERT INTO `group` (name) VALUES (?)';
    const stmt = db.prepare(sql);
    stmt.run(nombre);
}

async function register_group_handler(request, response)
{
    if (request.method === 'POST')
    {  
        let data = await getRequestbody(request);
        let obj = JSON.parse(data);
        let nombregrupo = obj.groupname;

        const exists = checkGroup(db, nombregrupo);
        if (exists) {
            response.writeHead(409, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ status: 'error', message: 'El grupo ya existe' }));
        }

        insertarGrupo(db, nombregrupo);
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'success', nombre: nombregrupo }));
    }  
    else 
    {  
        response.writeHead(405, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'error', message: 'Método no permitido' }));
    }
}

function eliminarGrupo(db, nombre) {
    const sql = 'DELETE FROM `group` WHERE name = ?';
    const stmt = db.prepare(sql);
    const result = stmt.run(nombre);
    return result.changes; // 0 si no hubo filas, >0 si borró
}


async function delete_group_handler(request, response)
{   
    if (request.method === 'POST')    // chequeo si el metodo es POST
    {
        try {
            let data = await getRequestbody(request);
            let obj = JSON.parse(data);
            let nombre = (obj.groupname).toString().trim();

            // verificar existencia server-side antes de borrar
            const exists = checkGroup(db, nombre);
            if (!exists) {
                response.writeHead(404, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ status: 'error', message: 'Grupo no encontrado' }));
                return;
            }

            const deleted = eliminarGrupo(db, nombre);
            if (deleted > 0) 
            {
                response.writeHead(200, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ status: 'success', nombre: nombre }));
            } else {
                response.writeHead(404, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ status: 'error', message: 'Grupo no encontrado' }));
            }
        } catch (err) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ status: 'error', message: err.message }));
        }
    } else {
        response.writeHead(405, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'error', message: 'Método no permitido' }));
    }
}



function modificarGrupo(db, nombre, newNombre, newPassword) {
    const updates = [];
    const params = [];
    if (typeof newNombre === 'string' && newNombre.length > 0 && newNombre !== nombre) {
        updates.push('name = ?');
        params.push(newNombre);
    }
    if (updates.length === 0) return 0;
    const sql = `UPDATE "group" SET ${updates.join(', ')} WHERE name = ?`;
    params.push(nombre);
    const stmt = db.prepare(sql);
    const result = stmt.run(...params);
    return result.changes;
}

async function update_group_handler(request, response)
{
    if (request.method === 'POST')
    {
        try {
            let data = await getRequestbody(request);
            let obj = JSON.parse(data);
            let nombre = obj.groupname;
            let newNombre = obj.newGroupname;

            // verificar existencia server-side antes de actualizar
            const exists = checkGroup(db, nombre);
            if (!exists) {
                response.writeHead(404, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ status: 'error', message: 'Grupo no encontrado' }));
                return;
            }

            if (newNombre && newNombre !== nombre) {
                const targetExists = checkGroup(db, newNombre);
                if (targetExists) {
                    response.writeHead(409, { 'Content-Type': 'application/json' });
                    response.end(JSON.stringify({ status: 'error', message: 'Nombre de grupo ya existe' }));
                    return;
                }
            }

            const updated = modificarGrupo(db, nombre, newNombre);
            if (updated > 0) {
                response.writeHead(200, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ status: 'success', nombre: newNombre, updated }));
            } else {
                // no se realizó ningún cambio
                response.writeHead(200, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ status: 'success', message: 'No se modificó nada', updated: 0 }));
            }
        } catch (err) {
            // handle unique constraint on username
            const msg = err && err.message ? err.message : String(err);
            if (msg.toLowerCase().includes('unique') || msg.toLowerCase().includes('constraint failed')) {
                response.writeHead(409, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ status: 'error', message: 'Nombre de grupo ya existe' }));
            } else {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ status: 'error', message: msg }));
            }
        }
    }
    else
    {
        response.writeHead(405, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'error', message: 'Método no permitido' }));
    }
}

// listar grupos de la base de datos (solo para verificar que se haya insertado el grupo correctamente)
function list_group_handler(request, response)
{
    const stmt = db.prepare('SELECT * FROM "group"');
    const rows = stmt.all();
    console.log('Grupos en la base de datos:');
    rows.forEach((row) => 
                        {
                        console.log(`ID: ${row.id}, Nombre: ${row.name}`);
                        });
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ status: 'success', message: 'Grupos listados en consola' }));
}

// funcion deprecada ya que la verificacion de la existencia de grupo 
//sera responsabilidad del servidor no del frontend
/*
async function check_group_handler(request, response) {
    if (request.method === 'POST') {
        try {
            const data = await getRequestbody(request);
            const obj = JSON.parse(data);
            const nombre = obj.groupname;
            const exists = await checkGroup(db, nombre);
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ exists }));
        } catch (err) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ status: 'error', message: err.message }));
        }
    } else {
        response.writeHead(405, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'error', message: 'Método no permitido' }));
    }
}
*/
// ------------- FUNCIONES DE ENDPOINTS  --------------

function checkEndpoint(db, nombre) {
    const sql = 'SELECT COUNT(*) as cnt FROM `endpoint` WHERE path = ? COLLATE NOCASE';
    const stmt = db.prepare(sql);
    const row = stmt.get(nombre);
    return row && row.cnt > 0;
}

async function register_endpoint_handler(request, response) 
                                                   //  para eso hay que hacer un formulario en el html y luego parsear los datos que 
                                                   // llegan por query params (o por body si se hace un POST) y luego llamar a la función 
                                                   // register con esos datos para que los inserte en la base de datos.
                                                   // ACA hay que poner los 2 casos el de GET y el de POST (esto si se usa formato REST)
                                                   // yo no voy a usar REST
{
    if (request.method === 'POST')    // chequeo si el metodo es POST
    {  
        let data = await getRequestbody(request); // el request llega como un stream, por eso hay que esperar a que llegue todo el body para 
        let obj = JSON.parse(data);               // poder parsearlo, por eso se hace una función getRequestbody que devuelve una promesa que se 
        let nombreendpoint = obj.endpointname;   // resuelve cuando llega todo el body, y luego se parsea el body como JSON para obtener los datos.

        const exists = checkEndpoint(db, nombreendpoint);
        if (exists) {
            response.writeHead(409, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ status: 'error', message: 'El endpoint ya existe' }));
        }

        try
        {
            let sql = 'INSERT INTO `endpoint` (path) VALUES (?)';
            const stmt = db.prepare(sql);
            stmt.run(nombreendpoint);
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ status: 'success', nombre: nombreendpoint }));
        }
        catch (err)
        {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ status: 'error', message: err.message }));
        }
    }  
    else 
    {  
        response.writeHead(405, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'error', message: 'Método no permitido' })); // si el método no es POST, se responde con un error indicando que el método no está permitido.
    }
}

function eliminarEndpoint(db, nombre) {
    const sql = 'DELETE FROM `endpoint` WHERE path = ?';
    const stmt = db.prepare(sql);
    const result = stmt.run(nombre);
    return result.changes; // 0 si no hubo filas, >0 si borró
}


async function delete_endpoint_handler(request, response)
{   
    if (request.method === 'POST')    // chequeo si el metodo es POST
    {
        try {
            let data = await getRequestbody(request);
            let obj = JSON.parse(data);
            let nombre = obj.endpointname;

            // verificar existencia server-side antes de borrar
            const exists = checkEndpoint(db, nombre);
            if (!exists) {
                response.writeHead(404, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ status: 'error', message: 'Endpoint no encontrado' }));
                return;
            }

            const deleted = eliminarEndpoint(db, nombre);
            if (deleted > 0) 
            {
                response.writeHead(200, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ status: 'success', nombre: nombre }));
            } else {
                response.writeHead(404, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ status: 'error', message: 'Endpoint no encontrado' }));
            }
        } catch (err) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ status: 'error', message: err.message }));
        }
    } else {
        response.writeHead(405, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'error', message: 'Método no permitido' }));
    }
}



function modificarEndpoint(db, nombre, newNombre, newPassword) {
    const updates = [];
    const params = [];
    if (typeof newNombre === 'string' && newNombre.length > 0 && newNombre !== nombre) {
        updates.push('path = ?');
        params.push(newNombre);
    }
    if (updates.length === 0) return 0;
    const sql = `UPDATE "endpoint" SET ${updates.join(', ')} WHERE path = ?`;
    params.push(nombre);
    const stmt = db.prepare(sql);
    const result = stmt.run(...params);
    return result.changes;
}

async function update_endpoint_handler(request, response)
{
    if (request.method === 'POST')
    {
        try {
            let data = await getRequestbody(request);
            let obj = JSON.parse(data);
            let nombre = obj.endpointname;
            let newNombre = obj.newEndpointname;

            // verificar existencia server-side antes de actualizar
            const exists = checkEndpoint(db, nombre);
            if (!exists) {
                response.writeHead(404, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ status: 'error', message: 'Endpoint no encontrado' }));
                return;
            }

            if (newNombre && newNombre !== nombre) {
                const targetExists = checkEndpoint(db, newNombre);
                if (targetExists) {
                    response.writeHead(409, { 'Content-Type': 'application/json' });
                    response.end(JSON.stringify({ status: 'error', message: 'Nombre de endpoint ya existe' }));
                    return;
                }
            }

            const updated = modificarEndpoint(db, nombre, newNombre);
            if (updated > 0) {
                response.writeHead(200, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ status: 'success', nombre: newNombre, updated }));
            } else {
                // no se realizó ningún cambio
                response.writeHead(200, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ status: 'success', message: 'No se modificó nada', updated: 0 }));
            }
        } catch (err) {
            // handle unique constraint on username
            const msg = err && err.message ? err.message : String(err);
            if (msg.toLowerCase().includes('unique') || msg.toLowerCase().includes('constraint failed')) {
                response.writeHead(409, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ status: 'error', message: 'Nombre de endpoint ya existe' }));
            } else {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ status: 'error', message: msg }));
            }
        }
    }
    else
    {
        response.writeHead(405, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'error', message: 'Método no permitido' }));
    }
}

// listar endpoints de la base de datos (solo para verificar que se haya insertado el endpoint correctamente)

function list_endpoint_handler(request, response)
{
    const stmt = db.prepare('SELECT * FROM "endpoint"');
    const rows = stmt.all();
    console.log('Endpoints en la base de datos:');
    rows.forEach((row) =>   {
                            console.log(`ID: ${row.id}, Nombre: ${row.path}`);
                            });

    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ status: 'success', message: 'Endpoints listados en consola' }));
}



// funcion deprecada ya que la verificacion de la existencia de endpoint 
// sera responsabilidad del servidor no del frontend
// ------------- FUNCIONES DE ASIGNACIÓN  --------------
// ------------- FUNCIONES DE ASIGNACIÓN USUARIOS-GRUPOS --------------

// -------------  FUNCIONES AUXILIARES para usar el ID en la asignacion --------------
function retornarIdUsuario(db, username) 
{
    const sql = 'SELECT id FROM user WHERE username = ? COLLATE NOCASE';
    const stmt = db.prepare(sql);
    const row = stmt.get(username);
    return row ? row.id : null;
}

function retornarIdGrupo(db, groupname) 
{
    const sql = 'SELECT id FROM `group` WHERE name = ? COLLATE NOCASE';
    const stmt = db.prepare(sql);
    const row = stmt.get(groupname);
    return row ? row.id : null;
}

function retornarIdEndpoint(db, endpointname) 
{
    const sql = 'SELECT id FROM `endpoint` WHERE path = ? COLLATE NOCASE';
    const stmt = db.prepare(sql);
    const row = stmt.get(endpointname);
    return row ? row.id : null;
}

function insertarUsuarioGrupo(db, nombreusuario, nombregrupo) 
{
    let idusuario = retornarIdUsuario(db, nombreusuario);
    let idgrupo = retornarIdGrupo(db, nombregrupo);
    let sql = 'INSERT OR IGNORE INTO `members` (id_user, id_group) VALUES (?, ?)';
    const stmt = db.prepare(sql);
    stmt.run(idusuario, idgrupo);
}


function chequearUsuarioEnGrupo(db, idusuario, idgrupo)
{
    const sql = 'SELECT COUNT(*) as cnt FROM members WHERE id_user = ? AND id_group = ?';
    const stmt = db.prepare(sql);
    const row = stmt.get(idusuario, idgrupo);
    return row && row.cnt > 0;
}

//TODO: se deberia chequear que el usuario y el grupo existan antes de asignar
async function assign_user_to_group_handler(request, response)
{
    // Implementación para asignar usuario a grupo
    if (request.method === 'POST')    // chequeo si el metodo es POST
    {  
        let data = await getRequestbody(request); // el request llega como un stream, por eso hay que esperar a que llegue todo el body para 
        let obj = JSON.parse(data);               // poder parsearlo, por eso se hace una función getRequestbody que devuelve una promesa que se 
        let nombreusuario = obj.username;   // resuelve cuando llega todo el body, y luego se parsea el body como JSON para obtener los datos.
        let nombregrupo = obj.groupname;
        
        insertarUsuarioGrupo(db, nombreusuario, nombregrupo);    // se llama a la funcion insertarUsuarioGrupo que inserta en la BD
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'success', nombre: nombreusuario }));  // se responde con un JSON indicando que el registro fue exitoso y se incluye el username registrado.
    }     
    else 
    {  
        response.writeHead(405, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'error', message: 'Método no permitido' })); // si el método no es POST, se responde con un error indicando que el método no está permitido.
    }
}


function removerUsuarioDeGrupo(db, idusuario, idgrupo)
{
    const sql = 'DELETE FROM members WHERE id_user = ? AND id_group = ?';
    const stmt = db.prepare(sql);
    const result = stmt.run(idusuario, idgrupo);
    return result.changes; // 0 si no hubo filas, >0 si borró
}

async function remove_user_from_group_handler(request, response)
{
    if (request.method === 'POST')    // chequeo si el metodo es POST
    {  
        let data = await getRequestbody(request);    // el request llega como un stream, por eso hay que esperar a que llegue todo el body para 
        let obj = JSON.parse(data);               // poder parsearlo, por eso se hace una función getRequestbody que devuelve una promesa que se 
        let username = obj.username;              // resuelve cuando llega todo el body, y luego se parsea el body como JSON para obtener el dato de username.     
        let groupname = obj.groupname;
        
        let idusuario = retornarIdUsuario(db, username);
        let idgrupo = retornarIdGrupo(db, groupname);
        try {
            const exists = chequearUsuarioEnGrupo(db, idusuario, idgrupo);
            if (!exists) {
                response.writeHead(404, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ status: 'error', message: 'Usuario no encontrado en el grupo' }));
                return;
            }
            const deleted = removerUsuarioDeGrupo(db, idusuario, idgrupo);
            if (deleted > 0) 
            {
                response.writeHead(200, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ status: 'success', username }));
            } else {
                response.writeHead(404, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ status: 'error', message: 'Usuario no encontrado en el grupo' }));
            }
            } catch (err) 
            {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ status: 'error', message: err.message }));
                return;
            }
    }else
    {
        response.writeHead(405, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'error', message: 'Método no permitido' }));
    }
}


function list_user_groups_handler(request, response)
{
    const stmt = db.prepare('SELECT * FROM "members"');
    const rows = stmt.all();
    console.log('Members en la base de datos:');
    rows.forEach((row) => {
                        console.log(`User ID: ${row.id_user}, Group ID: ${row.id_group}`);
                        });
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ status: 'success', message: 'Members listados en consola' }));
}



// ------------- FUNCIONES DE ASIGNACIÓN ENDPOINTS-GRUPOS --------------

function insertarGrupoEndpoint(db, nombregrupo, nombreendpoint) 
{
    // group es una palabra reservada de SQLite
    // si se usa ` ` se evitan problemas
    
    let idgrupo = retornarIdGrupo(db, nombregrupo);
    let idendpoint = retornarIdEndpoint(db, nombreendpoint);

    let sql = 'INSERT INTO `access` (id_group, id_endpoint) VALUES (?, ?)';
    const stmt = db.prepare(sql);
    const result = stmt.run(idgrupo, idendpoint);
    return result.changes || 0;
}


function chequearGrupoEnEndpoint(db, idgrupo, idendpoint)
{
    const sql = 'SELECT COUNT(*) as cnt FROM access WHERE id_group = ? AND id_endpoint = ?';
    const stmt = db.prepare(sql);
    const row = stmt.get(idgrupo, idendpoint);
    return row && row.cnt > 0;
}

//TODO: se deberia chequear que el usuario y el grupo existan antes de asignar
async function assign_endpoint_to_group_handler(request, response)
{
    // Implementación para asignar usuario a grupo
    if (request.method === 'POST')    // chequeo si el metodo es POST
    {  
        let data = await getRequestbody(request); // el request llega como un stream, por eso hay que esperar a que llegue todo el body para 
        let obj = JSON.parse(data);               // poder parsearlo, por eso se hace una función getRequestbody que devuelve una promesa que se 
        let nombregrupo = obj.groupname;   // resuelve cuando llega todo el body, y luego se parsea el body como JSON para obtener los datos.
        let nombreendpoint = obj.endpointname;
                    
        try
        {
            insertarGrupoEndpoint(db, nombregrupo, nombreendpoint);    // se llama a la funcion insertarGrupoEndpoint que inserta en la BD
        }
        catch (err)
        {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ status: 'error', message: err.message }));
        }
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'success', nombre: nombregrupo }));  // se responde con un JSON indicando que el registro fue exitoso y se incluye el nombre del grupo registrado.
    }     
    else 
    {  
        response.writeHead(405, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'error', message: 'Método no permitido' })); // si el método no es POST, se responde con un error indicando que el método no está permitido.
    }
}


function removerGrupoEndpoint(db, groupname, endpointname)
{   
    let idgrupo = retornarIdGrupo(db, groupname);
    let idendpoint = retornarIdEndpoint(db, endpointname);
    
    //TODO: como se hace esta comprobacion si el idrupo o idendpoint existe
    if (idgrupo === null || idendpoint === null) {
        throw new Error('Grupo o endpoint no encontrado');
    }

    const sql = 'DELETE FROM access WHERE id_group = ? AND id_endpoint = ?';
    const stmt = db.prepare(sql);
    const result = stmt.run(idgrupo, idendpoint);
    return result.changes || 0;
}

async function remove_endpoint_from_group_handler(request, response)
{
    if (request.method === 'POST')
    {
        try {
            let data = await getRequestbody(request);
            let obj = JSON.parse(data);
            let groupname = obj.groupname;
            let endpointname = obj.endpointname;

            let removed = removerGrupoEndpoint(db, groupname, endpointname);
            if (!removed) {
                response.writeHead(404, { 'Content-Type': 'application/json' });
                return response.end(JSON.stringify({ status: 'error', message: 'Relación no encontrada' }));
            }

            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ status: 'success', groupname: groupname, endpointname: endpointname, removed: removed }));
        } catch (err) {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ status: 'error', message: err.message }));
        }
    }
    else
    {
        response.writeHead(405, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'error', message: 'Método no permitido' }));
    }

}

function list_group_endpoints_handler(request, response)
{
    const stmt = db.prepare('SELECT * FROM "access"');
    const rows = stmt.all();
    console.log('Access en la base de datos:');
    rows.forEach((row) => {
                        console.log(`Group ID: ${row.id_group}, Endpoint ID: ${row.id_endpoint}`);
                        });
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ status: 'success', message: 'Access listados en consola' }));
}


// Se crea un MAP llamado router que asocia cada ruta (path) con su correspondiente handler 
// (función que maneja la solicitud para esa ruta).
// Se iran agregando las rutas y sus handlers al MAP utilizando el método set, donde la clave es la ruta
// y el valor es la función handler correspondiente.
// esto permite agrega nuevos casos de uso (nuevas rutas y handlers) de manera sencilla, simplemente agregando
// nuevas entradas al MAP sin necesidad de modificar la lógica del despachador principal.

let router = new Map();   
router.set('/', default_handler )

// router.set('/check-user', check_user_handler );
router.set('/login', login_handler );
router.set('/logout', logout_handler );
router.set('/register', register_handler );
router.set('/delete-user', delete_user_handler ); 
router.set('/update-user', update_user_handler ); 

// esta ruta es para listar los usuarios por consola pero solo en desarrollo.
router.set('/list-users', list_user_handler );


//router.set('/check-group', check_group_handler );
router.set('/register-group', register_group_handler );
router.set('/delete-group', delete_group_handler );
router.set('/update-group', update_group_handler );
// esta ruta es para listar los grupos por consola pero solo en desarrollo.
router.set('/list-groups', list_group_handler );


//router.set('/check-endpoint', check_endpoint_handler );
router.set('/register-endpoint', register_endpoint_handler );
router.set('/delete-endpoint', delete_endpoint_handler );
router.set('/update-endpoint', update_endpoint_handler );
router.set('/list-endpoints', list_endpoint_handler );

router.set(`/assign-user-to-group`, assign_user_to_group_handler );
router.set(`/remove-user-from-group`, remove_user_from_group_handler );
router.set(`/list-user-groups`, list_user_groups_handler );

router.set(`/assign-endpoint-to-group`, assign_endpoint_to_group_handler );
router.set(`/remove-endpoint-from-group`, remove_endpoint_from_group_handler );
router.set(`/list-group-endpoints`, list_group_endpoints_handler );




//Despachador principal
async function request_dispatcher(request, response)
{
	const url = new URL(request.url, 'http://' + config.server.ip);
    const path = url.pathname;

    const handler = router.get(path);

    if (handler)
    {
        return await handler(request, response);
    }
    else
    {
        response.writeHead(404);
        response.end('Método no encontrado');
    }
}





// ****************   BLOQUE DE INICIALIZACIÓN DEL SERVIDOR   ****************
function start()
{
console.clear();
console.log('Servidor ejecutándose... en el puerto ' + config.server.port + ' y la IP ' + config.server.ip);
console.log('Ingresa a http://' + config.server.ip + ':' + config.server.port + ' en tu navegador para acceder a la aplicación.');
console.log('Presiona Ctrl+C para detener el servidor.');
}

// se crea un servidor HTTP utilizando la función createServer del módulo http, pasando como argumento el request_dispatcher
// que es la función encargada de manejar las solicitudes entrantes. Luego, se llama al método listen del servidor para que
// escuche en la dirección IP y puerto especificados en la configuración, y se pasa la función start como callback que se 
// ejecutará una vez que el servidor esté listo para aceptar conexiones.

let server = createServer(request_dispatcher);

server.listen(config.server.port, config.server.ip, start);