#!/bin/bash
set -e

bundle exec whenever --update-crontab

service cron start

exec bundle exec rails server -b 0.0.0.0
