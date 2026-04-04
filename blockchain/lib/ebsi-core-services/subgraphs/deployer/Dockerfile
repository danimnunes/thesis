# Create reference to core-services
# hadolint ignore=DL3006 # core-services-base is defined in docker-compse.yml
FROM core-services-base AS builder

FROM node:24.14.1-alpine3.23@sha256:01743339035a5c3c11a373cd7c83aeab6ed1457b55da6a69e014a95ac4e4700b

# Install build dependencies
RUN apk update && \
  apk upgrade && \
  apk add --no-cache build-base git py3-pip

WORKDIR /app

# Copy root package.json + pnpm-lock.yaml + pnpm-workspace.yaml + patches + postinstall script
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/patches patches
COPY --from=builder /app/scripts/postinstall.mjs ./scripts/postinstall.mjs

# Copy contracts
COPY --from=builder /app/contracts/bootstrap-v2 ./contracts/bootstrap-v2
COPY --from=builder /app/contracts/did-registry-v5 ./contracts/did-registry-v5
COPY --from=builder /app/contracts/timestamp-v4 ./contracts/timestamp-v4
COPY --from=builder /app/contracts/track-and-trace ./contracts/track-and-trace
COPY --from=builder /app/contracts/trusted-contracts-registry-v1 ./contracts/trusted-contracts-registry-v1
COPY --from=builder /app/contracts/trusted-issuers-registry-v5 ./contracts/trusted-issuers-registry-v5
COPY --from=builder /app/contracts/trusted-policies-registry-v3 ./contracts/trusted-policies-registry-v3
COPY --from=builder /app/contracts/trusted-schemas-registry-v3 ./contracts/trusted-schemas-registry-v3

# Copy subgraphs
COPY --from=builder /app/subgraphs/core-services ./subgraphs/core-services
COPY --from=builder /app/subgraphs/estat ./subgraphs/estat

# Install all the dependencies
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
RUN \
  --mount=type=cache,target=/pnpm/store \
  pnpm install --frozen-lockfile --reporter=silent && \
  corepack cache clear

RUN chown -R node:node /app
USER node

# Deploy subgraphs
CMD [ "sh", "-c", "pnpm exec nx run-many -t deploy -p @ebsiint-subgraph/* && sleep inf" ]
