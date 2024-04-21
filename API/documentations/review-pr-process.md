# Prácticas para revisar un PR

El siguiente documento tiene como motivo el sugerir una vía válida para revisar un PR de forma efectiva.

## Orden de revisión

1. Obtener el big picture del PR (¿estamos revisando un refactor?, ¿feature?, etc...). Para así saber como abarcar y que esperar del PR.
2. Revisar la descripción del PR.
3. Revisar link de tarjeta que describa los requisitos y criterios de aceptación.
4. Comparar descripción de tarjeta con la descripción presentada en el PR.
5. Revisar commits y sus descripciones: deben tener sentido y explicar bien el cambio hecho en ellos.
6. Revisar código. (Se recomienda hacerlo commit a commit)
7. Si llegase a ser necesario, probar el flujo de la funcionalidad. (**Importante:** Para un resultado más efectivo, realizar esto una vez el código haya sido revisado y los comentarios corregidos)
8. Confirmar que el PR tenga al menos las etiquetas correspondientes a la funcionalidad sobre la que se trabajó.

## Highlights

### Documento PR

- Título acorde y resumido.
- Enlace a tarjeta o documento con la descripción de requisitos y criterios.
- Descripción del problema.
- Solución.
- Screenshots si aplica.
- Cómo probar.

La idea es revisar de que toda la información necesaria para la revisión esté disponible y esta se entiende.

### Código

- Sugerir el uso de buenas prácticas para tener un código legible.
- Revisar que el código refleje lo expuesto en el PR y commits.
- Sugerir cambios, si es que algo se puede hacer mejor o si se está agregando deuda técnica.

### Test

- Hay que potenciar la creación de test.
- El PR debe contener un alto coverage del código añadido.
