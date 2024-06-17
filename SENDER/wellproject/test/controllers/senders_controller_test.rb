require "test_helper"

class SendersControllerTest < ActionDispatch::IntegrationTest
  setup do
    @sender = senders(:one)
  end

  test "should get index" do
    get senders_url, as: :json
    assert_response :success
  end

  test "should create sender" do
    assert_difference("Sender.count") do
      post senders_url, params: { sender: {  } }, as: :json
    end

    assert_response :created
  end

  test "should show sender" do
    get sender_url(@sender), as: :json
    assert_response :success
  end

  test "should update sender" do
    patch sender_url(@sender), params: { sender: {  } }, as: :json
    assert_response :success
  end

  test "should destroy sender" do
    assert_difference("Sender.count", -1) do
      delete sender_url(@sender), as: :json
    end

    assert_response :no_content
  end
end
