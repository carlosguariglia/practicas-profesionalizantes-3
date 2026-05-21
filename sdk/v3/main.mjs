import { createServer } from 'node:http';
import { URL } from 'node:url';
import { readFileSync } from 'node:fs';
import  sqlite3  from 'sqlite3';
import { resolve } from 'node:path';
import { clearScreenDown } from 'node:readline';


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

    // se crea una nueva instancia de sqlite3.Database utilizando la ruta resuelta y se asigna a la variable db.
    // se proporciona una función de callback para manejar cualquier error que pueda ocurrir al conectar a la base de datos.
    // Si ocurre un error, se lanza una nueva excepción con un mensaje descriptivo. 
    const db = new sqlite3.Database(dbPath, function(err) 
    {   if (err) 
        {
            throw new Error(`Error al conectar a la base de datos: ${err.message}`);
        }
    });

    console.log(`Conexión a la base de datos ${dbPath} establecida.`);
    return db;   // se retorna la instancia de la base de datos para que pueda ser utilizada en otras partes del código

}

const db = connect_db(config.database.path);




// ****************   BLOQUE DE LÓGICA DE NEGOCIO   ****************

// *****************   FUNCIONES DE AUTENTICACIÓN   ****************
//TODO Hacer esta funcion siguiendo la consigna, usando autorizador, autenticador
function login( input )
{
	const userdata =
	{
		username: 'admin',
		password: '1234'
	};

	let output =
	{
		status: false,
		result: null,
		description: 'INVALID_USER_PASS'
	};

	if ( input.username === userdata.username && input.password === userdata.password )
	{
		output.status = true;
		output.result = input.username;
		output.description = null;
	}

	return output;
}


// ****************   BLOQUE DE RUTEO Y DESPACHO   ****************

