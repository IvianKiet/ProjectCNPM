// detail_menu.js - WITH DISCOUNT SUPPORT + JWT Authentication

// ============== AUTHENTICATION INITIALIZATION ==============
let currentUser = null;

async function initializeAuth() {
    try {
        currentUser = await initAuthenticatedPage();
        if (!currentUser) {
            return false;
        }
        console.log("Current user:", currentUser);
        setupLogoutButton('#logout-btn');
        setupTokenRefresh();
        return true;
    } catch (error) {
        console.error("Auth initialization error:", error);
        return false;
    }
}
// ============== END AUTHENTICATION ==============

// Get branch_id from URL
const urlParams = new URLSearchParams(window.location.search);
const branchId = urlParams.get('branch_id');


if (!branchId) {
    alert("Không tìm thấy thông tin chi nhánh");
    window.location.href = 'menu_restaurant.html';
}

let currentBranch = null;
let allMenuItems = [];
let allCategories = [];
let editingItemId = null;
let uploadedImage = null;
let currentFilter = 'all';

// Load branch and menu data
async function loadMenuData() {
    try {
        currentBranch = await BranchAPI.getOne(branchId);
        updatePageHeader();
        allCategories = await CategoryAPI.getAll();
        
        renderCategoryFilters();
        
        allMenuItems = [];
        for (const category of allCategories) {
            try {
                const items = await MenuAPI.getByCategory(category.category_id, branchId);
                items.forEach(item => {
                    item.category_name = category.category_name;
                });
                allMenuItems = allMenuItems.concat(items);
            } catch (error) {
                console.warn(`Could not load items for category ${category.category_id}:`, error);
            }
        }
        
        filterAndRenderItems(currentFilter);
        
    } catch (error) {
        console.error("Error loading menu data:", error);
        alert("Lỗi tải dữ liệu: " + error.message);
    }
}

function updatePageHeader() {
    const breadcrumb = document.querySelector('nav.flex.items-center h2');
    if (breadcrumb) {
        breadcrumb.textContent = `Chi nhánh ${currentBranch.branch_name}`;
    }
    
    const description = document.querySelector('.max-w-7xl p.text-gray-500');
    if (description) {
        description.textContent = `Quản lý ${allMenuItems.length} món ăn cho ${currentBranch.branch_name}`;
    }
}

// Render category filter buttons
function renderCategoryFilters() {
    const filterContainer = document.querySelector('.flex.overflow-x-auto.pb-4.mb-4');
    if (!filterContainer) return;
    
    filterContainer.innerHTML = '';
    
    const allBtn = createFilterButton('all', 'Tất cả món', currentFilter === 'all');
    filterContainer.appendChild(allBtn);
    
    allCategories.forEach(category => {
        const btn = createFilterButton(
            category.category_id, 
            category.category_name, 
            currentFilter === category.category_id
        );
        filterContainer.appendChild(btn);
    });
}

function createFilterButton(filterId, label, isActive) {
    const button = document.createElement('button');
    button.textContent = label;
    button.onclick = () => filterAndRenderItems(filterId);
    
    if (isActive) {
        button.className = 'px-4 py-2 rounded-full bg-primary text-white text-sm font-medium whitespace-nowrap shadow-sm';
    } else {
        button.className = 'px-4 py-2 rounded-full bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium whitespace-nowrap transition-colors';
    }
    
    return button;
}

function filterAndRenderItems(filterId) {
    currentFilter = filterId;
    
    let filteredItems;
    if (filterId === 'all') {
        filteredItems = allMenuItems;
    } else {
        filteredItems = allMenuItems.filter(item => item.category_id === filterId);
    }
    
    renderMenuItems(filteredItems);
    renderCategoryFilters();
}

