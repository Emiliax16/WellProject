
################################ PARA PRODUCCION ################################

# 1° OPCION CONTROLADOR: SendersController
#every :day, at: '6:00 am' do
#  runner "SendersController.new.fetch_unsent_and_send", output: { standard: 'log/cron.log' }
#end

# 2° OPCION MODELO: Sender
#every :day, at: '6:00 am' do
#  runner "Sender.fetch_unsent_and_send", output: { standard: 'log/cron.log' }
#end

# 3° OPCION RAKE
#every :day, at: '6:00 am' do
#  rake "sender:fetch_unsent_and_send", output: { standard: 'log/cron_rake.log' }
#end

# 4° OPCION COMMAND
#every :day, at: '6:00 am' do
# command "cd /home/emiliax/WellProject/SENDER/wellproject && bundle exec rake sender:fetch_unsent_and_send RAILS_ENV=production"
#end

# OPCION SYSTEAM
#every :day, at: '6:00 am' do
#  system("cd /home/emiliax/WellProject/SENDER/wellproject && bundle exec rails runner 'SendersController.new.fetch_unsent_and_send'", output: { standard: 'log/cron_system.log' })
#end



################################ PARA TESTEAR ################################
#every 1.minute do
#  runner "SendersController.new.fetch_unsent_and_send", output: { standard: 'log/cron.log' }
#end

#every 1.minute do
#  runner "Sender.fetch_unsent_and_send", output: { standard: 'log/cron.log' }
#end

#every 1.minute do
#  rake "sender:fetch_unsent_and_send", output: { standard: 'log/cron_rake.log' }
#end

#every 1.minute do
#  command "cd /home/emiliax/WellProject/SENDER/wellproject && bundle exec rake sender:fetch_unsent_and_send RAILS_ENV=production", output: { standard: 'log/cron_command.log' }
#end

#every 1.minute do
#  system("cd /home/emiliax/WellProject/SENDER/wellproject && bundle exec rails runner 'SendersController.new.fetch_unsent_and_send'", output: { standard: 'log/cron_system.log' })
#end

