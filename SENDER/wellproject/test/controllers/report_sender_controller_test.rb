require "test_helper"

class ReportSenderControllerTest < ActionDispatch::IntegrationTest
  def setup
    @controller = ReportSenderController.new
  end

  # TEST: check_reports_to_send (método privado)
  test "should filter out clients without wells" do
    reports = {
      "client_1" => {
        "correo" => "client1@example.com",
        "nombre" => "Cliente 1",
        "wells" => {}
      },
      "client_2" => {
        "correo" => "client2@example.com",
        "nombre" => "Cliente 2",
        "wells" => {
          "well_1" => [
            { "code" => "r1", "atributo1" => "valor1" }
          ]
        }
      }
    }

    result = @controller.send(:check_reports_to_send, reports)
    assert_equal 1, result.size
    assert_equal "client2@example.com", result.first[:client_email]
  end

  test "should filter out wells without reports" do
    reports = {
      "client_1" => {
        "correo" => "client1@example.com",
        "nombre" => "Cliente 1",
        "wells" => {
          "well_1" => [],
          "well_2" => [
            { "code" => "r1", "atributo1" => "valor1" }
          ]
        }
      }
    }

    result = @controller.send(:check_reports_to_send, reports)
    assert_equal 1, result.size
    assert_equal 1, result.first[:wells].size
    assert_equal ["well_2"], result.first[:wells].keys
  end

  # TEST: convert_reports_to_files (método privado)
  test "should generate CSV files for valid reports" do
    reports = [
      {
        client_email: "client1@example.com",
        client_name: "Cliente 1",
        number_of_wells: 1,
        wells: {
          "well_1" => [
            { "code" => "r1", "atributo1" => "valor1" }
          ]
        }
      }
    ]

    files = ConvertReportsToFiles.call(reports)
    assert_equal 1, files.size

    # Leer el contenido del archivo CSV generado
    csv_content = File.read(files.first)
    csv = CSV.parse(csv_content, headers: true)

    # Verificar los encabezados
    assert_equal ["Nombre Cliente", "Correo Cliente", "Código Pozo", "Atributos del Reporte"], csv.headers

    # Verificar el contenido de la fila
    row = csv.first
    assert_equal "Cliente 1", row["Nombre Cliente"]
    assert_equal "client1@example.com", row["Correo Cliente"]
    assert_equal "well_1", row["Código Pozo"]
    assert_equal '{"code"=>"r1", "atributo1"=>"valor1"}', row["Atributos del Reporte"]
  ensure
    # Asegurarse de que los archivos temporales se eliminen después de la prueba
    files.each { |file| File.delete(file) if File.exist?(file) }
  end
end
