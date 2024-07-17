require 'net/http'
require 'uri'

class ReportSenderController < ApplicationController

  # GET report_sender/fetch_reports_and_sent_to_clients
  def fetch_reports_and_sent_to_clients
    begin
      puts "ejecutando el cron job de envío mensual de reportes a la fecha #{Time.now}"
      reports_from_api = fetch_reports
      valid_reports = check_reports_to_send(reports_from_api)
      if valid_reports.any?
        files_to_sent = convert_reports_to_files(valid_reports)
        send_reports(files_to_sent)
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
      uri = URI.parse("http://#{ENV['FETCH_API_REPORTS_TO_CLIENTS']}")
      response = Net::HTTP.get_response(uri)
      if response.is_a?(Net::HTTPSuccess) && response.body['clients'].present?
        json_response = JSON.parse(response.body)
        json_response['clients'].values
      else
        raise "Error al obtener los reportes a enviar a los clientes: #{response.message}"
      end
    end

    def send_reports(report_files)
      send_data = SendReportsToClients.new(report_files)
      send_data.send_data
    end

    def check_reports_to_send(reports)
      return [] if reports.nil? || reports.empty?

      valid_reports = []

      reports.each do |client_id, client_data|
        next if client_data['wells'].nil? || client_data['wells'].empty?
  
        valid_wells = client_data['wells'].each_with_object({}) do |(well_id, well_reports), wells|
          wells[well_id] = well_reports unless well_reports.empty?
        end
  
        next if valid_wells.empty?
  
        valid_reports << {
          client_email: client_data['correo'],
          client_name: client_data['nombre'],
          number_of_wells: valid_wells.size,
          wells: valid_wells
        }
      end
  
      valid_reports
    end

    def convert_reports_to_files(reports)
      ConvertReportsToFiles.call(reports)
    end
end