async function login_handler(request, response)
{
    const url = new URL(request.url, 'http://' + config.server.ip);
    const input = Object.fromEntries(url.searchParams);

    const output = login(input);

    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(output));
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
async function getRequestbody(request)  
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
    return new Promise(function(resolve, reject) {
        const sql = 'SELECT COUNT(*) as cnt FROM user WHERE username = ? COLLATE NOCASE';
        db.get(sql, [username], function(err, row) {
            if (err) return reject(err);
            resolve(row && row.cnt > 0);
        });
    });
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
        const exists = await chequearUsuario(db, username);
        if (exists) 
        {
            response.writeHead(409, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ status: 'error', message: 'El usuario ya existe' }));
            return;
        }
        // insertar
        db.run('INSERT INTO `user` (username, password) VALUES (?, ?)', [username, password], function(err) {
        if (err) 
            {
            response.writeHead(500, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ status: 'error', message: err.message }));
            }
        });

        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'success', username: username }));  // se responde con un JSON indicando que el registro fue exitoso y se incluye el username registrado.
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
            const exists = await chequearUsuario(db, username);
            if (exists) {
                db.run('DELETE FROM user WHERE username = ? COLLATE NOCASE', [username], function(err) {
                    if (err) {
                        console.error('delete_user_handler SQL error:', err);
                        response.writeHead(500, { 'Content-Type': 'text/plain' });
                        return response.end('no se pudo borrar');
                    }
                    if (this.changes && this.changes > 0) {
                        response.writeHead(200, { 'Content-Type': 'application/json' });
                        return response.end(JSON.stringify({ status: 'success', username: username }));
                    } else {
                        response.writeHead(404, { 'Content-Type': 'application/json' });
                        return response.end(JSON.stringify({ status: 'error', message: 'No se pudo borrar' }));
                    }
                });
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

            const exists = await chequearUsuario(db, username);
            if (!exists) {
                response.writeHead(404, { 'Content-Type': 'application/json' });
                return response.end(JSON.stringify({ status: 'error', message: 'Usuario no encontrado' }));
            }

            // Case 1: Rename user (and maybe change password)
            if (newUsername && newUsername !== username) {
                const targetExists = await chequearUsuario(db, newUsername);
                if (targetExists) {
                    response.writeHead(409, { 'Content-Type': 'application/json' });
                    return response.end(JSON.stringify({ status: 'error', message: 'Nombre de usuario ya existe' }));
                }

                let sql = 'UPDATE user SET username = ?' + (newPassword ? ', password = ?' : '') + ' WHERE username = ? COLLATE NOCASE';
                let params = newPassword ? [newUsername, newPassword, username] : [newUsername, username];

                db.run(sql, params, function(err) {
                    if (err) {
                        response.writeHead(500, { 'Content-Type': 'application/json' });
                        return response.end(JSON.stringify({ status: 'error', message: err.message }));
                    }
                    response.writeHead(200, { 'Content-Type': 'application/json' });
                    response.end(JSON.stringify({ status: 'success', username: newUsername, updated: this.changes }));
                });

            // Case 2: Only change password
            } else if (newPassword) {
                db.run('UPDATE user SET password = ? WHERE username = ? COLLATE NOCASE', [newPassword, username], function(err) {
                    if (err) {
                        response.writeHead(500, { 'Content-Type': 'application/json' });
                        return response.end(JSON.stringify({ status: 'error', message: err.message }));
                    }
                    response.writeHead(200, { 'Content-Type': 'application/json' });
                    response.end(JSON.stringify({ status: 'success', username: username, updated: this.changes }));
                });

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
    db.all('SELECT * FROM user', function(err, rows) 
        { 
            if (err) 
                { console.error('Error al listar usuarios:', err.message);
                return;
                }
            console.log('Usuarios en la base de datos:');
            rows.forEach((row) => 
                            {
                            console.log(`ID: ${row.id}, Username: ${row.username}, Password: ${row.password}`);
                            });
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
    return new Promise(function(resolve, reject) {
        const sql = 'SELECT COUNT(*) as cnt FROM `group` WHERE name = ? COLLATE NOCASE';
        db.get(sql, [nombre], function(err, row) {
            if (err) return reject(err);
            resolve(row && row.cnt > 0);
        });
    });
}




function insertarGrupo(db, nombre) 
{
    // group es una palabra reservada de SQLite
    // si se usa ` ` se evitan problemas
    let sql = 'INSERT INTO `group` (name) VALUES (?)';
    db.run(sql, [nombre]);
}

async function register_group_handler(request, response)
{
    if (request.method === 'POST')
    {  
        let data = await getRequestbody(request);
        let obj = JSON.parse(data);
        let nombregrupo = obj.groupname;

        const exists = await checkGroup(db, nombregrupo);
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

async function eliminarGrupo(db, nombre) {
    return new Promise(function(resolve, reject) {
        const sql = 'DELETE FROM `group` WHERE name = ?';
        db.run(sql, [nombre], function(err) {
            if (err) return reject(err);
            resolve(this.changes); // 0 si no hubo filas, >0 si borró
        });
    });
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
            const exists = await checkGroup(db, nombre);
            if (!exists) {
                response.writeHead(404, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ status: 'error', message: 'Grupo no encontrado' }));
                return;
            }

            const deleted = await eliminarGrupo(db, nombre);
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



async function modificarGrupo(db, nombre, newNombre, newPassword) {
    return new Promise(function(resolve, reject) {
        const updates = [];
        const params = [];
        if (typeof newNombre === 'string' && newNombre.length > 0 && newNombre !== nombre) {
            updates.push('name = ?');
            params.push(newNombre);
        }
        if (updates.length === 0) return resolve(0);
        const sql = `UPDATE "group" SET ${updates.join(', ')} WHERE name = ?`;
        params.push(nombre);
        db.run(sql, params, function(err) {
            if (err) return reject(err);
            resolve(this.changes);
        });
    });
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
            const exists = await checkGroup(db, nombre);
            if (!exists) {
                response.writeHead(404, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ status: 'error', message: 'Grupo no encontrado' }));
                return;
            }

            if (newNombre && newNombre !== nombre) {
                const targetExists = await checkGroup(db, newNombre);
                if (targetExists) {
                    response.writeHead(409, { 'Content-Type': 'application/json' });
                    response.end(JSON.stringify({ status: 'error', message: 'Nombre de grupo ya existe' }));
                    return;
                }
            }

            const updated = await modificarGrupo(db, nombre, newNombre);
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
    db.all('SELECT * FROM "group"', function(err, rows) 
        { 
        if (err) 
        {   console.error('Error al listar grupos:', err.message);
            return;
        }
        console.log('Grupos en la base de datos:');
        rows.forEach((row) => 
                            {
                            console.log(`ID: ${row.id}, Nombre: ${row.name}`);
                            });
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
    return new Promise(function(resolve, reject) {
        const sql = 'SELECT COUNT(*) as cnt FROM `endpoint` WHERE path = ? COLLATE NOCASE';
        db.get(sql, [nombre], function(err, row) {
            if (err) return reject(err);
            resolve(row && row.cnt > 0);
        });
    });
}

async function register_endpoint_handler(request, response) //TODO: hay que hacer que reciba los datos desde el html y lo agrgue a la base de datos,
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

        const exists = await checkEndpoint(db, nombreendpoint);
        if (exists) {
            response.writeHead(409, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify({ status: 'error', message: 'El endpoint ya existe' }));
        }

        let sql = 'INSERT INTO `endpoint` (path) VALUES (?)';
        db.run(sql, [nombreendpoint], function(err) {
            if (err) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                return response.end(JSON.stringify({ status: 'error', message: err.message }));
            }
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ status: 'success', nombre: nombreendpoint }));
        });
    }  
    else 
    {  
        response.writeHead(405, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'error', message: 'Método no permitido' })); // si el método no es POST, se responde con un error indicando que el método no está permitido.
    }
}

