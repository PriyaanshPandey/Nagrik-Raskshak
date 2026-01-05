// ===== CONFIGURATION =====
const API_BASE = window.APP_CONFIG ? window.APP_CONFIG.apiUrl : 'http://localhost:3000';
const user = JSON.parse(localStorage.getItem("user"));
let selectedDepartment = "All";

if (!user) {
  alert("Login required");
  window.location.href = "auth.html?mode=login";
}

// ===== MAP INIT =====
let map;
let markers = [];
let allComplaints = [];
let liveLocationMarker = null;
let liveAccuracyCircle = null;
let liveLocationCentered = false;

// Initialize map
function initMap() {
  map = L.map("map").setView([26.7606, 83.3732], 13);
  
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap",
  }).addTo(map);
}

function addComplaintMarker(c) {
  if (!c.location || !c.location._latitude || !c.location._longitude) return;

  const lat = c.location._latitude;
  const lng = c.location._longitude;
  const priority = c.priority || "Low";
  
  let color = "#22c55e"; // 🟢 Low
  if (priority === "High") color = "#ef4444"; // 🔴
  else if (priority === "Medium") color = "#eab308"; // 🟡

  const marker = L.circleMarker([lat, lng], {
    radius: 8,
    fillColor: color,
    color: "#000",
    weight: 1,
    fillOpacity: 0.9,
  }).addTo(map);

  marker.bindPopup(`
    <div style="max-width: 250px;">
      <b>${c.description || "No description"}</b><br>
      <b>Dept:</b> ${c.department || "Unassigned"}<br>
      <b>Priority:</b> ${priority}<br>
      <b>Status:</b> ${c.status || "new"}<br>
      <b>Location:</b> ${c.address || "Unknown"}<br>
      <small>Submitted: ${c.timePassed || "recently"} ago</small>
    </div>
  `);

  markers.push(marker);
}

