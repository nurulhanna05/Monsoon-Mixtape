# Putting Monsoon Mixtape online (Ubuntu)

This gives the app a public web address, so the QR code in the header opens
it on anyone's phone.

## 1. Get an Ubuntu server

Any small Ubuntu 22.04 or 24.04 server works (1 GB memory is plenty). For
example a DigitalOcean droplet, an AWS Lightsail instance, or Oracle Cloud's
free tier. Make sure ports 80 and 443 are open in the provider's firewall.

Optional: point a domain name (e.g. `mixtape.example.com`) at the server's
IP address if you want `https://` and a nicer link.

## 2. Run the setup script

Log in to the server (`ssh ubuntu@<server IP>`) and run:

```bash
curl -fsSLO https://raw.githubusercontent.com/nurulhanna05/Monsoon-Mixtape/main/deploy/setup.sh
sudo bash setup.sh                       # or: sudo bash setup.sh mixtape.example.com
```

It installs Python and nginx, downloads the app to `/opt/monsoon-mixtape`,
starts it as a service that restarts by itself, and prints the address.
With a domain it also gets a free HTTPS certificate.

## 3. Updating

After pushing changes to GitHub, run the same command again on the server.

## Useful commands

```bash
sudo systemctl status monsoon-mixtape     # is it running?
sudo journalctl -u monsoon-mixtape -n 50  # recent log
```

## How the QR code knows the address

The service sets `PUBLIC_URL` (e.g. `https://mixtape.example.com/`) and the
app asks the server for it at `/share-url`. Without it, the QR code shows
whatever address the page was opened on. To change it, edit
`/etc/systemd/system/monsoon-mixtape.service`, then
`sudo systemctl daemon-reload && sudo systemctl restart monsoon-mixtape`.