function renderMenuItems(items) {
    const container = document.querySelector('.grid.grid-cols-1.sm\\:grid-cols-2');
    
    if (!container) {
        console.error("Menu container not found");
        return;
    }
    
    container.innerHTML = '';
    
    if (!items || items.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-12">
                <span class="material-symbols-outlined text-gray-400 text-6xl mb-4">restaurant_menu</span>
                <p class="text-gray-500 dark:text-gray-400">Chưa có món ăn nào. Nhấn "Thêm món mới" để bắt đầu.</p>
            </div>
        `;
        return;
    }
    
    items.forEach(item => {
        renderMenuItem(item, container);
    });
    
    updatePaginationInfo(items.length);
}

// ✅ NEW: Calculate discounted price
function calculateDiscountedPrice(price, discountPercent) {
    if (!discountPercent || discountPercent <= 0) return null;
    return price * (1 - discountPercent / 100);
}

// ✅ UPDATED: Render menu item with discount display
function renderMenuItem(item, container) {
    const statusConfig = getItemStatusConfig(item.status);
    const hasDiscount = item.discount_percent && item.discount_percent > 0;
    const discountedPrice = hasDiscount ? calculateDiscountedPrice(item.price, item.discount_percent) : null;
    
    const card = `
        <div class="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm hover:shadow-md transition-all group overflow-hidden flex flex-col" data-item-id="${item.menu_item_id}">
            <div class="aspect-video w-full bg-gray-200 dark:bg-gray-700 relative overflow-hidden">
                ${item.image ? 
                    `<img alt="${item.item_name}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" src="${item.image}"/>` :
                    `<div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800">
                        <span class="material-symbols-outlined text-gray-400 text-6xl">restaurant</span>
                    </div>`
                }
                ${hasDiscount ? `
                    <div class="absolute top-2 left-2">
                        <span class="px-2 py-1 rounded-md text-xs font-bold bg-red-500 text-white shadow-lg">
                            -${item.discount_percent}%
                        </span>
                    </div>
                ` : ''}
                <div class="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onclick="editMenuItem('${item.menu_item_id}')" class="p-1.5 bg-white/90 dark:bg-gray-800/90 rounded-full hover:text-primary text-gray-600 dark:text-gray-300 shadow-sm backdrop-blur-sm">
                        <span class="material-symbols-outlined text-sm">edit</span>
                    </button>
                    <button onclick="deleteMenuItem('${item.menu_item_id}')" class="p-1.5 bg-white/90 dark:bg-gray-800/90 rounded-full hover:text-red-500 text-gray-600 dark:text-gray-300 shadow-sm backdrop-blur-sm">
                        <span class="material-symbols-outlined text-sm">delete</span>
                    </button>
                </div>
                <div class="absolute bottom-2 left-2">
                    <span class="px-2 py-1 rounded text-xs font-bold bg-black/60 text-white backdrop-blur-sm">${item.category_name || 'Khác'}</span>
                </div>
            </div>
            <div class="p-4 flex-1 flex flex-col">
                <div class="flex justify-between items-start mb-2">
                    <h3 class="font-bold text-gray-900 dark:text-white line-clamp-1 group-hover:text-primary transition-colors">${item.item_name}</h3>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">${item.description || 'Chưa có mô tả'}</p>
                <div class="mt-auto flex items-center justify-between border-t border-border-light dark:border-border-dark pt-3">
                    <div class="flex items-center gap-2">
                        ${hasDiscount ? `
                            <span class="text-gray-400 line-through text-sm">${formatPrice(item.price)}</span>
                            <span class="text-primary font-bold">${formatPrice(discountedPrice)}</span>
                        ` : `
                            <span class="text-primary font-bold">${formatPrice(item.price)}</span>
                        `}
                    </div>
                    <div class="flex items-center gap-1">
                        <span class="w-2 h-2 rounded-full ${statusConfig.dotColor}"></span>
                        <span class="text-xs text-gray-500 dark:text-gray-400">${statusConfig.label}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', card);
}

function getItemStatusConfig(status) {
    const configs = {
        'available': { dotColor: 'bg-green-500', label: 'Còn hàng' },
        'unavailable': { dotColor: 'bg-red-500', label: 'Hết hàng' },
        'out_of_stock': { dotColor: 'bg-red-500', label: 'Hết hàng' }
    };
    return configs[status] || configs['available'];
}

function formatPrice(price) {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(price);
}

function updatePaginationInfo(totalItems) {
    const paginationText = document.querySelector('.flex.items-center.justify-between .text-sm');
    if (paginationText) {
        paginationText.innerHTML = `Hiển thị <span class="font-medium text-gray-900 dark:text-white">1</span> đến <span class="font-medium text-gray-900 dark:text-white">${totalItems}</span> trong tổng số <span class="font-medium text-gray-900 dark:text-white">${totalItems}</span> món`;
    }
}

// Open add dish modal
window.openAddDishModal = function() {
    const modal = document.getElementById('addDishModal');
    modal.classList.add('active');
    
    // Reset form
    document.getElementById('dish-name').value = '';
    document.getElementById('dish-price').value = '';
    document.getElementById('dish-discount').value = '0';  // ✅ NEW
    document.getElementById('dish-desc').value = '';
    document.getElementById('dish-status').checked = true;
    
    // Reset image
    uploadedImage = null;
    const imagePreview = document.getElementById('image-preview');
    if (imagePreview) imagePreview.remove();
    
    editingItemId = null;
    
    const modalTitle = modal.querySelector('h3');
    if (modalTitle) modalTitle.textContent = 'Thêm món ăn mới';
    
    populateCategoryDropdown();
}

// Close add dish modal
window.closeAddDishModal = function() {
    const modal = document.getElementById('addDishModal');
    modal.classList.remove('active');
    editingItemId = null;
    uploadedImage = null;
}

// Populate category dropdown
function populateCategoryDropdown() {
    const select = document.getElementById('dish-category');
    select.innerHTML = '';
    
    if (allCategories.length === 0) {
        select.innerHTML = '<option value="">Chưa có danh mục - Vui lòng tạo danh mục trước</option>';
        return;
    }
    
    allCategories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.category_id;
        option.textContent = category.category_name;
        select.appendChild(option);
    });
}

