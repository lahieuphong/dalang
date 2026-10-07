# Deploy Dalang lên https://dalang.hongvan.net

Dalang là website tĩnh: chỉ cần upload thư mục build, không cần Node.js hay database trên server.

## 1. Yêu cầu bắt buộc

- **HTTPS.** Trình duyệt chỉ cho dùng camera trên HTTPS. Hãy bật SSL cho
  subdomain trước khi deploy (cPanel: *SSL/TLS Status → Run AutoSSL*, hoặc
  Let's Encrypt).
- Server phải trả file `.wasm` với MIME `application/wasm`. File `.htaccess` đi
  kèm đã cấu hình sẵn việc này cho Apache/LiteSpeed.

## 2. Build

```bash
yarn install
yarn build
```

Kết quả nằm trong thư mục `dist/`, khoảng 31 MB, phần lớn là model và runtime
nhận diện tay:

```
dist/
├── .htaccess              ← cấu hình server (file ẩn, KHÔNG được bỏ sót)
├── index.html
├── favicon.svg, apple-touch-icon.png, og-image.jpg
├── assets/                ← JS/CSS có hash trong tên file
│   └── .htaccess          ← cache dài hạn cho thư mục này
├── mediapipe/wasm/        ← runtime nhận diện tay
└── models/hand_landmarker.task
```

## 3. Upload (hosting dùng Apache hoặc LiteSpeed, như cPanel / DirectAdmin)

1. Tạo subdomain `dalang.hongvan.net` và ghi lại thư mục gốc (document root)
   của nó, ví dụ `public_html/dalang.hongvan.net`.
2. Upload **toàn bộ nội dung bên trong** `dist/` vào thư mục gốc đó. Không
   upload chính thư mục `dist`: sau khi upload, `index.html` phải nằm ngay
   trong thư mục gốc.
3. Kiểm tra cả hai file ẩn `.htaccess` (ở gốc và trong `assets/`) đã lên
   server. Trong File Manager của cPanel, bật *Settings → Show Hidden Files*
   để thấy chúng.

Cách nhanh hơn: upload một file nén chứa nội dung `dist/`, rồi dùng
*Extract* ngay trong File Manager.

## 4. Kiểm tra sau khi deploy

- [ ] `http://dalang.hongvan.net` tự chuyển sang `https://`.
- [ ] Trang hiện sân khấu và hai con rối. Bấm **Enable camera**, cho phép camera, ô trạng thái hiện *Camera on · raise both hands*.
- [ ] Giơ hai tay lên: hai con rối được nâng lên và cử động.
- [ ] DevTools → Network: file `vision_wasm_internal.wasm` có `Content-Type: application/wasm`.
- [ ] DevTools → Console: không có lỗi *Content Security Policy*.

## 5. Cập nhật phiên bản mới

Chạy lại `yarn build` rồi upload đè. `index.html` luôn được kiểm tra lại
(`no-cache`), còn file trong `assets/` có hash trong tên, nên người xem nhận
bản mới ngay mà không cần xóa cache.

## 6. Nếu server dùng Nginx

Nginx không đọc `.htaccess`, nên cần thêm cấu hình tương đương. Lưu ý:
`add_header` trong một `location` sẽ thay thế các header ở cấp `server`, vì
vậy các header bảo mật được tách ra một file riêng và `include` lại ở từng nơi.

`/etc/nginx/snippets/dalang-headers.conf`:

```nginx
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header Permissions-Policy "camera=(self), microphone=(), geolocation=(), payment=()" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'wasm-unsafe-eval' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob: mediastream:; connect-src 'self' https://cdn.jsdelivr.net https://storage.googleapis.com; worker-src 'self' blob:; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'self'" always;
```

Site config:

```nginx
server {
    listen 80;
    server_name dalang.hongvan.net;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name dalang.hongvan.net;
    # ssl_certificate / ssl_certificate_key: theo chứng chỉ của bạn (ví dụ certbot)

    root /var/www/dalang.hongvan.net;   # nơi chứa nội dung dist/
    index index.html;

    gzip on;
    gzip_types text/css application/javascript text/javascript application/json image/svg+xml application/wasm;

    location = /index.html {
        include snippets/dalang-headers.conf;
        add_header Cache-Control "no-cache";
    }

    location /assets/ {
        include snippets/dalang-headers.conf;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location ~* \.wasm$ {
        types { }
        default_type application/wasm;
        include snippets/dalang-headers.conf;
        add_header Cache-Control "public, max-age=2592000";
    }

    location ~* \.task$ {
        types { }
        default_type application/octet-stream;
        include snippets/dalang-headers.conf;
        add_header Cache-Control "public, max-age=2592000";
    }

    location / {
        include snippets/dalang-headers.conf;
        try_files $uri $uri/ =404;
    }
}
```

## 7. Tùy chọn

- Khi HTTPS đã chạy ổn định, có thể bật HSTS: bỏ dấu `#` ở dòng
  `Strict-Transport-Security` trong `.htaccess`.
- Ảnh chia sẻ khi dán link (Facebook, Zalo…) là `og-image.jpg`, đã trỏ sẵn tới
  `https://dalang.hongvan.net/og-image.jpg`.
