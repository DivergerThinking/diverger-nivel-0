# diverger-nivel-0

Repo de pruebas del nivel 0 del harness Diverger ExP (préstamo de equipos mínimo). Lo crea EN-S0-01; la aplicación la genera el propio harness.

- `secretos.yml`: análisis de secretos con gitleaks; un PR con una credencial no se puede integrar.
- `worker-humo.yml`: pruebas a mano del entorno: el worker con el secreto `ANTHROPIC_API_KEY`, el acceso a GCP, la telemetría, la identidad del harness y, con `prueba: codeowners`, la protección de la configuración.
  Con `prueba: despliegue-worker`, que un worker no puede desplegar en staging (EN-FM-04): un job como el de un worker intenta desplegar sin credenciales y con un token de GitHub a nombre de la cuenta de despliegue, y los dos intentos fallan; staging sigue con la misma revisión. La cuenta de despliegue solo acepta los jobs del environment `staging`, que solo admite `main` ([ADR 0015](https://github.com/DivergerThinking/Diverger-ExP-Harness/blob/main/docs/adr/0015-despliegue-en-staging-con-cloud-deploy.md)).
- `.github/CODEOWNERS`: el titular es propietario de `.diverger/settings.json` y del propio CODEOWNERS. El ruleset `codeowners` (en `infra/github/` del harness, [ADR 0014](https://github.com/DivergerThinking/Diverger-ExP-Harness/blob/main/docs/adr/0014-codeowners-y-ruleset-de-la-configuracion.md)) impide cambiarlos con un push directo y exige su aprobación en la PR, también en modo yolo.

La preparación de los entornos está en `infra/entornos/LEEME.md` de [Diverger-ExP-Harness](https://github.com/DivergerThinking/Diverger-ExP-Harness).

Es público a propósito: con el plan Free de GitHub, las protecciones de rama solo funcionan en repositorios públicos ([ADR 0001](https://github.com/DivergerThinking/Diverger-ExP-Harness/blob/main/docs/adr/0001-repos-de-prueba-publicos.md), en un repositorio privado). No contiene datos ni credenciales.
