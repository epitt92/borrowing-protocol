FROM fedora:36

ARG UID=1000

RUN useradd --no-log-init --create-home -Uu ${UID} -s /bin/bash deployer && \
  dnf install --nodocs -qy dnf-utils \
  https://rpm.nodesource.com/pub_16.x/fc/36/x86_64/nodesource-release-fc36-1.noarch.rpm \
  libpq \
  openssl1.1 \
  openssl-libs && \
  dnf update --nodocs -qy && \
  dnf install --nodocs -qy \
  nodejs \
  procps \
  git

USER ${UID}

WORKDIR /app

CMD ["./docker/test.sh"]