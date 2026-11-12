FROM node:20-alpine
WORKDIR /app
COPY package.json ./package.json
COPY starkov-relay.mjs ./starkov-relay.mjs
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["node", "starkov-relay.mjs"]
