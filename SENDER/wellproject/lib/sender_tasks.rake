namespace :sender do
    desc "FUNCIONA CTM"
    task fetch_unsent_and_send: :environment do
        Sender.new.fetch_unsent_and_send
    end
end