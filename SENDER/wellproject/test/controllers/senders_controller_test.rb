require "test_helper"
require 'webmock/minitest'

  
class SendersControllerTest < ActionDispatch::IntegrationTest
  N_REPORTS = 5

  setup do
    @fetch_url = "http://#{ENV['FETCH_API_REPORTS']}"
    @post_url = "http://#{ENV['POST_API_REPORTS']}"
  end

  #stub_rquest(:action, url) -> to_return (get), with (post), to_timeout (get)

  test "should fetch and send unsent reports successfully" do
    reports = create_reports(custom_number: 1)
    stub_request(:get, @fetch_url).to_return(
      body: {
        "reports": reports
      }.to_json,
      headers: { 'Content-Type' => 'application/json' }
    )

    stub_request(:post, @post_url).
      with(
        body: {"id": 0}.to_json,
        headers: {
          'Content-Type'=>'application/json',
        }
      ).
      to_return(status: 200, body: "", headers: {})

    get fetch_unsent_and_send_senders_url, as: :json
    assert_response :success
    assert_equal "Reportes enviados correctamente.", JSON.parse(response.body)["message"]
  end

  test "should fetch two reports and repost them again" do
    reports = create_reports
    
    stub_request(:get, @fetch_url).to_return(
      body: {
        "reports": reports
      }.to_json,
      headers: { 'Content-Type' => 'application/json' }
    )

    N_REPORTS.times do |index|
      stub_request(:post, @post_url).with(
      body: {"id": index}.to_json,
      headers: {
        'Content-Type'=>'application/json',
        }
      )
    end

    get fetch_unsent_and_send_senders_url, as: :json
    assert_response :success
    assert_equal "Reportes enviados correctamente.", JSON.parse(response.body)["message"]
  end

  test "should handle incorrect format" do
    stub_request(:get, @fetch_url).to_return(
      body: { "incorrect_format": {} }.to_json,
      headers: { 'Content-Type' => 'application/json' }
    )

    get fetch_unsent_and_send_senders_url, as: :json
    assert_response :internal_server_error
    assert_includes JSON.parse(response.body)["error"], "Error al obtener reportes no enviados"
  end

  test "should handle invalid report values" do
    stub_request(:get, @fetch_url).to_return(
      body: {
        "reports": {
          "1": {
            "id": 1,
            "code": nil, # Valor inválido
            "date": "19-09-2027",
            "hour": "15:31:00",
            "totalizador": "un string cualquiera",  # Valor inválido
            "caudal": 1,
            "nivel_freatico": 5.8,
            "sent": true, # Valor inválido
            "sentDate": nil,
            "createdAt": "2024-06-02T21:43:17.811Z",
            "updatedAt": "2024-06-02T21:43:17.811Z"
          }
        }
      }.to_json,
      headers: { 'Content-Type' => 'application/json' }
    )

    get fetch_unsent_and_send_senders_url, as: :json
    assert_response :success
    assert_equal "No hay reportes no enviados.", JSON.parse(response.body)["message"]
  end

  test "should handle no response from api server" do
    stub_request(:get, @fetch_url).to_timeout

    get fetch_unsent_and_send_senders_url, as: :json
    assert_response :internal_server_error
    assert_includes JSON.parse(response.body)["error"], "execution expired"
  end

  private
  
  def create_reports(custom_number: nil)
    n_reports = custom_number ? custom_number : N_REPORTS
    reports = {}
    n_reports.times do |index| 
      reports[index] = {
        "id": index,
        "code": "TEST12345",
        "date": "19-09-2027",
        "hour": "15:31:00",
        "totalizador": 5,
        "caudal": 1,
        "nivel_freatico": 5.8,
        "sent": false,
        "sentDate": nil,
        "createdAt": "2024-06-02T21:43:17.811Z",
        "updatedAt": "2024-06-02T21:43:17.811Z"
      }
    end
    reports
  end
end