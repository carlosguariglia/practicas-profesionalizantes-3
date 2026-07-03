#!/bin/bash

# 1. Asegurarnos de que el Apache del sistema no esté molestando
sudo systemctl stop apache2

# 2. Definir rutas DINÁMICAMENTE
# Detectamos si existe una carpeta 'frontend' en el directorio actual
if [ -d "$(pwd)/frontend" ]; then
    FRONTEND_PATH="$(pwd)/frontend"
else
    FRONTEND_PATH="$(pwd)"
fi

CONFIG_TEMPORAL="/tmp/apache_sdk_v4.conf"

echo "Generando configuración temporal para Apache..."

# 3. Creamos un archivo de configuración limpio con la estructura exacta que quiere Apache
cat << EOF > $CONFIG_TEMPORAL
# Cargar la configuración base del sistema (para mantener variables y módulos de MX Linux)
Include /etc/apache2/apache2.conf

# Definir el nombre del servidor global para evitar el warning AH00558
ServerName localhost

# Configuración específica para el entorno de desarrollo v5
Listen 8081

<VirtualHost *:8081>
    DocumentRoot "$FRONTEND_PATH"
    
    <Directory "$FRONTEND_PATH">
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
EOF

echo "Iniciando Apache en http://localhost:8081..."
echo "Sirviendo desde el directorio: $FRONTEND_PATH"

# 4. Levantamos Apache pasándole ÚNICAMENTE nuestro archivo temporal con -f
sudo apachectl -D FOREGROUND -f $CONFIG_TEMPORAL