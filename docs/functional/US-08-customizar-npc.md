# US-08: Customizar un NPC (nombre, ropa y color)

**ID**: AB#<a asignar>
**Feature padre**: F-08 — Customización de NPC
**Épica**: AB#<a asignar> — Agent Workbench MVP
**Tipo**: Funcional
**Prioridad**: Should
**Estimación**: <SP, a completar por el equipo>

## Historia

Como **usuario desarrollador**,
quiero **cambiar el nombre, la ropa y el color de cualquier NPC existente**,
para **personalizar la experiencia visual y distinguir más fácilmente a cada agente en el mapa**.

## Contexto

Agent Workbench usa el repo base pablodelucca/pixel-agents que provee sprites Metro City con variantes de ropa y color. La personalización permite al usuario adaptar la apariencia de cada NPC a sus preferencias o convenciones de equipo, sin modificar el system prompt ni el comportamiento del agente. Los cambios son cosméticos y afectan solo a cómo se ve el NPC en el mapa. La personalización se aplica a la definición del agente, por lo que persiste entre sesiones: el agente siempre aparecerá con el aspecto personalizado hasta que se cambie nuevamente.

## Reglas de negocio

- RN1: La customización modifica únicamente atributos visuales del NPC (nombre display, variante de ropa, color de acento). No altera el system prompt ni el comportamiento del agente.
- RN2: Los cambios de customización se persisten entre sesiones (sobreviven a cerrar y reabrir la aplicación).
- RN3: El nombre display del NPC es independiente del `agentId` (identificador interno). El `agentId` no cambia aunque se modifique el nombre display.
- RN4: Las opciones de ropa y color disponibles son las que provee el conjunto de sprites del proyecto base. No se pueden cargar sprites arbitrarios en este flujo (eso corresponde a US-09).
- RN5: La customización se puede realizar sobre el agente esté activo (con chat abierto) o inactivo. Si el agente tiene un chat activo, el cambio se refleja en el NPC en el mapa de forma inmediata.
- RN6: El nombre display no puede quedar vacío.

## Criterios de aceptación

### Escenario 1: El usuario cambia el nombre display de un NPC (happy path)

```gherkin
Dado que el usuario accede a la configuración de personalización del agente "Tech Lead"
Cuando el usuario cambia el nombre display de "Tech Lead" a "Arquitecto"
Y confirma los cambios
Entonces el NPC en el mapa muestra el nombre "Arquitecto" en lugar de "Tech Lead"
Y el dock muestra el agente con el nombre "Arquitecto"
Y el nombre persiste al cerrar y reabrir la aplicación
```

### Escenario 2: El usuario cambia la ropa y el color del NPC (happy path)

```gherkin
Dado que el usuario accede a la configuración de personalización del agente "Dev Backend"
Cuando el usuario selecciona la variante de ropa "casual" y el color de acento "verde"
Y confirma los cambios
Entonces el NPC "Dev Backend" en el mapa adopta la ropa "casual" con acento "verde"
Y el cambio se ve reflejado de forma inmediata si el agente tiene un chat activo
Y la apariencia persiste al cerrar y reabrir la aplicación
```

### Escenario 3: El usuario personaliza un NPC con chat activo (alternativo)

```gherkin
Dado que el agente "QA Tester" tiene un chat abierto y su NPC está visible en el mapa
Cuando el usuario cambia el color de acento del NPC a "naranja" desde la configuración de personalización
Entonces el NPC "QA Tester" en el mapa cambia su color de acento a "naranja" sin interrumpir la sesión
Y el chat del "QA Tester" sigue activo y operativo
```

### Escenario 4: El usuario intenta guardar un nombre display vacío (error)

```gherkin
Dado que el usuario está editando la personalización del agente "UX/UI"
Cuando el usuario borra el nombre display y deja el campo vacío
Y confirma los cambios
Entonces el sistema no guarda los cambios
Y indica que el nombre display no puede estar vacío
Y el nombre anterior del NPC se mantiene
```

### Escenario 5: El usuario descarta los cambios antes de confirmar (alternativo)

```gherkin
Dado que el usuario modificó el nombre y el color del agente "Product Owner" en la pantalla de personalización
Cuando el usuario cancela sin confirmar
Entonces los cambios no se aplican
Y el NPC mantiene su apariencia anterior
```

## Dependencias

- **Funcionales**: ninguna US previa es bloqueante, aunque la customización tiene más sentido cuando el usuario ya tiene al menos un NPC visible (US-01).
- **Técnicas**: el conjunto de variantes de ropa y color disponibles depende de los sprites provistos por pablodelucca/pixel-agents; mecanismo de persistencia de la configuración de agentes (archivo local o store persistido).
- **De diseño**: pantalla o panel de personalización con preview del NPC; selector de variantes de ropa y color disponibles; campo editable para el nombre display.

## Fuera de alcance

- Cambio del system prompt del agente desde esta pantalla (es solo cosmético).
- Carga de sprites personalizados externos (eso es US-09).
- Personalización del escritorio o la posición del NPC en el mapa.
- Cambio del `agentId` interno del agente.
- Revertir a los valores por defecto con un solo clic (puede ser mejora futura).

## Notas para UX/UI

Es deseable que la pantalla de personalización muestre un preview en tiempo real del NPC con los cambios aplicados antes de confirmar. El usuario debe poder ver combinaciones de ropa y color antes de decidir. La lista de variantes disponibles debe ser finita y visible (no un input libre).

## Notas para Tech Lead

- La customización se almacena en la configuración del agente (no en la sesión). Al cargar el agente, el renderer debe leer los atributos customizados y aplicarlos.
- El `agentId` es inmutable; solo cambian `displayName`, `spriteVariant` y `color`.
- Ver Q-16 sobre el mecanismo de persistencia de las customizaciones.

## Métricas de éxito

- Porcentaje de usuarios que customizaron al menos un NPC.

## Preguntas abiertas

- [ ] Q-16: ¿Las customizaciones se guardan en un archivo de configuración local (ej: `~/.agent-workbench/config.json`), en localStorage del browser, o en un archivo dentro del proyecto Agent Workbench? ¿Deben sincronizarse entre distintas carpetas de trabajo o son globales a la instalación?
- [ ] Q-17: ¿Las variantes de ropa son animaciones completas (idle, typing, waiting) o solo la pose estática? Si el proyecto base ya provee las animaciones por variante, ¿están todas disponibles para todas las combinaciones de color?
