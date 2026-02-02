// ============================================
// CART MANAGEMENT SYSTEM FOR GUEST ORDERING
// ============================================
// NOTE: This cart system is designed for GUESTS (users without accounts).
// - GUESTS: No account, no login required, temporary cart in localStorage
// - CUSTOMERS: Have accounts, their orders are saved with customer_id in database
// 
// Key Differences:
// - Guest orders: customer_id = NULL in database
// - Customer orders: customer_id = valid UUID in database
// - This file handles the cart UI and localStorage for BOTH, but the 
//   distinction is made during order submission (see order.js)
// ============================================

// ============================================
// CART STORAGE - Data Management
// ============================================
let cartItems = [];
const STORAGE_KEY = 'gourmet_cart_items';

/**
 * Add item to cart
 * @param {Object} dish - {id, name, price, image, category, description}
 * @returns {boolean} - Success
 */
function addItemToCart(dish) {
    if (!dish || !dish.name || !dish.price) {
        console.error('❌ Invalid dish data:', dish);
        return false;
    }
    
    const existingItem = cartItems.find(item => 
        item.id === dish.id || 
        (item.name === dish.name && item.category === dish.category)
    );
    
    if (existingItem) {
        existingItem.quantity += 1;
        console.log('📈 Increased quantity:', existingItem.name, '→', existingItem.quantity);
    } else {
        cartItems.push({
            id: dish.id || `item-${Date.now()}`,
            name: dish.name,
            description: dish.description || '',
            price: dish.price,
            image: dish.image || '',
            category: dish.category || 'main',
            quantity: 1,
            note: '',  // ✅ NEW: Customer note for special requests
            addedAt: new Date().toISOString()
        });
        console.log('➕ Added new item:', dish.name);
    }
    
    saveToLocalStorage();
    updateCartDisplay(getTotalQuantity(), getTotalPrice());
    animateCartButton();
    showNotification(`Đã thêm ${dish.name} vào giỏ hàng`, 'success');
    
    return true;
}

/**
 * Remove item from cart
 * @param {number} index - Position in cartItems array
 * @returns {boolean} - Success
 */
function removeItemFromCart(index) {
    if (index < 0 || index >= cartItems.length) {
        console.error('❌ Invalid index:', index);
        return false;
    }
    
    const removedItem = cartItems.splice(index, 1)[0];
    console.log('🗑️ Removed:', removedItem.name);
    
    saveToLocalStorage();
    updateCartDisplay(getTotalQuantity(), getTotalPrice());
    return true;
}

/**
 * Update item quantity
 * @param {number} index - Position in array
 * @param {number} newQuantity - New quantity
 * @returns {boolean} - Success
 */
function updateItemQuantity(index, newQuantity) {
    if (index < 0 || index >= cartItems.length) {
        console.error('❌ Invalid index:', index);
        return false;
    }
    
    if (newQuantity <= 0) {
        return removeItemFromCart(index);
    }
    
    cartItems[index].quantity = parseInt(newQuantity);
    console.log('🔄 Updated quantity:', cartItems[index].name, '→', newQuantity);
    
    saveToLocalStorage();
    updateCartDisplay(getTotalQuantity(), getTotalPrice());
    return true;
}

/**
 * Update item note
 * @param {number} index - Position in array
 * @param {string} note - Customer note/special request
 * @returns {boolean} - Success
 */
function updateItemNote(index, note) {
    if (index < 0 || index >= cartItems.length) {
        console.error('❌ Invalid index:', index);
        return false;
    }
    
    cartItems[index].note = note || '';
    console.log('📝 Updated note for:', cartItems[index].name);
    
    saveToLocalStorage();
    return true;
}

/**
 * Increase quantity
 */
function increaseQuantity(index) {
    if (index >= 0 && index < cartItems.length) {
        cartItems[index].quantity += 1;
        saveToLocalStorage();
        updateCartDisplay(getTotalQuantity(), getTotalPrice());
        return true;
    }
    return false;
}

/**
 * Decrease quantity
 */
function decreaseQuantity(index) {
    if (index >= 0 && index < cartItems.length) {
        if (cartItems[index].quantity > 1) {
            cartItems[index].quantity -= 1;
            saveToLocalStorage();
            updateCartDisplay(getTotalQuantity(), getTotalPrice());
            return true;
        } else {
            return removeItemFromCart(index);
        }
    }
    return false;
}

/**
 * Get all cart items
 * @returns {Array} - Copy of cart items
 */
function getCartItems() {
    return [...cartItems];
}

/**
 * Get total quantity (including item quantities)
 * @returns {number}
 */
function getTotalQuantity() {
    return cartItems.reduce((sum, item) => sum + item.quantity, 0);
}

/**
 * Get total price
 * @returns {number}
 */
function getTotalPrice() {
    return cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

/**
 * Get item count (unique items)
 * @returns {number}
 */
function getItemCount() {
    return cartItems.length;
}

/**
 * Get items by category
 * @param {string} category - Category name
 * @returns {Array}
 */
function getItemsByCategory(category) {
    return cartItems.filter(item => item.category === category);
}

/**
 * Find item by ID
 * @param {string|number} itemId
 * @returns {Object|null}
 */
function findItemById(itemId) {
    return cartItems.find(item => item.id === itemId) || null;
}

/**
 * Clear entire cart
 */
function clearCart() {
    cartItems = [];
    saveToLocalStorage();
    updateCartDisplay(0, 0);
    console.log('🗑️ Cart cleared');
}

/**
 * Save to localStorage
 */
function saveToLocalStorage() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cartItems));
        console.log('💾 Cart saved:', cartItems.length, 'items');
    } catch (error) {
        console.error('❌ localStorage save error:', error);
    }
}

