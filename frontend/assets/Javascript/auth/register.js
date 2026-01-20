const registerButton = document.getElementById("btn_register");
const registerNotification = document.getElementById("register_notifaction");
const closeModalBtn = document.getElementById("close_modal");

registerButton.addEventListener("click", async (e) => {
    e.preventDefault();
    
    const fullName = document.getElementById("full_name").value;
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirm_password").value;
    
    // Clear previous error messages
    document.getElementById("message_fullname").textContent = "";
    document.getElementById("message_username").textContent = "";
    document.getElementById("meassage_password").textContent = "";
    document.getElementById("meassage_password_confirm").textContent = "";
    
    let isSuccess = true;
    
    // Validate full name
    const name_error = /[^a-zA-ZÀ-ỹ\s]/;
    if (fullName === "" || name_error.test(fullName)) {
        document.getElementById("message_fullname").textContent = "Tên không hợp lệ";
        isSuccess = false;
    }
    
    // Validate email
    const email_regex = /^[a-zA-Z0-9]+@gmail\.com$/;
    if (!email_regex.test(email)) {
        document.getElementById("message_username").textContent = "Email không hợp lệ";
        isSuccess = false;
    }
    
    // Validate password
    const password_regex = /(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])/;
    if (password.length < 8 || !password_regex.test(password)) {
        document.getElementById("meassage_password").textContent = "Mật khẩu không đủ mạnh";
        isSuccess = false;
    }
    
    // Validate confirm password
    if (password !== confirmPassword) {
        document.getElementById("meassage_password_confirm").textContent = "Mật khẩu không khớp";
        isSuccess = false;
    }
    
    if (!isSuccess) return;
    
    try {
        // FIXED: Use AuthAPI.register instead of raw fetch
        const data = await AuthAPI.register(fullName, email, password);
        
        // Show success notification
        registerNotification.classList.add("show");
        registerNotification.style.display = "flex";
        
        // Clear form
        document.getElementById("full_name").value = "";
        document.getElementById("email").value = "";
        document.getElementById("password").value = "";
        document.getElementById("confirm_password").value = "";
        
    } catch (error) {
        alert("Đăng ký thất bại: " + error.message);
        console.error("Registration error:", error);
    }
});

closeModalBtn.addEventListener("click", () => {
    registerNotification.classList.remove("show");
    registerNotification.style.display = "none";
    window.location.href = "../../index.html";
});