# --- Build Stage ---
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

# --- Production Stage ---
FROM node:22-alpine

ENV NODE_ENV=production


WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/dist ./dist

RUN npm ci

EXPOSE 8080

ENTRYPOINT ["npm", "run", "start:prod"]
