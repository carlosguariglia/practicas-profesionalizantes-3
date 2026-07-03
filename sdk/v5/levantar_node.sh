#archivo para levantar NODE pero usando nodemon
#!/bin/bash
#SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
#BACKEND_PATH="$SCRIPT_DIR/backend"
#echo "Iniciando Node.js con nodemon desde $BACKEND_PATH"
#cd "$BACKEND_PATH" || { echo "No existe $BACKEND_PATH"; exit 1; }
#nodemon main.mjs


#!/bin/bash
# archivo para levantar NODE pero usando nodemon

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_PATH="$SCRIPT_DIR/backend"

echo "Iniciando Node.js con nodemon desde $BACKEND_PATH"
cd "$BACKEND_PATH" || { echo "No existe $BACKEND_PATH"; exit 1; }

# ==========================================
# AUTOMATIZACIÓN DE ENTORNO
# ==========================================

# 1. Intentar activar Node v22 mediante NVM si está instalado en el sistema
if [ -s "$HOME/.nvm/nvm.sh" ]; then
    source "$HOME/.nvm/nvm.sh"
    nvm use 22 &> /dev/null || nvm install 22 &> /dev/null
fi

# 2. Validar que la versión actual de Node sea >= v22 (requerido para node:sqlite)
VERSION_ACTUAL=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)

if [ "$VERSION_ACTUAL" -lt 22 ]; then
    echo "======================================================================"
    echo "❌ ERROR DE ARQUITECTURA DE ENTORNO"
    echo "Este backend requiere Node.js v22 o superior para usar 'node:sqlite'."
    echo "Tu versión actual en esta terminal es: $(node -v)"
    echo "======================================================================"
    read -p "Presioná Enter para salir..."
    exit 1
fi

# 3. Verificar e instalar dependencias del package.json automáticamente
if [ ! -d "node_modules" ]; then
    echo "📦 No se encontró la carpeta node_modules."
    echo "Instalando dependencias declaradas en el package.json automáticamente..."
    npm install
fi

# ==========================================
# EJECUCIÓN
# ==========================================
# Usamos npx antes de nodemon por si nodemon no está global en el sistema,
# así se ejecuta el que esté declarado en tu package.json.
npx nodemon main.mjs