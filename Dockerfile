FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.30.4-alpine
COPY nginx.local.conf /etc/nginx/conf.d/default.conf
RUN rm -rf /usr/share/nginx/html/*
COPY --from=build /app/dist/rubrica-web/browser /usr/share/nginx/html
RUN test -f /usr/share/nginx/html/index.csr.html \
    && test -f /usr/share/nginx/html/index.html \
    && test -f /usr/share/nginx/html/contact/index.html \
    && test -f /usr/share/nginx/html/enterprise/index.html \
    && grep -q "Contact" /usr/share/nginx/html/contact/index.html
EXPOSE 80
