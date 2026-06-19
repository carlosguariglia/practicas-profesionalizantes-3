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
// se agrego todo el manejo que hacia el login_handler en el request dispatcher
// el manejo de errores pensar en un try-catch general para los errores generales (500)
// y luego try-catch para errores específicos (400, 401, etc)

async function request_dispatcher(request, response)
{
  try {  // Codigo para habilitar CORS (Cross-Origin Resource Sharing)
      response.setHeader('Access-Control-Allow-Origin', '*');   // el * permite cualquier origen, se deberia restringir a la IP del frontend
      response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS'); // metodos permitidos
      response.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-User-ID, Authorization, x-API-Version'); // cabeceras permitidas
      
      if (request.method === 'OPTIONS')
        {
            response.writeHead(204);
            response.end();
            return;
        }
      // fin del codigo CORS
      let userID = null;
      let authHeader = null;
      let bearerToken = null;
      let url = null;
      let path = null;
      let handler = null;
      let endpointName = null;

      // chequeo que se hace siempre, para separar y obtener el Bearer Token 
      try {
            userID = request.headers['x-user-id'];
            authHeader = request.headers['authorization'].split(' '); 
            bearerToken = authHeader[1];
            url = new URL(request.url, 'http://' + config.server.ip);
            path = url.pathname;
            handler = router.get(path);
            endpointName =  url.pathname.slice(1);
            
            if (authHeader[0] !== 'Bearer') {
              response.writeHead(400, { 'Content-Type': 'application/json' });
              return response.end(JSON.stringify({ exception: 'BadRequest', detail: ['Missing or invalid authorization header'] }));
              }

            if ((path!=='/login') && (!handler)) {
              response.writeHead(400, { 'Content-Type': 'application/json' });
              return response.end(JSON.stringify({ status: 'BadRequest', message: 'Endpoint no encontrado' }));
            }
            // aca se controla que el metodo sea POST para evitar validarlo en cada handler
            if (request.method !== 'POST') {
              response.writeHead(400, { 'Content-Type': 'application/json' });
              return response.end(JSON.stringify({ exception: 'BadRequest', detail: ['Invalid method'] }));
            }
        } catch (err) {
              console.log("Error procesando la solicitud:", err);
              response.writeHead(400, { 'Content-Type': 'application/json' });
              return response.end(JSON.stringify({ exception: 'BadRequest', detail: ['Invalid specification'] }));
        }
      // si la ruta es '/login' no se requiere autorización
      if (path === '/login')
        {   
          const output = model.login(userID, bearerToken);
          if (output) {
              response.writeHead(200, { 'Content-Type': 'application/json' });
              return response.end(JSON.stringify({ status: 'success', message: 'Login successful' }));
          }
        }
        else
        { 
        // Para otras rutas, se requiere autorización
        //  Ahora el usuario y la clave viajan por la cabecera (header), ya no se usa 
        //  el body del JSON para sacar el nombre de usuario
        try {
            
            if (!model.isAuthorized(userID, endpointName)) {
                      response.writeHead(401, { 'Content-Type': 'application/json' });
                      return response.end(JSON.stringify({ status: 'error', message: 'Invalid Authorization' }));
                    }
            
            console.log(`Usuario ${userID}, acceso al endpoint ${request.url}. Autorizacion: Autorizado`);
            
            return await handler(request, response);
        } catch (err) {
              response.writeHead(401, { 'Content-Type': 'application/json' });
              return response.end(JSON.stringify({ status: 'Unauthorized', message: 'Invalid Authorization' }));
        }
      }
    }catch (err) {
                response.writeHead(500, { 'Content-Type': 'application/json' });
                return response.end(JSON.stringify({ status: 'error', message: 'Internal Server Error' }));
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