async function eliminarEndpoint(db, nombre) {
    return new Promise(function(resolve, reject) {
        const sql = 'DELETE FROM `endpoint` WHERE path = ?';
        db.run(sql, [nombre], function(err) {
            if (err) return reject(err);
            resolve(this.changes); // 0 si no hubo filas, >0 si borró
        });
    });
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
            const exists = await checkEndpoint(db, nombre);
            if (!exists) {
                response.writeHead(404, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ status: 'error', message: 'Endpoint no encontrado' }));
                return;
            }

            const deleted = await eliminarEndpoint(db, nombre);
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



async function modificarEndpoint(db, nombre, newNombre, newPassword) {
    return new Promise(function(resolve, reject) {
        const updates = [];
        const params = [];
        if (typeof newNombre === 'string' && newNombre.length > 0 && newNombre !== nombre) {
            updates.push('path = ?');
            params.push(newNombre);
        }
        if (updates.length === 0) return resolve(0);
        const sql = `UPDATE "endpoint" SET ${updates.join(', ')} WHERE path = ?`;
        params.push(nombre);
        db.run(sql, params, function(err) {
            if (err) return reject(err);
            resolve(this.changes);
        });
    });
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
            const exists = await checkEndpoint(db, nombre);
            if (!exists) {
                response.writeHead(404, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ status: 'error', message: 'Endpoint no encontrado' }));
                return;
            }

            if (newNombre && newNombre !== nombre) {
                const targetExists = await checkEndpoint(db, newNombre);
                if (targetExists) {
                    response.writeHead(409, { 'Content-Type': 'application/json' });
                    response.end(JSON.stringify({ status: 'error', message: 'Nombre de endpoint ya existe' }));
                    return;
                }
            }

            const updated = await modificarEndpoint(db, nombre, newNombre);
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
function listarEndpoints(db)
{   
    }

function list_endpoint_handler(request, response)
{
    db.all('SELECT * FROM "endpoint"', function(err, rows) 
        { 
        if (err) 
        {   console.error('Error al listar endpoints:', err.message);
            return;
        }
        console.log('Endpoints en la base de datos:');
        rows.forEach((row) =>   {
                                console.log(`ID: ${row.id}, Nombre: ${row.path}`);
                                });
        });

    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ status: 'success', message: 'Endpoints listados en consola' }));
}



// funcion deprecada ya que la verificacion de la existencia de endpoint 
// sera responsabilidad del servidor no del frontend
// ------------- FUNCIONES DE ASIGNACIÓN  --------------
// ------------- FUNCIONES DE ASIGNACIÓN USUARIOS-GRUPOS --------------

// -------------  FUNCIONES AUXILIARES para usar el ID en la asignacion --------------
async function retornarIdUsuario(db, username) 
{
    return new Promise(function(resolve, reject) {
        const sql = 'SELECT id FROM user WHERE username = ? COLLATE NOCASE';
        db.get(sql, [username], function(err, row) {
            if (err) return reject(err);
            resolve(row ? row.id : null);
        });
    });
}

async function retornarIdGrupo(db, groupname) 
{
    return new Promise(function(resolve, reject) {
        const sql = 'SELECT id FROM `group` WHERE name = ? COLLATE NOCASE';
        db.get(sql, [groupname], function(err, row) {
            if (err) return reject(err);
            resolve(row ? row.id : null);
        });
    });
}

async function retornarIdEndpoint(db, endpointname) 
{
    return new Promise(function(resolve, reject) {
        const sql = 'SELECT id FROM `endpoint` WHERE path = ? COLLATE NOCASE';
        db.get(sql, [endpointname], function(err, row) {
            if (err) return reject(err);
            resolve(row ? row.id : null);
        });
    });
}

async function insertarUsuarioGrupo(db, nombreusuario, nombregrupo) 
{
    let idusuario = await retornarIdUsuario(db, nombreusuario);
    let idgrupo = await retornarIdGrupo(db, nombregrupo);
    let sql = 'INSERT OR IGNORE INTO `members` (id_user, id_group) VALUES (?, ?)';
    await db.run(sql, [idusuario, idgrupo]);  
}


