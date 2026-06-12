#!/bin/bash

# 1. Asegurarnos de que el Apache del sistema no esté molestando
sudo systemctl stop apache2

# 2. Definir rutas
FRONTEND_PATH="/var/www/html/sdk-frontend"
CONFIG_TEMPORAL="/tmp/apache_sdk_v4.conf"

echo "Generando configuración temporal para Apache..."

# 3. Creamos un archivo de configuración limpio con la estructura exacta que quiere Apache
cat << EOF > $CONFIG_TEMPORAL
# Cargar la configuración base del sistema (para mantener variables y módulos de MX Linux)
Include /etc/apache2/apache2.conf

# Configuración específica para el entorno de desarrollo v4
Listen 8081

<VirtualHost *:8081>
    DocumentRoot $FRONTEND_PATH
    
    <Directory $FRONTEND_PATH>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
EOF

echo "Iniciando Apache en http://localhost:8081..."
echo "Sirviendo desde el acceso directo: $FRONTEND_PATH"

# 4. Levantamos Apache pasándole ÚNICAMENTE nuestro archivo temporal con -f
sudo apachectl -D FOREGROUND -f $CONFIG_TEMPORAL
