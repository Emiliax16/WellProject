class CreateSenders < ActiveRecord::Migration[7.1]
  def change
    create_table :senders do |t|

      t.timestamps
    end
  end
end
