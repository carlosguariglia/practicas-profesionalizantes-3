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
    const db = new sqlite3.Database(dbPath, (err) => 
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

//Lógica de negocio / Modelo (Son independientes de protocolos, comunicaciones y servidor)
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

    console.log(input);

    const output = login(input);

    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(output));
}

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

function insertarUsuario(db, username, password) 
{
    let sql = 'INSERT INTO user (username, password) VALUES (?, ?)';
    db.run(sql, [username, password]);
}

async function register_handler(request, response) //TODO: hay que hacer que reciba los datos desde el html y lo agrgue a la base de datos,
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
        let username = obj.username;              // resuelve cuando llega todo el body, y luego se parsea el body como JSON para obtener los datos de username y password.     
        let password = obj.password;
        insertarUsuario(db, username, password);    // se llama a la funcion insertarUsuario que es la que maneja SQL para insertar en la bd
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'success', username: username }));  // se responde con un JSON indicando que el registro fue exitoso y se incluye el username registrado.
    }  
    else 
    {  
        response.writeHead(405, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'error', message: 'Método no permitido' })); // si el método no es POST, se responde con un error indicando que el método no está permitido.
    }
}

async function getRequestbody(request)
{
return new Promise((resolve, reject) =>
{
    let body = '';
    request.on('data', chunk =>
    {
    body += chunk.toString();
    });
    request.on('end', () =>
    {
    resolve(body);
    });
});
}

async function eliminarUsuario(db, username) {
return new Promise((resolve, reject) => {
const sql = 'DELETE FROM user WHERE username = ? COLLATE NOCASE';
db.run(sql, [username], function(err) {
if (err) return reject(err);
resolve(this.changes); // 0 si no hubo filas, >0 si borró
});
});
}


async function delete_user_handler(request, response)
{   
    if (request.method === 'POST')    // chequeo si el metodo es POST
    {  
        let data = await getRequestbody(request);    // el request llega como un stream, por eso hay que esperar a que llegue todo el body para 
        let obj = JSON.parse(data);               // poder parsearlo, por eso se hace una función getRequestbody que devuelve una promesa que se 
        let username = obj.username;              // resuelve cuando llega todo el body, y luego se parsea el body como JSON para obtener el dato de username.     
        try {
            const deleted = await eliminarUsuario(db, username);
            if (deleted > 0) 
            {
                response.writeHead(200, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ status: 'success', username }));
            } else {
                response.writeHead(404, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ status: 'error', message: 'Usuario no encontrado' }));
            }
            } catch (err) 
            {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ status: 'error', message: err.message }));
            }
    }else
    {
        response.writeHead(405, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'error', message: 'Método no permitido' }));
    }
}



async function modificarUsuario(db, username, newUsername, newPassword) {
    return new Promise((resolve, reject) => {
        const updates = [];
        const params = [];
        if (typeof newPassword === 'string' && newPassword.length > 0) {
            updates.push('password = ?');
            params.push(newPassword);
        }
        if (typeof newUsername === 'string' && newUsername.length > 0 && newUsername !== username) {
            updates.push('username = ?');
            params.push(newUsername);
        }
        if (updates.length === 0) return resolve(0);

        const sql = `UPDATE user SET ${updates.join(', ')} WHERE username = ? COLLATE NOCASE`;
        params.push(username);
        db.run(sql, params, function(err) {
            if (err) return reject(err);
            resolve(this.changes);
        });
    });
}

async function update_user_handler(request, response)
{
    if (request.method === 'POST')
    {
        try {
            let data = await getRequestbody(request);
            let obj = JSON.parse(data);
            let username = obj.username;
            let newUsername = obj.newUsername; // may be same as username
            let newPassword = obj.newPassword;

            const updated = await modificarUsuario(db, username, newUsername, newPassword);
            if (updated > 0) {
                response.writeHead(200, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ status: 'success', username: username, updated }));
            } else {
                response.writeHead(404, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ status: 'error', message: 'Usuario no encontrado' }));
            }
        } catch (err) {
            // handle unique constraint on username
            const msg = err && err.message ? err.message : String(err);
            if (msg.toLowerCase().includes('unique') || msg.toLowerCase().includes('constraint failed')) {
                response.writeHead(409, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ status: 'error', message: 'Nombre de usuario ya existe' }));
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

// Se crea un MAP llamado router que asocia cada ruta (path) con su correspondiente handler 
// (función que maneja la solicitud para esa ruta).
// Se iran agregando las rutas y sus handlers al MAP utilizando el método set, donde la clave es la ruta
// y el valor es la función handler correspondiente.
// esto permite agrega nuevos casos de uso (nuevas rutas y handlers) de manera sencilla, simplemente agregando
// nuevas entradas al MAP sin necesidad de modificar la lógica del despachador principal.

let router = new Map();   // 
router.set('/', default_handler )

router.set('/check-user', check_user_handler );
router.set('/login', login_handler );
router.set('/register', register_handler );
router.set('/delete-user', delete_user_handler );
router.set('/update-user', update_user_handler );

// esta ruta es para listar los usuarios por consola pero solo en desarrollo.
router.set('/list-users', listarUsuarios_handler );

/*
router.set('/register-group', register_group_handler );
router.set('/delete-group', delete_group_handler );
router.set('/update-group', update_group_handler );
router.set('/list-groups', listarGrupos_handler );

router.set('/register-endpoint', register_endpoint_handler );
router.set('/delete-endpoint', delete_endpoint_handler );
router.set('/update-endpoint', update_endpoint_handler );
router.set('/list-endpoints', listarEndpoints_handler );
*/

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


// listar usuarios de la base de datos (solo para verificar que se haya insertado el usuario admin correctamente)
function listarUsuarios(db)
{   
    db.all('SELECT * FROM user', (err, rows) => { 
        if (err) 
        { console.error('Error al listar usuarios:', err.message);
            return;
        }
        console.log('Usuarios en la base de datos:');
        rows.forEach((row) => {
                            console.log(`ID: ${row.id}, Username: ${row.username}, Password: ${row.password}`);
                              });
                                            });
}

function listarUsuarios_handler(request, response)
{
  listarUsuarios(db);
  response.writeHead(200, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify({ status: 'success', message: 'Usuarios listados en consola' }));
}

function checkUser(db, username) {
    return new Promise((resolve, reject) => {
        const sql = 'SELECT COUNT(*) as cnt FROM user WHERE username = ? COLLATE NOCASE';
        db.get(sql, [username], (err, row) => {
            if (err) return reject(err);
            resolve(row && row.cnt > 0);
        });
    });
}

async function check_user_handler(request, response) {
    if (request.method === 'POST') {
        try {
            const data = await getRequestbody(request);
            const obj = JSON.parse(data);
            const username = obj.username;
            const exists = await checkUser(db, username);
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