// Handle image upload WITH COMPRESSION
window.handleImageUpload = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
        alert("Ảnh quá lớn! Vui lòng chọn ảnh dưới 5MB");
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            const MAX_WIDTH = 800;
            const MAX_HEIGHT = 600;
            
            let width = img.width;
            let height = img.height;
            
            if (width > height) {
                if (width > MAX_WIDTH) {
                    height = Math.round((height * MAX_WIDTH) / width);
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width = Math.round((width * MAX_HEIGHT) / height);
                    height = MAX_HEIGHT;
                }
            }
            
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            
            uploadedImage = canvas.toDataURL('image/jpeg', 0.8);
            
            const uploadArea = document.querySelector('.border-dashed');
            let preview = document.getElementById('image-preview');
            
            if (!preview) {
                preview = document.createElement('img');
                preview.id = 'image-preview';
                preview.className = 'mt-2 rounded-lg max-h-40 mx-auto';
                uploadArea.appendChild(preview);
            }
            
            preview.src = uploadedImage;
        };
        
        img.src = e.target.result;
    };
    
    reader.readAsDataURL(file);
}

// Setup file upload listener
document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('file-upload');
    if (fileInput) {
        fileInput.addEventListener('change', handleImageUpload);
    }
});

// ✅ UPDATED: Handle form submission with discount
window.handleDishSubmit = async function(event) {
    event.preventDefault();
    
    const dishName = document.getElementById('dish-name').value.trim();
    const dishPrice = parseFloat(document.getElementById('dish-price').value);
    const dishDiscount = parseFloat(document.getElementById('dish-discount').value) || 0;  // ✅ NEW
    const dishCategory = document.getElementById('dish-category').value;
    const dishDesc = document.getElementById('dish-desc').value.trim();
    const dishStatus = document.getElementById('dish-status').checked ? 'available' : 'unavailable';
    
    // Validation
    if (!dishName) {
        alert("Vui lòng nhập tên món ăn");
        return;
    }
    
    if (!dishPrice || dishPrice <= 0) {
        alert("Vui lòng nhập giá hợp lệ");
        return;
    }
    
    if (dishDiscount < 0 || dishDiscount > 100) {
        alert("Giảm giá phải từ 0% đến 100%");
        return;
    }
    
    if (!dishCategory) {
        alert("Vui lòng chọn danh mục");
        return;
    }
    
    try {
        if (editingItemId) {
            const updateData = {
                category_id: dishCategory,  // ✅ ADDED: Allow category updates
                item_name: dishName,
                description: dishDesc,
                price: dishPrice,
                discount_percent: dishDiscount,  // ✅ NEW
                status: dishStatus,
                image: uploadedImage
            };
            
            await MenuAPI.update(editingItemId, updateData);
            alert("Cập nhật món ăn thành công!");
        } else {
            const menuItemData = {
                category_id: dishCategory,
                branch_id: branchId,
                item_name: dishName,
                description: dishDesc,
                price: dishPrice,
                discount_percent: dishDiscount,  // ✅ NEW
                status: dishStatus,
                image: uploadedImage
            };
            
            await MenuAPI.create(menuItemData);
            alert("Thêm món ăn thành công!");
        }
        
        closeAddDishModal();
        await loadMenuData();
        
    } catch (error) {
        console.error("Error saving menu item:", error);
        alert("Lỗi lưu món ăn: " + error.message);
    }
}

