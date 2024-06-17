require 'net/http'
require 'uri'

class SendersController < ApplicationController

  # GET /senders/fetch_unsent_and_send
  def fetch_unsent_and_send
    begin
      puts "ejecutando el cron job a #{Time.now}"
      reports = fetch_reports
      if reports.any?
        send_reports(reports)
        render json: { message: "Reportes enviados correctamente." }, status: :ok
      else
        render json: { message: "No hay reportes no enviados." }, status: :ok
      end
    rescue StandardError => e
      render json: { error: e.message }, status: :internal_server_error
    end
  end

  private
  
    def fetch_reports
      uri = URI.parse("http://#{ENV['FETCH_API_REPORTS']}")
      response = Net::HTTP.get_response(uri)
      if response.is_a?(Net::HTTPSuccess)
        json_response = JSON.parse(response.body)
        json_response['reports'].values
      else
        raise "Error al obtener reportes no enviados: #{response.message}"
      end
    end

    def send_reports(reports)
      valid_reports = check_reports_to_send(reports)
      send_data = SendDga.new(valid_reports)
      send_data.send_data
    end

    def check_reports_to_send(reports)
      return [] if reports.nil? || reports.empty?

      valid_reports = []
      reports.each do |report|
        TypesFormat.validate_data(report) ? valid_reports << report : next
      end

      return valid_reports
    end

    # Only allow a list of trusted parameters through.
    def sender_params
      params.fetch(:sender, {})
    end
end
