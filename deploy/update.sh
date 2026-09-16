#!/bin/sh
# Runs on the server. Takes a `git archive` tarball on stdin, so no GitHub access is needed there:
#   git archive --format=tar HEAD | ssh root@109.205.177.244 "sh /opt/upkorean/deploy/update.sh"
# .env, data/ and node_modules/ are kept.
set -e
APP=/opt/upkorean
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

tar -x -C "$TMP"
rsync -a --delete --exclude=/.env --exclude=/data/ --exclude=/node_modules/ "$TMP"/ "$APP"/
chown -R upkorean:upkorean "$APP"
cd "$APP"
sudo -u upkorean npm ci --omit=dev --no-audit --no-fund
systemctl restart upkorean
sleep 2
systemctl is-active upkorean
