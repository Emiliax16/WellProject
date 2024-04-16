# Versión de node, actualmente se usa la 21.7.3
FROM node:21-alpine

# Directorio de trabajo pars el contenedor
WORKDIR /usr/src/app

# Con COPY se copian los archivos al director de trabajo del contenedor, package* es el archivo package.json y package-lock.json
COPY ./API/package*.json ./

# Instalar las dependencias del proyecto
RUN npm install

# Copiar todos los archivos del directorio API al directorio de trabajo del contenedor
COPY ./API/ .

# Puerto app
EXPOSE 3000

# CMD -> ejecuta la aplicación
CMD ["node", "src/server.js"]
