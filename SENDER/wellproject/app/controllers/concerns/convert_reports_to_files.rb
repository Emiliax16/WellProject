require 'csv'

class ConvertReportsToFiles
  def self.call(reports)
    files = []

    reports.each do |report|
      csv_string = CSV.generate do |csv|
        # headers
        csv << ["Nombre Cliente", "Correo Cliente", "Código Pozo", "Atributo1", "Atributo2", "Atirbute3"]

        report[:wells].each do |well_code, well_reports|
          well_reports.each do |well_report|
            csv << [report[:client_name], report[:client_email], well_code, well_report.to_json]
          end
        end
      end

      # La carpeta tmp es para guardar archivos temporales
      file_path = Rails.root.join("tmp", "report_#{report[:client_email]}_#{Date.today}.csv")
      File.write(file_path, csv_string)
      files << file_path
    end

    files
  end
end