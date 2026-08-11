# syntax = docker/dockerfile:1

ARG RUBY_VERSION=3.0.2
FROM registry.docker.com/library/ruby:$RUBY_VERSION-slim as base

WORKDIR /rails

ENV RAILS_ENV="production" \
    BUNDLE_DEPLOYMENT="1" \
    BUNDLE_PATH="/usr/local/bundle" \
    BUNDLE_WITHOUT="development"

# Instalar las dependencias necesarias
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential git libvips pkg-config cron curl && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

# Copiar archivos de la aplicación
COPY Gemfile Gemfile.lock ./
RUN bundle install

COPY . .

# Crear usuario de Rails y asignar permisos.
#
# El `chmod +x` cubre el caso de construir la imagen sin bind mount. El arreglo
# de verdad esta en el indice de git: los archivos de bin/ pasan a 100755 en
# este mismo commit. Se aclara porque en este despliegue esta linea NO se
# ejecuta sobre lo que corre: el docker-compose monta ./SENDER/wellproject en
# /rails, asi que el contenedor usa los archivos del host y no los de la imagen.
#
# El CMD invoca `./bin/rails`, y sin bit de ejecucion el contenedor muere al
# arrancar con `exec: "./bin/rails": permission denied`. Paso en produccion el
# 10 de agosto de 2026.
RUN chmod +x bin/* && \
    useradd -ms /bin/bash rails && chown -R rails:rails /rails
USER rails:rails

EXPOSE 3000
CMD ["./bin/rails", "server"]