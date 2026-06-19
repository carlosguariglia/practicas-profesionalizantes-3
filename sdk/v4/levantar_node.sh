#archivo para levantar NODE pero usando nodemon
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_PATH="$SCRIPT_DIR/backend"
echo "Iniciando Node.js con nodemon desde $BACKEND_PATH"
cd "$BACKEND_PATH" || { echo "No existe $BACKEND_PATH"; exit 1; }
nodemon main.mjs