/**
 * Load from localStorage
 */
function loadFromLocalStorage() {
    try {
        const savedData = localStorage.getItem(STORAGE_KEY);
        if (savedData) {
            cartItems = JSON.parse(savedData);
            console.log('✅ Cart loaded from localStorage:', cartItems.length, 'items');
            return true;
        }
    } catch (error) {
        console.error('❌ localStorage load error:', error);
        cartItems = [];
    }
    return false;
}

/**
 * Print cart info (debug)
 */
function printCartInfo() {
    console.log('🛒 CART INFO:');
    console.log('📦 Unique items:', getItemCount());
    console.log('🔢 Total quantity:', getTotalQuantity());
    console.log('💰 Total price:', getTotalPrice().toLocaleString('vi-VN') + 'đ');
    console.log('📋 Details:');
    cartItems.forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.name} x${item.quantity} = ${(item.price * item.quantity).toLocaleString('vi-VN')}đ`);
    });
}

// ============================================
// CART UI - Display Management
// ============================================

/**
 * Update cart display on UI
 * @param {number} quantity - Total quantity
 * @param {number} totalPrice - Total price
 */
function updateCartDisplay(quantity, totalPrice) {
    // Update cart badges
    const cartBadges = document.querySelectorAll('.cart-badge');
    cartBadges.forEach(badge => {
        badge.textContent = quantity;
    });
    
    // Update cart prices
    const cartPrices = document.querySelectorAll('.cart-price');
    cartPrices.forEach(priceElement => {
        priceElement.textContent = formatPrice(totalPrice);
    });
    
    // Update cart quantities
    const cartQuantities = document.querySelectorAll('.cart-quantity');
    cartQuantities.forEach(qtyElement => {
        qtyElement.textContent = quantity;
    });
    
    console.log('🛒 UI updated:', {
        quantity: quantity,
        total: formatPrice(totalPrice)
    });
}

/**
 * Animate cart button when adding item
 */
function animateCartButton() {
    const cartButtons = document.querySelectorAll('.cart-button');
    cartButtons.forEach(button => {
        button.classList.add('scale-110');
        setTimeout(() => {
            button.classList.remove('scale-110');
        }, 200);
    });
}

/**
 * Format price (Vietnamese currency)
 * @param {number} price - Price to format
 * @returns {string} - Formatted price
 */
function formatPrice(price) {
    return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
}

/**
 * Show notification
 * @param {string} message - Message to display
 * @param {string} type - success, error, info, warning
 */
function showNotification(message, type = 'success') {
    const oldNotification = document.querySelector('.cart-notification');
    if (oldNotification) {
        oldNotification.remove();
    }
    
    const notification = document.createElement('div');
    
    const colors = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        info: 'bg-blue-500',
        warning: 'bg-yellow-500'
    };
    
    const icons = {
        success: 'check_circle',
        error: 'error',
        info: 'info',
        warning: 'warning'
    };
    
    const bgColor = colors[type] || colors.success;
    const icon = icons[type] || icons.success;
    
    notification.className = `cart-notification fixed top-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg z-[100] flex items-center gap-2 transition-opacity duration-300`;
    notification.innerHTML = `
        <span class="material-symbols-outlined text-sm">${icon}</span>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

/**
 * Reset cart display to 0
 */
function resetCartDisplay() {
    updateCartDisplay(0, 0);
}

/**
 * Render cart items list
 * @param {Array} items - List of items [{name, price, quantity}]
 */
function renderCartItems(items) {
    const cartList = document.querySelector('.cart-list');
    if (!cartList) return;

    cartList.innerHTML = '';

    items.forEach(item => {
        const li = document.createElement('li');
        li.className = 'cart-item flex justify-between py-2 border-b';
        li.innerHTML = `
            <span>${item.name} x${item.quantity}</span>
            <span>${formatPrice(item.price * item.quantity)}</span>
        `;
        cartList.appendChild(li);
    });

    console.log('📋 Cart items rendered:', items);
}

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🗄️ Initializing Cart System...');
    loadFromLocalStorage();
    
    if (cartItems.length > 0) {
        updateCartDisplay(getTotalQuantity(), getTotalPrice());
    } else {
        resetCartDisplay();
    }
});

// ============================================
// GLOBAL EXPORT
// ============================================
window.CartStorage = {
    // Data operations
    add: addItemToCart,
    remove: removeItemFromCart,
    updateQuantity: updateItemQuantity,
    updateNote: updateItemNote,  // ✅ NEW: Update item note
    increase: increaseQuantity,
    decrease: decreaseQuantity,
    clear: clearCart,
    
    // Getters
    getItems: getCartItems,
    getItemCount: getItemCount,
    getTotalQuantity: getTotalQuantity,
    getTotalPrice: getTotalPrice,
    getItemsByCategory: getItemsByCategory,
    findById: findItemById,
    
    // Utilities
    print: printCartInfo,
    save: saveToLocalStorage,
    load: loadFromLocalStorage
};

window.CartUI = {
    update: updateCartDisplay,
    animate: animateCartButton,
    notify: showNotification,
    reset: resetCartDisplay,
    formatPrice: formatPrice,
    renderItems: renderCartItems
};