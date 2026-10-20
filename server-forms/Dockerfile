FROM node:22-alpine

WORKDIR /app
COPY --chown=node:node server-forms/package.json ./server-forms/
RUN cd server-forms && npm install --omit=dev --ignore-scripts && npm cache clean --force
COPY --chown=node:node server-forms ./server-forms
COPY --chown=node:node public-forms ./public-forms
COPY --chown=node:node assets/brand ./assets/brand
USER node
EXPOSE 8788
CMD ["node", "server-forms/server.cjs"]
