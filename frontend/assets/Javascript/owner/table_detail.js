// Handle QR code generation for all tables
document.querySelectorAll(".create_QR").forEach(button => {
    button.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        
        // Get table info from the button's parent elements
        const tableCard = button.closest('.group');
        const tableNumberElement = tableCard.querySelector('p.text-lg');
        const tableNumber = tableNumberElement ? tableNumberElement.textContent : 'Unknown';
        
        // Get the table_id from data attribute
        const tableId = tableCard.dataset.tableId;
        
        if (!tableId) {
            alert("Không tìm thấy ID bàn. Vui lòng thêm data-table-id vào thẻ table card.");
            return;
        }
        
        try {
            // Use TableAPI to generate QR
            const data = await TableAPI.generateQR(tableId);
            
            console.log("QR Code generated:", data);
            
            // Show QR code info
            alert(`QR Code đã được tạo cho ${tableNumber}\n\nLink: ${data.qr_content}\n\nBạn có thể tạo QR code từ link này bằng các công cụ online.`);
            
            // Optional: Open QR code generator
            const qrGenUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(data.qr_content)}`;
            window.open(qrGenUrl, '_blank');
            
        } catch (error) {
            console.error("QR generation error:", error);
            alert("Lỗi tạo QR: " + error.message);
        }
    });
});

// Load tables for a branch
async function loadTables(branchId) {
    try {
        const tables = await TableAPI.getAll(branchId);
        console.log("Loaded tables:", tables);
        
        // Display tables in UI
        renderTables(tables);
        
    } catch (error) {
        console.error("Load tables error:", error);
    }
}

// Render tables to UI
function renderTables(tables) {
    const container = document.querySelector('.grid');
    if (!container) return;
    
    container.innerHTML = ""; // Clear existing
    
    tables.forEach(table => {
        const tableCard = createTableCard(table);
        container.insertAdjacentHTML('beforeend', tableCard);
    });
}

// Create table card HTML
function createTableCard(table) {
    const statusColor = table.status === 'available' ? 'green' : 
                       table.status === 'occupied' ? 'orange' : 'purple';
    
    const statusText = table.status === 'available' ? 'Trống' : 
                      table.status === 'occupied' ? 'Đang phục vụ' : 'Đã đặt';
    
    return `
        <div class="group relative flex flex-col items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md dark:border-slate-700 dark:bg-slate-800" data-table-id="${table.table_id}">
            <button class="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors" title="Xóa bàn" onclick="deleteTable('${table.table_id}')">
                <span class="material-symbols-outlined text-[20px]">delete</span>
            </button>
            <div class="flex h-16 w-16 items-center justify-center rounded-full bg-${statusColor}-50 text-${statusColor}-600 dark:bg-slate-700 dark:text-${statusColor}-400">
                <span class="material-symbols-outlined text-4xl">table_restaurant</span>
            </div>
            <div class="flex flex-col items-center gap-1">
                <p class="text-lg font-bold text-slate-900 dark:text-white">${table.table_number}</p>
                <span class="inline-flex items-center rounded-full bg-${statusColor}-50 px-2 py-1 text-xs font-medium text-${statusColor}-700 dark:bg-${statusColor}-900/30 dark:text-${statusColor}-400 ring-1 ring-inset ring-${statusColor}-600/20">${statusText}</span>
            </div>
            <button class="create_QR flex w-full items-center justify-center gap-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-primary px-3 py-2 text-sm font-bold transition-colors dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-blue-400">
                <span class="material-symbols-outlined text-[20px]">qr_code_2</span>
                <span>Tạo QR</span>
            </button>
        </div>
    `;
}

// Delete table function
window.deleteTable = async function(tableId) {
    if (!confirm("Bạn có chắc muốn xóa bàn này?")) return;
    
    try {
        await TableAPI.delete(tableId);
        
        // Remove from UI
        const card = document.querySelector(`[data-table-id="${tableId}"]`);
        if (card) card.remove();
        
        alert("Xóa bàn thành công!");
    } catch (error) {
        console.error("Error deleting table:", error);
        alert("Xóa bàn thất bại: " + error.message);
    }
};

// Initialize QR button listeners after rendering
function initializeQRButtons() {
    document.querySelectorAll(".create_QR").forEach(button => {
        button.addEventListener("click", async (event) => {
            event.preventDefault();
            event.stopPropagation();
            
            const tableCard = button.closest('.group');
            const tableNumberElement = tableCard.querySelector('p.text-lg');
            const tableNumber = tableNumberElement ? tableNumberElement.textContent : 'Unknown';
            const tableId = tableCard.dataset.tableId;
            
            if (!tableId) {
                alert("Không tìm thấy ID bàn");
                return;
            }
            
            try {
                const data = await TableAPI.generateQR(tableId);
                alert(`QR Code đã được tạo cho ${tableNumber}\n\nLink: ${data.qr_content}`);
                
                // Open QR code image
                const qrGenUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(data.qr_content)}`;
                window.open(qrGenUrl, '_blank');
                
            } catch (error) {
                alert("Lỗi tạo QR: " + error.message);
            }
        });
    });
}

// Call this after rendering tables
// Example: After loadTables() completes, call initializeQRButtons()