# Global Dockerfile Arguments (in our CI can be overriden in ./.build-args)
ARG SERVICE_IMG=registry.kyso.io/docker/node
ARG SERVICE_TAG=fixme
# Base image (SERVICE_TAG must be overriden when building)
FROM ${SERVICE_IMG}:${SERVICE_TAG}
# Set the PACKAGE_VERSION value from the args (if not defined the build fails)
ARG PACKAGE_VERSION=invalid
# Install package
RUN npm update --location=global npm &&\
 npm install --location=global kyso@${PACKAGE_VERSION}
# Image command
CMD ["kyso"]
