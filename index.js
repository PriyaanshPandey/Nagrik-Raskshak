// ===== CONFIGURATION =====
const API_BASE = window.APP_CONFIG ? window.APP_CONFIG.apiUrl : 'http://localhost:3000';
const user = JSON.parse(localStorage.getItem("user"));

// ===== HEADER USER STATE =====
if (user) {
  document.getElementById("loggedUser").classList.remove("hidden");
  document.getElementById("loggedUserName").innerText = user.name;
  document.getElementById("loginBtn").style.display = "none";
  document.getElementById("signupBtn").style.display = "none";
  document.getElementById("logoutBtn").classList.remove("hidden");
} else {
  window.location.href = "auth.html?mode=login";
}

function logout() {
  localStorage.clear();
  window.location.href = "auth.html?mode=login";
}

// ===== PREFILL NAME =====
document.getElementById("name").value = user ? user.name : "";

// ===== IMAGE INPUT =====
const imageInput = document.getElementById("dropzone-file");
const uploadText = document.getElementById("uploadText");
const uploadedText = document.getElementById("uploadedText");

// ===== LOCATION DATA =====
const areaCoords = {
  Golghar: [26.7606, 83.3732],
  Rustampur: [26.7518, 83.3645],
  Gorakhnath: [26.7794, 83.3729],
  Mohaddipur: [26.7399, 83.3811],
  Chargawan: [26.8051, 83.3653],
  "Medical College": [26.759, 83.3952],
  University: [26.7749, 83.4065],
  "Railway Station": [26.7489, 83.381],
};

document.getElementById("areaSelect").addEventListener("change", () => {
  const area = document.getElementById("areaSelect").value;
  if (area && areaCoords[area]) {
    document.getElementById("lat").value = areaCoords[area][0];
    document.getElementById("lng").value = areaCoords[area][1];
  } else if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((pos) => {
      document.getElementById("lat").value = pos.coords.latitude;
      document.getElementById("lng").value = pos.coords.longitude;
    }, () => {
      // Default location if geolocation fails
      document.getElementById("lat").value = areaCoords.Golghar[0];
      document.getElementById("lng").value = areaCoords.Golghar[1];
    });
  } else {
    document.getElementById("lat").value = areaCoords.Golghar[0];
    document.getElementById("lng").value = areaCoords.Golghar[1];
  }
});

