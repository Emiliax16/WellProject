class TypesFormat
  STRUCTURE = {
    id: Integer,
    sent: FalseClass,
    sentDate: NilClass,
    code: String,
    totalizador: Integer,
    date: String,
    hour: String
  }.freeze

  #
  # Valida el formato de los datos recibidos por cada reporte
  # @param [Hash] object: hash con los atributos del reporte
  # @return [Boolean] False o true si el formato es correcto
  #
  def self.validate_data(object)
    object.each do |entry|
      return false unless self.check_type(entry)
    end

    true
  end

  private
    def self.check_type(data)
      return false unless data.present? && data[0].present?

      STRUCTURE[data[0].to_sym].present? ? STRUCTURE[data[0].to_sym] == data[1].class : true
    end
end
