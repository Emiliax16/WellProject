# Proceso de desarrollo

## Una rama por tema

Cada tema distinto a tratar, debe ir en una rama distinta. Por ejemplo, si trabajaremos en un feature y un bug, cada uno de estos debe ir en una rama distinta. Esto facilita la revisión, al presentar solamente cambios relacionados al revisor.

Cada rama debe tener un nombre según nuestras [convenciones](git-conventions.md).

## Un commit por cambio lógico

Si bien cada tópico tendrá su propia rama, es útil, tanto para la revisión como para ver la historia, que cada cambio lógico sea autocontenido en un commit. Por ejemplo, si para un feature debo refactorizar un método para dividirlo en dos, es bueno tener un commit para el refactor, y otro para el feature.

Cada commit debe tener un mensaje explicativo que indique porque se realizan los cambios.

## Cada rama debe unirse vía Pull Request

Durante la revisión del PR es normal que se produzcan muchos comentarios, los cuales deben ser asumidos de manera constructiva, pero no como instrucciones. Si tomamos una decisión que el revisor está cuestionando, debemos ser capaces de explicar por qué la tomamos.

En caso de que sea necesario, se deben corregir los comentarios del revisor, utilizando `rebase` para que los cambios se agrupen lógicamente.

Los PR siempre tienen una rama de destino, a la cual se unirán los cambios. Normalmente, los cambios van a la rama `development`, que es nuestra rama de integración continua. A veces, es necesario enviar cambios directamente a producción en la rama `master`. Esto último debemos hacerlo solo en los casos en que es estrictamente necesario. Más información de a donde apuntar, está en nuestras [convenciones](git-conventions.md).

Si ha pasado mucho tiempo durante el desarrollo de nuestra rama, es posible que aparezcan conflictos con los cambios ya unidos a la rama de destino. En este caso, debemos solucionarlos con un `git rebase` sobre la rama de destino (actualizada).