// ✅ UPDATED: Edit menu item with discount
window.editMenuItem = async function(menuItemId) {
    try {
        const item = await MenuAPI.getOne(menuItemId);
        
        editingItemId = menuItemId;
        uploadedImage = item.image || null;
        
        const modal = document.getElementById('addDishModal');
        modal.classList.add('active');
        
        populateCategoryDropdown();
        
        document.getElementById('dish-name').value = item.item_name;
        document.getElementById('dish-price').value = item.price;
        document.getElementById('dish-discount').value = item.discount_percent || 0;  // ✅ NEW
        document.getElementById('dish-category').value = item.category_id;
        document.getElementById('dish-desc').value = item.description || '';
        document.getElementById('dish-status').checked = item.status === 'available';
        
        if (item.image) {
            const uploadArea = document.querySelector('.border-dashed');
            let preview = document.getElementById('image-preview');
            
            if (!preview) {
                preview = document.createElement('img');
                preview.id = 'image-preview';
                preview.className = 'mt-2 rounded-lg max-h-40 mx-auto';
                uploadArea.appendChild(preview);
            }
            
            preview.src = item.image;
        }
        
        const modalTitle = document.querySelector('#addDishModal h3');
        if (modalTitle) modalTitle.textContent = 'Chỉnh sửa món ăn';
        
    } catch (error) {
        console.error("Error loading menu item:", error);
        alert("Lỗi tải thông tin: " + error.message);
    }
}

// Category Management Modal
window.openCategoryModal = function() {
    const modal = document.getElementById('categoryModal');
    if (modal) {
        modal.classList.add('active');
        renderCategoryList();
    }
}

window.closeCategoryModal = function() {
    const modal = document.getElementById('categoryModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

function renderCategoryList() {
    const container = document.getElementById('category-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (allCategories.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                Chưa có danh mục nào. Nhấn "Thêm danh mục" để tạo mới.
            </div>
        `;
        return;
    }
    
    allCategories.forEach(cat => {
        const catCard = `
            <div class="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div>
                    <h4 class="font-medium text-gray-900 dark:text-white">${cat.category_name}</h4>
                    <p class="text-xs text-gray-500 dark:text-gray-400">${cat.description || 'Không có mô tả'}</p>
                </div>
                <button onclick="deleteCategory('${cat.category_id}')" class="text-red-500 hover:text-red-700">
                    <span class="material-symbols-outlined">delete</span>
                </button>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', catCard);
    });
}

window.addNewCategory = async function() {
    const name = prompt("Tên danh mục:");
    if (!name || !name.trim()) return;
    
    const description = prompt("Mô tả (tùy chọn):");
    
    try {
        await CategoryAPI.create({
            category_name: name.trim(),
            description: description?.trim() || '',
            status: 'active'
        });
        
        allCategories = await CategoryAPI.getAll();
        renderCategoryList();
        renderCategoryFilters();
        alert("Thêm danh mục thành công!");
        
    } catch (error) {
        alert("Lỗi tạo danh mục: " + error.message);
    }
}

window.deleteCategory = async function(categoryId) {
    if (!confirm("Xóa danh mục này sẽ xóa tất cả món ăn trong danh mục. Bạn có chắc?")) return;
    
    try {
        alert("Chức năng xóa danh mục chưa được triển khai trên API");
    } catch (error) {
        alert("Lỗi xóa danh mục: " + error.message);
    }
}

window.createDefaultCategories = async function() {
    try {
        const defaultCategories = [
            { category_name: 'Món chính', description: 'Các món ăn chính', status: 'active' },
            { category_name: 'Khai vị', description: 'Món khai vị', status: 'active' },
            { category_name: 'Tráng miệng', description: 'Món tráng miệng', status: 'active' },
            { category_name: 'Đồ uống', description: 'Nước uống các loại', status: 'active' }
        ];
        
        for (const cat of defaultCategories) {
            await CategoryAPI.create(cat);
        }
        
        alert("Đã tạo 4 danh mục mặc định!");
        allCategories = await CategoryAPI.getAll();
        renderCategoryList();
        renderCategoryFilters();
        
    } catch (error) {
        alert("Lỗi tạo danh mục: " + error.message);
    }
}

// Delete menu item
window.deleteMenuItem = async function(menuItemId) {
    if (!confirm("Bạn có chắc muốn xóa món ăn này?")) return;
    
    try {
        await MenuAPI.delete(menuItemId);
        alert("Xóa món ăn thành công!");
        
        await loadMenuData();
        
    } catch (error) {
        console.error("Error deleting menu item:", error);
        alert("Xóa món ăn thất bại: " + error.message);
    }
}

// Initialize

// Initialize - WITH AUTHENTICATION
window.addEventListener('DOMContentLoaded', async () => {
    // Check branch_id first
    if (!branchId) {
        alert("Không tìm thấy thông tin chi nhánh");
        window.location.href = 'menu_restaurant.html';
        return;
    }
    
    // Initialize authentication
    const authSuccess = await initializeAuth();
    if (!authSuccess) {
        return; // Will redirect to login
    }
    
    // Load menu data
    await loadMenuData();
});