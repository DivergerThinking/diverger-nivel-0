# Imagen para Cloud Run: se construye con todas las dependencias y se ejecuta solo con las de producción.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-slim
# npm y corepack no hacen falta para ejecutar la aplicación, y sus dependencias son las que más
# vulnerabilidades traen a la imagen: se quitan.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
# Los parches de Debian que la imagen base aún no trae (harness#646, CVE-2026-109518 de apt): el job
# imagen del CI falla con un HIGH corregido, y sin él no hay despliegue.
RUN apt-get update && apt-get upgrade -y --no-install-recommends && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production PORT=8080
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
USER node
EXPOSE 8080
CMD ["node", "dist/server/app/main.js"]