// ===== SUBMIT FORM =====
document.getElementById("complaintForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("name").value.trim();
  const mobile = document.getElementById("email").value.trim();
  const complaint = document.getElementById("message").value.trim();

  if (!name || !mobile || !complaint) {
    alert("⚠️ Fill Name, Mobile and Complaint");
    return;
  }

  if (mobile.length !== 10 || !/^\d+$/.test(mobile)) {
    alert("⚠️ Mobile number must be 10 digits");
    return;
  }

  const formData = new FormData();
  formData.append("name", name);
  formData.append("mobile", mobile);
  formData.append("description", complaint);
  formData.append("lat", document.getElementById("lat").value);
  formData.append("lng", document.getElementById("lng").value);
  formData.append("userId", user.id);
  formData.append("userName", user.name);

  if (imageInput.files.length > 0) {
    formData.append("image", imageInput.files[0]);
  }

  try {
    const res = await fetch(`${API_BASE}/submit-complaint`, {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    if (data.success) {
      const modal = document.getElementById("successModal");
      modal.classList.remove("hidden");
      modal.style.display = "flex";

      setTimeout(() => {
        e.target.reset();
        uploadedText.classList.add("hidden");
        uploadText.classList.remove("hidden");
        modal.classList.add("hidden");
        modal.style.display = "none";
      }, 2000);

      // REFRESH PAST COMPLAINTS AFTER SUBMIT
      fetchPastComplaints();
    } else {
      alert(data.error || "Submission failed");
    }
  } catch (err) {
    console.error("Submission error:", err);
    alert("Server error. Try again later.");
  }
});

// ===== IMAGE UPLOAD UI =====
if (imageInput) {
  imageInput.addEventListener("change", () => {
    if (imageInput.files.length > 0) {
      uploadText.classList.add("hidden");
      uploadedText.classList.remove("hidden");
    } else {
      uploadedText.classList.add("hidden");
      uploadText.classList.remove("hidden");
    }
  });
}

// ===== CLOSE MODAL =====
function closeSuccessModal() {
  const modal = document.getElementById("successModal");
  modal.classList.add("hidden");
  modal.style.display = "none";
}
window.closeSuccessModal = closeSuccessModal;

// ===== FETCH PAST COMPLAINTS =====
async function fetchPastComplaints() {
  try {
    const res = await fetch(`${API_BASE}/my-complaints?userId=${user.id}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const complaints = Array.isArray(data) ? data : (data.complaints || []);

    const container = document.getElementById("pastComplaints");
    if (!container) return;
    
    container.innerHTML = "";

    if (complaints.length === 0) {
      container.innerHTML = `<p class="text-gray-300 col-span-full text-center">No past complaints found</p>`;
      return;
    }

    complaints.forEach((c) => {
      const createdAt = c.createdAt ? new Date(c.createdAt) : new Date();
      const now = new Date();
      const diffHours = Math.floor((now - createdAt) / (1000 * 60 * 60));
      const days = Math.floor(diffHours / 24);
      const hours = diffHours % 24;
      const timePassed = days > 0 ? `${days}d ${hours}h ago` : `${diffHours}h ago`;
      
      // Get last status for simple display
      let lastAction = "Submitted";
      let lastActionTime = "";
      
      if (c.actions && c.actions.length > 0) {
        const last = c.actions[c.actions.length - 1];
        lastAction = last.action;
        lastActionTime = last.timestamp ? new Date(last.timestamp).toLocaleDateString() : "";
      }

      const card = document.createElement("div");
      card.className = "bg-[#1b1b25] p-4 rounded-2xl border border-white/10 shadow-md mb-4";
      
      // FIXED: Image URL uses API_BASE
      const imageHtml = c.imagePath ? `
        <img 
          src="${API_BASE}/${c.imagePath}" 
          class="mt-2 w-full h-32 object-cover rounded-lg"
          onerror="this.style.display='none'"
        />
      ` : "";
      
      card.innerHTML = `
        <div class="flex justify-between items-start">
          <h3 class="text-lg font-semibold text-violet-300">
            ${c.description ? c.description.substring(0, 40) + (c.description.length > 40 ? "..." : "") : "No description"}
          </h3>
          <span class="status-badge ${c.status || 'new'}">${c.status || 'new'}</span>
        </div>
        
        <div class="mt-2 space-y-1">
          <p class="text-gray-400"><b>Status:</b> ${getSimpleStatusText(c.status)}</p>
          <p class="text-gray-400"><b>Submitted:</b> ${createdAt.toLocaleDateString()}</p>
          <p class="text-gray-400"><b>Time passed:</b> ${timePassed}</p>
          <p class="text-gray-400"><b>Last update:</b> ${lastActionTime || createdAt.toLocaleDateString()}</p>
        </div>
        
        ${imageHtml}
        
        <div class="mt-3">
          <p class="text-gray-500 text-sm"><b>Latest update:</b> ${lastAction}</p>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error("Failed to fetch complaints", err);
    const container = document.getElementById("pastComplaints");
    if (container) {
      container.innerHTML = `<p class="text-red-500 col-span-full text-center">Failed to load complaints</p>`;
    }
  }
}

// ===== SIMPLIFIED STATUS TEXT FOR CITIZENS =====
function getSimpleStatusText(status) {
  const statusMap = {
    'new': '⏳ Awaiting Review',
    'classified': '🔍 Under Review',
    'under_action': '⚡ Action In Progress',
    'resolved': '✅ Resolved'
  };
  return statusMap[status] || status;
}

// ===== BOT FUNCTIONALITY =====
async function handleBotMessage(text) {
  const user = JSON.parse(localStorage.getItem("user"));
  
  // Check if user is asking about complaint status
  const statusKeywords = ['status', 'update', 'progress', 'track', 'complaint', 'my complaints', 
                         'pending', 'resolved', 'open', 'closed', 'submitted', 'recent'];
  
  const isAskingAboutComplaints = statusKeywords.some(keyword => 
    text.toLowerCase().includes(keyword)
  );
  
  if (isAskingAboutComplaints && user) {
    // User is asking about complaints and is logged in
    return await checkComplaintStatus(user.id, text);
  } else if (isAskingAboutComplaints && !user) {
    // User asking but not logged in
    return {
      reply: "Please log in first to check your complaint status. Click the login button above."
    };
  } else {
    // Use regular FAQ bot
    return await fetchRegularBotResponse(text);
  }
}

async function checkComplaintStatus(userId, message) {
  try {
    const res = await fetch(`${API_BASE}/bot-check-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, message })
    });
    
    return await res.json();
  } catch (err) {
    console.error("Status check failed:", err);
    return {
      reply: "I'm having trouble accessing the complaint system right now. Please check the 'My Past Complaints' section directly."
    };
  }
}

async function fetchRegularBotResponse(text) {
  try {
    const res = await fetch(`${API_BASE}/bot-query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text })
    });
    
    return await res.json();
  } catch (err) {
    console.error("Bot query failed:", err);
    return {
      reply: "I'm having trouble connecting to the help system. Please try again later."
    };
  }
}

