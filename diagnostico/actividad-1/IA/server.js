const express = require('express');
const sqlite3 = require('sqlite3');
const path = require('path');
const cors = require('cors');

const DB_PATH = path.join(__dirname, 'materials.db');
const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    quantity REAL NOT NULL CHECK(quantity >= 0),
    unit TEXT NOT NULL
  )`);

  // Seed initial materials if table is empty
  db.get('SELECT COUNT(*) as c FROM materials', (err, row) => {
    if (err) return console.error('DB count error:', err.message);
    if (row && row.c === 0) {
      const items = [
        { name: 'Vidrio', quantity: 1000, unit: 'kg' },
        { name: 'Hierro', quantity: 800, unit: 'kg' },
        { name: 'Aluminio', quantity: 500, unit: 'kg' },
        { name: 'Cobre', quantity: 200, unit: 'kg' },
        { name: 'Bronce', quantity: 150, unit: 'kg' },
        { name: 'Cartón', quantity: 300, unit: 'kg' },
        { name: 'Papel Blanco', quantity: 400, unit: 'kg' },
        { name: 'Tapas de plástico', quantity: 2000, unit: 'units' },
        { name: 'Aceite de girasol', quantity: 2, unit: 'm3' },
        { name: 'Baterías de vehículos', quantity: 50, unit: 'units' }
      ];
      const stmt = db.prepare('INSERT INTO materials (name, quantity, unit) VALUES (?, ?, ?)');
      items.forEach(i => stmt.run(i.name, i.quantity, i.unit, (e) => { if (e) console.error('seed insert error', e.message); }));
      stmt.finalize(() => console.log('Seeded initial materials'));
    }
  });
});

const app = express();
app.use(cors());
app.use(express.json());
// Servir archivos estáticos (frontend) desde la carpeta del proyecto
app.use(express.static(path.join(__dirname)));

app.get('/materials', (req, res) => {
  db.all('SELECT id, name, quantity, unit FROM materials ORDER BY name', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/materials', (req, res) => {
  const { name, quantity, unit } = req.body;
  if (!name || typeof quantity !== 'number' || quantity < 0 || !unit) {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  const stmt = db.prepare('INSERT INTO materials (name, quantity, unit) VALUES (?, ?, ?)');
  stmt.run(name.trim(), quantity, unit.trim(), function(err) {
    if (err) {
      if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Material duplicado' });
      return res.status(500).json({ error: err.message });
    }
    res.status(201).json({ id: this.lastID });
  });
});

app.post('/materials/:id/adjust', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { delta } = req.body;
  if (isNaN(id) || typeof delta !== 'number' || delta === 0) return res.status(400).json({ error: 'Invalid request' });

  db.get('SELECT quantity FROM materials WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Material no encontrado' });
    const newQty = row.quantity + delta;
    if (newQty < 0) return res.status(400).json({ error: 'No se permite stock negativo' });
    db.run('UPDATE materials SET quantity = ? WHERE id = ?', [newQty, id], function(err2) {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ id, quantity: newQty });
    });
  });
});

// Servir la página principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'plantaRecicladora.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
