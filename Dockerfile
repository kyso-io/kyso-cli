ARG SERVICE_IMG=node
ARG SERVICE_TAG=16.16.0-alpine3.16

FROM ${SERVICE_IMG}:${SERVICE_TAG}

# Set the PACKAGE_VERSION value from the args (if not defined the build fails)
ARG PACKAGE_VERSION=invalid

# Install package
RUN apk update &&\
 apk add --no-cache coreutils curl git &&\
 rm -rf /var/cache/apk/* &&\
 npm update --location=global npm &&\
 npm install --location=global kyso@${PACKAGE_VERSION}
# Image command
CMD ["kyso"]
