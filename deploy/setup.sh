#!/usr/bin/env bash
# Put Monsoon Mixtape online on a fresh Ubuntu server (22.04 or 24.04).
#
#   sudo bash setup.sh                      # http://<server IP>/
#   sudo bash setup.sh mixtape.example.com  # https://mixtape.example.com/ (domain must point here)
#
# Safe to run again: it updates the code and restarts the app.
set -euo pipefail

DOMAIN="${1:-}"
REPO="https://github.com/nurulhanna05/Monsoon-Mixtape.git"
BRANCH="${BRANCH:-main}"
DIR=/opt/monsoon-mixtape
USER_NAME=mixtape

if [[ $EUID -ne 0 ]]; then
  echo "Run with sudo: sudo bash $0 $DOMAIN" >&2
  exit 1
fi

echo "== Installing Python, nginx and git"
apt-get update -q
apt-get install -y -q python3 python3-venv git nginx curl

echo "== Getting the code ($BRANCH)"
id -u "$USER_NAME" >/dev/null 2>&1 || useradd --system --home "$DIR" --shell /usr/sbin/nologin "$USER_NAME"
if [[ -d "$DIR/.git" ]]; then
  git -C "$DIR" fetch -q origin "$BRANCH"
  git -C "$DIR" checkout -q "$BRANCH"
  git -C "$DIR" reset -q --hard "origin/$BRANCH"
else
  git clone -q --branch "$BRANCH" "$REPO" "$DIR"
fi
mkdir -p "$DIR/backend/cache"  # NASA POWER answers are saved here
chown -R "$USER_NAME:$USER_NAME" "$DIR"

echo "== Python packages"
sudo -u "$USER_NAME" python3 -m venv "$DIR/.venv"
sudo -u "$USER_NAME" "$DIR/.venv/bin/pip" install -q -r "$DIR/requirements.txt"

# The address the QR code in the app points at.
if [[ -n "$DOMAIN" ]]; then
  PUBLIC_URL="https://$DOMAIN/"
else
  PUBLIC_URL="http://$(curl -4 -s https://api.ipify.org || hostname -I | awk '{print $1}')/"
fi

echo "== App service (PUBLIC_URL=$PUBLIC_URL)"
sed -e "s#__DIR__#$DIR#g" -e "s#__USER__#$USER_NAME#g" -e "s#__PUBLIC_URL__#$PUBLIC_URL#g" \
  "$DIR/deploy/monsoon-mixtape.service" > /etc/systemd/system/monsoon-mixtape.service
systemctl daemon-reload
systemctl enable -q monsoon-mixtape
systemctl restart monsoon-mixtape

echo "== nginx"
sed -e "s#__DOMAIN__#${DOMAIN:-_}#g" "$DIR/deploy/nginx.conf" > /etc/nginx/sites-available/monsoon-mixtape
ln -sf /etc/nginx/sites-available/monsoon-mixtape /etc/nginx/sites-enabled/monsoon-mixtape
rm -f /etc/nginx/sites-enabled/default
nginx -t -q
systemctl reload nginx

# Let web traffic through if the firewall is on.
if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow -q "Nginx Full"
fi

if [[ -n "$DOMAIN" ]]; then
  echo "== HTTPS certificate for $DOMAIN"
  apt-get install -y -q certbot python3-certbot-nginx
  certbot --nginx -n --agree-tos --register-unsafely-without-email --redirect -d "$DOMAIN"
fi

echo
echo "Done. Monsoon Mixtape is at $PUBLIC_URL"
