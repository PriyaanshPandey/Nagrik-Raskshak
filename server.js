const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const multer = require("multer");
const fetch = require("node-fetch");
const path = require("path");

// Load environment variables
require('dotenv').config();

// Initialize Firebase with environment variables
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
  })
});

const db = admin.firestore();

const app = express();

// CORS configuration for production
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'https://your-netlify-site.netlify.app', // Will update after Netlify deployment
  'https://nagrik-backend.onrender.com'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}`;
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Content-Length', 'X-Requested-With']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure multer for file uploads (memory storage for production)
const storage = multer.memoryStorage(); // Store files in memory instead of disk
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Health check endpoint (required for Render)
app.get("/health", (req, res) => {
  res.json({ 
    status: "healthy", 
    service: "Nagrik Rakshak API",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API info endpoint
app.get("/api", (req, res) => {
  res.json({
    name: "Nagrik Rakshak API",
    version: "1.0.0",
    endpoints: {
      auth: ["/register", "/login"],
      complaints: ["/submit-complaint", "/complaints", "/my-complaints"],
      bot: ["/bot-query", "/bot-check-status"],
      admin: ["/update-complaint-status"],
      system: ["/health"]
    }
  });
});

app.get("/", (req, res) => {
  res.json({
    message: "Nagrik Rakshak Backend is running 🚀",
    docs: "Visit /api for API documentation",
    health: "Visit /health for service status"
  });
});

/**
 * REGISTER USER
 */
app.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "Missing fields" });
    }

    const existing = await db
      .collection("users")
      .where("email", "==", email)
      .get();

    if (!existing.empty) {
      return res.json({ success: false, message: "User already exists" });
    }

    const userRef = await db.collection("users").add({
      name,
      email,
      password,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({
      success: true,
      user: {
        id: userRef.id,
        name,
        email,
      },
    });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Register failed",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

/**
 * LOGIN USER
 */
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password required" });
    }

    const snapshot = await db
      .collection("users")
      .where("email", "==", email)
      .where("password", "==", password)
      .get();

    if (snapshot.empty) {
      return res.json({ 
        success: false,
        message: "Invalid email or password"
      });
    }

    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();

    // Remove password from response for security
    delete userData.password;

    res.json({
      success: true,
      user: {
        id: userDoc.id,
        ...userData,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ 
      success: false,
      message: "Login failed",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

/**
 * SUBMIT COMPLAINT
 * 🔐 Now linked with logged-in user
 */
app.post("/submit-complaint", upload.any(), async (req, res) => {
  try {
    const {
      userId,
      userName,
      mobile,
      description,
      lat,
      lng
    } = req.body;

    if (!userId || !userName || !description) {
      return res.status(400).json({ 
        error: "Missing required fields",
        required: ["userId", "userName", "description"]
      });
    }

    let imageName = null;
    let hasImage = false;
    
    if (req.files && req.files.length > 0) {
      const file = req.files[0];
      imageName = file.originalname;
      hasImage = true;
      
      // Note: In production, you might want to upload to Firebase Storage
      // For now, we're only storing the file name since free tiers have limited storage
    }

    let location = null;
    let address = "Location not provided";

    if (lat && lng) {
      location = new admin.firestore.GeoPoint(
        parseFloat(lat),
        parseFloat(lng)
      );

      try {
        const geoUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;

        const geoResponse = await fetch(geoUrl, {
          headers: {
            "User-Agent": "NagrikRakshak/1.0 (contact: shikhar0538@gmail.com)",
          },
        });

        if (geoResponse.ok) {
          const geoData = await geoResponse.json();
          if (geoData?.display_name) {
            address = geoData.display_name
              .split(", ")
              .slice(0, 3)
              .join(", ");
          }
        }
      } catch (geoError) {
        console.warn("Geocoding failed:", geoError.message);
        address = "Location provided but address lookup failed";
      }
    }

    const complaintData = {
      userId,
      userName,
      mobile: mobile || "Not provided",
      description,
      location,
      address,
      imageName,
      hasImage,
      department: null,
      priority: null,
      status: "new",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      clientCreatedAt: new Date().toISOString(),
      actions: [{
        action: "Complaint Submitted",
        timestamp: new Date().toISOString(),
        by: userName
      }],
      deadline: null,
      overdue: false,
      lastUpdated: new Date().toISOString()
    };

    await db.collection("complaints").add(complaintData);

    res.json({ 
      success: true, 
      message: "Complaint saved successfully",
      complaintId: complaintData.id
    });
  } catch (err) {
    console.error("Submit complaint error:", err);
    res.status(500).json({ 
      error: "Failed to save complaint",
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

/**
 * UPDATE COMPLAINT STATUS
 */
app.post("/update-complaint-status", async (req, res) => {
  try {
    const { complaintId, status, adminName } = req.body;

    if (!complaintId || !status) {
      return res.status(400).json({ success: false, message: "Missing fields" });
    }

    const complaintRef = db.collection("complaints").doc(complaintId);
    const complaintDoc = await complaintRef.get();

    if (!complaintDoc.exists) {
      return res.status(404).json({ success: false, message: "Complaint not found" });
    }

    const currentData = complaintDoc.data();
    const actions = currentData.actions || [];

    // Add new action with regular timestamp (not FieldValue)
    actions.push({
      action: `Status changed to ${status}`,
      timestamp: new Date().toISOString(),
      by: adminName || "Admin"
    });

    // Update complaint - use regular Date object for lastUpdated
    await complaintRef.update({
      status: status,
      actions: actions,
      lastUpdated: new Date().toISOString()
    });

    res.json({ 
      success: true, 
      message: `Status updated to ${status}`,
      complaintId: complaintId
    });
  } catch (err) {
    console.error("Update status error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Update failed: " + err.message 
    });
  }
});

/**
 * ADMIN – ALL COMPLAINTS
 */
app.get("/complaints", async (req, res) => {
  try {
    const snapshot = await db
      .collection("complaints")
      .orderBy("createdAt", "desc")
      .get();

    const complaints = snapshot.docs.map((doc) => {
      const data = doc.data();
      
      // Calculate time passed
      const createdAt = data.createdAt?.toDate();
      const now = new Date();
      let timePassed = "";
      let hoursPassed = 0;
      
      if (createdAt) {
        const diffMs = now - createdAt;
        hoursPassed = Math.floor(diffMs / (1000 * 60 * 60));
        const days = Math.floor(hoursPassed / 24);
        const hours = hoursPassed % 24;
        
        if (days > 0) {
          timePassed = `${days}d ${hours}h`;
        } else {
          timePassed = `${hours}h`;
        }
      }
      
      // Check if overdue
      let isOverdue = data.overdue || false;
      if (data.deadline && data.status !== "resolved") {
        const deadline = data.deadline?.toDate();
        if (deadline && now > deadline) {
          isOverdue = true;
        }
      }

      return {
        id: doc.id,
        ...data,
        createdAt: createdAt ? createdAt.toISOString() : null,
        deadline: data.deadline ? data.deadline.toDate().toISOString() : null,
        timePassed,
        hoursPassed,
        isOverdue,
        actions: data.actions || []
      };
    });

    res.json({
      success: true,
      count: complaints.length,
      complaints: complaints
    });
  } catch (err) {
    console.error("Get all complaints error:", err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

/**
 * 👤 USER – MY COMPLAINTS
 */
app.get("/my-complaints", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ 
      success: false,
      error: "Missing userId" 
    });

    const complaintsRef = db.collection("complaints");

    let snapshot;
    try {
      snapshot = await complaintsRef
        .where("userId", "==", userId)
        .orderBy("createdAt", "desc")
        .get();
    } catch (err) {
      console.warn("OrderBy failed, fetching without orderBy:", err.message);
      snapshot = await complaintsRef.where("userId", "==", userId).get();
    }

    const complaints = snapshot.docs.map(doc => {
      const data = doc.data();
      
      // Handle timestamp conversion
      let createdAt = new Date();
      if (data.createdAt) {
        if (data.createdAt.toDate) {
          createdAt = data.createdAt.toDate();
        } else if (typeof data.createdAt === 'string') {
          createdAt = new Date(data.createdAt);
        }
      }
      
      // Handle actions timestamps
      const actions = data.actions || [];
      const processedActions = actions.map(action => ({
        ...action,
        timestamp: action.timestamp ? new Date(action.timestamp) : new Date()
      }));

      return {
        id: doc.id,
        description: data.description || "",
        status: data.status || "Pending",
        address: data.address || "",
        imageName: data.imageName || "",
        hasImage: data.hasImage || false,
        createdAt: createdAt,
        actions: processedActions,
        priority: data.priority || "Low"
      };
    });

    res.json({
      success: true,
      userId: userId,
      count: complaints.length,
      complaints: complaints
    });
  } catch (err) {
    console.error("Fetch user complaints failed:", err);
    res.status(500).json({ 
      success: false,
      error: "Failed to fetch complaints",
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// FAQ array for bot responses
const FAQS = [
  // 📝 Filing complaints
  {
    keywords: ["file", "register", "complaint", "issue", "problem", "report", "submit", "raise"],
    answer:
      "You can submit a complaint by filling the form on the dashboard. Add details and an optional image to help authorities take faster action. Make sure to provide accurate location information."
  },

  // 📌 Complaint status & tracking
  {
    keywords: ["status", "progress", "update", "track", "tracking", "check status", "where is", "what happened"],
    answer:
      "You can check your complaint status in two ways:\n1. Ask me: 'What's the status of my complaints?'\n2. View the 'My Past Complaints' section after logging in\nI'll show you progress, priority, and current status of all your issues."
  },

  // 👤 My complaints
  {
    keywords: ["my complaints", "my status", "check my", "see my", "my issues", "my reports"],
    answer:
      "To see your complaints, you can ask me:\n• 'What's the status of my complaints?'\n• 'Show my recent complaints'\n• 'Do I have any pending issues?'\n• 'What complaints have been resolved?'\nI'll show you all details with current status."
  },

  // 🔍 Specific status types
  {
    keywords: ["pending", "open", "waiting", "not resolved", "still open"],
    answer:
      "Pending complaints are those that haven't been resolved yet. Ask me 'Do I have any pending complaints?' and I'll show you all open issues with their current progress and priority level."
  },

  // ✅ Resolved complaints
  {
    keywords: ["resolved", "closed", "completed", "done", "finished", "solved"],
    answer:
      "Resolved complaints are issues that have been successfully addressed. Ask me 'What complaints have been resolved?' to see all your completed cases along with resolution details."
  },

  // 🕒 Time & resolution
  {
    keywords: ["time", "how long", "resolution", "delay", "when", "duration", "take time", "wait"],
    answer:
      "Complaints are reviewed as soon as they are received. Resolution time depends on the nature and priority of the issue:\n• High priority: 24 hours\n• Medium priority: 72 hours\n• Low priority: 1 week\nYou can track exact times in your complaint status."
  },

  // 🏢 Department handling
  {
    keywords: ["department", "authority", "who", "handles", "responsible", "which department"],
    answer:
      "Each complaint is automatically routed to the appropriate department based on its category and location:\n• Water issues → Water Department\n• Electricity → Electricity Department\n• Roads → PWD\n• Garbage → Municipality\n• Crime → Police\n• Traffic → Traffic Police"
  },

  // 📍 Location related
  {
    keywords: ["location", "area", "place", "address", "gps", "where", "pinpoint"],
    answer:
      "You can select your area from the dropdown or allow location access so the complaint is mapped accurately for faster resolution. Accurate location helps our teams reach the spot quickly."
  },

  // 📷 Image upload
  {
    keywords: ["image", "photo", "picture", "upload", "proof", "evidence", "attach"],
    answer:
      "Uploading an image is optional but highly recommended, as it helps authorities understand the issue better. Supported formats: PNG, JPG (Max 5MB). Clear images lead to faster resolution."
  },

  // 🔐 Privacy & security
  {
    keywords: ["privacy", "secure", "data", "safe", "identity", "personal", "information"],
    answer:
      "Your personal details are securely stored and only accessible to authorized officials handling the complaint. We never share your information with third parties without consent."
  },

  // 🧑 Account related
  {
    keywords: ["login", "sign in", "signup", "register account", "account", "profile", "create account"],
    answer:
      "You can create an account or log in using your registered email to submit and track complaints. One account lets you manage all your complaints and receive updates."
  },

  // 🔄 Multiple complaints
  {
    keywords: ["multiple", "more than one", "many complaints", "several", "another", "new complaint"],
    answer:
      "You can submit multiple complaints whenever required. Each complaint is tracked independently. There's no limit - report all issues you encounter in your area."
  },

  // ❌ Editing complaints
  {
    keywords: ["edit", "change", "update complaint", "modify", "correct", "wrong information"],
    answer:
      "Once submitted, complaints are reviewed by authorities. For corrections, you can submit a new complaint with updated information. Our team coordinates all related complaints."
  },

  // 🗑 Deleting complaints
  {
    keywords: ["delete", "remove", "cancel complaint", "withdraw", "take back"],
    answer:
      "Complaints are preserved to ensure accountability and proper resolution through official channels. Once submitted, they remain in the system for transparency and tracking."
  },

  // 📞 Contact / help
  {
    keywords: ["help", "support", "contact", "assist", "help desk", "customer care", "support team"],
    answer:
      "This platform is designed to guide and assist citizens in raising concerns. For direct help, you can ask me specific questions or use the complaint form for official assistance."
  },

  // ⚠️ Urgent / emergency
  {
    keywords: ["urgent", "emergency", "immediate", "danger", "critical", "serious", "life threatening"],
    answer:
      "Urgent concerns are prioritized based on severity. If you have a life-threatening emergency, please contact emergency services directly first, then report here for follow-up."
  },

  // 🧾 Complaint ID & reference
  {
    keywords: ["id", "complaint number", "reference", "tracking number", "complaint code"],
    answer:
      "Each complaint is assigned a unique reference internally, allowing smooth tracking and follow-up. You can refer to your complaints by description when asking me for updates."
  },

  // 🌐 Platform purpose
  {
    keywords: ["what is this", "what is nagrik rakshak", "nagrik rakshak", "platform", "purpose", "about", "what does"],
    answer:
      "Nagrik Rakshak is a digital grievance platform that connects citizens with authorities to resolve public issues efficiently. We bridge the gap between people and government services."
  },

  // ⏰ Deadlines & SLA
  {
    keywords: ["deadline", "sla", "time limit", "due date", "by when", "timeframe", "guarantee"],
    answer:
      "We have strict deadlines for complaint resolution:\n• ⚡ High priority: 24 hours\n• 🟡 Medium priority: 72 hours\n• 🟢 Low priority: 7 days\nOverdue complaints get special attention from supervisors."
  },

  // 📊 Priority system
  {
    keywords: ["priority", "important", "high", "medium", "low", "critical", "severity"],
    answer:
      "Complaints are automatically prioritized:\n• 🔴 High: Safety issues, emergencies\n• 🟡 Medium: Functional problems\n• 🟢 Low: Maintenance, cleanliness\nPriority determines response time and resource allocation."
  },

  // 🔔 Notifications
  {
    keywords: ["notification", "alert", "update me", "tell me", "inform", "notify", "email", "sms"],
    answer:
      "You receive automatic updates when:\n1. Complaint is received\n2. Status changes (Under Action/Resolved)\n3. Deadline is approaching\n4. Complaint is resolved\nCheck your complaint status anytime by asking me."
  },

  // 🗺️ Map features
  {
    keywords: ["map", "location map", "see on map", "geographic", "nearby", "area map"],
    answer:
      "All complaints are plotted on our interactive map. Admins can see complaint hotspots and allocate resources efficiently. Citizens can see general issue areas in their locality."
  },

  // 📈 Statistics & reports
  {
    keywords: ["statistics", "reports", "data", "numbers", "how many", "trends", "analytics"],
    answer:
      "The system tracks:\n• Total complaints submitted\n• Resolution rates\n• Average resolution time\n• Department performance\n• Common issue areas\nThis helps improve public service delivery."
  },

  // 🤖 AI features
  {
    keywords: ["ai", "artificial intelligence", "smart", "automatic", "classification", "how it works"],
    answer:
      "Our AI automatically:\n1. Classifies complaints by department\n2. Assigns priority (High/Medium/Low)\n3. Sets resolution deadlines\n4. Detects urgent issues\nThis ensures faster and more accurate routing."
  },

  // 🏆 Success stories
  {
    keywords: ["success", "worked", "solved cases", "examples", "testimonials", "results"],
    answer:
      "Nagrik Rakshak has successfully resolved thousands of complaints including:\n• Road repairs\n• Water supply restoration\n• Street light fixes\n• Garbage clearance\n• Traffic management\nYour complaint could be next!"
  },

  // 🔄 Follow-up process
  {
    keywords: ["follow up", "reminder", "chase", "escalate", "supervisor", "manager"],
    answer:
      "If your complaint is delayed:\n1. System automatically escalates after deadline\n2. Supervisors are notified\n3. Priority is increased\n4. Additional resources are allocated\nYou can always ask me for current status."
  },

  // 📱 Mobile access
  {
    keywords: ["mobile", "phone", "app", "android", "ios", "mobile friendly", "responsive"],
    answer:
      "The platform works perfectly on all devices:\n• Mobile phones\n• Tablets\n• Laptops\n• Desktops\nNo app installation needed - just visit the website from any device."
  },

  // 🌙 Offline complaints
  {
    keywords: ["offline", "no internet", "phone call", "sms", "visit office", "in person"],
    answer:
      "Currently we only support online complaints. However, you can:\n1. Visit a friend with internet\n2. Use public WiFi\n3. Visit municipal office for assistance\nWe're working on SMS-based complaint system."
  },

  // 🎯 Tips for effective complaints
  {
    keywords: ["tips", "effective", "better", "fast", "quick", "successful", "how to"],
    answer:
      "For faster resolution:\n1. Provide clear description\n2. Add photo evidence\n3. Accurate location\n4. Contact number\n5. Regular updates\nWell-documented complaints get resolved 3x faster!"
  }
];

/**
 * BOT QUERY ENDPOINT
 */
app.post("/bot-query", (req, res) => {
  const { message } = req.body;

  if (!message || message.trim().length === 0) {
    return res.json({
      reply: "I'm here to help you. Please share your concern."
    });
  }

  const text = message.toLowerCase();
  const words = text
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(w => w.length > 2);

  let bestMatch = null;
  let bestScore = 0;

  for (const faq of FAQS) {
    let score = 0;
    for (const keyword of faq.keywords) {
      for (const word of words) {
        if (word.includes(keyword) || keyword.includes(word)) {
          score++;
        }
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = faq;
    }
  }

  if (bestMatch && bestScore >= 1) {
    return res.json({ reply: bestMatch.answer });
  }

  const fallbackReplies = [
    "That's an important concern. The platform is designed to ensure such issues are handled responsibly.",
    "Thanks for bringing this up. Your concern aligns with how the system supports citizen grievances.",
    "This is something the platform accounts for, ensuring proper attention through the grievance process.",
    "Your concern is valid, and the system supports resolution through appropriate authorities."
  ];

  const reply = fallbackReplies[Math.floor(Math.random() * fallbackReplies.length)];
  res.json({ reply });
});

/**
 * BOT - CHECK COMPLAINT STATUS
 */
app.post("/bot-check-status", async (req, res) => {
  try {
    const { userId, message } = req.body;
    
    if (!userId) {
      return res.json({
        reply: "I need to know who you are to check your complaints. Please log in first."
      });
    }

    // Clean and analyze the message
    const text = message.toLowerCase();
    
    // Check what user is asking about
    const isAskingStatus = text.includes('status') || text.includes('update') || 
                          text.includes('progress') || text.includes('track');
    const isAskingRecent = text.includes('recent') || text.includes('latest') || 
                          text.includes('last') || text.includes('new');
    const isAskingPending = text.includes('pending') || text.includes('open') || 
                           text.includes('waiting') || text.includes('not resolved');
    const isAskingResolved = text.includes('resolved') || text.includes('closed') || 
                            text.includes('completed') || text.includes('done');

    // Get user's complaints
    const complaintsRef = db.collection("complaints");
    let snapshot;
    try {
      snapshot = await complaintsRef
        .where("userId", "==", userId)
        .orderBy("createdAt", "desc")
        .get();
    } catch (err) {
      snapshot = await complaintsRef.where("userId", "==", userId).get();
    }

    if (snapshot.empty) {
      return res.json({
        reply: "You haven't submitted any complaints yet. Use the form to submit your first complaint!"
      });
    }

    const complaints = snapshot.docs.map(doc => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate?.() || new Date();
      const now = new Date();
      const hoursPassed = Math.floor((now - createdAt) / (1000 * 60 * 60));
      
      return {
        id: doc.id,
        description: data.description || "",
        status: data.status || "new",
        priority: data.priority || "Low",
        createdAt: createdAt,
        hoursPassed: hoursPassed,
        address: data.address || "Unknown location"
      };
    });

    // Filter based on what user is asking
    let filteredComplaints = complaints;
    
    if (isAskingPending) {
      filteredComplaints = complaints.filter(c => 
        c.status !== "resolved"
      );
    } else if (isAskingResolved) {
      filteredComplaints = complaints.filter(c => 
        c.status === "resolved"
      );
    } else if (isAskingRecent) {
      filteredComplaints = complaints.slice(0, 3); // Last 3
    }

    // Prepare response
    if (filteredComplaints.length === 0) {
      if (isAskingPending) {
        return res.json({
          reply: "Great news! You have no pending complaints. All your issues have been resolved. 🎉"
        });
      } else if (isAskingResolved) {
        return res.json({
          reply: "You haven't had any complaints resolved yet. Your submitted complaints are still being processed."
        });
      }
      return res.json({
        reply: "I couldn't find any complaints matching your request."
      });
    }

    // Build detailed response
    let reply = "";
    
    if (isAskingRecent) {
      reply = "Here are your recent complaints:\n\n";
    } else if (isAskingPending) {
      reply = `You have ${filteredComplaints.length} pending complaint${filteredComplaints.length > 1 ? 's' : ''}:\n\n`;
    } else if (isAskingResolved) {
      reply = `You have ${filteredComplaints.length} resolved complaint${filteredComplaints.length > 1 ? 's' : ''}:\n\n`;
    } else {
      reply = `You have ${complaints.length} complaint${complaints.length > 1 ? 's' : ''} in total:\n\n`;
    }

    filteredComplaints.forEach((c, index) => {
      const days = Math.floor(c.hoursPassed / 24);
      const hours = c.hoursPassed % 24;
      const timeAgo = days > 0 ? `${days}d ${hours}h ago` : `${c.hoursPassed}h ago`;
      
      const statusEmoji = {
        'new': '🆕',
        'classified': '🔍',
        'under_action': '⚡',
        'resolved': '✅'
      }[c.status] || '📋';

      reply += `${index + 1}. ${statusEmoji} **${c.description.substring(0, 40)}${c.description.length > 40 ? '...' : ''}**\n`;
      reply += `   📊 Status: ${c.status.replace('_', ' ').toUpperCase()}\n`;
      reply += `   🏷️ Priority: ${c.priority}\n`;
      reply += `   ⏰ Submitted: ${timeAgo}\n`;
      reply += `   📍 Location: ${c.address}\n\n`;
    });

    // Add helpful suggestions
    if (filteredComplaints.some(c => c.status === "under_action")) {
      reply += "Complaints marked as 'Under Action' are being actively worked on by our team.\n";
    }
    
    if (filteredComplaints.some(c => c.status === "new")) {
      reply += "New complaints are awaiting AI classification (usually takes 1 minute).\n";
    }

    reply += "\nYou can also check the 'My Past Complaints' section for more details.";

    res.json({ reply });

  } catch (err) {
    console.error("Bot status check failed:", err);
    res.json({
      reply: "Sorry, I'm having trouble accessing your complaint data right now. Please try again later."
    });
  }
});

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.path,
    method: req.method
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📚 API docs: http://localhost:${PORT}/api`);
});
