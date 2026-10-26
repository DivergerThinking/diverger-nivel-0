# diverger-nivel-0

Repo de pruebas del nivel 0 del harness Diverger ExP (préstamo de equipos mínimo). Lo crea EN-S0-01; la aplicación la genera el propio harness.

- `secretos.yml`: análisis de secretos con gitleaks; un PR con una credencial no se puede integrar.
- `worker-humo.yml`: prueba a mano de que un worker se autentica con el secreto `ANTHROPIC_API_KEY`.

La preparación de los entornos está en `infra/entornos/LEEME.md` de [Diverger-ExP-Harness](https://github.com/DivergerThinking/Diverger-ExP-Harness).

Es público a propósito: con el plan Free de GitHub, las protecciones de rama solo funcionan en repositorios públicos ([ADR 0001](https://github.com/DivergerThinking/Diverger-ExP-Harness/blob/main/docs/adr/0001-repos-de-prueba-publicos.md), en un repositorio privado). No contiene datos ni credenciales.
