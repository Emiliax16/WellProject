ARG NODE_VERSION=21-alpine
ARG API_PORT=3000
FROM node:${NODE_VERSION} as development

ENV API_PORT=${API_PORT}

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE ${API_PORT}

CMD ["npm", "run", "dev"]
