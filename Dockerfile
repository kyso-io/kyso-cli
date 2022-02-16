# Global Dockerfile Arguments (in our CI can be overriden in ./.build-args)
ARG BUILDER_IMG=registry.kyso.io/docker/node-builder
ARG BUILDER_TAG=latest

# Builder image
FROM ${BUILDER_IMG}:${BUILDER_TAG} AS builder
# Change the working directory to /root
WORKDIR /root
# Copy files required to build the application
COPY package*.json tsconfig.json ./
# Execute `npm ci` (not install)
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc,required npm install
