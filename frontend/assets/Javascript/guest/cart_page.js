// ============================================
// CART PAGE - Render cart items with notes
// ============================================

/**
 * Render all cart items on the cart/checkout page
 */
function renderOrderCart() {
    console.log('🎨 renderOrderCart called');
    const cartContainer = document.getElementById('cart-items-container');
    if (!cartContainer) {
        console.error('❌ Cart container not found');
        return;
    }

    const items = window.CartStorage.getItems();
    console.log('📦 Cart items:', items.length, items);
    
    if (items.length === 0) {
        cartContainer.innerHTML = `
            <div class="text-center py-12">
                <span class="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-600 mb-4">shopping_cart</span>
                <p class="text-slate-500 dark:text-slate-400 mb-4">Giỏ hàng của bạn đang trống</p>
                <a href="menu.html" class="inline-block px-6 py-3 bg-primary text-white rounded-lg font-bold hover:bg-primary/90 transition">
                    Quay lại chọn món
                </a>
            </div>
        `;
        updateSummary();
        toggleConfirmButton(false);
        return;
    }

    cartContainer.innerHTML = items.map((item, index) => `
        <div class="bg-white dark:bg-surface-dark rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-slate-200 dark:border-white/5 shadow-sm">
            <div class="flex gap-4">
                <!-- Image -->
                <div class="w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 flex-shrink-0">
                    ${item.image ? 
                        `<img src="${item.image}" alt="${item.name}" class="w-full h-full object-cover" onerror="this.src='https://via.placeholder.com/100'">` :
                        `<div class="w-full h-full flex items-center justify-center">
                            <span class="material-symbols-outlined text-slate-400 text-3xl">restaurant</span>
                        </div>`
                    }
                </div>

                <!-- Details -->
                <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-start mb-2">
                        <div class="flex-1 pr-2">
                            <h3 class="font-bold text-base sm:text-lg text-slate-900 dark:text-white line-clamp-1">
                                ${item.name}
                            </h3>
                            ${item.description ? 
                                `<p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">
                                    ${item.description}
                                </p>` : 
                                ''
                            }
                        </div>
                        <button onclick="removeItem(${index})" 
                            class="text-red-500 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition touch-target-lg">
                            <span class="material-symbols-outlined text-xl">delete</span>
                        </button>
                    </div>

                    <!-- Price and Quantity -->
                    <div class="flex items-center justify-between mt-3 sm:mt-4">
                        <div class="text-primary font-bold text-base sm:text-lg">
                            ${window.CartUI.formatPrice(item.price)}
                        </div>
                        
                        <div class="flex items-center gap-2 sm:gap-3 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                            <button onclick="decreaseQuantity(${index})" 
                                class="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 transition touch-target-lg">
                                <span class="material-symbols-outlined text-lg">remove</span>
                            </button>
                            <span class="font-bold text-base sm:text-lg w-8 text-center">${item.quantity}</span>
                            <button onclick="increaseQuantity(${index})" 
                                class="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 transition touch-target-lg">
                                <span class="material-symbols-outlined text-lg">add</span>
                            </button>
                        </div>
                    </div>

                    <!-- ✅ NEW: Note Input -->
                    <div class="mt-3 sm:mt-4">
                        <div class="relative">
                            <textarea 
                                id="note-${index}"
                                placeholder="Ghi chú đặc biệt (VD: không hành, ít cay...)"
                                class="w-full px-3 py-2 sm:px-4 sm:py-3 text-sm sm:text-base rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                                rows="2"
                                maxlength="200"
                                onchange="updateNote(${index}, this.value)"
                            >${item.note || ''}</textarea>
                            <div class="absolute bottom-2 right-2 text-xs text-slate-400">
                                <span id="note-count-${index}">${(item.note || '').length}</span>/200
                            </div>
                        </div>
                    </div>

                    <!-- Item Subtotal -->
                    <div class="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-slate-200 dark:border-white/5 flex justify-between items-center">
                        <span class="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Tạm tính:</span>
                        <span class="font-bold text-slate-900 dark:text-white">
                            ${window.CartUI.formatPrice(item.price * item.quantity)}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    `).join('');

    updateSummary();
    toggleConfirmButton(items.length > 0);
}

