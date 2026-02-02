// File upload handling
const fileUpload = document.getElementById("file-upload");
const imageDisplay = document.getElementById("image_display");
const btnDelete = document.getElementById("btn_delete");
const btnAdd = document.getElementById("new_add");
const successNotification = document.getElementById("success_notifaction");
const closeModal = document.getElementById("close_modal");
const boxRestaurant = document.getElementById("box_restaurant");

let srcImage = "";

// Handle file upload
fileUpload.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            srcImage = event.target.result;
            imageDisplay.src = srcImage;
            imageDisplay.style.display = "block";
        };
        reader.readAsDataURL(file);
    }
});

// Handle delete image
btnDelete.addEventListener("click", () => {
    srcImage = "";
    imageDisplay.src = "";
    imageDisplay.style.display = "none";
    fileUpload.value = "";
});

// Add restaurant
btnAdd.addEventListener("click", async (e) => {
    e.preventDefault();
    
    const name = document.getElementById("name_restaurant").value;
    const address = document.getElementById("address_restaurant").value;
    const province = document.getElementById("province_restaurant").value;
    const phone = document.getElementById("phone_restaurant").value;
    const manager = document.getElementById("manage_restaurant").value;
    
    // Clear previous errors
    document.getElementById("message_name").textContent = "";
    document.getElementById("message_address").textContent = "";
    document.getElementById("message_phone").textContent = "";
    document.getElementById("message_manager").textContent = "";
    
    // Validation
    let isValid = true;
    
    if (!name || name.trim() === "") {
        document.getElementById("message_name").textContent = "Vui lòng nhập tên nhà hàng";
        isValid = false;
    }
    
    if (!address || address.trim() === "") {
        document.getElementById("message_address").textContent = "Vui lòng nhập địa chỉ";
        isValid = false;
    }
    
    if (!province || province === "") {
        alert("Vui lòng chọn tỉnh thành");
        isValid = false;
    }
    
    const phoneRegex = /^[0-9]{10,11}$/;
    if (!phone || !phoneRegex.test(phone)) {
        document.getElementById("message_phone").textContent = "Số điện thoại không hợp lệ";
        isValid = false;
    }
    
    if (!manager || manager.trim() === "") {
        document.getElementById("message_manager").textContent = "Vui lòng nhập tên quản lý";
        isValid = false;
    }
    
    if (!isValid) return;
    
    try {
        const data = await BranchAPI.create({
            branch_name: name,
            address: address,
            province: province,
            phone: phone,
            manager_name: manager,
            image: srcImage || ""
        });
        
        console.log("Branch created:", data);
        
        // Show success notification
        successNotification.classList.add("show");
        successNotification.style.display = "flex";
        
        // Add to UI
        addRestaurantToUI(data);
        
        // Clear form
        document.getElementById("name_restaurant").value = "";
        document.getElementById("address_restaurant").value = "";
        document.getElementById("province_restaurant").value = "";
        document.getElementById("phone_restaurant").value = "";
        document.getElementById("manage_restaurant").value = "";
        srcImage = "";
        imageDisplay.style.display = "none";
        fileUpload.value = "";
        
        // Close modal
        document.getElementById('add-restaurant-modal').classList.add('hidden');
        
    } catch (error) {
        console.error("Error creating branch:", error);
        alert("Thêm nhà hàng thất bại: " + error.message);
    }
});

// Close success notification
closeModal.addEventListener("click", () => {
    successNotification.classList.remove("show");
    successNotification.style.display = "none";
});

// Function to add restaurant to UI
function addRestaurantToUI(branch) {
    const restaurantCard = `
        <div class="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col" data-branch-id="${branch.branch_id}">
            <div class="p-6 flex-1">
                <div class="flex justify-between items-start mb-4">
                    <div class="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                        <span class="material-symbols-outlined text-orange-600 dark:text-orange-400">restaurant</span>
                    </div>
                    <span class="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                        Đang hoạt động
                    </span>
                </div>
                <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-1">${branch.branch_name}</h3>
                <p class="text-sm text-gray-500 dark:text-gray-400 mb-4 flex items-center">
                    <span class="material-symbols-outlined text-xs mr-1">location_on</span>
                    ${branch.address}
                </p>
                <div class="py-4 border-t border-border-light dark:border-border-dark flex items-center justify-between">
                    <div>
                        <span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Tổng số bàn</span>
                        <p class="text-2xl font-bold text-gray-900 dark:text-white mt-1">0</p>
                    </div>
                    <div class="text-right">
                        <span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Mã QR</span>
                        <p class="text-sm font-medium text-gray-700 dark:text-gray-300 mt-1">Chưa tạo</p>
                    </div>
                </div>
            </div>
            <div class="bg-gray-50 dark:bg-gray-800 px-6 py-4 flex items-center justify-between border-t border-border-light dark:border-border-dark">
                <span class="text-sm text-gray-500 dark:text-gray-400">Vừa tạo</span>
                <div class="flex gap-2">
                    <button onclick="editRestaurant('${branch.branch_id}')" class="text-primary hover:text-primary-hover font-medium text-sm">
                        <span class="material-symbols-outlined text-sm">edit</span>
                    </button>
                    <button onclick="deleteRestaurant('${branch.branch_id}')" class="text-red-500 hover:text-red-700 font-medium text-sm">
                        <span class="material-symbols-outlined text-sm">delete</span>
                    </button>
                </div>
            </div>
        </div>
    `;
    
    boxRestaurant.insertAdjacentHTML('beforeend', restaurantCard);
}

// Delete restaurant function
window.deleteRestaurant = async function(branchId) {
    if (!confirm("Bạn có chắc muốn xóa nhà hàng này?")) return;
    
    try {
        await BranchAPI.delete(branchId);
        
        // Remove from UI
        const card = document.querySelector(`[data-branch-id="${branchId}"]`);
        if (card) card.remove();
        
        alert("Xóa nhà hàng thành công!");
    } catch (error) {
        console.error("Error deleting branch:", error);
        alert("Xóa nhà hàng thất bại: " + error.message);
    }
};

// Edit restaurant function
window.editRestaurant = async function(branchId) {
    // TODO: Implement edit functionality
    alert("Chức năng chỉnh sửa đang được phát triển");
};

// Load restaurants on page load
window.addEventListener('DOMContentLoaded', async () => {
    try {
        const branches = await BranchAPI.getAll();
        console.log("Loaded branches:", branches);
        
        boxRestaurant.innerHTML = ""; // Clear loading state
        
        if (branches && branches.length > 0) {
            branches.forEach(branch => {
                addRestaurantToUI(branch);
            });
        } else {
            boxRestaurant.innerHTML = `
                <div class="col-span-full text-center py-12">
                    <span class="material-symbols-outlined text-gray-400 text-6xl mb-4">store</span>
                    <p class="text-gray-500 dark:text-gray-400">Chưa có nhà hàng nào. Thêm nhà hàng đầu tiên!</p>
                </div>
            `;
        }
    } catch (error) {
        console.error("Load error:", error);
        boxRestaurant.innerHTML = `
            <div class="col-span-full text-center py-12">
                <p class="text-red-500">Lỗi tải dữ liệu: ${error.message}</p>
            </div>
        `;
    }
});