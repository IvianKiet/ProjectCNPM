// ============================================
// MENU DISPLAY SYSTEM FOR GUEST ORDERING
// ============================================
// NOTE: This displays the menu for BOTH guests and customers
// The actual distinction happens during order submission
// ============================================

// ============================================
// API CONFIGURATION
// ============================================
const MENU_API_CONFIG = {
    BASE_URL: 'http://localhost:8000/api',
    ENDPOINTS: {
        GET_MENU: '/guest/menu-items',
        GET_TABLE: '/guest/tables/:tableId'
    },
    USE_API: true, // Set to false for demo data
};

// ============================================
// DEMO DATA (fallback when API is disabled)
// ============================================
const DEMO_MENU_DATA = {
    categories: [
        { id: '1', name: 'Khai vị', icon: 'restaurant' },
        { id: '2', name: 'Món chính', icon: 'lunch_dining' },
        { id: '3', name: 'Đồ uống', icon: 'local_cafe' },
        { id: '4', name: 'Tráng miệng', icon: 'cake' }
    ],
    items: [
        {
            id: '1',
            name: 'Loading...',
            description: '-',
            price: 45000,
            image: 'https://via.placeholder.com/300',
            category: '1',
            status: 'available'
        },
    ]
};

// ============================================
// STATE MANAGEMENT
// ============================================
let menuState = {
    categories: [],
    items: [],
    currentCategory: 'all',
    searchQuery: '',
    currentPage: 1,
    itemsPerPage: 12
};

// ============================================
// INITIALIZATION
// ============================================
async function initializeMenu() {
    console.log('🍽️ Initializing Menu System...');
    
    // ✅ NEW: Get parameters from URL (from QR code scan)
    const urlParams = new URLSearchParams(window.location.search);
    const branchIdFromUrl = urlParams.get('branch_id');
    const tableIdFromUrl = urlParams.get('table_id');
    const tableNumberFromUrl = urlParams.get('table_number');
    
    // ✅ NEW: Handle QR code scan - save branch and table info
    if (branchIdFromUrl) {
        console.log('📱 QR Scan detected - Branch ID:', branchIdFromUrl);
        localStorage.setItem('demo_branch_id', branchIdFromUrl);
        localStorage.setItem('demo_branch_name', 'Chi nhánh'); // Can be updated later
    }
    
    if (tableIdFromUrl) {
        console.log('📱 QR Scan detected - Table ID:', tableIdFromUrl);
        localStorage.setItem('current_table_id', tableIdFromUrl);
        
        // Extract table number from ID or use provided number
        if (tableNumberFromUrl) {
            localStorage.setItem('current_table_number', tableNumberFromUrl);
        }
    }
    
    // Get table info from URL or localStorage (keep existing code)
    const tableInfo = getTableInfoFromUrl();
    if (tableInfo.tableId && !tableIdFromUrl) {
        localStorage.setItem('current_table_id', tableInfo.tableId);
        if (tableInfo.tableNumber) {
            localStorage.setItem('current_table_number', tableInfo.tableNumber);
        }
    }
    
    // Display table info
    updateTableDisplay();
    
    // Load menu data
    if (MENU_API_CONFIG.USE_API) {
        await loadMenuFromAPI();
    } else {
        loadDemoMenu();
    }
    
    // Setup UI
    renderCategories();
    renderMenu();
    setupEventListeners();

    // Wait for guest_utils to finish fetching the real table number, then refresh display.
    // This is needed because guest_utils fetches table_number asynchronously from the API
    // and updateTableDisplay() above may have run before that fetch completed.
    if (window.GuestUtils && window.GuestUtils.tableNumberReady) {
        window.GuestUtils.tableNumberReady.then(() => {
            updateTableDisplay();
        });
    }
    
    console.log('✅ Menu System Ready');
    
    // ✅ NEW: Debug logging
    console.log('📍 Current Branch ID:', localStorage.getItem('demo_branch_id'));
    console.log('🪑 Current Table ID:', localStorage.getItem('current_table_id'));
}

