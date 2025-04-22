FROM node:20-alpine

# Labels
LABEL maintainer="tom@rhize.com"
LABEL org.opencontainers.image.authors="tom@rhize.com"
LABEL org.opencontainers.image.source="https://github.com/libremfg/PackML-MQTT-Simulator"
LABEL org.opencontainers.image.url="https://www.libremfg.com/"
LABEL org.opencontainers.image.vendor="Libre Technologies Inc"
LABEL org.opencontainers.image.version="2.1.0"

WORKDIR /machine

COPY package.json /machine

RUN npm install

COPY --chown=node:node ./src/ /machine

USER node

ENV NODE_ENV=production

ENV NODE_OPTIONS="--max-old-space-size=20"

CMD ["node", "index.js"]
