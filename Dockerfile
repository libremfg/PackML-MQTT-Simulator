FROM node:12-alpine

WORKDIR /machine

COPY package.json /machine

RUN npm install

COPY ./src/ /machine

USER node

CMD node index.js
