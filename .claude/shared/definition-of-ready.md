# Definition of Ready (DoR)

Una historia entra al Sprint Planning **solo si cumple TODO esto**.

## Checklist

- [ ] Tiene **título claro** en formato `Como <rol>, quiero <acción>, para <beneficio>`.
- [ ] Tiene **descripción funcional** completa (no más de 1 página).
- [ ] Tiene **criterios de aceptación** en formato Gherkin (Given/When/Then), mínimo 1 escenario feliz + 1 alternativo + 1 de error.
- [ ] Tiene **mockups o wireframes** adjuntos (si tiene UI), aprobados por UX.
- [ ] Tiene **dependencias técnicas identificadas** (APIs, servicios, librerías).
- [ ] Tiene **estimación** del equipo (story points o talla S/M/L).
- [ ] No supera **8 story points** (si los supera, se parte).
- [ ] Tiene **work item de Azure DevOps** creado y vinculado.
- [ ] El **PO confirmó la prioridad**.
- [ ] Si toca datos sensibles: **revisión de seguridad/privacidad** marcada.

## Antipatrones que la sacan de Ready

- Criterios de aceptación que dicen "según se discuta" o "como acordemos".
- Mockups en estado "borrador" o sin aprobación.
- Dependencias de servicios que aún no existen sin un mock acordado.
- Historia que en realidad es una épica disfrazada.
