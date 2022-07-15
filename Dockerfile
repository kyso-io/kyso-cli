# Global Dockerfile Arguments (in our CI can be overriden in ./.build-args)
ARG BUILDER_IMG=registry.kyso.io/docker/node-builder
ARG BUILDER_TAG=latest

# Builder image
FROM ${BUILDER_IMG}:${BUILDER_TAG} AS builder
# Change the working directory to /root
WORKDIR /root
# Copy files required to build the application
COPY package*.json tsconfig.json ./
# Add the curl package to publish the package
RUN apt-get update && apt-get install -y curl ca-certificates nsis p7zip-full\
 xz-utils --no-install-recommends && rm -rf /var/lib/apt/lists/*
# Execute `npm ci` (not install)
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc,required npm install
