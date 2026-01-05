// ===== CONFIGURATION =====
// BACKEND URLS - Configure these based on your Render services
const BACKEND_URL = 'https://nagrik-raskshak-f8t1.onrender.com'; // Your Node backend
const AI_SERVICE_URL = 'https://nagrik-raskshak-1.onrender.com'; // Your AI service (currently 503)

// Get user from localStorage
const user = JSON.parse(localStorage.getItem("user"));

// ===== HEADER USER STATE =====
if (user) {
  const loggedUserEl = document.getElementById("loggedUser");
  const loggedNameEl = document.getElementById("loggedUserName");
  const loginBtn = document.getElementById("loginBtn");
  const signupBtn = document.getElementById("signupBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  
  if (loggedUserEl) loggedUserEl.classList.remove("hidden");
  if (loggedNameEl) loggedNameEl.innerText = user.name || 'User';
  if (loginBtn) loginBtn.style.display = "none";
  if (signupBtn) signupBtn.style.display = "none";
  if (logoutBtn) logoutBtn.classList.remove("hidden");
} else {
  // Redirect to login if no user
  window.location.href = "auth.html?mode=login";
}

// ===== LOGOUT FUNCTION =====
function logout() {
  localStorage.clear();
  window.location.href = "auth.html?mode=login";
}

// ===== PREFILL USER NAME IN FORM =====
const nameInput = document.getElementById("name");
if (nameInput && user) {
  nameInput.value = user.name || "";
}

// ===== IMAGE UPLOAD HANDLING =====
const imageInput = document.getElementById("dropzone-file");
const uploadText = document.getElementById("uploadText");
const uploadedText = document.getElementById("uploadedText");

if (imageInput) {
  imageInput.addEventListener("change", () => {
    if (imageInput.files.length > 0) {
      if (uploadText) uploadText.classList.add("hidden");
      if (uploadedText) uploadedText.classList.remove("hidden");
    } else {
      if (uploadedText) uploadedText.classList.add("hidden");
      if (uploadText) uploadText.classList.remove("hidden");
    }
  });
}

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

// Initialize location based on area selection
const areaSelect = document.getElementById("areaSelect");
if (areaSelect) {
  areaSelect.addEventListener("change", function() {
    const area = this.value;
    const latInput = document.getElementById("lat");
    const lngInput = document.getElementById("lng");
    
    if (area && areaCoords[area] && latInput && lngInput) {
      // Use predefined coordinates for selected area
      latInput.value = areaCoords[area][0];
      lngInput.value = areaCoords[area][1];
    } else if (navigator.geolocation && latInput && lngInput) {
      // Try to get current location
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          latInput.value = pos.coords.latitude;
          lngInput.value = pos.coords.longitude;
        },
        () => {
          // Fallback to default location
          latInput.value = areaCoords.Golghar[0];
          lngInput.value = areaCoords.Golghar[1];
        }
      );
    } else if (latInput && lngInput) {
      // Final fallback
      latInput.value = areaCoords.Golghar[0];
      lngInput.value = areaCoords.Golghar[1];
    }
  });
}

