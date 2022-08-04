# Global Dockerfile Arguments (in our CI can be overriden in ./.build-args)
ARG SERVICE_IMG=registry.kyso.io/docker/node
ARG SERVICE_TAG=fixme

# Production image
FROM ${SERVICE_IMG}:${SERVICE_TAG} AS service
# Set the PACKAGE_VERSION value from the args
ARG PACKAGE_VERSION=invalid
# Set the NODE_ENV value from the args
ARG NODE_ENV=production
# Export the NODE_ENV to the container environment
ENV NODE_ENV=${NODE_ENV}
# Change the workdir to the root home
WORKDIR /root
# Install package
RUN npm update --location=global npm &&\
 npm install --location=global kyso@${PACKAGE_VERSION}
# Copy entrypoint
COPY ./container/entrypoint.sh /entrypoint.sh
# Use it
ENTRYPOINT ["/entrypoint.sh"]
# Image command
CMD [""]
