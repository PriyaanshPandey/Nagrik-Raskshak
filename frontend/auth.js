/* ================= CONFIGURATION ================= */
const API_BASE = window.APP_CONFIG ? window.APP_CONFIG.apiUrl : 'http://localhost:3000';

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

  try {
    const res = await fetch(`${API_BASE}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    const data = await res.json();

    if (data.success) {
      localStorage.setItem("user", JSON.stringify(data.user));
      window.location.href = "index.html";
    } else {
      alert(data.message || "Signup failed");
    }
  } catch (err) {
    console.error("Registration error:", err);
    if (err.message.includes("Failed to fetch")) {
      alert("Cannot connect to server. Please check your internet connection.");
    } else {
      alert("Registration failed. Please try again.");
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
    const res = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    const data = await res.json();

    if (data.success) {
      localStorage.setItem("user", JSON.stringify(data.user));
      window.location.href = "index.html";
    } else {
      alert(data.message || "Invalid email or password");
    }
  } catch (err) {
    console.error("Login error:", err);
    if (err.message.includes("Failed to fetch")) {
      alert("Cannot connect to server. Please check your internet connection.");
    } else {
      alert("Login failed. Please try again.");
    }
  }
}
