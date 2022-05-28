FROM node:16

WORKDIR /api
COPY . .
RUN npm install node
RUN npm ci
CMD ["node", "spotifyRequests.js"]
EXPOSE 9001