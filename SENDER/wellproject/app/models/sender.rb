require 'net/http'
require 'uri'

class Sender < ApplicationRecord
  def self.fetch_unsent_and_send
    begin
      puts "ejecutando el cron job a #{Time.now}"
      reports = check_reports_to_send(fetch_reports)
      if reports.any?
        send_reports(reports)
        puts "Reportes enviados correctamente"
      else
        puts "No hay reportes para enviar"
      end
    rescue StandardError => e
      puts "Error al enviar reportes: #{e.message}"
    end
  end

  private

    def self.fetch_reports
      uri = URI.parse("http://#{ENV['FETCH_API_REPORTS']}")
      response = Net::HTTP.get_response(uri)
      if response.is_a?(Net::HTTPSuccess) && response.body['reports'].present?
        json_response = JSON.parse(response.body)
        json_response['reports'].values
      else
        raise "Error al obtener reportes no enviados: #{response.message}"
      end
    end

    def self.send_reports(reports)
      send_data = SendDga.new(reports)
      send_data.send_data
    end

    def self.check_reports_to_send(reports)
      return [] if reports.nil? || reports.empty?

      valid_reports = []
      reports.each do |report|
        TypesFormat.validate_data(report) ? valid_reports << report : next
      end

      valid_reports
    end
end
