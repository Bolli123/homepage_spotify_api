FROM node:16

WORKDIR /src
COPY ./src .
RUN npm install node
RUN npm ci
CMD ["node", "spotifyRequests.js"]
EXPOSE 9001