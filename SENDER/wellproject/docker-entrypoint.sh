#!/bin/bash
set -e
export BUNDLE_GEMFILE=/rails/Gemfile
export GEM_HOME=/usr/local/bundle
export GEM_PATH=/usr/local/bundle:/usr/local/lib/ruby/gems/3.0.0

bundle exec whenever --update-crontab

service cron start

exec bundle exec rails server -b 0.0.0.0
