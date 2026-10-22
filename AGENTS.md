# Rúbrica frontend

The canonical environment orchestration lives in the sibling `rubrica-back` repository.

- `make dev` and `make dev-docker` run this Angular application bare metal with hot reload.
- Staging and production build the frontend in Docker through their respective backend Make targets.
- Do not introduce a frontend-only `.env.production` workflow or production secrets.
- Keep `proxy.conf.json` aligned with the bare-metal Core/Auth ports documented by the backend.
- Run `npm run lint`, `npm test -- --watch=false` and the relevant build/E2E checks before delivery.
- Never require rebuilding a frontend container for the normal development loop.
