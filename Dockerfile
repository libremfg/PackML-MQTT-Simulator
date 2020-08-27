FROM node:12-alpine

LABEL maintainer="Tom Hollingworth <tom.hollingworth@spruiktec.com>"

WORKDIR /machine

COPY package.json /machine

RUN npm install

COPY ./src/ /machine

USER node

ENV NODE_ENV=production

CMD ["node", "index.js"]
