FROM node:22-alpine

WORKDIR /app
COPY --chown=node:node package.json server.cjs ./
USER node
EXPOSE 8787
CMD ["node", "server.cjs"]
