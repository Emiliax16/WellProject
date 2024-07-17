class ClientMailer < ApplicationMailer
  default from: 'email_frfom@gmail.com' #TODO: poner el de promedicion

  def send_report(email, file_path, client_name)
    attachments["report_#{Date.today}.csv"] = File.read(file_path)
    mail(to: email, subject: "Reporte Mensual de Promedición", body: "Hola #{client_name},\n\nAdjunto encontrarás tu reporte mensual de derechos de agua.\n\nSaludos,\nEquipo de Promedición")
  end
end