// ===== SUBMIT COMPLAINT FORM =====
const complaintForm = document.getElementById("complaintForm");
if (complaintForm) {
  complaintForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    // Get form values
    const name = document.getElementById("name")?.value.trim();
    const mobile = document.getElementById("email")?.value.trim();
    const complaint = document.getElementById("message")?.value.trim();
    const submitBtn = document.getElementById("submitBtn");
    
    // Validation
    if (!name || !mobile || !complaint) {
      alert("⚠️ Please fill Name, Mobile and Complaint fields");
      return;
    }
    
    if (mobile.length !== 10 || !/^\d+$/.test(mobile)) {
      alert("⚠️ Mobile number must be 10 digits");
      return;
    }
    
    // Disable button during submission
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="flex items-center"><svg class="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Submitting...</span>';
    }
    
    // Prepare form data
    const formData = new FormData();
    formData.append("name", name);
    formData.append("mobile", mobile);
    formData.append("description", complaint);
    formData.append("lat", document.getElementById("lat").value);
    formData.append("lng", document.getElementById("lng").value);
    formData.append("userId", user.id);
    formData.append("userName", user.name);
    
    if (imageInput && imageInput.files.length > 0) {
      formData.append("image", imageInput.files[0]);
    }
    
    try {
      const response = await fetch(`${BACKEND_URL}/submit-complaint`, {
        method: "POST",
        body: formData,
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Show success modal
        const modal = document.getElementById("successModal");
        if (modal) {
          modal.classList.remove("hidden");
          modal.style.display = "flex";
        }
        
        // Reset and refresh after 2 seconds
        setTimeout(() => {
          complaintForm.reset();
          if (uploadedText) uploadedText.classList.add("hidden");
          if (uploadText) uploadText.classList.remove("hidden");
          if (modal) {
            modal.classList.add("hidden");
            modal.style.display = "none";
          }
          
          // Refresh complaints list
          fetchPastComplaints();
        }, 2000);
      } else {
        alert(data.error || "Submission failed. Please try again.");
      }
    } catch (error) {
      console.error("Submission error:", error);
      alert("Server error. Please check your connection and try again.");
    } finally {
      // Re-enable submit button
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = "Submit Complaint";
      }
    }
  });
}

// ===== MODAL FUNCTIONS =====
function closeSuccessModal() {
  const modal = document.getElementById("successModal");
  if (modal) {
    modal.classList.add("hidden");
    modal.style.display = "none";
  }
}
window.closeSuccessModal = closeSuccessModal;

