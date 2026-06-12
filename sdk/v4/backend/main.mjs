import { createServer } from 'node:http';
import { URL } from 'node:url';
import { db, config } from './database.js';
import * as handlers from './handlers.js';
import * as model from './model.js';

// Se modularizo:
// database.js: toda la lógica de acceso a datos (usuarios, grupos, endpoints)
// handlers.js: toda la lógica de manejo de requests (login, register, etc)
// models.js: definiciones de clases y funciones para usuarios, grupos y endpoints
// main.mjs: servidor HTTP, registro de rutas y dispatcher


// Router: map paths to handler functions exported from handlers.js
const router = new Map();



// login y logout
router.set('/login', handlers.login_handler);
router.set('/logout', handlers.logout_handler);
// usuarios
router.set('/register', handlers.register_handler);
router.set('/deleteUser', handlers.delete_user_handler);
router.set('/updateUser', handlers.update_user_handler);
// grupos
router.set('/registerGroup', handlers.register_group_handler);
router.set('/deleteGroup', handlers.delete_group_handler);
router.set('/updateGroup', handlers.update_group_handler);
// endpoints
router.set('/registerEndpoint', handlers.register_endpoint_handler);
router.set('/deleteEndpoint', handlers.delete_endpoint_handler);
router.set('/updateEndpoint', handlers.update_endpoint_handler);
// usuarios <-> grupos
router.set('/assignUserToGroup', handlers.assign_user_to_group_handler);
router.set('/removeUserFromGroup', handlers.remove_user_from_group_handler);
// endpoints a grupos
router.set('/assignEndpointToGroup', handlers.assign_endpoint_to_group_handler);
router.set('/removeEndpointFromGroup', handlers.remove_endpoint_from_group_handler);
// checks used by frontend
router.set('/checkGroup', handlers.check_group_handler);
router.set('/checkEndpoint', handlers.check_endpoint_handler);
// list endpoints (frontend uses these to print to console)
router.set('/listUsers', handlers.list_users_handler);
router.set('/listGroups', handlers.list_groups_handler);
router.set('/listEndpoints', handlers.list_endpoints_handler);
router.set('/listUserGroups', handlers.list_user_groups_handler);
router.set('/listGroupEndpoints', handlers.list_group_endpoints_handler);

// rutas de prueba
router.set('/log', handlers.log_handler);
router.set('/sayHello', handlers.say_hello_handler);


// request dispatcher: busca el handler correspondiente a la ruta y lo ejecuta
async function request_dispatcher(request, response)
{
  // Codigo para habilitar CORS (Cross-Origin Resource Sharing)
  response.setHeader('Access-Control-Allow-Origin', '*');   // el * permite cualquier origen, se deberia restringir a la IP del frontend
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS'); // metodos permitidos
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-User-ID, x-User-Accesskey, x-API-Version'); // cabeceras permitidas
  
  if (request.method === 'OPTIONS')
    {
        response.writeHead(204);
        response.end();
        return;
    }
  // fin del codigo CORS
    
  const url = new URL(request.url, 'http://' + config.server.ip);
  const path = url.pathname;
  const handler = router.get(path);

  // si la ruta es '/login', no se requiere autorización
  // si el usuario es admin, esta autorizado a todo y cuando digo todo es todo


    if ( (path === '/login') || (request.headers['x-user-id'] === 'admin') )
    {   if (handler) return await handler(request, response);
      //response.writeHead(404, { 'Content-Type': 'text/plain' });
      //response.end('Método no encontrado');
    }
    else
    { 
    // Para otras rutas, se requiere autorización
    //TODO: hay que hacer el autorizador aca
    //  Ahora el usuario y la clave viajan por la cabecera (header), ya no se usa el body del JSON
    // para sacar el nombre de usuario
    
    // const data = await handlers.getRequestbody(request);
    // const obj = JSON.parse(data);
    
    const output = model.isAuthorized(request.headers['x-user-id'], url.pathname.slice(1));  // el slice es para sacar la barra del inicio de la ruta

    if (output == null) {
              response.writeHead(401, { 'Content-Type': 'application/json' });
              return response.end(JSON.stringify({ status: 'error', message: 'Error' }));
            }
    if (!output) {
          console.log(`Usuario ${request.headers['x-user-id']}, acceso al endpoint ${url.pathname}. Autorizacion: No Autorizado`);
                response.writeHead(403, { 'Content-Type': 'application/json' });
                return response.end(JSON.stringify({ status: 'error', message: 'No autorizado' }));
            }
    console.log(`Usuario ${request.headers['x-user-id']}, acceso al endpoint ${request.url}. Autorizacion: Autorizado`);
    if (handler) return await handler(request, response);
    response.writeHead(404, { 'Content-Type': 'text/plain' });
    response.end('Método no encontrado');
    
  }
}

function start() {
  console.clear();
  console.log('Servidor ejecutándose... en el puerto ' + config.server.port + ' y la IP ' + config.server.ip);
  console.log('Ingresa a http://' + config.server.ip + ':' + config.server.port + ' en tu navegador para acceder a la aplicación.');
  console.log('Presiona Ctrl+C para detener el servidor.');
}

const server = createServer(request_dispatcher);
server.listen(config.server.port, config.server.ip, start);



//* PREGUNTAR: es correcto la forma de  habilitar admin para todoas  las rutas
//* como esta hecho en la  linea 79?

//* Puedo eliminar los botones  ir a LOG y sayHello

//* porque los metodos de listar usuario, grupos etc por consola,
//* aunque no les ponga GET,POST y solo los mande el explorardor los toma como GET
//* se que es una funcion auxiliar pero es correcto haberlo forzado a que sea POST

//* en el frontend es correcto que haya renombrado las variables que son distintas al usuario actual
//* por ejemplo en agregar un usuario newusername en vez de usar username ya que es global y se confunde con el usuario activo
//* y entonces cuando lo mando por el body del JSON poner username: newusername?
//* o debo cambiar la forma que lo estoy haciendo
