#!/bin/sh
# Runs on the server. Takes a `git archive` tarball on stdin, so no GitHub access is needed there:
#   git archive --format=tar HEAD | ssh root@109.205.177.244 "sh /opt/upkorean/deploy/update.sh"
# .env, data/, audio/, node_modules/ and the npm cache are kept.
set -e
APP=/opt/upkorean
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

tar -x -C "$TMP"
rsync -a --delete --exclude=/.env --exclude=/data/ --exclude=/audio/ --exclude=/node_modules/ --exclude=/.npm/ "$TMP"/ "$APP"/
chown -R upkorean:upkorean "$APP"

# ssh runs the copy of this script that is already on the server, so a change to the rsync line above only
# takes effect on the deploy AFTER the one that delivers it. That is how the clips were wiped once: the
# tarball had stopped carrying audio/ while the running script still had no exclude for it. Say so loudly
# rather than restarting into a site whose narrator is gone.
CLIPS=$(ls "$APP"/audio/words 2>/dev/null | wc -l)
if [ "$CLIPS" -lt 1000 ]; then
  echo "DIQQAT: /opt/upkorean/audio/words da $CLIPS ta fayl (1000 kutilgan) — diktor audiosi o'chib ketgan." >&2
  echo "Tiklash:  cmd /c \"tar -cf - audio | ssh root@... tar -xf - -C /opt/upkorean\"" >&2
  echo "  keyin:  chown -R upkorean:upkorean /opt/upkorean/audio && systemctl restart upkorean" >&2
fi

cd "$APP"
sudo -u upkorean npm ci --omit=dev --no-audit --no-fund
systemctl restart upkorean
sleep 2
systemctl is-active upkorean
