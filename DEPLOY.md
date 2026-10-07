# Deploy Dalang lên https://dalang.hongvan.net

Dalang là website tĩnh: chỉ cần upload thư mục build, không cần Node.js hay
database trên server. Server hiện tại của `dalang.hongvan.net` là **IIS
(Windows)** và đã tự chuyển HTTP sang HTTPS.

## 1. Build

```bash
yarn install
yarn build
```

Kết quả nằm trong thư mục `dist/`, khoảng 43 MB, phần lớn là model và runtime
nhận diện tay. Người xem không tải hết chừng đó: trình duyệt chỉ lấy một bản
runtime phù hợp (khoảng 12 MB) cộng với model (khoảng 8 MB).

```
dist/
├── index.html
├── web.config             ← cấu hình cho IIS (bắt buộc trên server hiện tại)
├── .htaccess              ← cấu hình cho Apache/LiteSpeed (IIS bỏ qua file này)
├── favicon.svg, apple-touch-icon.png, og-image.jpg
├── assets/                ← JS/CSS có hash trong tên file
├── mediapipe/wasm/        ← runtime nhận diện tay (6 file, phải upload đủ)
└── models/hand_landmarker.task
```

## 2. Upload: mọi file phải nằm ở THƯ MỤC GỐC của website

> **Lỗi hay gặp:** giải nén vào bên trong thư mục con (ví dụ đang đứng trong
> `assets/` khi bấm Extract). Khi đó trang hiện nền đen trống: `index.html` cũ
> ở gốc trỏ tới các file JS/CSS không còn tồn tại.

1. Mở File Manager của hosting và vào **thư mục gốc** của
   `dalang.hongvan.net` (thường tên là `httpdocs`, `wwwroot` hoặc
   `dalang.hongvan.net`). Đó là nơi chứa `index.html` hiện tại.
2. **Xóa toàn bộ nội dung cũ** trong thư mục gốc: `index.html`, `assets/`,
   `mediapipe/`, `models/`, các file ảnh, `.htaccess`, `web.config`…
3. Vẫn đứng ở thư mục gốc, upload file nén rồi bấm **Extract** ngay tại đó.
4. Sau khi giải nén, thư mục gốc phải có ngay `index.html`, `web.config` và
   thư mục `assets/`. Nếu thấy `assets/assets/` hoặc
   `dalang-production/index.html` thì nghĩa là đã giải nén sai chỗ.

## 3. Kiểm tra sau khi deploy

- [ ] Mở `https://dalang.hongvan.net`: trang hiện sân khấu và hai con rối (nền nâu, không phải nền đen trống).
- [ ] Bấm **Enable camera**, cho phép camera, ô trạng thái hiện *Camera on · raise both hands*.
- [ ] Giơ hai tay lên: hai con rối được nâng lên và cử động.
- [ ] `https://dalang.hongvan.net/models/hand_landmarker.task` tải về được (không báo 404).
- [ ] DevTools → Network: `vision_wasm_internal.wasm` có `Content-Type: application/wasm`.
- [ ] `https://dalang.hongvan.net/mediapipe/wasm/vision_wasm_module_internal.js` mở được (không báo 404). Bản này dùng khi máy người xem yếu và việc nhận diện tay được chuyển sang Web Worker.
- [ ] Mở `https://dalang.hongvan.net/?debug=1`: bảng số liệu hiện `cameraFPS`, `inferenceMs`, `inputAgeMs`, `renderFPS`.
- [ ] DevTools → Console: không có lỗi đỏ.

Nếu trang chủ báo **500 Internal Server Error** ngay sau khi upload, hosting
đang khóa một mục trong `web.config`. Thử xóa khối `<httpProtocol>` trước
(header bảo mật); site vẫn chạy được, chỉ thiếu các header đó.

## 4. Cập nhật phiên bản mới

Chạy lại `yarn build`, rồi lặp lại **bước 2**: xóa nội dung cũ, upload và
giải nén ở thư mục gốc. `index.html` luôn được kiểm tra lại (`no-cache`),
còn file trong `assets/` có hash trong tên, nên người xem nhận bản mới ngay.

## 5. Nếu chuyển sang hosting khác

- **Apache / LiteSpeed (cPanel, DirectAdmin):** dùng `.htaccess` có sẵn trong
  build. Nó tự chuyển HTTPS, đặt MIME `.wasm`, nén file, thêm header bảo mật
  và cache. Nhớ bật *Show Hidden Files* để thấy file này.
- **Nginx:** không đọc `.htaccess` hay `web.config`, nên cần cấu hình tương
  đương bên dưới. `add_header` trong một `location` sẽ thay thế các header ở
  cấp `server`, vì vậy header bảo mật được tách ra một file riêng và
  `include` lại ở từng nơi.

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

Ảnh chia sẻ khi dán link (Facebook, Zalo…) là `og-image.jpg`, đã trỏ sẵn tới
`https://dalang.hongvan.net/og-image.jpg`.
