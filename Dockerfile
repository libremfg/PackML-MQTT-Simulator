FROM node:12-alpine

# Labels
LABEL maintainer="tom.hollingworth@spruiktec.com"
LABEL org.opencontainers.image.authors="tom.hollingworth@spruiktec.com"
LABEL org.opencontainers.image.source="https://github.com/Spruik/PackML-MQTT-Simulator"
LABEL org.opencontainers.image.url="https://spruiktec.com/"
LABEL org.opencontainers.image.vendor="Spruik Technologies LLC"
LABEL org.opencontainers.image.version="1.0.9"

WORKDIR /machine

COPY package.json /machine

RUN npm install

COPY --chown=node:node ./src/ /machine

USER node

ENV NODE_ENV=production

ENV NODE_OPTIONS="--max-old-space-size=20"

CMD ["node", "index.js"]
