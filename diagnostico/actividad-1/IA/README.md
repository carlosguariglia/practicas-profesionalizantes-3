# Planta Recicladora — Sistema mínimo de gestión de stock

Instrucciones rápidas:

- Instalar dependencias:

```bash
npm install
```

- Iniciar servidor backend:

```bash
npm start
```

- Abrir `plantaRecicladora.html` en el navegador (desde el sistema de archivos) y usar la interfaz. El frontend se comunica con el backend en `http://localhost:5000`.

(tambien se puede acceder directamente en el navegador http://localhost:500)

Notas:
- La base de datos SQLite se crea en `materials.db` en la misma carpeta.

- Validaciones: cantidades no negativas, nombres únicos, no permitir stock negativo en ajustes.