/**
 * Get table info from URL parameters
 */
function getTableInfoFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return {
        tableId: urlParams.get('table_id'),
        tableNumber: urlParams.get('table_number')
    };
}

/**
 * Update table display in header
 */
function updateTableDisplay() {
    const tableNumber = localStorage.getItem('current_table_number') || 'N/A';
    const desktopDisplay = document.getElementById('table-info-desktop');
    const mobileDisplay = document.getElementById('table-info-mobile');
    
    const displayText = `${tableNumber}`;
    
    if (desktopDisplay) desktopDisplay.textContent = displayText;
    if (mobileDisplay) mobileDisplay.textContent = displayText;
}

// ============================================
// API INTEGRATION
// ============================================
/**
 * Load menu from API
 */
async function loadMenuFromAPI() {
    // Try to get branch_id from URL first (demo mode), then from localStorage
    const urlParams = new URLSearchParams(window.location.search);
    let branchId = urlParams.get('branch_id') || localStorage.getItem('demo_branch_id');
    
    if (!branchId) {
        console.warn('⚠️ No branch_id found, using demo data');
        loadDemoMenu();
        return;
    }
    
    try {
        console.log('📡 Fetching menu from API for branch:', branchId);
        
        const response = await fetch(
            `${MENU_API_CONFIG.BASE_URL}${MENU_API_CONFIG.ENDPOINTS.GET_MENU}?branch_id=${branchId}`
        );
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        const items = await response.json();
        console.log('✅ Menu loaded:', items.length, 'items');
        
        // Extract unique categories
        const categoryMap = new Map();
        items.forEach(item => {
            if (!categoryMap.has(item.category_id)) {
                categoryMap.set(item.category_id, {
                    id: item.category_id,
                    name: item.category_name,
                    icon: 'restaurant' // Default icon
                });
            }
        });
        
        menuState.categories = Array.from(categoryMap.values());
        menuState.items = items.map(item => ({
            id: item.menu_item_id,
            name: item.item_name,
            description: item.description || '',
            price: item.price,
            image: item.image || 'https://via.placeholder.com/300',
            category: item.category_id,
            status: item.status,
            discount_percent: item.discount_percent || 0
        }));
        
    } catch (error) {
        console.error('❌ Failed to load menu from API:', error);
        console.log('📋 Falling back to demo data');
        loadDemoMenu();
    }
}

/**
 * Load demo menu data
 */
function loadDemoMenu() {
    menuState.categories = DEMO_MENU_DATA.categories;
    menuState.items = DEMO_MENU_DATA.items;
    console.log('📋 Demo menu loaded');
}

// ============================================
// UI RENDERING
// ============================================
/**
 * Render category navigation
 */
