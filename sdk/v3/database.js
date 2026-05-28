import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';

function default_config() {
    return {
        server: { ip: '127.0.0.1', port: 3000, default_path: './index.html' },
        database: { path: './db.sqlite3' }
    };
}

function load_config() {
    try {
        const data = readFileSync('./config.json', 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        return default_config();
    }
}

const config = load_config();

function connect_db(path) {
    const dbPath = resolve(path);
    const db = new DatabaseSync(dbPath);
    console.log(`Conexión a la base de datos ${dbPath} establecida.`);
    return db;
}

const db = connect_db(config.database.path);

export { db, config };
