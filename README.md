# Rubrica Web

Angular frontend for the Rubrica signature MVP.

It provides three primary experiences:

- `/login`: Auth login and session refresh;
- `/dashboard`: operator/admin document upload, request creation and invitation
  link generation;
- `/signing/:token`: authenticated review and signature of an invitation.

## Development

```bash
npm ci
npm start
```

Open `http://localhost:4200`. The development proxy sends Auth routes to port
8101 and Core routes to port 8100.

## Frontend platform

- Angular SSR with hydration and client rendering for authenticated routes;
- Angular service worker and web app manifest for installable PWA support;
- Angular ESLint through `npm run lint`;
- Bootstrap and Bootstrap Icons available globally;
- Day.js as the canonical date parsing, UTC conversion and formatting helper;
- `ngx-mask` configured globally, with reusable Brazilian, Japanese and
  international masks in `src/app/core/input-masks.ts`;
- Zod validation for SSR runtime variables.

Validate the complete frontend with:

```bash
npm run lint
npm test -- --watch=false
npm run build
```

The SSR bundle can be started after a build with:

```bash
HOST=0.0.0.0 PORT=4000 npm run serve:ssr:rubrica-web
```

Angular validates SSR request hosts. Set `NG_ALLOWED_HOSTS` for a production
domain when it is not one of the defaults declared in `angular.json`.

## Production container

`Dockerfile` continues to build the browser output and serve it through Nginx,
preserving the current Compose gateway and its Auth/Core proxies. The same build
also emits the SSR server bundle, ready for a later dedicated Node deployment
behind the production Nginx gateway.