// ===== FETCH PAST COMPLAINTS =====
async function fetchPastComplaints() {
  try {
    const response = await fetch(`${BACKEND_URL}/my-complaints?userId=${user.id}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    const complaints = Array.isArray(data) ? data : (data.complaints || []);
    
    const container = document.getElementById("pastComplaints");
    if (!container) return;
    
    container.innerHTML = "";
    
    if (complaints.length === 0) {
      container.innerHTML = `
        <div class="col-span-full text-center py-10">
          <p class="text-gray-400 mb-4">No past complaints found</p>
          <p class="text-gray-500 text-sm">Submit your first complaint using the form above</p>
        </div>
      `;
      return;
    }
    
    complaints.forEach((complaint) => {
      const createdAt = complaint.createdAt ? new Date(complaint.createdAt) : new Date();
      const now = new Date();
      const diffHours = Math.floor((now - createdAt) / (1000 * 60 * 60));
      const days = Math.floor(diffHours / 24);
      const hours = diffHours % 24;
      const timePassed = days > 0 ? `${days}d ${hours}h ago` : `${diffHours}h ago`;
      
      // Get last action
      let lastAction = "Submitted";
      let lastActionTime = "";
      
      if (complaint.actions && complaint.actions.length > 0) {
        const last = complaint.actions[complaint.actions.length - 1];
        lastAction = last.action || "Updated";
        lastActionTime = last.timestamp ? new Date(last.timestamp).toLocaleDateString() : "";
      }
      
      // Create image URL - FIXED PATH HANDLING
      const getImageUrl = () => {
        if (complaint.imageUrl) return complaint.imageUrl;
        if (complaint.imagePath) {
          // Handle different path formats
          let path = complaint.imagePath;
          if (!path.startsWith('/') && !path.startsWith('http')) {
            path = '/' + path;
          }
          // Remove duplicate uploads folder if present
          if (path.startsWith('/uploads/uploads/')) {
            path = path.replace('/uploads/uploads/', '/uploads/');
          } else if (path.startsWith('uploads/uploads/')) {
            path = path.replace('uploads/uploads/', 'uploads/');
          }
          return `${BACKEND_URL}${path.startsWith('/') ? path : '/' + path}`;
        }
        return null;
      };
      
      const imageUrl = getImageUrl();
      const imageHtml = imageUrl ? `
        <div class="mt-3">
          <img 
            src="${imageUrl}" 
            class="w-full h-40 object-cover rounded-lg border border-white/10"
            onerror="this.style.display='none'"
            loading="lazy"
            alt="Complaint image"
          />
        </div>
      ` : "";
      
      // Status badge styling
      const statusBadgeClass = {
        'new': 'bg-orange-500 text-black',
        'classified': 'bg-blue-500 text-white',
        'under_action': 'bg-purple-500 text-white',
        'resolved': 'bg-green-500 text-white'
      }[complaint.status || 'new'] || 'bg-gray-500 text-white';
      
      const card = document.createElement("div");
      card.className = "bg-[#1b1b25] p-5 rounded-2xl border border-white/10 shadow-md hover:border-violet-500/30 transition-colors mb-4";
      
      card.innerHTML = `
        <div class="flex justify-between items-start mb-3">
          <h3 class="text-lg font-semibold text-violet-300">
            ${complaint.description ? complaint.description.substring(0, 50) + (complaint.description.length > 50 ? "..." : "") : "No description"}
          </h3>
          <span class="px-3 py-1 rounded-full text-xs font-semibold ${statusBadgeClass}">
            ${complaint.status || 'new'}
          </span>
        </div>
        
        <div class="grid grid-cols-2 gap-2 text-sm">
          <div class="text-gray-400">
            <span class="font-medium">Submitted:</span> ${createdAt.toLocaleDateString()}
          </div>
          <div class="text-gray-400">
            <span class="font-medium">Time passed:</span> ${timePassed}
          </div>
          <div class="text-gray-400">
            <span class="font-medium">Status:</span> ${getSimpleStatusText(complaint.status)}
          </div>
          <div class="text-gray-400">
            <span class="font-medium">Last update:</span> ${lastActionTime || createdAt.toLocaleDateString()}
          </div>
        </div>
        
        ${imageHtml}
        
        <div class="mt-3 pt-3 border-t border-white/10">
          <p class="text-gray-500 text-sm">
            <span class="font-medium">Latest action:</span> ${lastAction}
          </p>
        </div>
      `;
      
      container.appendChild(card);
    });
  } catch (error) {
    console.error("Failed to fetch complaints:", error);
    const container = document.getElementById("pastComplaints");
    if (container) {
      container.innerHTML = `
        <div class="col-span-full text-center py-10">
          <p class="text-red-400 mb-2">Failed to load complaints</p>
          <p class="text-gray-500 text-sm">Please check your connection and try again</p>
        </div>
      `;
    }
  }
}

// ===== SIMPLIFIED STATUS TEXT =====
function getSimpleStatusText(status) {
  const statusMap = {
    'new': '⏳ Awaiting Review',
    'classified': '🔍 Under Review',
    'under_action': '⚡ Action In Progress',
    'resolved': '✅ Resolved'
  };
  return statusMap[status] || status || 'Pending';
}

// ===== BOT FUNCTIONALITY =====
async function handleBotMessage(text) {
  // Check if asking about complaints
  const statusKeywords = ['status', 'update', 'progress', 'track', 'complaint', 'my complaints', 
                         'pending', 'resolved', 'open', 'closed', 'submitted', 'recent'];
  
  const isAskingAboutComplaints = statusKeywords.some(keyword => 
    text.toLowerCase().includes(keyword)
  );
  
  if (isAskingAboutComplaints && user) {
    // Check complaint status through backend
    return await checkComplaintStatus(user.id, text);
  } else if (isAskingAboutComplaints && !user) {
    return {
      reply: "Please log in first to check your complaint status. Click the login button above."
    };
  } else {
    // Use AI service for general queries
    return await fetchRegularBotResponse(text);
  }
}

async function checkComplaintStatus(userId, message) {
  try {
    const response = await fetch(`${BACKEND_URL}/bot-check-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, message })
    });
    
    return await response.json();
  } catch (error) {
    console.error("Status check failed:", error);
    return {
      reply: "I'm having trouble accessing the complaint system right now. Please check the 'My Past Complaints' section directly."
    };
  }
}

