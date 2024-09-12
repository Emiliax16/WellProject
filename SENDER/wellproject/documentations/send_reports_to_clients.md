# Flujo de Envío de Correos Mensuales a Clientes

Se describe el flujo completo de envío de correos electrónicos a clientes con archivos CSV adjuntos, incluyendo la recolección de reportes desde la API, la validación de la estrctura de los datos, y su conversión a CSV y el envío de correos.

## Recolección de Reportes
Archivo: `app/controllers/report_sender_controller.rb`

El flujo es:
1. Obtiene los reportes desde una API externa.
2. Verifica que la respuesta sea exitosa y que contenga datos de clientes.
3. Validación de Reportes
4. Filtra los clientes sin pozos y los pozos sin reportes. Construye un array de reportes válidos.
5. Se convierten los reportes a archivos csv almacenados temporalmente en la carpeta `/tmp`. Esto se realiza en el archivo `app/controller/concerns/convert_reports_to_files.rb`
6. Itera sobre cada archivo CSV. Extrae el correo electrónico del cliente y el nombre del archivo. Utiliza ClientMailer para enviar el archivo CSV por correo electrónico.

## Estructura de reportes a enviar a cada cliente

Cada mes, se obtienen los reportes de todos los clientes disponibles para cada pozo, para enviarlos como archivo csv y quedar el respaldo. La estructura al obtener los reportes desde la API es la siguiente:
```json
{
  "clients": {
    "client_1": {
      "correo": "client1@example.com",
      "nombre": "Nombre del Cliente 1",
      "wells": {
        "well_1": [
          {
            "code": "Reporte 1 Código",
            "atributo1": "valor1",
            "atributo2": "valor2",
            "atributo3": "valor3"
            // Otros atributos del reporte
          },
          {
            "code": "Reporte 2 Código",
            "atributo1": "valor1",
            "atributo2": "valor2",
            "atributo3": "valor3"
            // Otros atributos del reporte
          }
        ],
        "well_2": [
          {
            "code": "Reporte 1 Código",
            "atributo1": "valor1",
            "atributo2": "valor2",
            "atributo3": "valor3"
            // Otros atributos del reporte
          }
        ]
      }
    },
    "client_2": {
      "correo": "client2@example.com",
      "nombre": "Nombre del Cliente 2",
      "wells": {
        "well_1": [
          {
            "code": "Reporte 1 Código",
            "atributo1": "valor1",
            "atributo2": "valor2",
            "atributo3": "valor3"
            // Otros atributos del reporte
          }
        ]
      }
    }
  }
}
```

Luego, esta estrctura se pasa a un archivo csv separado por cliente, donde se envía en el siguiente formato:
```csv

```