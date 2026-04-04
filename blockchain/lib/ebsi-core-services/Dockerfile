FROM node:24.14.1-alpine3.23@sha256:01743339035a5c3c11a373cd7c83aeab6ed1457b55da6a69e014a95ac4e4700b

WORKDIR /app

# Install build dependencies
RUN apk update && \
  apk upgrade && \
  apk add --no-cache build-base git py3-pip

# Install all the dependencies
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Copy pnpm-lock.yaml + pnpm-workspace.yaml
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches patches

# Fetch dependencies
RUN --mount=type=cache,target=/pnpm/store pnpm fetch

# Copy all other files
COPY . .

# Install dependencies and build all projects
RUN \
  --mount=type=cache,target=/app/.nx \
  --mount=type=cache,target=/pnpm/store \
  pnpm install --frozen-lockfile --offline --reporter=silent && \
  pnpm run build:all && \
  rm -rf ./**/node_modules && \
  corepack cache clear

USER node
