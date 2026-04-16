# US-06: Usar la terminal embebida — tab Bash (shell interactiva)

**ID**: AB#<a asignar>
**Feature padre**: F-06 — Terminal embebida — tab Bash (shell interactiva)
**Épica**: AB#<a asignar> — Agent Workbench MVP
**Tipo**: Funcional
**Prioridad**: Must
**Estimación**: <SP, a completar por el equipo>

## Historia

Como **usuario desarrollador**,
quiero **ejecutar comandos de shell directamente en la carpeta de trabajo del chat activo**,
para **complementar la conversación con el agente sin necesidad de abrir una terminal externa**.

## Contexto

Cada chat tiene una terminal embebida con dos pestañas. La tab "Bash" es una shell real e interactiva, disponible para el usuario: puede escribir comandos, ver su output y navegar el filesystem, todo dentro de la carpeta de trabajo que eligió al abrir ese chat. Esta terminal no está bajo el control del agente: es exclusiva del usuario y corre como un proceso independiente del proceso de Claude Code. Permite al usuario verificar resultados, correr tests, instalar dependencias o hacer cualquier operación de shell sin salir de la interfaz de Agent Workbench.

## Reglas de negocio

- RN1: La tab Bash abre una shell real en la carpeta de trabajo de la sesión de chat correspondiente. El directorio inicial (`cwd`) es la carpeta elegida al abrir el chat.
- RN2: La shell de la tab Bash es independiente del proceso Claude Code de esa sesión. Las acciones del usuario en la tab Bash no afectan al agente y viceversa.
- RN3: La tab Bash es un proceso separado por sesión de chat. Si hay 3 chats abiertos, hay 3 shells independientes (una por chat).
- RN4: Al cerrar el chat, el proceso de shell de la tab Bash también se termina.
- RN5: El usuario puede ejecutar cualquier comando disponible en su entorno shell. No hay restricciones de comandos en el MVP.
- RN6: El contenido del buffer de la tab Bash persiste mientras la sesión está activa. Si el usuario cambia a la tab Agente y vuelve, el historial de comandos sigue visible.
- RN7: La shell hereda el entorno del usuario, salvo `ANTHROPIC_API_KEY` que debe estar ausente (consistente con el proceso Claude Code).

## Criterios de aceptación

### Escenario 1: El usuario ejecuta un comando en la carpeta del chat (happy path)

```gherkin
Dado que el usuario tiene un chat abierto con el agente "Dev Backend" sobre la carpeta "/home/usuario/proyectos/api"
Y la tab "Bash" de la terminal embebida está activa
Cuando el usuario escribe "ls -la" y presiona Enter
Entonces la shell ejecuta el comando en la carpeta "/home/usuario/proyectos/api"
Y el output del comando se muestra en la terminal
Y la shell queda lista para recibir el siguiente comando
```

### Escenario 2: El usuario ejecuta un comando de larga duración (alternativo)

```gherkin
Dado que el usuario está en la tab "Bash" del chat con el agente "Dev Frontend"
Cuando el usuario ejecuta "npm run build" que demora varios segundos
Entonces el output del comando aparece en la terminal a medida que se genera
Y la shell no acepta nuevos comandos hasta que el proceso termine
Y cuando el proceso termina, la shell queda nuevamente disponible para recibir comandos
```

### Escenario 3: El usuario navega entre tab Bash y tab Agente sin perder el contexto (alternativo)

```gherkin
Dado que el usuario ejecutó 3 comandos en la tab "Bash" del chat con el agente "Tech Lead"
Cuando el usuario cambia a la tab "Agente" y luego vuelve a la tab "Bash"
Entonces el historial de comandos y outputs sigue visible en la terminal
Y la shell sigue activa en el mismo directorio de trabajo
```

### Escenario 4: El usuario cierra el chat con un proceso corriendo en la tab Bash (alternativo)

```gherkin
Dado que la tab "Bash" tiene un proceso corriendo (por ejemplo un servidor de desarrollo)
Cuando el usuario cierra el chat
Entonces el proceso de shell y todos sus procesos hijos se terminan junto con la sesión
Y el NPC desaparece del mapa
```

### Escenario 5: La shell falla al iniciarse (error)

```gherkin
Dado que el usuario abrió un chat con el agente "QA Tester" sobre la carpeta "/home/usuario/proyectos/tests"
Cuando el proceso de shell no puede iniciarse en esa carpeta por un error del sistema
Entonces la tab "Bash" muestra un mensaje indicando que la shell no pudo iniciarse
Y la tab "Agente" sigue funcionando con normalidad
Y el chat sigue abierto y funcional para conversar con el agente
```

### Escenario 6: El usuario intenta ejecutar un comando en una shell ocupada (error)

```gherkin
Dado que hay un proceso corriendo en la tab "Bash" (por ejemplo "npm test")
Cuando el usuario escribe un nuevo comando e intenta ejecutarlo
Entonces el nuevo input se encola en la terminal (comportamiento estándar de shell con proceso en foreground)
Y el sistema no interrumpe el proceso en curso
```

## Dependencias

- **Funcionales**: US-01 (la carpeta de trabajo se define al abrir el chat y es el `cwd` inicial de la shell).
- **Técnicas**: xterm.js en el frontend para renderizar la terminal; node-pty en el backend para gestionar el pseudoterminal; el backend debe mantener un proceso shell por sesión de chat, separado del proceso Claude Code.
- **De diseño**: diseño de la tab Bash dentro de la terminal embebida; diferenciación visual con la tab Agente; tamaño y comportamiento del componente de terminal.

## Fuera de alcance

- Restricción de comandos ejecutables (no hay sandboxing de shell en el MVP).
- Compartir la shell entre múltiples sesiones de chat.
- Persistencia del historial de comandos entre sesiones.
- Sincronización del directorio de trabajo entre el agente y la shell (son procesos independientes).
- Personalización del shell (tema de colores, prompt) en el MVP.

## Notas para UX/UI

La tab Bash debe verse y comportarse como una terminal real: fuente monoespaciada, colores ANSI, cursor parpadeante. Debe ser visualmente distinguible de la tab Agente que es un log estructurado, no un terminal. El tamaño del componente debe ser suficiente para trabajar cómodamente, con posibilidad de redimensionar si el layout lo permite.

## Notas para Tech Lead

- node-pty en el backend debe recibir el tamaño de la terminal (columnas × filas) desde el frontend para que los comandos que dependen del ancho de pantalla (como `man`, `less`, herramientas con UI en terminal) funcionen correctamente.
- Ante el resize del componente de terminal en el frontend, debe notificarse al pty para que se ajuste.
- La shell debe iniciarse con `cwd` igual a la `workingDirectory` de la sesión (la carpeta elegida en US-01).
- Ver Q-12 sobre qué shell usar por defecto.

## Métricas de éxito

- Porcentaje de sesiones en las que el usuario ejecuta al menos un comando en la tab Bash.

## Preguntas abiertas

- [ ] Q-12: ¿La tab Bash usa la shell default del usuario (bash, zsh, fish, etc.) o una shell fija (por ejemplo bash) independientemente de la configuración del OS? ¿Cómo se determina la shell a usar?
- [ ] Q-13: ¿El proceso de shell de la tab Bash puede acceder a variables de entorno personalizadas del usuario (ej: `PATH` custom, `NVM_DIR`, etc.)? ¿Se hereda el entorno completo del proceso del backend?
