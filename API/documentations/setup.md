# Instrucciones de instalación

La instalación completa se basa en la distribución de ubuntu, ya sea desde Linux o desde Windows con WSL2. Cada link adjuntado tiene una versión para MacOS para seguir el paso a paso de la instalación de cada programa.

## Índice

- Índice
  - [Prerequisitos](#prerequisitos)
  - [Instalar docker](#instalar-docker)
  - [Instalar docker-compose](#instalar-docker-compose)
  - [Instalar nginx](#instalar-nginx)
  - [Configurar motor de base de datos](#configurar-motor-de-base-de-datos)
  - [Configuraciones](#configuraciones)

## Prerequisitos

- Preferir la distribución de Ubuntu sobre otras distribuciones de Linux. Para usuarios de Windows se debe instalar WSL 2 siguiendo esta documentación: <https://learn.microsoft.com/en-us/windows/wsl/install>. Es importante que sea WSL 2, ya que tiene mayor compatibilidad y rendimiento que WSL1 con las aplicaciones utilizadas.
- Una vez dentro de la consola, actualizar la máquina con:
   ```sh
   sudo apt update
   sudo apt upgrade
   ```
- Para conectar con github, se puede utilizar [github-cli](https://cli.github.com/manual/gh_repo_clone), pero se recomienda crear una llave ssh.
- Generar la llave ssh para github con: `ssh-keygen -t ed25519`
- Copiar el output del comando `cat /path/to/key-name.pub` (llave recién creada)
- Importante notar que se debe cambiar `/path/to/key` por la ruta donde se guardó la llave ssh en su pc.
- Pegar en: <https://github.com/settings/keys>
- Luego:

   ```sh
   git clone git@github.com:Emiliax16/WellProject.git
   cd WellProject/API
   ```

> Si estas usando macOS, asegurate de tener instalado [Homebrew](https://brew.sh/) antes de continuar con la configuración del ambiente local.

## Instalar docker

La guía completa de instalación se encuentra en este [Link](https://docs.docker.com/engine/install/ubuntu/). Se recomienda seguir el paso a paso desde este link ya que explica el funcionamiento de cada comando. En resumen:

Ejecutar:

Desintalar cualquier versión de docker presente en el ambiente
```sh
for pkg in docker.io docker-doc docker-compose docker-compose-v2 podman-docker containerd runc; do sudo apt-get remove $pkg; done
```

Instalar el repositorio de docker
```sh
# Add Docker's official GPG key:
sudo apt-get update
sudo apt-get install ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# Add the repository to Apt sources:
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
```

Instalar los paquetes de docker
```sh
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Verificar que docker se haya instalado correctamente, debería aparecer un mensaje del estilo "Hello world"
```sh
sudo docker run hello-world
```

## Instalar docker-compose

Para seguir el paso a paso de la instalación completa, seguir este [Link](https://www.digitalocean.com/community/tutorials/how-to-install-and-use-docker-compose-on-ubuntu-20-04). En resumen:

Instalar docker-compose
```sh
sudo curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
```

Setear permisos para ejecutar docker-compose
```sh
sudo chmod +x /usr/local/bin/docker-compose
```

Vereficar que la instalación está correcta
```sh
docker-compose --version
```

## Instalar nginx

Para pruebas locales, no se debe instalar nginx. Al ingresar por primera vez a la instancia de Amazon se debe instalar. Para ingresar a la instancia, se necesita del archivo con la clave ssh generada (sólo los admin del repositorio podrán ingresar a la instancia). **Actualmente ya se encuentra instalado y configurado en la instancia.**

El paso a paso de la instalación de ngix se encuentra en el siguiente [Link](https://www.digitalocean.com/community/tutorials/how-to-install-nginx-on-ubuntu-20-04#step-2-adjusting-the-firewall). En resumen:

Actualizar terminal e instalar nginx
```sh
sudo apt update
sudo apt install nginx
```

Enlistar los perfiles de aplicación preconfigurados disponibles en el firewall UFW
```sh
sudo ufw app list
```
Debería aparecer el siguiente output
```sh
Output
Available applications:
  Nginx Full
  Nginx HTTP
  Nginx HTTPS
  OpenSSH
```

Habilitar cada perfil
```sh
sudo ufw allow 'Nginx HTTP'
```

Chequear el estado del servidor web (lo normal es que esté activo)
```sh
systemctl status nginx
```

Chequear tu dirección IP para corroborar instalación de nginx
```sh
curl -4 icanhazip.com
```
Esto debe mostrar la IP pública del pc. Ingresar a la web con esta IP: ```http://your_server_ip```. Si se muestra una plantilla por defecto de nginx quiere decir que la instalación y el estado del servidor están correctos.

Comandos útiles para manejar el estado del servidor
```sh
sudo systemctl stop nginx
sudo systemctl start nginx
sudo systemctl restart nginx
sudo systemctl reload nginx
sudo systemctl disable nginx
sudo systemctl enable nginx
```

## Configurar motor de base de datos

Se utilizará `postgres` de forma local. La instalación consta de:

Instalar postgres
```sh
sudo apt install postgresql postgresql-contrib
```

Iniciar postgres
```sh
sudo service postgresql start
```

Ingresar a al consola de postgres
```sh
sudo -u postgres psql
```

Crear usuario con contraseña y volverlo superuser
```sh
CREATE USER user_name WITH PASSWORD 'password';
ALTER USER user_name WITH SUPERUSER;
```

## Configuraciones

Para configurar tu entorno local, sigue estos pasos:

1. Copia el archivo `.env.example` a `.env`:
   ```bash
   cp .env.example .env
2. Completa el `.env` con tu información local
