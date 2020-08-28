FROM node:12-alpine

LABEL maintainer="Tom Hollingworth <tom.hollingworth@spruiktec.com>"

WORKDIR /machine

COPY package.json /machine

RUN npm install

COPY --chown=node:node ./src/ /machine

USER node

ENV NODE_ENV=production

ENV NODE_OPTIONS="--max-old-space-size=20"

CMD ["node", "index.js"]
