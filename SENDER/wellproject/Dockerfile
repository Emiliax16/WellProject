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
# El `chmod +x` es una red de seguridad: el CMD invoca `./bin/rails`, y si esos
# archivos llegan sin bit de ejecucion el contenedor muere al arrancar con
# `exec: "./bin/rails": permission denied`. Paso en produccion el 10 de agosto
# de 2026. El repo ya los tiene como 100755, pero un checkout con
# core.fileMode=false volveria a perderlo sin que nadie lo note.
RUN chmod +x bin/* && \
    useradd -ms /bin/bash rails && chown -R rails:rails /rails
USER rails:rails

EXPOSE 3000
CMD ["./bin/rails", "server"]