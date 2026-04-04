# Create reference to core-services
# hadolint ignore=DL3006 # core-services-base is defined in docker-compse.yml
FROM core-services-base AS builder

# Create deployment
# See https://pnpm.io/cli/deploy
FROM node:24.14.1-alpine3.23@sha256:01743339035a5c3c11a373cd7c83aeab6ed1457b55da6a69e014a95ac4e4700b AS service-builder
WORKDIR /app
COPY --from=builder /app/ ./
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
RUN --mount=type=cache,target=/pnpm/store \
  pnpm --filter="@ebsiint-api/authorisation-api-v4" deploy --prod --no-optional pruned

# Create tiny runtime image
# See https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md#smaller-images-without-npmyarn
FROM alpine:3.23@sha256:25109184c71bdad752c8312a8623239686a9a2071e8825f20acb8f2198c3f659
WORKDIR /usr/src/app
# Add required binaries and create "node" user
RUN --mount=type=cache,target=/var/cache/apk,sharing=locked \
  apk add libstdc++ dumb-init && \
  apk update && apk upgrade && \
  addgroup -g 1000 node && adduser -u 1000 -G node -s /bin/sh -D node && \
  chown node:node ./
COPY --from=service-builder /usr/local/bin/node /usr/local/bin/
COPY --from=service-builder /usr/local/bin/docker-entrypoint.sh /usr/local/bin/
ENTRYPOINT ["docker-entrypoint.sh"]
# Switch to "node" user
USER node
# Only import what's necessary
COPY --from=service-builder /app/pruned/api api
COPY --from=service-builder /app/pruned/dist dist
COPY --from=service-builder /app/pruned/node_modules node_modules
# Create .env.default file with docker tag
ARG DOCKER_TAG
RUN echo "DOCKER_TAG=$DOCKER_TAG" >> .env.default
# Define environment variables
ENV NODE_ENV=production
# Run with dumb-init to not start node with PID=1, since Node.js was not designed to run as PID 1
CMD [ "dumb-init", "node", "dist/main.js" ]
