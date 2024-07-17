# Documentación para ActionMailer

Documentación oficial: [ActionMailerRails](https://guides.rubyonrails.org/action_mailer_basics.html)
Video útil para configurar envíos: [GmailSMTP](https://www.youtube.com/watch?v=eYhi_rbnOo8)

## Introducción

ActionMailer es una biblioteca integrada en Ruby on Rails que permite enviar correos electrónicos desde tu aplicación.

## Configuración de ActionMailer

Para enviar correos electrónicos **gratuitos**, se debe ActionMailer con los detalles del SMTP. Esta configuración se realiza en los archivos `config/environments/development.rb` y `config/environments/production.rb`.

### Configuración en `development`

```ruby
# config/environments/development.rb
Rails.application.configure do
  # Configura el método de entrega de correos como :smtp
  config.action_mailer.delivery_method = :smtp

  # Configura las opciones del servidor SMTP
  config.action_mailer.smtp_settings = {
    address:              'smtp.gmail.com',   # Dirección del servidor SMTP
    port:                 587,                # Puerto del servidor SMTP
    domain:               'example.com',      # Dominio para HELO
    user_name:            'your_email@gmail.com',  # Nombre de usuario del servidor SMTP
    password:             'your_password',         # Contraseña del servidor SMTP
    authentication:       'plain',            # Método de autenticación
    enable_starttls_auto: true                # Habilitar STARTTLS para asegurar la conexión
  }
end
```

#### Explicación de las configuraciones

- `delivery_method`: Define el método de entrega como SMTP.
- `smtp_settings`: Configura las opciones del servidor SMTP, incluyendo la dirección, puerto, dominio, nombre de usuario, contraseña, método de autenticación y habilitación de STARTTLS.

#### ¿Por qué SMTP?

SMTP es un servidor de Gmail para enviar correos electrónicos. Es gratuito hasta cierto límite de envíos diarios, exactamente 500 diarios.

### Cómo crear un Mailer

- Crear un Mailer
```ruby
rails generate mailer ClientMailer
```

Esto crea automáticamente los siguientes archivos:
```ruby
app/mailers/client_mailer.rb
app/views/client_mailer/
test/mailers/client_mailer_test.rb
test/mailers/previews/client_mailer_preview.rb
```

- Definir el Método en el Mailer: Ejemplo de su uso en el archivo `app/mailers/client_mailer.rb`

```ruby
class ClientMailer < ApplicationMailer
  default from: 'email_from@gmail.com'

  def send_report(email, file_path, client_name)
    attachments["report_#{Date.today}.csv"] = File.read(file_path)
    mail(to: email, subject: "Reporte Mensual de Pozos de Agua", body: "Hola #{client_name},\n\nAdjunto reporte mensual de pozos de agua.\n\nSaludos,\nEquipo de Promedición de Pozos")
  end
end
```