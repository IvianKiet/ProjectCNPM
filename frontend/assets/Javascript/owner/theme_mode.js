// Get the html element
const html = document.documentElement;  

// Get theme toggle button
const btn_toggle = document.getElementById("theme-toggle");  

// In-memory theme storage (replaces localStorage)
let currentTheme = 'light';

btn_toggle.addEventListener("click", () => {
    // Toggle the dark class
    html.classList.toggle("dark");
    
    // Update in-memory theme
    if (html.classList.contains("dark")) {
        currentTheme = "dark";
    } else {
        currentTheme = "light";
    }
});