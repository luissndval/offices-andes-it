# Definition of Done (DoD)

Una historia se considera **terminada** solo si cumple TODO esto.

## Código

- [ ] Implementa **todos los criterios de aceptación**.
- [ ] Pasa **linter y formatter** sin warnings.
- [ ] Tiene **tests unitarios** con cobertura ≥ 80% sobre el código nuevo.
- [ ] Tiene **tests de integración** para los flujos críticos.
- [ ] No introduce **vulnerabilidades** (escaneo SAST en pipeline OK).
- [ ] **Code review aprobado** por al menos 1 dev distinto al autor.
- [ ] **Merge a `main`** completado, sin conflictos pendientes.

## Mobile específico

- [ ] Funciona en **iOS** (versión mínima soportada) y **Android** (API mínima soportada).
- [ ] Probado en **al menos 2 tamaños de pantalla** por plataforma.
- [ ] Sin **memory leaks** detectables en sesión de 5 minutos de uso normal.
- [ ] **Cold start** no se degrada > 5% respecto al baseline.
- [ ] Strings externalizados (i18n-ready aunque solo haya un idioma activo).
- [ ] Accesibilidad básica: `accessibilityLabel`/`contentDescription` en elementos interactivos.

## QA

- [ ] **Casos de prueba ejecutados** y todos en verde.
- [ ] Bugs **bloqueantes y mayores cerrados**. Bugs menores documentados como deuda con work item.
- [ ] **Regresión** del módulo afectado pasada.

## Despliegue

- [ ] **Desplegado en ambiente de QA**.
- [ ] **Validado por el PO** en QA (acceptance).
- [ ] **Build de release** generada y firmada.
- [ ] **Notas de release** actualizadas.

## Documentación

- [ ] **Work item de Azure DevOps** actualizado a "Done" con link al PR.
- [ ] Si cambia comportamiento documentado: **README/wiki actualizado**.
- [ ] Si cambia un contrato de API: **documentación de API actualizada**.
