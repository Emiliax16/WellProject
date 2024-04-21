# Convenciones GIT

## Branches

Siguen la estructura: `<TIPO>/<DESCRIPCION-DEL-BRANCH>`

La `DESCRIPCION-DEL-BRANCH` es algo descriptivo, pero no tan largo.

Los tipos de branch y sus usos se clasifican de la siguiente manera

Tipo          | Ejemplo                                                      | Descripción
------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------
`feature`     | `feature/asignar-items-por-empleado`                         | Nuevas características o mejoras que tienen impacto en el usuario
`bugfix`      | `bugfix/error-al-editar-variable-empresa`                    | Correcciones a bugs no urgentes
`hotfix`      | `hotfix/error-500-eliminar-bono-activo-o-actualizar-trabajo` | Correcciones a bugs urgentes
`docs`        | `docs/guia-estilo-ramas`                                     | Mejoras a la documentación
`style`       | `style/hash-alignment`                                       | Modificaciones de estilos de código (por ejemplo activar una regla de linter).
`refactor`    | `refactor/invocacion-cell-class`                             | Cambios internos en el código que no tienen impacto para el usuario
`test`        | `test/agregar-test-servicios-template-forms`                 | Agrega, corrige o mejora tests
`performance` | `performance/job-data-modifier`                              | Cambios en el código que sólo mejoran la performance
`chore`       | `chore/num-workers`                                          | Cambios al proceso de build y herramientas auxiliares
`migration`   | `migration/agregar-columna-Y-a-modelo-X`                     | Migración individual para agregar cambios a la rama
`revert`      | `revert-5016-feature/rmcl-850-asignar-items-por-empleado`    | Revierte un cambio ya sea en `develpment` o en `master` por una funcionalidad incorrecta, el nombre de la branch es `revert-<n° pr>-<tipo>/<nombre de la rama>`
`cherry-pick` | `cherry-pick-6d8dcba`                                        | Toma un commit para llevarlo a otra rama `cherry-pick-<hash abreviado del commit>` es importante referenciar el PR que incorpora la feature en el PR del cherry-pick

Todas las ramas deben nacer desde `development` y sus merges apuntar a `development`, a excepción de los `hotfix`, que nacen y apuntan a `master`, y de los `revert` que pueden apuntar a `master` o `development`.

## Pull requests

### Título

Bien explicado, humano, cualquier persona en la empresa entienda de qué se trata.

Algo como `Cambiar permisos de usuario administrador` no dice mucho, mejor algo como `Agregar permiso de usuario administrador para visualizar información sensible`.

### Descripción

Que el que tenga que hacer revisión entienda qué está revisando. Tenemos una plantillacon todos los detalles a incluir.
### Revisión

Cuando se crea el pull request se asigna a alguien. Una vez terminada la revisión, se debe merger el pr luego de tener al menos 1 approve.

## Commits

Se prefiere utiliza el [commit message guideline](https://github.com/angular/angular/blob/master/CONTRIBUTING.md#-commit-message-guidelines) de angular

### Mensajes en commits

Los mensajes de commit:

```text
<tipo>: <descripción>
  <BLANK LINE>
  <cuerpo>
  <BLANK LINE>
  <pie>
```

- Cada línea no debiera tener más de 100 caracteres para que se lea bien.
- [Guia para escribir mejores mensajes de commits](https://github.com/RomuloOliveira/commit-messages-guide)

### Tipo de commits

El tipo nos ayuda a clasificar los commits. Los tipos son bastante similares a los tipos de rama:

- **feat**: Un nuevo feature
- **fix**: La corrección de un bug
- **docs**: Cambios en la documentación
- **style**: Cambios que no afectan el significado del código (espacios, indentación, etc.)
- **refactor**: Un cambio en el código que no agrega una funcionalidad ni corrige un bug
- **perf** Cambios en el código que sólo mejoran la performance
- **test**: Agrega, corrige o mejora tests
- **chore**: Cambios al proceso de build y herramientas auxiliares
- **migration**: Cambios en el código a la base de datos.

### Descripción de commits

Lo importante en una descripción de commit es que nos genera documentación. Esto se refleja cuando vemos el historial de cada línea mientras programamos (muy útil en VS Code) o cuando se hace una revisión global de los commits en un PR (la pestaña commits).

#### Ejemplo de Buen Mensaje de Commit

> **feat: Implementar caso de update de un cliente que quiere cambiar su configuración de perfil**
>
> El cambio de perfil era sólo configurable por usuario admin, por ende se implementa que cada cliente pueda actualizar su propia información de forma independiente.

Este mensaje nos indica que estaba asumiendo el código, y la información adicional que invalida ese supuesto.