async function chequearUsuarioEnGrupo(db, idusuario, idgrupo)
{
    return new Promise(function(resolve, reject) {
        const sql = 'SELECT COUNT(*) as cnt FROM members WHERE id_user = ? AND id_group = ?';
        db.get(sql, [idusuario, idgrupo], function(err, row) {
            if (err) return reject(err);
            resolve(row && row.cnt > 0);
        });
    });
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
        
        await insertarUsuarioGrupo(db, nombreusuario, nombregrupo);    // se llama a la funcion insertarUsuarioGrupo que inserta en la BD
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'success', nombre: nombreusuario }));  // se responde con un JSON indicando que el registro fue exitoso y se incluye el username registrado.
    }     
    else 
    {  
        response.writeHead(405, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'error', message: 'Método no permitido' })); // si el método no es POST, se responde con un error indicando que el método no está permitido.
    }
}


async function removerUsuarioDeGrupo(db, idusuario, idgrupo)
{
    return new Promise(function(resolve, reject) {
        const sql = 'DELETE FROM members WHERE id_user = ? AND id_group = ?';
        db.run(sql, [idusuario, idgrupo], function(err) {
            if (err) return reject(err);
            resolve(this.changes); // 0 si no hubo filas, >0 si borró
        });
    });
}

async function remove_user_from_group_handler(request, response)
{
    if (request.method === 'POST')    // chequeo si el metodo es POST
    {  
        let data = await getRequestbody(request);    // el request llega como un stream, por eso hay que esperar a que llegue todo el body para 
        let obj = JSON.parse(data);               // poder parsearlo, por eso se hace una función getRequestbody que devuelve una promesa que se 
        let username = obj.username;              // resuelve cuando llega todo el body, y luego se parsea el body como JSON para obtener el dato de username.     
        let groupname = obj.groupname;
        
        let idusuario = await retornarIdUsuario(db, username);
        let idgrupo = await retornarIdGrupo(db, groupname);
        try {
            const exists = await chequearUsuarioEnGrupo(db, idusuario, idgrupo);
            if (!exists) {
                response.writeHead(404, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ status: 'error', message: 'Usuario no encontrado en el grupo' }));
                return;
            }
            const deleted = await removerUsuarioDeGrupo(db, idusuario, idgrupo);
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


function listarMembers(db)
{   
    db.all('SELECT * FROM "members"', function(err, rows) { 
        if (err) 
        { console.error('Error al listar members:', err.message);
            return;
        }
        console.log('Members en la base de datos:');
        rows.forEach((row) => {
                            console.log(`User ID: ${row.id_user}, Group ID: ${row.id_group}`);
                            });
                                            });
}

function list_user_groups_handler(request, response)
{
    listarMembers(db);
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
    db.run(sql, [idgrupo, idendpoint]);
    
}


async function chequearGrupoEnEndpoint(db, idgrupo, idendpoint)
{
    return new Promise(function(resolve, reject) {
        const sql = 'SELECT COUNT(*) as cnt FROM access WHERE id_group = ? AND id_endpoint = ?';
        db.get(sql, [idgrupo, idendpoint], function(err, row) {
            if (err) return reject(err);
            resolve(row && row.cnt > 0);
        });
    });
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
                    
        await insertarGrupoEndpoint(db, nombregrupo, nombreendpoint);    // se llama a la funcion insertarGrupoEndpoint que inserta en la BD
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'success', nombre: nombregrupo }));  // se responde con un JSON indicando que el registro fue exitoso y se incluye el nombre del grupo registrado.
    }     
    else 
    {  
        response.writeHead(405, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'error', message: 'Método no permitido' })); // si el método no es POST, se responde con un error indicando que el método no está permitido.
    }
}


async function removerGrupoEndpoint(db, groupname, endpointname)
{   
    let idgrupo = await retornarIdGrupo(db, groupname);
    let idendpoint = await retornarIdEndpoint(db, endpointname);
    
    //TODO: como se hace esta comprobacion si el idrupo o idendpoint existe
    if (idgrupo === null || idendpoint === null) {
        throw new Error('Grupo o endpoint no encontrado');
    }

    return new Promise(function(resolve, reject) {
        const sql = 'DELETE FROM access WHERE id_group = ? AND id_endpoint = ?';
        db.run(sql, [idgrupo, idendpoint], function(err) {
            if (err) return reject(err);
            resolve(this.changes || 0);
        });
    });
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

            let removed = await removerGrupoEndpoint(db, groupname, endpointname);
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

function listarAccess(db)
{   
    db.all('SELECT * FROM "access"', function(err, rows) { 
        if (err) 
        { console.error('Error al listar access:', err.message);
            return;
        }
        console.log('Access en la base de datos:');
        rows.forEach((row) => {
                            console.log(`User ID: ${row.id_user}, Group ID: ${row.id_group}`);
                            });
                                            });
}

function list_group_endpoints_handler(request, response)
{
    listaraccess(db);
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