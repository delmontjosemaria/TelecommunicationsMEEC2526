FROM mcr.microsoft.com/devcontainers/javascript-node:1-22-bookworm

# Install additional tools useful for development (skip if network unavailable)
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends \
        curl \
        wget \
        git \
        vim \
        nano \
    && apt-get clean -y && rm -rf /var/lib/apt/lists/* \
    || true

# Install MongoDB Shell via npm (works without apt network access)
RUN npm install -g mongosh || true

# Install global npm packages for development
RUN su node -c "npm install -g \
    @angular/cli@19 \
    typescript@5.4 \
    ts-node \
    nodemon \
    concurrently"

# Set up working directory
WORKDIR /workspaces

# Configure git for the development environment
RUN git config --global --add safe.directory /workspaces