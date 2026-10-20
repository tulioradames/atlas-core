FROM node:22-alpine

WORKDIR /app
COPY --chown=node:node package.json ./
RUN npm install --omit=dev --ignore-scripts && npm cache clean --force
COPY --chown=node:node src ./src
COPY --chown=node:node tests ./tests
USER node
EXPOSE 8790
CMD ["node", "src/server.cjs"]
