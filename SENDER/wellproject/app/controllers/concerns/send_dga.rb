require 'net/http'
require 'uri'

class SendDga
  attr_accessor :reports

  def initialize(reports)
    @reports = reports
  end

  def send_data
    reports.each do |report|
      send_report(report)
      # Hay que esperar 5 minutos entre cada envío según el docimento de la dga
      # https://dga.mop.gob.cl/uploads/sites/13/2024/08/Transmision_mee_subterraneas_nueva-API.pdf
      sleep 300
    end
  end

  private

  def send_report(report)
    uri = URI.parse("http://#{ENV['POST_API_REPORTS']}")
    http = Net::HTTP.new(uri.host, uri.port)
    request = Net::HTTP::Post.new(uri.request_uri, 'Content-Type' => 'application/json')
    request.body = { id: report['id'] }.to_json
    response = http.request(request)
    unless response.is_a?(Net::HTTPSuccess)
      raise "Error al enviar reporte: #{response.message}"
    end
    puts "Reporte #{report['id']} enviado exitosamente."
  end
end
