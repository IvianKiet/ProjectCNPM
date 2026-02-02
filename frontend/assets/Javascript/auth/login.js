const loginButton = document.getElementById("button_login");

loginButton.addEventListener("click", async (e) => {
    e.preventDefault();
    
    const email = document.getElementById("input_username").value;
    const password = document.getElementById("input_password").value;
    
    // Validation
    const email_regex = /^[a-zA-Z0-9]+@gmail\.com$/;
    if (!email_regex.test(email)) {
        document.getElementById("message_username").textContent = "Email không hợp lệ";
        return;
    }
    
    try {
        const data = await AuthAPI.login(email, password);
        Storage.setUser(data);
        window.location.href = "Pages/restaurantOwner/owner_dashboard.html";
    } catch (error) {
        document.getElementById("meassage_password").textContent = error.message;
    }
});