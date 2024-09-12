# WellProject/SENDER

Repositorio encargado de conseguir todos los reportes no enviados a la dga desde la `/API`. Luego de obtenerlos, se envían al endpoint encargado de postear a la dga, con una diferencia de 10 segundos en cada envío. La lógica de envíos se automatiza mediante el uso de `cron_jobs`, que se traduce en una tarea programada que se ejecutará en un intervalo predifinido. En nuestro caso, se ejecuta cada día a las 6am. El archivo encargado de ejecutar esta tarea es `SENDER\wellproject\config\schedule.rb`.

Es importante saber que una forma de testear el envío automático es comentando el bloque de líneas del archivo anterior, y descomentando el bloque marcado como tests. Luego de esta modificación, se debe actualizar la tabla `Cron` que tiene múltiples tareas programadas (actualmente solo 1). Al actualizar la tabla, automáticamente comienza a ejecutar la línea dentro del bloque, por cada intervalo de tiempo declarado.

Para actualizar la tabla se utiliza: `whenever --update-crontab`

## Levantar el servidor

Para levantar este servidor, se realiza con el comando `rails s`. Se recomienda siempre antes correr el `GemFile` con `bundle install` para instalar cualquier gema pendiente.

## Gema `whenever`

La gema que se utiliza para manejar los `cron`. Permite el acceso y actualización a la tabla.

- Instalación:
  - En el archivo `GemFile`, agregar `gem 'whenever', require: false` (el require false es bueno para ahorrarnos performance, ya que esta línea no se ejecutará automáticamente sino que sólo cuando se carga cuando lo forzamos o cuando algún script lo necesita)
  - Correr `bundle install`
- Configuración inicial:
  - Correr `bundle exec wheneverize .` para crear el archivo de tareas pendientes, en la ruta `SENDER\wellproject\config\schedule.rb` (esto ya está creado, se deja el paso a paso apra replicar)
  - Definir las tareas mediante la siguiente sintaxis:
```text
every 10.minute do
  runner "SendersController.new.fetch_unsent_and_send", output: { standard: 'log/cron.log' }
end
```
## Logs (para tests o para la ejecución real)

Los logs de la ejecución de las tareas `cron` están en la carpeta de archivos temporales `log/cron.log`. Si se tiene corriendo el servidor, aquí aparecerá cada ejecución en este formato:
```
ejecutando el cron job a 2024-06-16 22:10:05 -0400
Reporte 1 enviado exitosamente.
Reporte 2 enviado exitosamente.
Reporte 3 enviado exitosamente.
Reporte 4 enviado exitosamente.
Reporte 5 enviado exitosamente.
Reporte 6 enviado exitosamente.
Reporte 7 enviado exitosamente.
Reporte 8 enviado exitosamente.
Reporte 9 enviado exitosamente.
ejecutando el cron job a 2024-06-16 22:20:05 -0400
Reporte 1 enviado exitosamente.
Reporte 2 enviado exitosamente.
Reporte 3 enviado exitosamente.
Reporte 4 enviado exitosamente.
Reporte 5 enviado exitosamente.
Reporte 6 enviado exitosamente.
Reporte 7 enviado exitosamente.
Reporte 8 enviado exitosamente.
Reporte 9 enviado exitosamente.
```

## Comandos útiles

- Por algún motivo a veces el gitignore se me buggea y me salen archivon bin modificados, y aunque se descarten vuelven a aparecer, esto se soluciona corriendo el comando `git update-index --assume-unchanged bin/*`, que hace que ya no se considere el seguimiento de cambios en los archivos bin (dejan de aparecer en los changes).
- Ver la lista los `cron jobs` para asegurarte de que el cron job está añadido bien a la tabla. Se ve con el comando `crontab -l` y el output debería ser algo del estilo:
```
/bin/bash -l -c 'cd /path/to/your/project && bundle exec bin/rails runner '\''SendersController.new.fetch_unsent_and_send'\'' >> log/cron.log'
```

## Sintaxis para leer archivo ``schedule.rb` con los cron jobs:

La sintaxis de cron consta de cinco campos separados por espacios, que indican cuándo se debe ejecutar la tarea:

1. **Minuto (0 - 59)**: Especifica el minuto de la hora.
2. **Hora (0 - 23)**: Especifica la hora del día.
3. **Día del mes (1 - 31)**: Especifica el día del mes.
4. **Mes (1 - 12)**: Especifica el mes del año.
5. **Día de la semana (0 - 6)**: Especifica el día de la semana (0 es domingo, 6 es sábado).

Un asterisco (`*`) en cualquier campo significa "todos los valores posibles" para ese campo. Por ejemplo, un asterisco en el campo de mes significa que la tarea se ejecutará todos los meses.

### Ejemplo -> se ejecuta a las 9 de la mañana, los 28 de cada mes.

```ruby
every '0 9 28 * *' do
  runner "ReportSenderController.new.fetch_reports_and_sent_to_clients", output: { standard: 'log/cron.log' }
end
```