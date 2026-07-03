#!/bin/bash

# Obtener la ruta absoluta de la carpeta donde está este script
DIR_ACTUAL="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Iniciando entorno de desarrollo..."
echo "Ubicación: $DIR_ACTUAL"

# Detectar el emulador de terminal disponible en MX Linux
if command -v xfce4-terminal &> /dev/null; then
    TERMINAL="xfce4-terminal"
    # --title le pone nombre a la ventana, -e ejecuta el comando
    $TERMINAL --title="Node Backend" --command="bash -c 'cd \"$DIR_ACTUAL\"; ./levantar_node.sh; exec bash'" &
    $TERMINAL --title="Apache Frontend" --command="bash -c 'cd \"$DIR_ACTUAL\"; ./levantar_apache.sh; exec bash'" &
else
    # Opción genérica por si usas otra versión de escritorio
    TERMINAL="x-terminal-emulator"
    $TERMINAL -e "bash -c 'cd \"$DIR_ACTUAL\"; ./levantar_node.sh; exec bash'" &
    $TERMINAL -e "bash -c 'cd \"$DIR_ACTUAL\"; ./levantar_apache.sh; exec bash'" &
fi

echo "¡Terminales lanzadas en segundo plano!"
