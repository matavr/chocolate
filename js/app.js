/**
 * CHOCOLATE — Boutique Storefront Logic
 * г. Караганда, ТЦ «Арбат» & ТД «Абзал»
 */

(function () {
    'use strict';

    // ──────────────── CONFIG & CONSTANTS ────────────────
    const WA_PHONE = '77013530115'; // Официальный WhatsApp бутика CHOCOLATE (+7 701 353 01 15)
    const STORAGE_KEY = 'cw_products';
    const CART_KEY = 'cw_cart';

    // Standard ordered sizes from smallest to largest
    const ORDERED_SIZES = [
        { key: 'xs', name: 'XS (40)', label: 'XS' },
        { key: 's',  name: 'S (42)',  label: 'S' },
        { key: 'm',  name: 'M (44)',  label: 'M' },
        { key: 'l',  name: 'L (46)',  label: 'L' },
        { key: 'xl', name: 'XL (48)', label: 'XL' },
        { key: 'xxl',name: 'XXL (50)',label: 'XXL' },
        { key: 'one',name: 'ONE SIZE',label: 'ONE SIZE' }
    ];

    // ──────────────── STATE ────────────────
    let products = [];
    let cart = [];
    let currentFilter = {
        category: 'all',
        size: 'all',
        sort: 'default',
        search: ''
    };
    let currentModalProduct = null;
    let selectedSize = null;
    let modalQuantity = 1;

    // ──────────────── INIT ────────────────
    document.addEventListener('DOMContentLoaded', async () => {
        loadCart();
        updateCartBadge();
        initEventListeners();
        await loadProducts();
        renderCatalog();
    });

    // ──────────────── DATA LOADING ────────────────
    async function loadProducts() {
        // First try to fetch from backend server
        try {
            const res = await fetch('/api/products');
            if (res.ok) {
                products = await res.json();
                localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
                return;
            }
        } catch (e) {
            // Server not reachable or opened via file:// protocol
        }

        // Fallback to localStorage
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

    // ──────────────── CATALOG RENDERING ────────────────
    function renderCatalog() {
        const grid = document.getElementById('productsGrid');
        const emptyState = document.getElementById('catalogEmptyState');
        const featuredGrid = document.getElementById('featuredGrid');
        const featuredSection = document.getElementById('featuredSection');

        if (!grid) return;

        // Filter products
        let filtered = products.filter(item => {
            // Category filter
            if (currentFilter.category !== 'all') {
                if (currentFilter.category === 'sale') {
                    if (!item.oldPrice || Number(item.oldPrice) <= Number(item.price)) return false;
                } else if (item.category !== currentFilter.category) {
                    return false;
                }
            }

            // Size filter
            if (currentFilter.size !== 'all') {
                const sKey = currentFilter.size.toLowerCase();
                const stock = item.sizes && item.sizes[sKey] ? Number(item.sizes[sKey]) : 0;
                if (stock <= 0) return false;
            }

            // Search filter
            if (currentFilter.search.trim()) {
                const q = currentFilter.search.toLowerCase();
                const matchTitle = item.title && item.title.toLowerCase().includes(q);
                const matchDesc = item.description && item.description.toLowerCase().includes(q);
                const matchCat = item.category && item.category.toLowerCase().includes(q);
                if (!matchTitle && !matchDesc && !matchCat) return false;
            }

            return true;
        });

        // Sort products
        if (currentFilter.sort === 'price-asc') {
            filtered.sort((a, b) => Number(a.price) - Number(b.price));
        } else if (currentFilter.sort === 'price-desc') {
            filtered.sort((a, b) => Number(b.price) - Number(a.price));
        } else if (currentFilter.sort === 'sale') {
            filtered.sort((a, b) => {
                const diffA = (a.oldPrice && a.oldPrice > a.price) ? (a.oldPrice - a.price) : 0;
                const diffB = (b.oldPrice && b.oldPrice > b.price) ? (b.oldPrice - b.price) : 0;
                return diffB - diffA;
            });
        }

        // Render Featured on Home (if any products marked as featured)
        const featuredItems = products.filter(p => p.isFeatured);
        if (featuredSection && featuredGrid) {
            if (featuredItems.length > 0 && currentFilter.category === 'all' && !currentFilter.search) {
                featuredSection.style.display = 'block';
                featuredGrid.innerHTML = featuredItems.slice(0, 4).map(createProductCardHtml).join('');
            } else {
                featuredSection.style.display = 'none';
            }
        }

        // Empty state handling
        if (filtered.length === 0) {
            grid.innerHTML = '';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';
        grid.innerHTML = filtered.map(createProductCardHtml).join('');
    }

    // Helper: format price
    function formatPrice(num) {
        if (!num && num !== 0) return '0 ₸';
        return Number(num).toLocaleString('ru-RU') + ' ₸';
    }

    // Generate product card HTML
    function createProductCardHtml(prod) {
        const hasDiscount = prod.oldPrice && Number(prod.oldPrice) > Number(prod.price);
        const discountPercent = hasDiscount 
            ? Math.round(((Number(prod.oldPrice) - Number(prod.price)) / Number(prod.oldPrice)) * 100) 
            : 0;

        // Size tags
        const sizeTagsHtml = ORDERED_SIZES.map(s => {
            const count = prod.sizes && prod.sizes[s.key] ? Number(prod.sizes[s.key]) : 0;
            if (count > 0) {
                return `<span class="size-tag" title="В наличии: ${count} шт.">${s.label}</span>`;
            } else {
                return `<span class="size-tag out" title="Закончился">${s.label}</span>`;
            }
        }).join('');

        const imgSrc = prod.image || '';
        const placeholderHtml = `<div class="card-placeholder-img"><img src="images/logo-icon.svg" alt="CHOCOLATE" style="width:48px;height:48px;opacity:0.6;"><span>CHOCOLATE</span></div>`;
        const mediaHtml = imgSrc 
            ? `<img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(prod.title)}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'card-placeholder-img\\'><img src=\\'images/logo-icon.svg\\' alt=\\'CHOCOLATE\\' style=\\'width:48px;height:48px;opacity:0.6;\\'><span>CHOCOLATE</span></div>'">` 
            : placeholderHtml;

        return `
            <div class="product-card" data-id="${prod.id}">
                <div class="card-media" onclick="window.cwOpenProduct('${prod.id}')">
                    ${mediaHtml}
                    <div class="card-badges">
                        ${prod.isFeatured ? '<span class="badge badge-featured">ХИТ</span>' : ''}
                        ${hasDiscount ? `<span class="badge badge-sale">-${discountPercent}%</span>` : ''}
                    </div>
                    <div class="card-quick-actions" onclick="event.stopPropagation()">
                        <button class="quick-view-btn" onclick="window.cwOpenProduct('${prod.id}')">
                            <i class="fas fa-eye"></i> Выбрать размер
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    <span class="card-category">${escapeHtml(prod.category || 'Коллекция')}</span>
                    <h3 class="card-title" onclick="window.cwOpenProduct('${prod.id}')">${escapeHtml(prod.title)}</h3>
                    <div class="card-sizes-available">
                        ${sizeTagsHtml}
                    </div>
                    <div class="card-footer">
                        <div class="price-wrap">
                            <span class="price-current">${formatPrice(prod.price)}</span>
                            ${hasDiscount ? `<span class="price-old">${formatPrice(prod.oldPrice)}</span>` : ''}
                        </div>
                        <button class="card-add-cart-btn" onclick="window.cwOpenProduct('${prod.id}')" title="Выбрать размер">
                            <i class="fas fa-shopping-bag"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    // ──────────────── PRODUCT MODAL & SIZE PICKER ────────────────
    window.cwOpenProduct = function (productId) {
        const prod = products.find(p => String(p.id) === String(productId));
        if (!prod) return;

        currentModalProduct = prod;
        selectedSize = null;
        modalQuantity = 1;

        const modal = document.getElementById('productModal');
        const mediaCol = document.getElementById('modalProductMedia');
        const catEl = document.getElementById('modalProductCategory');
        const titleEl = document.getElementById('modalProductTitle');
        const priceCurrentEl = document.getElementById('modalPriceCurrent');
        const priceOldEl = document.getElementById('modalPriceOld');
        const discountTag = document.getElementById('modalDiscountTag');
        const descEl = document.getElementById('modalProductDesc');
        const sizePickerGrid = document.getElementById('modalSizePickerGrid');
        const sizeStatusMsg = document.getElementById('modalSizeStatusMsg');
        const qtyInput = document.getElementById('modalQtyInput');

        if (catEl) catEl.textContent = prod.category || 'Одежда CHOCOLATE';
        if (titleEl) titleEl.textContent = prod.title;
        if (descEl) descEl.textContent = prod.description || 'Изысканный крой, натуральные материалы премиум-класса. Идеальная посадка по фигуре.';

        // Image
        if (mediaCol) {
            const fallback = `<div class="card-placeholder-img"><img src="images/logo-icon.svg" alt="CHOCOLATE" style="width:64px;height:64px;opacity:0.6;"><span>CHOCOLATE</span></div>`;
            if (prod.image) {
                mediaCol.innerHTML = `<img src="${escapeHtml(prod.image)}" alt="${escapeHtml(prod.title)}" onerror="this.parentElement.innerHTML='<div class=\\'card-placeholder-img\\'><img src=\\'images/logo-icon.svg\\' alt=\\'CHOCOLATE\\' style=\\'width:64px;height:64px;opacity:0.6;\\'></div>'">`;
            } else {
                mediaCol.innerHTML = fallback;
            }
        }

        // Prices
        if (priceCurrentEl) priceCurrentEl.textContent = formatPrice(prod.price);
        const hasDiscount = prod.oldPrice && Number(prod.oldPrice) > Number(prod.price);
        if (hasDiscount) {
            const pct = Math.round(((Number(prod.oldPrice) - Number(prod.price)) / Number(prod.oldPrice)) * 100);
            if (priceOldEl) {
                priceOldEl.textContent = formatPrice(prod.oldPrice);
                priceOldEl.style.display = 'inline';
            }
            if (discountTag) {
                discountTag.textContent = `-${pct}% СКИДКА`;
                discountTag.style.display = 'inline-block';
            }
        } else {
            if (priceOldEl) priceOldEl.style.display = 'none';
            if (discountTag) discountTag.style.display = 'none';
        }

        // ─── RENDER SIZES STRICTLY FROM SMALLEST TO LARGEST ───
        if (sizePickerGrid) {
            let firstAvailableSize = null;

            sizePickerGrid.innerHTML = ORDERED_SIZES.map(s => {
                const stock = prod.sizes && prod.sizes[s.key] ? Number(prod.sizes[s.key]) : 0;
                const isAvailable = stock > 0;
                if (isAvailable && !firstAvailableSize) {
                    firstAvailableSize = s;
                }

                return `
                    <button type="button" 
                            class="size-choice-btn ${!isAvailable ? 'disabled' : ''}" 
                            data-size-key="${s.key}"
                            data-size-name="${s.name}"
                            data-stock="${stock}"
                            ${!isAvailable ? 'disabled' : ''}
                            onclick="window.cwSelectSize('${s.key}', '${s.name}', ${stock})">
                        <span class="size-name">${s.name}</span>
                        <span class="size-stock">${isAvailable ? `В наличии: ${stock} шт.` : 'Нет в наличии'}</span>
                    </button>
                `;
            }).join('');

            // Automatically pre-select first available size for convenience
            if (firstAvailableSize) {
                window.cwSelectSize(firstAvailableSize.key, firstAvailableSize.name, prod.sizes[firstAvailableSize.key]);
            } else {
                if (sizeStatusMsg) sizeStatusMsg.textContent = 'К сожалению, все размеры сейчас распроданы';
            }
        }

        if (qtyInput) qtyInput.value = '1';

        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    };

    window.cwCloseProductModal = function () {
        const modal = document.getElementById('productModal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
        currentModalProduct = null;
        selectedSize = null;
    };

    window.cwSelectSize = function (sizeKey, sizeName, stock) {
        selectedSize = { key: sizeKey, name: sizeName, stock: Number(stock) };

        // Highlight active button
        const buttons = document.querySelectorAll('#modalSizePickerGrid .size-choice-btn');
        buttons.forEach(btn => {
            if (btn.dataset.sizeKey === sizeKey) {
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
        });

        const statusMsg = document.getElementById('modalSizeStatusMsg');
        if (statusMsg) {
            statusMsg.innerHTML = `<i class="fas fa-check-circle" style="color:var(--chocolate)"></i> Выбран размер <strong>${sizeName}</strong> (в наличии: ${stock} шт.)`;
        }
    };

    window.cwChangeModalQty = function (delta) {
        const input = document.getElementById('modalQtyInput');
        if (!input) return;
        let val = parseInt(input.value) || 1;
        val += delta;
        if (val < 1) val = 1;
        if (selectedSize && selectedSize.stock && val > selectedSize.stock) {
            val = selectedSize.stock;
            alert(`В наличии доступно максимум ${selectedSize.stock} шт. данного размера.`);
        }
        input.value = val;
        modalQuantity = val;
    };

    // Add to Cart from Modal
    window.cwAddToCartFromModal = function () {
        if (!currentModalProduct) return;
        if (!selectedSize) {
            alert('Пожалуйста, выберите размер одежды (от самого маленького к самому большому)!');
            return;
        }

        const qtyInput = document.getElementById('modalQtyInput');
        const qty = parseInt(qtyInput ? qtyInput.value : 1) || 1;

        addToCart(currentModalProduct, selectedSize, qty);
        window.cwCloseProductModal();
        window.cwOpenCart();
    };

    // Quick WhatsApp 1-Click order from Modal
    window.cwOrderWhatsAppDirect = function () {
        if (!currentModalProduct) return;
        if (!selectedSize) {
            alert('Пожалуйста, выберите размер перед оформлением заказа!');
            return;
        }

        const qtyInput = document.getElementById('modalQtyInput');
        const qty = parseInt(qtyInput ? qtyInput.value : 1) || 1;
        const total = Number(currentModalProduct.price) * qty;

        const text = `Здравствуйте! Хочу заказать в бутик CHOCOLATE (Караганда):\n\n` +
            `👗 *${currentModalProduct.title}*\n` +
            `📏 Размер: *${selectedSize.name}*\n` +
            `🔢 Количество: ${qty} шт.\n` +
            `💰 Цена: ${formatPrice(total)}\n\n` +
            `Подскажите, можно ли оформить доставку или отложить для примерки в ТЦ «Арбат»?`;

        const waUrl = `https://wa.me/${WA_PHONE}?text=${encodeURIComponent(text)}`;
        window.open(waUrl, '_blank');
    };

    // ──────────────── CART SYSTEM ────────────────
    function loadCart() {
        try {
            const data = localStorage.getItem(CART_KEY);
            cart = data ? JSON.parse(data) : [];
        } catch (e) {
            cart = [];
        }
    }

    function saveCart() {
        localStorage.setItem(CART_KEY, JSON.stringify(cart));
        updateCartBadge();
        renderCart();
    }

    function addToCart(product, sizeObj, quantity) {
        const itemIndex = cart.findIndex(i => String(i.productId) === String(product.id) && i.sizeKey === sizeObj.key);
        if (itemIndex > -1) {
            cart[itemIndex].quantity += quantity;
        } else {
            cart.push({
                productId: product.id,
                title: product.title,
                price: Number(product.price),
                image: product.image || '',
                sizeKey: sizeObj.key,
                sizeName: sizeObj.name,
                quantity: quantity
            });
        }
        saveCart();
    }

    window.cwRemoveCartItem = function (index) {
        cart.splice(index, 1);
        saveCart();
    };

    function updateCartBadge() {
        const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
        const badges = document.querySelectorAll('.cart-counter');
        badges.forEach(b => {
            b.textContent = totalCount;
            b.style.display = totalCount > 0 ? 'flex' : 'none';
        });
    }

    window.cwOpenCart = function () {
        const drawer = document.getElementById('cartBackdrop');
        if (drawer) {
            drawer.classList.add('active');
            document.body.style.overflow = 'hidden';
            renderCart();
        }
    };

    window.cwCloseCart = function () {
        const drawer = document.getElementById('cartBackdrop');
        if (drawer) {
            drawer.classList.remove('active');
            document.body.style.overflow = '';
        }
    };

    function renderCart() {
        const list = document.getElementById('cartItemsList');
        const emptyMsg = document.getElementById('cartEmptyMessage');
        const foot = document.getElementById('cartFoot');
        const totalEl = document.getElementById('cartTotalAmount');

        if (!list) return;

        if (cart.length === 0) {
            list.innerHTML = '';
            if (emptyMsg) emptyMsg.style.display = 'block';
            if (foot) foot.style.display = 'none';
            return;
        }

        if (emptyMsg) emptyMsg.style.display = 'none';
        if (foot) foot.style.display = 'block';

        const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        if (totalEl) totalEl.textContent = formatPrice(total);

        list.innerHTML = cart.map((item, idx) => `
            <div class="cart-item">
                <div class="cart-item-img">
                    ${item.image ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}">` : '<div class="card-placeholder-img" style="font-size:10px;"><i class="fas fa-gem"></i></div>'}
                </div>
                <div class="cart-item-info">
                    <h4>${escapeHtml(item.title)}</h4>
                    <div class="cart-item-meta">Размер: <strong>${escapeHtml(item.sizeName)}</strong> • ${item.quantity} шт.</div>
                    <div class="cart-item-price">${formatPrice(item.price * item.quantity)}</div>
                </div>
                <button class="cart-item-remove" onclick="window.cwRemoveCartItem(${idx})" title="Удалить">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        `).join('');
    }

    // ──────────────── CHECKOUT & WHATSAPP ────────────────
    window.cwOpenCheckout = function () {
        if (cart.length === 0) {
            alert('Ваша корзина пуста.');
            return;
        }
        window.cwCloseCart();
        const modal = document.getElementById('checkoutModal');
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    };

    window.cwCloseCheckout = function () {
        const modal = document.getElementById('checkoutModal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    };

    window.cwSubmitOrder = function (e) {
        if (e) e.preventDefault();

        const name = document.getElementById('orderCustomerName')?.value.trim();
        const phone = document.getElementById('orderCustomerPhone')?.value.trim();
        const delivery = document.getElementById('orderDeliveryType')?.value;
        const address = document.getElementById('orderAddress')?.value.trim();
        const payment = document.getElementById('orderPaymentType')?.value;
        const comment = document.getElementById('orderComment')?.value.trim();

        if (!name || !phone) {
            alert('Пожалуйста, укажите имя и номер телефона.');
            return;
        }

        const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        let itemsText = cart.map((item, i) => 
            `${i + 1}. *${item.title}*\n   Размер: *${item.sizeName}* | Кол-во: ${item.quantity} шт. | ${formatPrice(item.price * item.quantity)}`
        ).join('\n\n');

        const message = 
            `🛍️ *НОВЫЙ ЗАКАЗ В БУТИК CHOCOLATE*\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `👤 *Покупатель:* ${name}\n` +
            `📞 *Телефон:* ${phone}\n` +
            `🚚 *Доставка:* ${delivery}\n` +
            (address ? `📍 *Адрес:* ${address}\n` : '') +
            `💳 *Оплата:* ${payment}\n` +
            (comment ? `💬 *Комментарий:* ${comment}\n` : '') +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `👗 *ВЫБРАННЫЕ ТОВАРЫ:*\n\n${itemsText}\n\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `💰 *ИТОГО К ОПЛАТЕ:* ${formatPrice(total)}\n\n` +
            `Бутик в Караганде: ТЦ «Арбат» (бутик 1) & ТД «Абзал» (бутик 93)`;

        const waUrl = `https://wa.me/${WA_PHONE}?text=${encodeURIComponent(message)}`;

        // Clear cart
        cart = [];
        saveCart();
        window.cwCloseCheckout();

        // Redirect to WhatsApp
        window.open(waUrl, '_blank');
    };

    // ──────────────── SIZE GUIDE MODAL ────────────────
    window.cwOpenSizeGuide = function () {
        const modal = document.getElementById('sizeGuideModal');
        if (modal) {
            modal.classList.add('active');
        }
    };

    window.cwCloseSizeGuide = function () {
        const modal = document.getElementById('sizeGuideModal');
        if (modal) {
            modal.classList.remove('active');
        }
    };

    // ──────────────── EVENT LISTENERS ────────────────
    function initEventListeners() {
        // Category Pills
        const catPills = document.querySelectorAll('.category-pill');
        catPills.forEach(pill => {
            pill.addEventListener('click', () => {
                catPills.forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                currentFilter.category = pill.dataset.category || 'all';
                renderCatalog();
            });
        });

        // Size Filter Pills
        const sizePills = document.querySelectorAll('.size-pill-btn');
        sizePills.forEach(pill => {
            pill.addEventListener('click', () => {
                sizePills.forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                currentFilter.size = pill.dataset.size || 'all';
                renderCatalog();
            });
        });

        // Sort Select
        const sortSelect = document.getElementById('catalogSort');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                currentFilter.sort = e.target.value;
                renderCatalog();
            });
        }

        // Search Input
        const searchInput = document.getElementById('catalogSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                currentFilter.search = e.target.value;
                renderCatalog();
            });
        }

        // Grid Switchers
        const grid2 = document.getElementById('gridBtn2');
        const grid3 = document.getElementById('gridBtn3');
        const grid4 = document.getElementById('gridBtn4');
        const productsGrid = document.getElementById('productsGrid');

        function setGrid(cols) {
            if (!productsGrid) return;
            productsGrid.className = 'products-grid';
            if (cols === 2) productsGrid.classList.add('grid-2');
            if (cols === 3) productsGrid.classList.add('grid-3');
            [grid2, grid3, grid4].forEach(btn => { if (btn) btn.classList.remove('active'); });
            if (cols === 2 && grid2) grid2.classList.add('active');
            if (cols === 3 && grid3) grid3.classList.add('active');
            if (cols === 4 && grid4) grid4.classList.add('active');
        }

        if (grid2) grid2.addEventListener('click', () => setGrid(2));
        if (grid3) grid3.addEventListener('click', () => setGrid(3));
        if (grid4) grid4.addEventListener('click', () => setGrid(4));

        // Close modals on clicking backdrop
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-backdrop')) {
                window.cwCloseProductModal();
                window.cwCloseCheckout();
                window.cwCloseSizeGuide();
                window.cwCloseIosModal();
            }
            if (e.target.classList.contains('cart-backdrop')) {
                window.cwCloseCart();
            }
        });

        // ESC key close
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                window.cwCloseProductModal();
                window.cwCloseCart();
                window.cwCloseCheckout();
                window.cwCloseSizeGuide();
                window.cwCloseIosModal();
            }
        });
    }

    // ──────────────── MOBILE DRAWER & SEARCH UTILS ────────────────
    window.cwToggleMobileMenu = function (show) {
        const backdrop = document.getElementById('mobileDrawerBackdrop');
        if (!backdrop) return;
        if (show) {
            backdrop.classList.add('active');
            document.body.style.overflow = 'hidden';
        } else {
            backdrop.classList.remove('active');
            document.body.style.overflow = '';
        }
    };

    window.cwFocusSearch = function () {
        const searchInput = document.getElementById('catalogSearchInput');
        if (searchInput) {
            const catalogSec = document.getElementById('catalog');
            if (catalogSec) {
                catalogSec.scrollIntoView({ behavior: 'smooth' });
            }
            setTimeout(() => {
                searchInput.focus();
                searchInput.select();
            }, 350);
        }
    };

    // ──────────────── PWA (ADD TO HOME SCREEN) ────────────────
    let deferredPwaPrompt = null;
    const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

    // Register Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js').catch(() => {});
        });
    }

    // Android / Chrome / Edge install prompt listener
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPwaPrompt = e;
        if (!isStandalone && !sessionStorage.getItem('cw_pwa_dismissed')) {
            setTimeout(() => {
                showPwaBanner();
            }, 3000);
        }
    });

    // Check iOS prompt
    if (isIosDevice && !isStandalone && !sessionStorage.getItem('cw_pwa_dismissed')) {
        setTimeout(() => {
            showPwaBanner();
        }, 4000);
    }

    function showPwaBanner() {
        const banner = document.getElementById('pwaBanner');
        if (banner) {
            banner.classList.add('active');
        }
    }

    window.cwInstallPWA = async function () {
        if (deferredPwaPrompt) {
            deferredPwaPrompt.prompt();
            const { outcome } = await deferredPwaPrompt.userChoice;
            deferredPwaPrompt = null;
            window.cwDismissPWABanner();
        } else if (isIosDevice) {
            window.cwDismissPWABanner();
            window.cwOpenIosModal();
        } else {
            window.cwOpenIosModal();
        }
    };

    window.cwPromptPWAInstall = function () {
        if (deferredPwaPrompt) {
            deferredPwaPrompt.prompt();
        } else {
            window.cwOpenIosModal();
        }
    };

    window.cwDismissPWABanner = function () {
        const banner = document.getElementById('pwaBanner');
        if (banner) {
            banner.classList.remove('active');
        }
        sessionStorage.setItem('cw_pwa_dismissed', 'true');
    };

    window.cwOpenIosModal = function () {
        const modal = document.getElementById('iosPwaModal');
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    };

    window.cwCloseIosModal = function () {
        const modal = document.getElementById('iosPwaModal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    };

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