async function fetchRegularBotResponse(text) {
  try {
    const response = await fetch(`${AI_SERVICE_URL}/bot-query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text })
    });
    
    // Handle AI service downtime
    if (!response.ok) {
      return {
        reply: "The AI assistant is temporarily unavailable. Please check your complaint status using the 'My Past Complaints' section below, or try again later."
      };
    }
    
    return await response.json();
  } catch (error) {
    console.error("Bot query failed:", error);
    return {
      reply: "I'm having trouble connecting to the help system. You can check your complaints below or try again later."
    };
  }
}

async function sendBotMessage() {
  const input = document.getElementById("botInput");
  const messages = document.getElementById("botMessages");
  
  if (!input || !messages) return;
  
  const text = input.value.trim();
  if (!text) return;
  
  // Add user message
  messages.innerHTML += `
    <div class="flex justify-end mb-3">
      <div class="bg-violet-600 text-white rounded-2xl rounded-br-none px-4 py-2 max-w-[80%]">
        ${text}
      </div>
    </div>
  `;
  
  input.value = "";
  messages.scrollTop = messages.scrollHeight;
  
  // Add typing indicator
  const typingDiv = document.createElement("div");
  typingDiv.className = "flex mb-3";
  typingDiv.innerHTML = `
    <div class="bg-gray-700 text-white rounded-2xl rounded-bl-none px-4 py-2">
      <div class="typing">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;
  messages.appendChild(typingDiv);
  messages.scrollTop = messages.scrollHeight;
  
  try {
    const data = await handleBotMessage(text);
    
    // Remove typing indicator
    typingDiv.remove();
    
    // Add bot response with typewriter effect
    const botMsg = document.createElement("div");
    botMsg.className = "flex mb-3";
    botMsg.innerHTML = `
      <div class="bg-gray-700 text-white rounded-2xl rounded-bl-none px-4 py-2 max-w-[80%]">
        <span id="bot-response-text"></span>
      </div>
    `;
    
    messages.appendChild(botMsg);
    messages.scrollTop = messages.scrollHeight;
    
    const reply = data.reply || "I couldn't process your request at the moment.";
    const responseText = botMsg.querySelector("#bot-response-text");
    let i = 0;
    
    const typewriter = setInterval(() => {
      if (i < reply.length) {
        responseText.textContent += reply.charAt(i);
        i++;
        messages.scrollTop = messages.scrollHeight;
      } else {
        clearInterval(typewriter);
      }
    }, 20);
    
  } catch (error) {
    typingDiv.remove();
    messages.innerHTML += `
      <div class="flex mb-3">
        <div class="bg-gray-700 text-white rounded-2xl rounded-bl-none px-4 py-2">
          Something went wrong. Please try again.
        </div>
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
    // Show bot
    botBox.classList.add("active");
    botToggle.style.transform = "scale(0)";
    
    setTimeout(() => {
      botToggle.style.display = "none";
    }, 200);
  } else {
    // Hide bot
    botBox.classList.remove("active");
    botToggle.style.display = "flex";
    
    setTimeout(() => {
      botToggle.style.transform = "scale(1)";
    }, 50);
  }
}

// ===== ENTER KEY FOR BOT =====
const botInput = document.getElementById("botInput");
if (botInput) {
  botInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendBotMessage();
    }
  });
}

// ===== ADD STYLES =====
const style = document.createElement('style');
style.textContent = `
  .status-badge {
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    display: inline-block;
  }
  
  .typing {
    display: inline-flex;
    align-items: center;
    height: 20px;
  }
  
  .typing span {
    display: inline-block;
    width: 6px;
    height: 6px;
    background: #9ca3af;
    border-radius: 50%;
    margin: 0 2px;
    animation: typing 1s infinite ease-in-out;
  }
  
  .typing span:nth-child(2) { animation-delay: 0.2s; }
  .typing span:nth-child(3) { animation-delay: 0.4s; }
  
  @keyframes typing {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-4px); }
  }
`;
document.head.appendChild(style);

// ===== INITIALIZE PAGE =====
if (user) {
  // Fetch past complaints on page load
  fetchPastComplaints();
  
  // Set initial location after a short delay
  setTimeout(() => {
    const latInput = document.getElementById("lat");
    const lngInput = document.getElementById("lng");
    
    if (latInput && lngInput) {
      latInput.value = areaCoords.Golghar[0];
      lngInput.value = areaCoords.Golghar[1];
    }
    
    // Auto-refresh complaints every 30 seconds
    setInterval(fetchPastComplaints, 30000);
  }, 100);
}
