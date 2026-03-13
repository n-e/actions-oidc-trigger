FROM node:24.14.0-trixie-slim AS base

ARG TAG

RUN npm i -g actions-oidc-trigger@$(echo -n "$TAG" | cut -c '2-')


FROM base AS slim

RUN groupadd app && useradd app -g app -m

USER app

ENTRYPOINT [ "actions-oidc-trigger" ]

FROM base AS docker-cli

# In this image we don't switch to the app user as we need to be root to access the docker socket

COPY docker/add-docker-to-apt.sh ./

RUN ./add-docker-to-apt.sh && rm add-docker-to-apt.sh

# apt list --all-versions docker-ce
ARG VERSION_STRING=5:29.2.1-1~debian.13~trixie

RUN apt update \
    && apt install -y \
    docker-ce-cli=$VERSION_STRING \
    git \
    && rm -rf /var/lib/apt/lists/*

ENTRYPOINT [ "actions-oidc-trigger" ]