function renderCategories() {
    const desktopNav = document.getElementById('category-nav-desktop');
    const mobileNav = document.getElementById('category-nav-mobile');
    const chipContainer = document.getElementById('category-chips');
    
    // Desktop sidebar categories
    if (desktopNav) {
        const allCategory = `
            <button onclick="filterByCategory('all')" 
                    class="category-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${menuState.currentCategory === 'all' ? 'active' : 'hover:bg-slate-100 dark:hover:bg-white/5'}">
                <span class="material-symbols-outlined">restaurant_menu</span>
                <span class="font-medium">Tất cả món</span>
            </button>
        `;
        
        const categoryButtons = menuState.categories.map(cat => `
            <button onclick="filterByCategory('${cat.id}')" 
                    class="category-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${menuState.currentCategory === cat.id ? 'active' : 'hover:bg-slate-100 dark:hover:bg-white/5'}">
                <span class="material-symbols-outlined">${cat.icon}</span>
                <span class="font-medium">${cat.name}</span>
            </button>
        `).join('');
        
        desktopNav.innerHTML = allCategory + categoryButtons;
    }
    
    // Mobile sidebar (same as desktop)
    if (mobileNav) {
        const allCategory = `
            <button onclick="filterByCategory('all'); closeMobileMenu();" 
                    class="category-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${menuState.currentCategory === 'all' ? 'active' : 'hover:bg-slate-100 dark:hover:bg-white/5'}">
                <span class="material-symbols-outlined">restaurant_menu</span>
                <span class="font-medium">Tất cả món</span>
            </button>
        `;
        
        const categoryButtons = menuState.categories.map(cat => `
            <button onclick="filterByCategory('${cat.id}'); closeMobileMenu();" 
                    class="category-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${menuState.currentCategory === cat.id ? 'active' : 'hover:bg-slate-100 dark:hover:bg-white/5'}">
                <span class="material-symbols-outlined">${cat.icon}</span>
                <span class="font-medium">${cat.name}</span>
            </button>
        `).join('');
        
        mobileNav.innerHTML = allCategory + categoryButtons;
    }
    
    // Mobile chips
    if (chipContainer) {
        const chips = [
            `<button onclick="filterByCategory('all')" 
                     class="category-btn px-4 py-2 rounded-full border whitespace-nowrap ${menuState.currentCategory === 'all' ? 'active' : 'border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5'}">
                Tất cả
            </button>`,
            ...menuState.categories.map(cat => `
                <button onclick="filterByCategory('${cat.id}')" 
                        class="category-btn px-4 py-2 rounded-full border whitespace-nowrap ${menuState.currentCategory === cat.id ? 'active' : 'border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5'}">
                    ${cat.name}
                </button>
            `)
        ];
        
        chipContainer.innerHTML = chips.join('');
    }
}

/**
 * Render menu items grid
 */
