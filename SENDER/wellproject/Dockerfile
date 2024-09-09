# syntax = docker/dockerfile:1

ARG RUBY_VERSION=3.0.2
FROM ruby:$RUBY_VERSION-slim as base

WORKDIR /rails

# Deshabilitamos temporalmente el modo de deployment para evitar problemas
ENV RAILS_ENV="development" \
    BUNDLE_PATH="/usr/local/bundle" \
    BUNDLE_WITHOUT="production"

FROM base as build

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
    build-essential \
    git \
    libvips \
    pkg-config

RUN gem install bundler -v 2.5.18
COPY Gemfile Gemfile.lock ./

# Desactivar el modo de deployment para instalar correctamente las gemas
RUN bundle install && \
    rm -rf ~/.bundle/ "${BUNDLE_PATH}"/ruby/*/cache "${BUNDLE_PATH}"/ruby/*/bundler/gems/*/.git && \
    bundle exec bootsnap precompile --gemfile

COPY . .

RUN bundle exec bootsnap precompile app/ lib/

FROM base

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
    curl \
    libsqlite3-0 \
    libvips \
    cron && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

COPY --from=build /usr/local/bundle /usr/local/bundle
COPY --from=build /rails /rails

RUN useradd -m -d /home/rails -s /bin/bash rails && \
    chown -R rails:rails /rails /usr/local/bundle && \
    chmod +x /rails/bin/docker-entrypoint

USER root

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]
