import { createServer } from 'node:http';
import { URL } from 'node:url';
import { dirname } from 'node:path';
import { config } from 'dotenv';

function load_config()
{
	let config = null;
	
	try
	{  const data = readFileSync('config.json', 'utf-8');
		config = JSON.parse(data);
		console.log('Configuración cargada');
	}
	catch (error)
	{
		console.error('Error cargando config.json. Usando valores por defecto:', error);
		config = {default_config};
	}
	
	return config;
}

const default_config = {
	ip: '127.0.0.1',
	port: 3000
};

function login(input)
{
	const userdata =
	{
		username: 'admin',
		password: '1234'
	};

	if (input.username === userdata.username && 
		input.password === userdata.password )
	{
		return {
			status: true,
			result: input.username,
			description: null,
		};
	}

	return {
		status: false,
		result: null,
		description: 'INVALID_USER_PASS'
	};
}

//Respuesta predeterminada del servidor (path: /)

function default_response(response)
{
	const html = `<!DOCTYPE html>
	<html lang="es">
	<head>
	<meta charset="UTF-8">
	<title>Login</title>
	</head>
	<body>
	<form action="/login" method="get">
	<label>Usuario:</label>
	<input name="username" required><br>
	<label>Password:</label>
	<input type="password" name="password" required><br>
	<button type="submit">Enviar</button>
	</form>
	</body>
	</html>`;

	response.writeHead(200, { 'Content-Type': 'text/html' });
	response.end(html);
}

function not_found(response)
{
	response.writeHead(404);
	response.end('Not Found');
}

function method_not_allowed(response)
{
	response.writeHead(405);
	response.end('Method Not Allowed');
}

//Mecanismo de ruteo/despacho
let router = new Map();
router.set('/login', { GET: login });

function request_dispatcher(request, response)
{
	let url = new URL(request.url, 'http://' + connection.ip + ':' + connection.port);
	let path = url.pathname;
	let method = request.method.toUpperCase();

	if (path === '/')
	{
		return default_response(response);
	}

	let route = router.get(path);

	if (!route)
	{
		return not_found(response);
	}

	let handler = route[method];

	if (!handler)
	{
		return method_not_allowed(response);
	}


	//Obtención de los datos de entrada al método de la API 
	let input =
	{
		username: url.searchParams.get('username'),
		password: url.searchParams.get('password')
	};

	//Ejecución del método
	let output = handler(input);

	//Escritura de respuesta para el cliente
	response.writeHead(200, { 'Content-Type': 'application/json' });
	response.end(JSON.stringify(output));
}

function start()
{
	console.log('Servidor corriendo en http://' + connection.ip + ':' + connection.port);
}


let connection = create_connection();
let server = createServer(request_dispatcher);

server.listen(connection.port, connection.ip, start);