function renderMenu() {
    const grid = document.getElementById('dishes-grid');
    if (!grid) return;
    
    const filteredItems = getFilteredItems();
    const paginatedItems = getPaginatedItems(filteredItems);
    
    if (paginatedItems.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full text-center py-12">
                <span class="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-700 mb-4">search_off</span>
                <p class="text-slate-500 dark:text-slate-400">Không tìm thấy món ăn</p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = paginatedItems.map(item => `
        <div class="group bg-white dark:bg-card-dark rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10 hover:shadow-xl transition-all">
            <div class="aspect-square bg-cover bg-center" 
                 style="background-image: url('${item.image}')"></div>
            
            <div class="p-4">
                <h3 class="font-bold text-lg mb-1 group-hover:text-primary transition-colors line-clamp-1">
                    ${item.name}
                </h3>
                <p class="text-sm text-slate-500 dark:text-slate-400 mb-3 line-clamp-2">
                    ${item.description}
                </p>
                
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-xl font-black text-primary">
                            ${formatPrice(item.price)}
                        </p>
                        ${item.discount_percent > 0 ? `
                            <p class="text-xs text-slate-400 line-through">
                                ${formatPrice(item.price * (1 + item.discount_percent / 100))}
                            </p>
                        ` : ''}
                    </div>
                    
                    <button onclick="addToCart('${item.id}')" 
                            class="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl font-medium transition-all">
                        <span class="material-symbols-outlined text-sm">add</span>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
    
    renderPagination(filteredItems.length);
}

/**
 * Filter items by category and search
 */
function getFilteredItems() {
    let items = menuState.items;
    
    // Filter by category
    if (menuState.currentCategory !== 'all') {
        items = items.filter(item => item.category === menuState.currentCategory);
    }
    
    // Filter by search query
    if (menuState.searchQuery) {
        const query = menuState.searchQuery.toLowerCase();
        items = items.filter(item => 
            item.name.toLowerCase().includes(query) ||
            item.description.toLowerCase().includes(query)
        );
    }
    
    return items;
}

/**
 * Get paginated items
 */
function getPaginatedItems(items) {
    const start = (menuState.currentPage - 1) * menuState.itemsPerPage;
    const end = start + menuState.itemsPerPage;
    return items.slice(start, end);
}

/**
 * Render pagination controls
 */
function renderPagination(totalItems) {
    const totalPages = Math.ceil(totalItems / menuState.itemsPerPage);
    const paginationInfo = document.getElementById('pagination-info');
    const pageNumbers = document.getElementById('page-numbers');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    
    if (paginationInfo) {
        const start = (menuState.currentPage - 1) * menuState.itemsPerPage + 1;
        const end = Math.min(menuState.currentPage * menuState.itemsPerPage, totalItems);
        paginationInfo.textContent = `Hiển thị ${start}-${end} trong ${totalItems} món`;
    }
    
    if (prevBtn) {
        prevBtn.disabled = menuState.currentPage === 1;
    }
    
    if (nextBtn) {
        nextBtn.disabled = menuState.currentPage === totalPages;
    }
    
    if (pageNumbers) {
        const pages = [];
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || Math.abs(i - menuState.currentPage) <= 1) {
                pages.push(`
                    <button onclick="goToPage(${i})" 
                            class="px-3 py-1 rounded ${i === menuState.currentPage ? 'bg-primary text-white' : 'hover:bg-slate-100 dark:hover:bg-white/5'}">
                        ${i}
                    </button>
                `);
            } else if (pages[pages.length - 1] !== '...') {
                pages.push('...');
            }
        }
        pageNumbers.innerHTML = pages.join('');
    }
}

// ============================================
// USER INTERACTIONS
// ============================================
function filterByCategory(categoryId) {
    menuState.currentCategory = categoryId;
    menuState.currentPage = 1;
    renderCategories();
    renderMenu();
    
    // Update page title
    const categoryName = categoryId === 'all' ? 'Thực đơn' : 
        menuState.categories.find(c => c.id === categoryId)?.name || 'Thực đơn';
    
    const titleEl = document.getElementById('category-title');
    if (titleEl) titleEl.textContent = categoryName;
}

function handleSearch(event) {
    menuState.searchQuery = event.target.value;
    menuState.currentPage = 1;
    renderMenu();
}

function goToPage(page) {
    menuState.currentPage = page;
    renderMenu();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function addToCart(itemId) {
    const item = menuState.items.find(i => i.id === itemId);
    if (!item) {
        console.error('❌ Item not found:', itemId);
        return;
    }
    
    window.CartStorage.add({
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        image: item.image,
        category: item.category
    });
}

function formatPrice(price) {
    return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
}

// ============================================
// MOBILE MENU CONTROLS
// ============================================
function openMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    const overlay = document.getElementById('menu-overlay');
    
    if (menu) menu.classList.add('open');
    if (overlay) overlay.classList.remove('hidden');
}

function closeMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    const overlay = document.getElementById('menu-overlay');
    
    if (menu) menu.classList.remove('open');
    if (overlay) overlay.classList.add('hidden');
}

// ============================================
// EVENT LISTENERS
// ============================================
function setupEventListeners() {
    // Search inputs
    const searchInputs = [
        document.getElementById('search-input'),
        document.getElementById('search-input-mobile')
    ];
    
    searchInputs.forEach(input => {
        if (input) {
            input.addEventListener('input', handleSearch);
        }
    });
    
    // Mobile menu controls
    const openMenuBtn = document.getElementById('open-menu');
    const closeMenuBtn = document.getElementById('close-menu');
    const overlay = document.getElementById('menu-overlay');
    
    if (openMenuBtn) openMenuBtn.addEventListener('click', openMobileMenu);
    if (closeMenuBtn) closeMenuBtn.addEventListener('click', closeMobileMenu);
    if (overlay) overlay.addEventListener('click', closeMobileMenu);
    
    // Pagination
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (menuState.currentPage > 1) {
                goToPage(menuState.currentPage - 1);
            }
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(
                getFilteredItems().length / menuState.itemsPerPage
            );
            if (menuState.currentPage < totalPages) {
                goToPage(menuState.currentPage + 1);
            }
        });
    }
}

// ============================================
// GLOBAL EXPORTS
// ============================================
window.filterByCategory = filterByCategory;
window.goToPage = goToPage;
window.addToCart = addToCart;

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', initializeMenu);