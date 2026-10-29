# VPS'ga joylash (deploy)

Panel — Node.js ilovasi. VPS (Ubuntu/Debian) uchun qadamlar.

## 1. Node o'rnatish (bir marta)

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v   # v22.x bo'lsin
```

## 2. Fayllarni yuklash

Loyihani `/opt/yuznazorat-panel` ga ko'chiring (node_modules'siz). Masalan kompyuterdan:

```bash
# node_modules, data, uploads ni yubormaymiz — .gitignore shuni ta'minlaydi
rsync -av --exclude node_modules --exclude data --exclude uploads \
  ./  user@VPS_IP:/opt/yuznazorat-panel/
```

VPS'da:

```bash
cd /opt/yuznazorat-panel
npm install --omit=dev
```

## 3. Sozlama (.env)

```bash
cp .env.example .env
nano .env
```

- `PANEL_PAROL` — brauzerdan kirish paroli (albatta o'rnating!)
- `API_KALIT` — Android ilova davomat yuborishda ishlatadigan maxfiy kalit
- `PORT` — port (standart 4100)

## 4. Ishga tushirish — systemd

```bash
sudo cp yuznazorat-panel.service /etc/systemd/system/
sudo chown -R www-data:www-data /opt/yuznazorat-panel
sudo systemctl daemon-reload
sudo systemctl enable --now yuznazorat-panel
sudo systemctl status yuznazorat-panel      # ishlayotganini tekshirish
```

Jurnal: `journalctl -u yuznazorat-panel -f`

## 5. Tashqaridan kirish

**Oddiy (port ochish):**
```bash
sudo ufw allow 4100/tcp
```
Kirish: `http://VPS_IP:4100` (parol so'raydi).

**Tavsiya (domen + HTTPS, nginx):**
```nginx
server {
  server_name panel.sizningdomen.uz;
  location / { proxy_pass http://127.0.0.1:4100; proxy_set_header Host $host; }
  client_max_body_size 20M;   # rasm yuklash uchun
}
```
Keyin: `sudo certbot --nginx -d panel.sizningdomen.uz`

## Yangilash

```bash
cd /opt/yuznazorat-panel
# yangi fayllarni rsync bilan ko'chiring, keyin:
npm install --omit=dev
sudo systemctl restart yuznazorat-panel
```

## Eslatma
- `data/` (ma'lumot) va `uploads/` (rasmlar) VPS'da saqlanadi — zaxira oling.
- Android ilova davomatni `POST http://VPS_IP:4100/api/davomat` ga, sarlavhada `X-API-Key: <API_KALIT>` bilan yuboradi.
