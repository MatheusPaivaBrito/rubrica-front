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

## Production container

`Dockerfile` builds the Angular static application and Nginx serves it. The
backend repository's Compose file runs it as `web`, proxying Auth and Core under
the same origin.
