namespace :sender do
    desc "Enviar reportes a la DGA"
    task fetch_unsent_and_send: :environment do
      SendersController.new.fetch_unsent_and_send
    end
end

# MODELO
#namespace :sender do
#    desc "Enviar reportes a la DGA"
#    task fetch_unsent_and_send: :environment do
#      Sender.fetch_unsent_and_send
#    end
#end
