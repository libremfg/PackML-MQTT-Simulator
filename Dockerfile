FROM node:12

WORKDIR /machine

COPY package.json /machine

RUN npm install

COPY . /machine

CMD node index.js
