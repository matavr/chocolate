const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'products.json');
const UPLOADS_DIR = path.join(__dirname, 'images', 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Initial products data (empty by default as requested: user adds products via admin)
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), 'utf-8');
}

function readProducts() {
    try {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        return JSON.parse(raw);
    } catch (e) {
        return [];
    }
}

function saveProducts(products) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(products, null, 2), 'utf-8');
}

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = urlObj.pathname;

    // ──────────────── API ROUTES ────────────────
    if (pathname === '/api/products' && req.method === 'GET') {
        const products = readProducts();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(products));
        return;
    }

    if (pathname === '/api/products' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const product = JSON.parse(body);
                const products = readProducts();
                if (!product.id) {
                    product.id = 'prod_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
                }
                product.createdAt = product.createdAt || new Date().toISOString();
                products.unshift(product);
                saveProducts(products);
                res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ success: true, product }));
            } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON', details: err.message }));
            }
        });
        return;
    }

    if (pathname.startsWith('/api/products/') && req.method === 'PUT') {
        const id = pathname.replace('/api/products/', '');
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const updatedData = JSON.parse(body);
                let products = readProducts();
                const index = products.findIndex(p => String(p.id) === String(id));
                if (index !== -1) {
                    products[index] = { ...products[index], ...updatedData, updatedAt: new Date().toISOString() };
                    saveProducts(products);
                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: true, product: products[index] }));
                } else {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Product not found' }));
                }
            } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
        return;
    }

    if (pathname.startsWith('/api/products/') && req.method === 'DELETE') {
        const id = pathname.replace('/api/products/', '');
        let products = readProducts();
        const initialLen = products.length;
        products = products.filter(p => String(p.id) !== String(id));
        if (products.length < initialLen) {
            saveProducts(products);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: true }));
        } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Product not found' }));
        }
        return;
    }

    if (pathname === '/api/upload' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                if (!data.base64) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'No base64 data provided' }));
                    return;
                }
                const matches = data.base64.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
                let ext = 'jpg';
                let buffer;
                if (matches && matches.length === 3) {
                    ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
                    buffer = Buffer.from(matches[2], 'base64');
                } else {
                    buffer = Buffer.from(data.base64, 'base64');
                }
                const filename = `photo_${Date.now()}_${Math.floor(Math.random() * 10000)}.${ext}`;
                const filepath = path.join(UPLOADS_DIR, filename);
                fs.writeFileSync(filepath, buffer);
                const publicUrl = `images/uploads/${filename}`;
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ success: true, url: publicUrl }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Upload failed', details: err.message }));
            }
        });
        return;
    }

    // ──────────────── STATIC FILE SERVING ────────────────
    let reqPath = pathname === '/' ? '/index.html' : pathname;
    const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
    const filePath = path.join(__dirname, safePath);

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404 Not Found');
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, { 'Content-Type': contentType });
        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
    });
});

server.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`  CHOCOLATE WHITE — Бутик женской одежды (Караганда)`);
    console.log(`  Сайт витрина:  http://localhost:${PORT}`);
    console.log(`  Админ-панель:  http://localhost:${PORT}/admin.html`);
    console.log(`====================================================`);
});
