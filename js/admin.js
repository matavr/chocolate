/**
 * CHOCOLATE WHITE — Управление бутиком (Admin Panel)
 * Live Camera Snapshot, Size Inventory Matrix, Product Editor
 */

(function () {
    'use strict';

    const STORAGE_KEY = 'cw_products';
    const ORDERED_SIZES = [
        { key: 'xs', name: 'XS (40)', label: 'XS' },
        { key: 's',  name: 'S (42)',  label: 'S' },
        { key: 'm',  name: 'M (44)',  label: 'M' },
        { key: 'l',  name: 'L (46)',  label: 'L' },
        { key: 'xl', name: 'XL (48)', label: 'XL' },
        { key: 'xxl',name: 'XXL (50)',label: 'XXL' },
        { key: 'one',name: 'ONE SIZE',label: 'ONE SIZE' }
    ];

    let products = [];
    let currentEditId = null;
    let cameraStream = null;
    let currentFacingMode = 'environment'; // default to rear camera on phones

    // ──────────────── INIT ────────────────
    document.addEventListener('DOMContentLoaded', async () => {
        await loadProducts();
        renderDashboard();
        initListeners();
    });

    // ──────────────── DATA PERSISTENCE ────────────────
    async function loadProducts() {
        // Try server API first
        try {
            const res = await fetch('/api/products');
            if (res.ok) {
                products = await res.json();
                localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
                return;
            }
        } catch (e) {
            // Local fallback
        }

        const local = localStorage.getItem(STORAGE_KEY);
        if (local) {
            try {
                products = JSON.parse(local);
            } catch (err) {
                products = [];
            }
        } else {
            products = [];
        }
    }

    async function saveProducts() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(products));

        // If online, save to server too
        try {
            // We can also trigger individual CRUD API calls
        } catch (e) {
            // Offline fallback
        }
    }

    // ──────────────── RENDER DASHBOARD & TABLE ────────────────
    function renderDashboard() {
        updateStats();
        renderTable();
    }

    function updateStats() {
        const totalCountEl = document.getElementById('statTotalProducts');
        const inStockCountEl = document.getElementById('statTotalStock');
        const featuredCountEl = document.getElementById('statFeatured');
        const saleCountEl = document.getElementById('statOnSale');

        if (totalCountEl) totalCountEl.textContent = products.length;

        let totalUnits = 0;
        let featuredCount = 0;
        let saleCount = 0;

        products.forEach(p => {
            if (p.isFeatured) featuredCount++;
            if (p.oldPrice && Number(p.oldPrice) > Number(p.price)) saleCount++;
            if (p.sizes) {
                Object.values(p.sizes).forEach(cnt => {
                    totalUnits += (Number(cnt) || 0);
                });
            }
        });

        if (inStockCountEl) inStockCountEl.textContent = totalUnits;
        if (featuredCountEl) featuredCountEl.textContent = featuredCount;
        if (saleCountEl) saleCountEl.textContent = saleCount;
    }

    function renderTable() {
        const tbody = document.getElementById('productsTableBody');
        const emptyState = document.getElementById('adminEmptyState');
        const searchVal = document.getElementById('adminSearchInput')?.value.toLowerCase().trim() || '';
        const catFilter = document.getElementById('adminCategoryFilter')?.value || 'all';

        if (!tbody) return;

        let filtered = products.filter(p => {
            if (catFilter !== 'all' && p.category !== catFilter) return false;
            if (searchVal) {
                const matchTitle = p.title && p.title.toLowerCase().includes(searchVal);
                const matchSku = p.sku && p.sku.toLowerCase().includes(searchVal);
                if (!matchTitle && !matchSku) return false;
            }
            return true;
        });

        if (filtered.length === 0) {
            tbody.innerHTML = '';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';

        tbody.innerHTML = filtered.map(prod => {
            const hasDiscount = prod.oldPrice && Number(prod.oldPrice) > Number(prod.price);
            const discountPct = hasDiscount 
                ? Math.round(((Number(prod.oldPrice) - Number(prod.price)) / Number(prod.oldPrice)) * 100)
                : 0;

            const sizeBadges = ORDERED_SIZES.map(s => {
                const cnt = prod.sizes && prod.sizes[s.key] ? Number(prod.sizes[s.key]) : 0;
                const cls = cnt > 0 ? 'has-stock' : 'no-stock';
                return `<span class="size-stock-badge ${cls}" title="${s.name}">${s.label}: ${cnt}</span>`;
            }).join('');

            const thumbSrc = prod.image || '';

            return `
                <tr>
                    <td style="width: 70px;">
                        ${thumbSrc 
                            ? `<img src="${escapeHtml(thumbSrc)}" alt="" class="prod-thumb" onerror="this.src=''; this.className='prod-thumb';">` 
                            : `<div class="prod-thumb" style="display:flex;align-items:center;justify-content:center;color:#825E4D;"><i class="fas fa-image"></i></div>`}
                    </td>
                    <td>
                        <div class="prod-info-title">${escapeHtml(prod.title)}</div>
                        <div class="prod-info-sku">Арт: ${escapeHtml(prod.sku || prod.id.substring(0, 8))}</div>
                    </td>
                    <td>
                        <span class="prod-category-tag">${escapeHtml(prod.category || 'Без категории')}</span>
                    </td>
                    <td>
                        <div style="font-weight: 700; color: var(--brand-dark);">${formatPrice(prod.price)}</div>
                        ${hasDiscount ? `<div style="font-size: 11px; color: var(--danger);"><del>${formatPrice(prod.oldPrice)}</del> (-${discountPct}%)</div>` : ''}
                    </td>
                    <td>
                        <div class="size-pill-row">
                            ${sizeBadges}
                        </div>
                    </td>
                    <td style="text-align: center;">
                        <button class="featured-toggle-btn ${prod.isFeatured ? 'active' : ''}" 
                                onclick="window.cwToggleFeatured('${prod.id}')" 
                                title="${prod.isFeatured ? 'Убрать с главного экрана' : 'Выставить на главный экран'}">
                            <i class="fas fa-star"></i>
                        </button>
                    </td>
                    <td>
                        <div class="table-actions">
                            <button class="action-btn" onclick="window.cwEditProduct('${prod.id}')" title="Редактировать">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="action-btn" onclick="window.cwOpenQuickStock('${prod.id}')" title="Быстро изменить остатки">
                                <i class="fas fa-boxes-stacked"></i>
                            </button>
                            <button class="action-btn" onclick="window.cwDuplicateProduct('${prod.id}')" title="Дублировать">
                                <i class="fas fa-copy"></i>
                            </button>
                            <button class="action-btn delete-btn" onclick="window.cwDeleteProduct('${prod.id}')" title="Удалить">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function formatPrice(num) {
        if (!num && num !== 0) return '0 ₸';
        return Number(num).toLocaleString('ru-RU') + ' ₸';
    }

    // ──────────────── CREATE / EDIT PRODUCT MODAL ────────────────
    window.cwOpenAddModal = function () {
        currentEditId = null;
        const titleEl = document.getElementById('modalFormTitle');
        if (titleEl) titleEl.textContent = 'Добавить новый товар';
        
        const form = document.getElementById('productForm');
        if (form) form.reset();

        const preview = document.getElementById('formImagePreview');
        const placeholder = document.getElementById('formPlaceholderBox');
        if (preview) {
            preview.src = '';
            preview.style.display = 'none';
        }
        if (placeholder) {
            placeholder.style.display = 'flex';
        }

        const imgVal = document.getElementById('formImageVal');
        if (imgVal) imgVal.value = '';

        const feat = document.getElementById('formIsFeatured');
        if (feat) feat.checked = true; // default on home screen

        // Reset sizes matrix to 1
        ORDERED_SIZES.forEach(s => {
            const input = document.getElementById(`size_input_${s.key}`);
            if (input) input.value = '1';
        });

        openModal('productModal');
    };

    window.cwEditProduct = function (id) {
        const prod = products.find(p => String(p.id) === String(id));
        if (!prod) return;

        currentEditId = prod.id;
        const titleEl = document.getElementById('modalFormTitle');
        if (titleEl) titleEl.textContent = 'Редактировать товар';

        document.getElementById('formTitle').value = prod.title || '';
        document.getElementById('formCategory').value = prod.category || 'Платья';
        document.getElementById('formPrice').value = prod.price || '';
        document.getElementById('formOldPrice').value = prod.oldPrice || '';
        document.getElementById('formSku').value = prod.sku || '';
        document.getElementById('formDesc').value = prod.description || '';
        document.getElementById('formIsFeatured').checked = !!prod.isFeatured;

        // Image
        const preview = document.getElementById('formImagePreview');
        const placeholderBox = document.getElementById('formPlaceholderBox');
        const imgVal = document.getElementById('formImageVal');

        if (prod.image) {
            if (preview) {
                preview.src = prod.image;
                preview.style.display = 'block';
            }
            if (placeholderBox) placeholderBox.style.display = 'none';
            if (imgVal) imgVal.value = prod.image;
        } else {
            if (preview) {
                preview.src = '';
                preview.style.display = 'none';
            }
            if (placeholderBox) placeholderBox.style.display = 'flex';
            if (imgVal) imgVal.value = '';
        }

        // Size Matrix Counts
        ORDERED_SIZES.forEach(s => {
            const input = document.getElementById(`size_input_${s.key}`);
            if (input) {
                input.value = prod.sizes && prod.sizes[s.key] !== undefined ? prod.sizes[s.key] : 0;
            }
        });

        openModal('productModal');
    };

    window.cwSaveProduct = async function (e) {
        if (e) e.preventDefault();

        const title = document.getElementById('formTitle').value.trim();
        const category = document.getElementById('formCategory').value;
        const price = Number(document.getElementById('formPrice').value) || 0;
        const oldPriceVal = document.getElementById('formOldPrice').value;
        const oldPrice = oldPriceVal ? Number(oldPriceVal) : null;
        const sku = document.getElementById('formSku').value.trim();
        const description = document.getElementById('formDesc').value.trim();
        const isFeatured = document.getElementById('formIsFeatured').checked;
        const image = document.getElementById('formImageVal').value.trim();

        if (!title) {
            alert('Пожалуйста, введите название товара.');
            return;
        }
        if (price <= 0) {
            alert('Пожалуйста, укажите корректную цену товара.');
            return;
        }

        // Collect sizes
        const sizes = {};
        ORDERED_SIZES.forEach(s => {
            const input = document.getElementById(`size_input_${s.key}`);
            sizes[s.key] = input ? Math.max(0, parseInt(input.value) || 0) : 0;
        });

        if (currentEditId) {
            // Update existing
            const index = products.findIndex(p => String(p.id) === String(currentEditId));
            if (index !== -1) {
                products[index] = {
                    ...products[index],
                    title,
                    category,
                    price,
                    oldPrice,
                    sku: sku || products[index].sku,
                    description,
                    isFeatured,
                    image,
                    sizes,
                    updatedAt: new Date().toISOString()
                };

                // Sync with server if possible
                try {
                    await fetch(`/api/products/${currentEditId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(products[index])
                    });
                } catch (err) {}
            }
        } else {
            // Create new
            const newProd = {
                id: 'cw_' + Date.now(),
                title,
                category,
                price,
                oldPrice,
                sku: sku || 'CW-' + Math.floor(1000 + Math.random() * 9000),
                description,
                isFeatured,
                image,
                sizes,
                createdAt: new Date().toISOString()
            };

            products.unshift(newProd);

            // Sync with server if possible
            try {
                await fetch('/api/products', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newProd)
                });
            } catch (err) {}
        }

        await saveProducts();
        closeModal('productModal');
        renderDashboard();
    };

    window.cwDeleteProduct = async function (id) {
        const prod = products.find(p => String(p.id) === String(id));
        if (!prod) return;

        if (!confirm(`Вы действительно хотите удалить товар "${prod.title}"?`)) {
            return;
        }

        products = products.filter(p => String(p.id) !== String(id));

        try {
            await fetch(`/api/products/${id}`, { method: 'DELETE' });
        } catch (err) {}

        await saveProducts();
        renderDashboard();
    };

    window.cwDuplicateProduct = async function (id) {
        const prod = products.find(p => String(p.id) === String(id));
        if (!prod) return;

        const clone = JSON.parse(JSON.stringify(prod));
        clone.id = 'cw_' + Date.now();
        clone.title = clone.title + ' (Копия)';
        clone.sku = 'CW-' + Math.floor(1000 + Math.random() * 9000);
        clone.createdAt = new Date().toISOString();

        products.unshift(clone);

        try {
            await fetch('/api/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(clone)
            });
        } catch (err) {}

        await saveProducts();
        renderDashboard();
    };

    window.cwToggleFeatured = async function (id) {
        const prod = products.find(p => String(p.id) === String(id));
        if (!prod) return;

        prod.isFeatured = !prod.isFeatured;

        try {
            await fetch(`/api/products/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isFeatured: prod.isFeatured })
            });
        } catch (err) {}

        await saveProducts();
        renderDashboard();
    };

    // ──────────────── QUICK STOCK MODAL ────────────────
    let quickStockProdId = null;
    window.cwOpenQuickStock = function (id) {
        const prod = products.find(p => String(p.id) === String(id));
        if (!prod) return;

        quickStockProdId = prod.id;
        document.getElementById('quickStockTitle').textContent = prod.title;

        const container = document.getElementById('quickStockGrid');
        if (container) {
            container.innerHTML = ORDERED_SIZES.map(s => {
                const count = prod.sizes && prod.sizes[s.key] !== undefined ? prod.sizes[s.key] : 0;
                return `
                    <div style="background:#fff; border:1px solid var(--border-color); border-radius:4px; padding:10px; text-align:center;">
                        <div style="font-weight:700; font-size:13px; color:var(--brand-dark);">${s.name}</div>
                        <input type="number" min="0" id="qs_${s.key}" value="${count}" 
                               style="width:100%; padding:6px; margin-top:6px; text-align:center; font-weight:700; border:1px solid var(--border-color); border-radius:3px;">
                    </div>
                `;
            }).join('');
        }

        openModal('quickStockModal');
    };

    window.cwSaveQuickStock = async function () {
        if (!quickStockProdId) return;
        const prod = products.find(p => String(p.id) === String(quickStockProdId));
        if (!prod) return;

        if (!prod.sizes) prod.sizes = {};
        ORDERED_SIZES.forEach(s => {
            const val = document.getElementById(`qs_${s.key}`)?.value;
            prod.sizes[s.key] = Math.max(0, parseInt(val) || 0);
        });

        try {
            await fetch(`/api/products/${quickStockProdId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sizes: prod.sizes })
            });
        } catch (err) {}

        await saveProducts();
        closeModal('quickStockModal');
        renderDashboard();
    };

    // ──────────────── LIVE CAMERA & PHOTO CAPTURE ────────────────
    window.cwOpenLiveCamera = async function () {
        openModal('cameraModal');
        await startCameraStream();
    };

    async function startCameraStream() {
        const video = document.getElementById('cameraVideo');
        if (!video) return;

        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            cameraStream = null;
        }

        try {
            // First attempt with ideal settings & facingMode
            try {
                cameraStream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: currentFacingMode,
                        width: { ideal: 1280 },
                        height: { ideal: 960 }
                    },
                    audio: false
                });
            } catch (errFacing) {
                // Laptop webcams often fail on facingMode: 'environment'. Fallback to any camera!
                cameraStream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: false
                });
            }

            video.srcObject = cameraStream;
            video.setAttribute('playsinline', true);
            await video.play();
        } catch (err) {
            alert('Не удалось запустить камеру на ноутбуке. Пожалуйста, разрешите доступ к веб-камере в браузере или используйте кнопку «Выбрать файл / Скриншот».');
            closeModal('cameraModal');
        }
    }

    window.cwSwitchCamera = function () {
        currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
        startCameraStream();
    };

    window.cwTakeSnapshot = function () {
        const video = document.getElementById('cameraVideo');
        const canvas = document.getElementById('cameraCanvas');
        if (!video || !canvas) return;

        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);

        // Set as current product image
        setProductImage(dataUrl);

        // Stop camera stream & close modal
        window.cwCloseLiveCamera();
    };

    window.cwCloseLiveCamera = function () {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            cameraStream = null;
        }
        closeModal('cameraModal');
    };

    // Helper: Smart Client-Side Image Resizing for Screenshots & Photos (JPEG & PNG)
    function compressImageFile(file, maxDimension = 1400) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = reject;
            reader.onload = (e) => {
                const rawDataUrl = e.target.result;
                const img = new Image();
                img.onerror = () => resolve(rawDataUrl);
                img.onload = () => {
                    let width = img.width;
                    let height = img.height;

                    // If image is already reasonably sized and small (< 1.5MB), use directly
                    if (width <= maxDimension && height <= maxDimension && file.size < 1.5 * 1024 * 1024) {
                        return resolve(rawDataUrl);
                    }

                    if (width > maxDimension || height > maxDimension) {
                        if (width > height) {
                            height = Math.round((height * maxDimension) / width);
                            width = maxDimension;
                        } else {
                            width = Math.round((width * maxDimension) / height);
                            height = maxDimension;
                        }
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');

                    const isPng = file.type === 'image/png' || (file.name && file.name.toLowerCase().endsWith('.png'));
                    if (!isPng) {
                        ctx.fillStyle = '#FFFFFF';
                        ctx.fillRect(0, 0, width, height);
                    }
                    ctx.drawImage(img, 0, 0, width, height);

                    const outputFormat = isPng ? 'image/png' : 'image/jpeg';
                    const quality = isPng ? undefined : 0.88;
                    const optimizedBase64 = canvas.toDataURL(outputFormat, quality);
                    resolve(optimizedBase64);
                };
                img.src = rawDataUrl;
            };
            reader.readAsDataURL(file);
        });
    }

    // Direct Shortcut from Toolbar: opens Add Modal and preloads image
    window.cwAddFromGallery = async function (fileInput) {
        if (!fileInput.files || !fileInput.files[0]) return;
        const file = fileInput.files[0];
        window.cwOpenAddModal();
        await processAndSetImage(file);
        fileInput.value = '';
    };

    // File input change handler (mobile gallery, laptop screenshots, file picker)
    window.cwHandleFileUpload = async function (fileInput) {
        if (!fileInput.files || !fileInput.files[0]) return;
        const file = fileInput.files[0];
        await processAndSetImage(file);
        fileInput.value = '';
    };

    async function processAndSetImage(file) {
        try {
            // Compress phone camera/gallery photo or PNG screenshot
            const base64 = await compressImageFile(file, 1400);

            // Upload to server if server is online, or save directly as base64
            try {
                const res = await fetch('/api/upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ base64 })
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.url) {
                        setProductImage(data.url);
                        return;
                    }
                }
            } catch (err) {
                // If offline server, set data URL directly
            }
            setProductImage(base64);
        } catch (err) {
            alert('Не удалось обработать изображение: ' + err.message);
        }
    }

    // Prompt for direct image URL
    window.cwPromptImageUrl = function () {
        const current = document.getElementById('formImageVal').value;
        const url = prompt('Введите или вставьте прямую ссылку на фото товара (URL):', current);
        if (url !== null && url.trim()) {
            setProductImage(url.trim());
        }
    };

    function setProductImage(src) {
        const preview = document.getElementById('formImagePreview');
        const placeholderBox = document.getElementById('formPlaceholderBox');
        const imgVal = document.getElementById('formImageVal');

        if (preview) {
            preview.src = src;
            preview.style.display = 'block';
        }
        if (placeholderBox) {
            placeholderBox.style.display = 'none';
        }
        if (imgVal) {
            imgVal.value = src;
        }
    }

    window.cwRemoveProductImage = function () {
        const preview = document.getElementById('formImagePreview');
        const placeholderBox = document.getElementById('formPlaceholderBox');
        const imgVal = document.getElementById('formImageVal');

        if (preview) {
            preview.src = '';
            preview.style.display = 'none';
        }
        if (placeholderBox) {
            placeholderBox.style.display = 'flex';
        }
        if (imgVal) {
            imgVal.value = '';
        }
    };

    // ──────────────── EXPORT & IMPORT & DEMO ────────────────
    window.cwExportData = function () {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(products, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `chocolate_white_backup_${Date.now()}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
    };

    window.cwImportData = function (fileInput) {
        if (!fileInput.files || !fileInput.files[0]) return;
        const file = fileInput.files[0];
        const reader = new FileReader();
        reader.onload = async function (e) {
            try {
                const imported = JSON.parse(e.target.result);
                if (Array.isArray(imported)) {
                    if (confirm(`Импортировать ${imported.length} товаров? Текущие данные будут объединены.`)) {
                        products = imported;
                        await saveProducts();
                        renderDashboard();
                        alert('Каталог успешно импортирован!');
                    }
                } else {
                    alert('Ошибка: неверный формат файла JSON.');
                }
            } catch (err) {
                alert('Ошибка чтения файла JSON: ' + err.message);
            }
        };
        reader.readAsText(file);
    };

    window.cwClearAllProducts = async function () {
        if (!confirm('Вы уверены, что хотите удалить ВСЕ товары из каталога?')) return;
        products = [];
        await saveProducts();
        renderDashboard();
    };

    // ──────────────── MODAL HELPERS ────────────────
    function openModal(id) {
        const el = document.getElementById(id);
        if (el) {
            el.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    function closeModal(id) {
        const el = document.getElementById(id);
        if (el) {
            el.classList.remove('active');
            document.body.style.overflow = '';
        }
    }
    window.cwCloseModal = closeModal;

    // ──────────────── LISTENERS ────────────────
    function initListeners() {
        const searchInput = document.getElementById('adminSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', () => renderTable());
        }

        const catFilter = document.getElementById('adminCategoryFilter');
        if (catFilter) {
            catFilter.addEventListener('change', () => renderTable());
        }

        // Global Paste Listener (Ctrl+V) for Instant Screenshots on Laptop
        window.addEventListener('paste', async (e) => {
            const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
            if (!items) return;
            for (let item of items) {
                if (item.type && item.type.startsWith('image/')) {
                    const file = item.getAsFile();
                    if (file) {
                        e.preventDefault();
                        const modal = document.getElementById('productModal');
                        if (!modal || !modal.classList.contains('active')) {
                            window.cwOpenAddModal();
                        }
                        await processAndSetImage(file);
                        break;
                    }
                }
            }
        });

        // Drag and Drop Image Handler
        const dropZone = document.getElementById('photoDropZone');
        if (dropZone) {
            ['dragenter', 'dragover'].forEach(eventName => {
                dropZone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dropZone.style.borderColor = 'var(--brand-accent)';
                    dropZone.style.background = '#EDE4D8';
                });
            });

            ['dragleave', 'drop'].forEach(eventName => {
                dropZone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dropZone.style.borderColor = 'var(--border-color)';
                    dropZone.style.background = '#FAF9F6';
                });
            });

            dropZone.addEventListener('drop', async (e) => {
                const files = e.dataTransfer?.files;
                if (files && files[0] && files[0].type.startsWith('image/')) {
                    await processAndSetImage(files[0]);
                }
            });
        }

        // Close on clicking backdrop
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) {
                closeModal(e.target.id);
                if (e.target.id === 'cameraModal') {
                    window.cwCloseLiveCamera();
                }
            }
        });

        // Close on ESC
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const activeModal = document.querySelector('.modal-overlay.active');
                if (activeModal) {
                    closeModal(activeModal.id);
                    if (activeModal.id === 'cameraModal') {
                        window.cwCloseLiveCamera();
                    }
                }
            }
        });
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

})();
