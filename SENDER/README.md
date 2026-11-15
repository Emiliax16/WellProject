# WellProject Main App - SENDER

Lógica principal de obtención de reportes no enviados y reenvío a la DGA. La tarea `rake sender:fetch_unsent_and_send` pide a la API una página de hasta 100 reportes pendientes (`/fetchUnsentReports`) y le solicita reenviarlos uno por uno (`/repostToDGA`), con 5 minutos de espera entre cada envío, según la documentación de transmisión de la DGA. La programación se define con la gema `whenever` en `config/schedule.rb`.

## Advertencias de operación

En el `config/schedule.rb` versionado, todos los bloques `every` están comentados, así que `whenever --update-crontab` no programa nada con el archivo tal como está en el repositorio. En producción, el job diario existe solo porque la instancia tiene un cambio local que descomenta el bloque de la tarea rake. La hora del job es la del contenedor, que no define zona horaria y usa UTC.

Además, el crontab y el servicio `cron` viven dentro del contenedor y no forman parte de su proceso principal, que solo levanta Puma. El crontab se pierde si el contenedor se recrea, y el servicio `cron` también se pierde cuando el contenedor se reinicia. Los pasos de instalación de este README sirven para un entorno local. Para revisar o reactivar el cron en producción, sin reconstruir imágenes ni levantar todo el stack, hay que seguir la sección del SENDER en `API/documentations/amazon-instance.md`.

Antes de reactivarlo hay que considerar dos comportamientos:

1. La tarea se detiene ante la primera respuesta de error de `/repostToDGA`, de modo que un solo reporte rechazado impide reenviar los siguientes.
2. Los pozos pueden enviar más de un reporte por hora, y la DGA rechaza los siguientes con "Ya existe un registro en esa fecha, hora para la obra". Esos reportes figuran como no enviados y harán fallar la tarea si no se filtran.

Está planificado reemplazar este servicio por un cron en la API.

La documentación completa de cómo se compone el cron job utilizado y cómo actualizarlo se encuentra en este [link](wellproject/README.md).

A continuación, se documenta cómo poder realizar la instalación local:

## Setup

### 1. Instalación de Ruby

Hay dos opciones:

1. (Recomendado) Usar `rbenv`
  1. Instala `rbenv` y `ruby-build`:
```sh
  curl -fsSL https://github.com/rbenv/rbenv-installer/raw/main/bin/rbenv-installer | bash
  echo 'export PATH="$HOME/.rbenv/bin:$PATH"' >> ~/.bashrc
  echo 'eval "$(rbenv init - bash)"' >> ~/.bashrc
  source ~/.bashrc
```
  2. Instala Ruby 3.0.2:
```sh
rbenv install 3.0.2
rbenv global 3.0.2
```
  3. Verificar que esté instalada la versión correcta:
```sh
ruby -v
```
2. Instalar ruby sin manejo de versiones ([acá la guía completa de instalación oficial](https://www.ruby-lang.org/en/documentation/installation/)):
```sh
sudo apt-get install ruby-full
```

### 2. Instalación de Ruby on Rails

1. Instala la gema Rails:
```sh
gem install rails -v 7.1.3
```
2. Verificar que esté instalada la versión correcta:
```sh
rails -v
```

### 3. Configuración del Proyecto

1. Clonar el repositorio del proyecto:
```sh
git clone https://github.com/Emiliax16/WellProject.git
```
2. Entrar al directorio:
```sh
cd Wellproject/SENDER/wellproject
```
3. Instalar las dependencias del proyecto:
```sh
bundle install
```
4. Iniciar el servidor:
```sh
rails server
```

El servidor iniciará en el puerto que indica el archivo `puma.rb`.

Como plus, se incluye el cómo levantar el docker de este proyecto, ya que el cron job no viene dentro del `Dockerfile` dado que es muy complicado realizar la configuración del cron antes de tener completamente configurada la imagen. Por esto, es necesario construir la imagen, levantarla, y luego ingresar a ella para seguir una serie de pasos:

## Setup Docker (con cron job funcional)

### Requisitos Previos
Docker y Docker Compose instalados. Docker compose de preferencia en versión sobre 2

### 1. Creación de la imagen
```sh
sudo docker-compose build --no-cache sender
```

### 2. Levantar imagen
```sh
sudo docker-compose up -d
```

### 3. Solución de Problemas de Permisos
3.1 Otorgar Permisos de Escritura al Usuario Rails
Durante la instalación, habían problemas de permisos al instalar las gemas. El error principal estaba relacionado con la falta de permisos de escritura en `/usr/local/lib/ruby/gems/3.0.0`.

Ejecutamos los siguientes pasos:
1. Accedimos al contenedor como `root`:
```sh
sudo docker exec -it --user root sender bash
```
2. Otorgamos permisos al usuario rails:
```sh
chown -R rails:rails /usr/local/lib/ruby/gems/3.0.0
chown -R rails:rails /usr/local/bin
```

3.1 Moverse a user rails, instalar el bundle y actualizar el crontab
```
su - rails
bundle install
whenever --update-crontab
gem list // para comprobar que todo esta en orden
```
3.1.2 Volver a root
```
ctrl + d
service cron start
tail -f log/cron_rake.log
```

3.2 Reconstrucción y Ejecución de los Contenedores
Después de asegurarnos de que los permisos eran correctos:
```sh
sudo docker-compose build --no-cache sender
sudo docker-compose up -d
```

### 4. Configuración del Cron Job con Whenever

4.1 Actualizar el Cron Job
Accedimos al contenedor como el usuario `rails`:
```sh
sudo docker exec -it sender bash
```
Dentro del contenedor, nos aseguramos de que estábamos en el directorio `/rails` y ejecutamos `whenever`:
```sh
cd /rails
whenever --update-crontab
```
4.2 Iniciar el Servicio de Cron
Cambiamos al usuario `root` (o salimos e iniciamos como `root`):
```sh
su - root
```
Iniciamos el servicio `cron`:
```sh
service cron start
```

### 5. Verificación final
Para asegurarnos de que el cron job estaba funcionando correctamente, revisamos los logs (dentro de la carpeta de `/rails`):
```sh
tail -f log/cron_rake.log
```

#### Comando útil
Resulta útil tener instalado `nano` en las imagenes de docker:
```sh
apt-get update && apt-get install -y nano
```