// Update the existing sendBotMessage function
async function sendBotMessage() {
  const input = document.getElementById("botInput");
  const messages = document.getElementById("botMessages");

  if (!input || !messages) return;

  const text = input.value.trim();
  if (!text) return;

  // User message
  messages.innerHTML += `
    <div class="mb-2 text-right text-violet-300">
      ${text}
    </div>
  `;
  input.value = "";
  messages.scrollTop = messages.scrollHeight;

  // Typing indicator
  const typingDiv = document.createElement("div");
  typingDiv.className = "typing";
  typingDiv.innerHTML = `<span></span><span></span><span></span>`;
  messages.appendChild(typingDiv);
  messages.scrollTop = messages.scrollHeight;

  try {
    const data = await handleBotMessage(text);

    // Remove typing animation
    typingDiv.remove();

    // Typewriter effect
    const botMsg = document.createElement("div");
    botMsg.className = "mb-2 text-gray-300 whitespace-pre-line";
    messages.appendChild(botMsg);

    let i = 0;
    const reply = data.reply || "I couldn't process your request.";

    const typer = setInterval(() => {
      if (i < reply.length) {
        botMsg.textContent += reply.charAt(i);
        i++;
        messages.scrollTop = messages.scrollHeight;
      } else {
        clearInterval(typer);
      }
    }, 20);

  } catch (err) {
    typingDiv.remove();
    messages.innerHTML += `
      <div class="mb-2 text-red-400">
        Something went wrong. Please try again.
      </div>
    `;
    messages.scrollTop = messages.scrollHeight;
  }
}

function toggleBot() {
  const botBox = document.getElementById("botBox");
  const botToggle = document.getElementById("botToggle");

  if (!botBox || !botToggle) return;

  if (!botBox.classList.contains("active")) {
    botBox.classList.add("active");
    botToggle.style.transition = "transform 0.2s ease";
    botToggle.style.transform = "scale(0)";

    setTimeout(() => {
      botToggle.style.display = "none";
    }, 200);

  } else {
    botBox.classList.remove("active");
    botToggle.style.display = "flex";
    botToggle.style.transition = "transform 0.2s ease";

    setTimeout(() => {
      botToggle.style.transform = "scale(1)";
    }, 50);
  }
}

// ===== ADD SIMPLE CSS =====
const style = document.createElement('style');
style.textContent = `
  .status-badge {
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
  }
  .status-badge.new { background: #ff9800; color: #000; }
  .status-badge.classified { background: #2196f3; color: white; }
  .status-badge.under_action { background: #9c27b0; color: white; }
  .status-badge.resolved { background: #4caf50; color: white; }
  
  .typing {
    display: inline-block;
    padding: 10px;
  }
  .typing span {
    display: inline-block;
    width: 8px;
    height: 8px;
    background: #9ca3af;
    border-radius: 50%;
    margin: 0 2px;
    animation: typing 1s infinite ease-in-out;
  }
  .typing span:nth-child(2) { animation-delay: 0.2s; }
  .typing span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes typing {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-5px); }
  }
`;
document.head.appendChild(style);

// ===== ENTER KEY FOR BOT =====
document.getElementById("botInput")?.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    sendBotMessage();
  }
});

// ===== INITIAL FETCH =====
if (user) {
  fetchPastComplaints();
  
  // Set initial location
  setTimeout(() => {
    document.getElementById("lat").value = areaCoords.Golghar[0];
    document.getElementById("lng").value = areaCoords.Golghar[1];
  }, 100);
}
