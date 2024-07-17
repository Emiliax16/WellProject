require 'net/http'
require 'uri'

class SendReportsToClients
  attr_accessor :files

  def initialize(files)
    @files = files
  end

  def send_data
    files.each do |file_path|
      filename = File.basename(file_path, ".csv")
      # formato: "report_<client_email>_<date>.csv"
      client_email = filename.split('_')[1]
      client_name = filename.split('_')[0] # TODO: que no se me olvide agregar el nombre en el archivo csv (en el path)

      ClientMailer.send_report(client_email, file_path, client_name).deliver_now
    end
  end
end