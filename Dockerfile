# Global Dockerfile Arguments (in our CI can be overriden in ./.build-args)
ARG SERVICE_IMG=registry.kyso.io/docker/node
ARG SERVICE_TAG=latest

# Production image
FROM ${SERVICE_IMG}:${SERVICE_TAG} AS service
# Set the PACKAGE_VERSION value from the args
ARG UPDATED_PACKAGE_VERSION=invalid
# Set the NODE_ENV value from the args
ARG NODE_ENV=production
# Export the NODE_ENV to the container environment
ENV NODE_ENV=${NODE_ENV}
# Change the workdir to the root home
WORKDIR /root
# Install package
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc,required\
 npm install -g @kyso-io/kyso-cli@$UPDATED_PACKAGE_VERSION
# Container command
CMD ["/bin/sh"]
