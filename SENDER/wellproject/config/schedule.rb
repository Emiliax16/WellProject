# Use this file to easily define all of your cron jobs.
#
# It's helpful, but not entirely necessary to understand cron before proceeding.
# http://en.wikipedia.org/wiki/Cron

# Example:
#
# set :output, "/path/to/my/cron_log.log"
#
# every 2.hours do
#   command "/usr/bin/some_great_command"
#   runner "MyModel.some_method"
#   rake "some:great:rake:task"
# end
#
# every 4.days do
#   runner "AnotherModel.prune_old_records"
# end

# Learn more: http://github.com/javan/whenever

# CRON JOB para ejecutarse todos los días a las 6 de la mañana, va a mandar todos los repotres que tengan sent en flase 
every :day, at: '6:00 am' do
  runner "SendersController.new.fetch_unsent_and_send", output: { standard: 'log/cron.log' }
end

# CRON JOB para ejecutarse cada 10 minutos, es para tests, se puede bajar a 1 minutos y ver el
# archivo log/cron.log para ver que se ejecuta correctamente
#every 1.minute do
#  runner "SendersController.new.fetch_unsent_and_send", output: { standard: 'log/cron.log' }
#end

