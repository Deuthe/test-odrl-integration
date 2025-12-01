FROM node:20-alpine
WORKDIR /app

# Copy package.json and install dependencies
COPY package.json .
RUN npm install

# Copy the rest of the application
COPY server.js .

EXPOSE 3000
CMD ["node", "server.js"]
