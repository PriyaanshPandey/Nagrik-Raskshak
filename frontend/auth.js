/* ================= CONFIGURATION ================= */
const API_BASE = window.APP_CONFIG ? window.APP_CONFIG.apiUrl : 'https://nagrik-raskshak-f8t1.onrender.com';

/* ================= PANEL SWITCH ================= */
function switchPanel() {
  const signup = document.getElementById("signup");
  const login = document.getElementById("login");

  if (!signup || !login) return;

  if (signup.classList.contains("active")) {
    signup.classList.remove("active");
    signup.classList.add("exit");
    login.classList.remove("exit");
    login.classList.add("active");
  } else {
    login.classList.remove("active");
    login.classList.add("exit");
    signup.classList.remove("exit");
    signup.classList.add("active");
  }
}

/* ================= OPEN FROM HEADER ================= */
function openLogin() {
  window.location.href = "auth.html?mode=login";
}

function openSignup() {
  window.location.href = "auth.html?mode=signup";
}

/* ================= PAGE LOAD ================= */
window.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");
  const signup = document.getElementById("signup");
  const login = document.getElementById("login");

  if (!signup || !login) return;

  signup.classList.remove("active", "exit");
  login.classList.remove("active", "exit");

  if (mode === "login") {
    login.classList.add("active");
  } else {
    signup.classList.add("active");
  }
});

/* ================= REGISTER ================= */
async function register() {
  const name = document.getElementById("su-name")?.value.trim();
  const email = document.getElementById("su-email")?.value.trim();
  const password = document.getElementById("su-password")?.value.trim();
  const mobile = document.getElementById("su-mobile")?.value.trim() || "0000000000"; // ADDED

  if (!name || !email || !password) {
    alert("Fill all fields");
    return;
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    alert("Please enter a valid email address");
    return;
  }

  if (password.length < 6) {
    alert("Password must be at least 6 characters");
    return;
  }

  // Mobile validation (optional but good)
  if (mobile && mobile.length !== 10) {
    alert("Mobile number should be 10 digits");
    return;
  }

  try {
    console.log("Registering with:", { name, email, mobile }); // Debug
    
    const res = await fetch(`${API_BASE}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, mobile }) // ADDED mobile
    });

    console.log("Response status:", res.status); // Debug
    
    const data = await res.json();
    console.log("Register response:", data); // Debug

    if (data.success) {
      localStorage.setItem("user", JSON.stringify(data.user));
      localStorage.setItem("token", data.token || "temp-token");
      alert("Registration successful!");
      window.location.href = "index.html";
    } else {
      alert(data.message || data.error || "Signup failed");
    }
  } catch (err) {
    console.error("Registration error:", err);
    if (err.message.includes("Failed to fetch")) {
      alert("Cannot connect to server. Please check your internet connection.");
    } else {
      alert("Registration failed: " + err.message);
    }
  }
}

/* ================= LOGIN ================= */
async function login() {
  const email = document.getElementById("li-email")?.value.trim();
  const password = document.getElementById("li-password")?.value.trim();

  if (!email || !password) {
    alert("Fill all fields");
    return;
  }

  try {
    console.log("Logging in with:", { email }); // Debug
    
    const res = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    console.log("Login response status:", res.status); // Debug
    
    const data = await res.json();
    console.log("Login response:", data); // Debug

    if (data.success) {
      localStorage.setItem("user", JSON.stringify(data.user));
      localStorage.setItem("token", data.token || "temp-token");
      alert("Login successful!");
      window.location.href = "index.html";
    } else {
      alert(data.message || data.error || "Invalid email or password");
    }
  } catch (err) {
    console.error("Login error:", err);
    if (err.message.includes("Failed to fetch")) {
      alert("Cannot connect to server. Please check your internet connection.");
    } else {
      alert("Login failed: " + err.message);
    }
  }
}

// ===== ADD THESE FUNCTIONS FOR BUTTON CLICKS =====
// Make sure your HTML buttons call these

// Add to window object for global access
window.register = register;
window.login = login;
window.switchPanel = switchPanel;
window.openLogin = openLogin;
window.openSignup = openSignup;
