#!/usr/bin/env bash
# Yuz Nazorat panel — VPS deploy/yangilash skripti.
# Ishlatish (lokal terminaldan bitta buyruq):
#   ssh root@45.92.173.191 "curl -fsSL https://raw.githubusercontent.com/Dimonbek/admin-panel/main/vps-deploy.sh | bash"
# Qayta ishga tushirsa — kodni yangilaydi, .env va ma'lumotlarni saqlaydi.

APP=/opt/yuznazorat-panel
REPO=https://github.com/Dimonbek/admin-panel.git

echo "==> 1/6 Node tekshiruvi"
node -v >/dev/null 2>&1 || { curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs; }

echo "==> 2/6 Kod (clone yoki yangilash)"
git config --global --add safe.directory "$APP" 2>/dev/null || true
if [ -d "$APP/.git" ]; then
  git -C "$APP" fetch --all --quiet
  git -C "$APP" reset --hard origin/main
else
  rm -rf "$APP"
  git clone "$REPO" "$APP"
fi
cd "$APP" || exit 1

echo "==> 3/6 Paketlar"
npm install --omit=dev

echo "==> 4/6 Sozlama (.env faqat birinchi marta yaratiladi)"
if [ ! -f "$APP/.env" ]; then
  cat > "$APP/.env" <<EOF
PORT=4100
PANEL_PAROL=$(openssl rand -hex 6)
API_KALIT=$(openssl rand -hex 24)
EOF
fi

echo "==> 5/6 systemd xizmat"
cp "$APP/yuznazorat-panel.service" /etc/systemd/system/
chown -R www-data:www-data "$APP"
systemctl daemon-reload
systemctl enable yuznazorat-panel >/dev/null 2>&1 || true
systemctl restart yuznazorat-panel

echo "==> 6/6 Port ochish"
ufw allow 4100/tcp >/dev/null 2>&1 || true

sleep 2
echo "================================================"
echo "Holat: $(systemctl is-active yuznazorat-panel)"
echo "PANEL: http://45.92.173.191:4100"
echo "Kirish parol va ilova kaliti (.env dan):"
grep -E 'PANEL_PAROL|API_KALIT' "$APP/.env"
echo "================================================"