// ===== LOAD COMPLAINTS =====
async function loadComplaints() {
  try {
    // Clear existing markers
    markers.forEach((m) => map.removeLayer(m));
    markers = [];

    const res = await fetch(`${API_BASE}/complaints`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    const data = await res.json();
    allComplaints = Array.isArray(data) ? data : (data.complaints || []);

    const recentContainer = document.getElementById("recentComplaints");
    const highBox = document.getElementById("highRisk");
    const mediumBox = document.getElementById("mediumRisk");
    const lowBox = document.getElementById("lowRisk");

    // Clear containers
    if (recentContainer) recentContainer.innerHTML = "";
    if (highBox) highBox.innerHTML = "";
    if (mediumBox) mediumBox.innerHTML = "";
    if (lowBox) lowBox.innerHTML = "";

    allComplaints.forEach((c, index) => {
      // Department filter
      if (selectedDepartment !== "All" && c.department !== selectedDepartment) {
        return;
      }
      
      // Add to map
      addComplaintMarker(c);

      const priority = c.priority || "Low";
      const status = c.status || "new";
      const isOverdue = c.isOverdue || false;

      // Recent complaints cards (first 3)
      if (index < 3 && recentContainer) {
        const card = document.createElement("div");
        card.className = `card ${priority.toLowerCase()} ${isOverdue ? "overdue" : ""}`;

        // FIXED: Image URL uses API_BASE
        const imageHtml = c.imagePath ? `
          <div class="img-wrap">
            <img src="${API_BASE}/${c.imagePath}" 
                 onclick="openImage('${API_BASE}/${c.imagePath}')"
                 onerror="this.style.display='none'">
          </div>
        ` : "";

        card.innerHTML = `
          <div class="priority ${priority.toLowerCase()}">
            ${priority} Priority ${isOverdue ? " ⚠️ OVERDUE" : ""}
          </div>
          ${imageHtml}
          <b>${c.description ? c.description.substring(0, 60) + (c.description.length > 60 ? "..." : "") : "No description"}</b><br>
          <small>📍 ${c.address || "Unknown"}</small><br>
          <small>📊 Status: <span class="status-badge ${status}">${status}</span></small><br>
          <small>⏰ ${c.timePassed || "0h"} ago</small><br>
          
          <!-- ACTION BUTTONS -->
          <div class="action-buttons" data-id="${c.id}">
            ${status === "classified" ? `
              <button class="action-btn mark-action" onclick="updateStatus('${c.id}', 'under_action')">
                ⚡ Take Action
              </button>
            ` : ""}
            
            ${status === "under_action" ? `
              <button class="action-btn mark-resolved" onclick="updateStatus('${c.id}', 'resolved')">
                ✅ Mark Resolved
              </button>
            ` : ""}
            
            ${status === "resolved" ? `
              <span class="resolved-badge">✅ Resolved</span>
            ` : ""}
            
            ${status === "new" ? `
              <span class="status-badge new">Awaiting Classification</span>
            ` : ""}
          </div>
        `;
        recentContainer.appendChild(card);
      }

      /* ===== LIST VIEW (RISK) ===== */
      const item = document.createElement("div");
      item.className = `risk-item ${isOverdue ? "overdue" : ""}`;

      item.innerHTML = `
        <span class="priority ${priority.toLowerCase()}">
          ${priority} Priority ${isOverdue ? " ⚠️ OVERDUE" : ""}
        </span>
        <p class="desc">${c.description ? c.description.substring(0, 80) + (c.description.length > 80 ? "..." : "") : "No description"}</p>
        <small>📍 ${c.address || "Unknown"}</small><br>
        <small>📊 Status: <span class="status-badge ${status}">${status}</span></small><br>
        <small>⏰ ${c.timePassed || "0h"} ago</small>
        
        <!-- ACTION BUTTONS FOR LIST VIEW -->
        <div class="action-buttons" data-id="${c.id}">
          ${status === "classified" ? `
            <button class="action-btn mark-action" onclick="updateStatus('${c.id}', 'under_action')">
              ⚡ Take Action
            </button>
          ` : ""}
          
          ${status === "under_action" ? `
            <button class="action-btn mark-resolved" onclick="updateStatus('${c.id}', 'resolved')">
              ✅ Mark Resolved
            </button>
          ` : ""}
          
          ${status === "resolved" ? `
            <span class="resolved-badge">✅ Resolved</span>
          ` : ""}
          
          ${status === "new" ? `
            <span class="status-badge new">Awaiting Classification</span>
          ` : ""}
        </div>
      `;

      // Add to appropriate priority box
      if (priority === "High" && highBox) {
        highBox.appendChild(item);
      } else if (priority === "Medium" && mediumBox) {
        mediumBox.appendChild(item);
      } else if (lowBox) {
        lowBox.appendChild(item);
      }
    });

    // Fit map bounds to markers
    if (markers.length > 0) {
      const group = L.featureGroup(markers);
      map.fitBounds(group.getBounds(), { padding: [40, 40] });
    }

    // Apply overdue styling to body if any complaint is overdue
    const hasOverdue = allComplaints.some((c) => c.isOverdue);
    document.body.classList.toggle("overdue-alert", hasOverdue);
  } catch (err) {
    console.error("Failed to load complaints:", err);
    showNotification("Failed to load complaints: " + err.message, "error");
  }
}

// ===== UPDATE STATUS =====
async function updateStatus(complaintId, newStatus) {
  const adminName = user?.name || "Admin";

  if (!confirm(`Change status to "${newStatus}"?`)) return;

  try {
    const res = await fetch(`${API_BASE}/update-complaint-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        complaintId,
        status: newStatus,
        adminName,
      }),
    });

    const data = await res.json();

    if (data.success) {
      showNotification(`Status updated to ${newStatus}`, "success");
      setTimeout(() => loadComplaints(), 1000);
    } else {
      showNotification("Failed: " + (data.message || "Unknown error"), "error");
    }
  } catch (err) {
    console.error("Update failed:", err);
    showNotification("Network error. Please try again.", "error");
  }
}

// ===== NOTIFICATION FUNCTION =====
function showNotification(message, type = "info") {
  const existing = document.querySelector(".status-notification");
  if (existing) existing.remove();

  const notification = document.createElement("div");
  notification.className = `status-notification ${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      ${message}
      <button onclick="this.parentElement.parentElement.remove()">×</button>
    </div>
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, 3000);
}

// ===== LIVE LOCATION =====
function showLiveLocation() {
  if (!navigator.geolocation) {
    showNotification("Geolocation not supported", "error");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;

      if (liveLocationMarker) map.removeLayer(liveLocationMarker);
      if (liveAccuracyCircle) map.removeLayer(liveAccuracyCircle);

      liveLocationMarker = L.marker([latitude, longitude])
        .addTo(map)
        .bindPopup("📍 Your Live Location");

      liveAccuracyCircle = L.circle([latitude, longitude], {
        radius: accuracy,
        color: "#3b82f6",
        fillOpacity: 0.15,
      }).addTo(map);

      if (!liveLocationCentered) {
        map.setView([latitude, longitude], 16);
        liveLocationCentered = true;
      }
    },
    (err) => {
      console.error("Geolocation error:", err);
      showNotification("Could not get your location", "error");
    }
  );
}

// ===== IMAGE MODAL =====
function openImage(src) {
  const modal = document.getElementById("imageModal");
  const modalImg = document.getElementById("modalImg");
  if (modal && modalImg) {
    modalImg.src = src;
    modal.classList.remove("hidden");
  }
}

function closeImage() {
  const modal = document.getElementById("imageModal");
  if (modal) {
    modal.classList.add("hidden");
  }
}

// ===== DOM READY =====
document.addEventListener("DOMContentLoaded", () => {
  // Initialize map
  initMap();
  
  const knob = document.getElementById("knob");
  const switchBox = document.getElementById("switch");
  const mapView = document.getElementById("mapView");
  const listView = document.getElementById("listView");
  const deptSelect = document.getElementById("departmentSelect");

  // Set user name
  if (user?.name) {
    const userNameElement = document.getElementById("userName");
    if (userNameElement) {
      userNameElement.innerText = "Admin: " + user.name;
    }
  }

  // Department filter
  if (deptSelect) {
    deptSelect.addEventListener("change", () => {
      selectedDepartment = deptSelect.value;
      loadComplaints();
    });
  }

  // View toggle
  let isMap = true;
  
  if (mapView) mapView.classList.remove("hidden");
  if (listView) listView.classList.add("hidden");
  if (knob) knob.style.left = "2px";

  if (switchBox) {
    switchBox.addEventListener("click", () => {
      if (isMap) {
        if (mapView) mapView.classList.add("hidden");
        if (listView) listView.classList.remove("hidden");
        if (knob) knob.style.left = "56px";
      } else {
        if (listView) listView.classList.add("hidden");
        if (mapView) mapView.classList.remove("hidden");
        if (knob) knob.style.left = "2px";

        setTimeout(() => {
          if (map) map.invalidateSize(true);
          showLiveLocation();
        }, 300);
      }
      isMap = !isMap;
    });
  }

  // Load complaints every 30 seconds for real-time updates
  loadComplaints();
  setInterval(loadComplaints, 30000);

  // Initialize map and location
  setTimeout(() => {
    if (map) map.invalidateSize(true);
    showLiveLocation();
  }, 400);

  // Image modal event listeners
  const modal = document.getElementById("imageModal");
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeImage();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeImage();
  });
});
