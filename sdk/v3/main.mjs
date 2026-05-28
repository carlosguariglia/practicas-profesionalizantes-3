import { createServer } from 'node:http';
import { URL } from 'node:url';
import { db, config } from './database.js';
import * as handlers from './handlers.js';

// Se modularizo:
// database.js: toda la lógica de acceso a datos (usuarios, grupos, endpoints)
// handlers.js: toda la lógica de manejo de requests (login, register, etc)
// models.js: definiciones de clases y funciones para usuarios, grupos y endpoints
// main.mjs: servidor HTTP, registro de rutas y dispatcher


// Router: map paths to handler functions exported from handlers.js
const router = new Map();
// default
router.set('/', handlers.default_handler);
// login y logout
router.set('/login', handlers.login_handler);
router.set('/logout', handlers.logout_handler);
// usuarios
router.set('/register', handlers.register_handler);
router.set('/delete-user', handlers.delete_user_handler);
router.set('/update-user', handlers.update_user_handler);
// grupos
router.set('/register-group', handlers.register_group_handler);
router.set('/delete-group', handlers.delete_group_handler);
router.set('/update-group', handlers.update_group_handler);
// endpoints
router.set('/register-endpoint', handlers.register_endpoint_handler);
router.set('/delete-endpoint', handlers.delete_endpoint_handler);
router.set('/update-endpoint', handlers.update_endpoint_handler);
// usuarios <-> grupos
router.set('/assign-user-to-group', handlers.assign_user_to_group_handler);
router.set('/remove-user-from-group', handlers.remove_user_from_group_handler);
// endpoints a grupos
router.set('/assign-endpoint-to-group', handlers.assign_endpoint_to_group_handler);
router.set('/remove-endpoint-from-group', handlers.remove_endpoint_from_group_handler);
// checks used by frontend
router.set('/check-group', handlers.check_group_handler);
router.set('/check-endpoint', handlers.check_endpoint_handler);
// list endpoints (frontend uses these to print to console)
router.set('/list-users', handlers.list_users_handler);
router.set('/list-groups', handlers.list_groups_handler);
router.set('/list-endpoints', handlers.list_endpoints_handler);
router.set('/list-user-groups', handlers.list_user_groups_handler);
router.set('/list-group-endpoints', handlers.list_group_endpoints_handler);

// rutas de prueba
router.set('/log', handlers.log_handler);
router.set('/sayHello', handlers.say_hello_handler);


// request dispatcher: busca el handler correspondiente a la ruta y lo ejecuta
async function request_dispatcher(request, response)
{
  const url = new URL(request.url, 'http://' + config.server.ip);
  const path = url.pathname;
  const handler = router.get(path);

  if ((path === '/') || (path === '/login')) 
  {   if (handler) return await handler(request, response);
      response.writeHead(404, { 'Content-Type': 'text/plain' });
      response.end('Método no encontrado');
    

      }
  else
  {
    // Para otras rutas, se requiere autorización
  
    console.log(`Request headers: ${JSON.stringify(request.headers)}`);
    console.log('Authorization: ' + (request.headers['authorization'] || 'N/A'));
    
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