/**
 * Update order summary
 */
function updateSummary() {
    const items = window.CartStorage.getItems();
    const subtotal = window.CartStorage.getTotalPrice();
    const tax = subtotal * 0.1;
    const total = subtotal + tax;

    // Update subtotal
    const subtotalElement = document.getElementById('summary-subtotal');
    if (subtotalElement) {
        subtotalElement.textContent = window.CartUI.formatPrice(subtotal);
    }

    // Update tax
    const taxElement = document.getElementById('summary-tax');
    if (taxElement) {
        taxElement.textContent = window.CartUI.formatPrice(tax);
    }

    // Update total
    const totalElement = document.getElementById('summary-total');
    if (totalElement) {
        totalElement.textContent = window.CartUI.formatPrice(total);
    }
}

/**
 * Toggle confirm order button state
 */
function toggleConfirmButton(enabled) {
    const confirmBtn = document.getElementById('confirm_order');
    if (!confirmBtn) return;

    if (enabled) {
        confirmBtn.disabled = false;
        confirmBtn.className = 'w-full mt-2 bg-primary hover:bg-primary/90 text-white font-bold sm:font-black text-base sm:text-lg py-4 sm:py-5 rounded-lg sm:rounded-xl transition-all flex items-center justify-center gap-3 touch-target-lg cursor-pointer';
        confirmBtn.innerHTML = `
            XÁC NHẬN ĐẶT MÓN
            <span class="material-symbols-outlined text-[20px]">restaurant</span>
        `;
    } else {
        confirmBtn.disabled = true;
        confirmBtn.className = 'w-full mt-2 bg-gray-400 cursor-not-allowed text-white font-bold sm:font-black text-base sm:text-lg py-4 sm:py-5 rounded-lg sm:rounded-xl transition-all flex items-center justify-center gap-3 touch-target-lg';
        confirmBtn.innerHTML = `
            CHỌN MÓN TRƯỚC
            <span class="material-symbols-outlined text-[20px]">restaurant</span>
        `;
    }
}

/**
 * Remove item from cart
 */
window.removeItem = function(index) {
    if (confirm('Bạn có chắc muốn xóa món này?')) {
        window.CartStorage.remove(index);
        renderOrderCart();
        window.CartUI.notify('Đã xóa món khỏi giỏ hàng', 'success');
    }
};

/**
 * Increase item quantity
 */
window.increaseQuantity = function(index) {
    window.CartStorage.increase(index);
    renderOrderCart();
};

/**
 * Decrease item quantity
 */
window.decreaseQuantity = function(index) {
    window.CartStorage.decrease(index);
    renderOrderCart();
};

/**
 * Update item note
 */
window.updateNote = function(index, note) {
    window.CartStorage.updateNote(index, note);
    
    // Update character count
    const countElement = document.getElementById(`note-count-${index}`);
    if (countElement) {
        countElement.textContent = note.length;
    }
    
    console.log('📝 Note updated for item', index, ':', note);
};

/**
 * Initialize cart page
 */
function initCartPage() {
    console.log('🛒 Initializing cart page...');
    
    // Check if CartStorage is available
    if (!window.CartStorage) {
        console.error('❌ CartStorage not available yet, retrying...');
        setTimeout(initCartPage, 100);
        return;
    }
    
    renderOrderCart();
    
    // Auto-refresh summary when cart changes
    const originalSave = window.CartStorage.save;
    window.CartStorage.save = function() {
        originalSave.call(window.CartStorage);
        if (typeof renderOrderCart === 'function') {
            updateSummary();
        }
    };
}

document.addEventListener('DOMContentLoaded', initCartPage);

// Also try to run immediately if DOM is already loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCartPage);
} else {
    // DOM already loaded
    initCartPage();
}

// Export for use in other files
window.renderOrderCart = renderOrderCart;