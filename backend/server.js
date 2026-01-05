const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const multer = require("multer");
const path = require("path");
const fetch = require("node-fetch");  // Added for AI calls

// Load environment variables
require('dotenv').config();

// Initialize Firebase with environment variables
// ============ FIXED FIREBASE INITIALIZATION ============
console.log("🔄 Initializing Firebase Admin SDK...");

// Debug: Show what environment variables are available
console.log("🔍 Checking environment variables:");
console.log("   FIREBASE_PROJECT_ID:", process.env.FIREBASE_PROJECT_ID ? "✅ Set" : "❌ Missing");
console.log("   FIREBASE_CLIENT_EMAIL:", process.env.FIREBASE_CLIENT_EMAIL ? "✅ Set" : "❌ Missing");
console.log("   FIREBASE_PRIVATE_KEY:", process.env.FIREBASE_PRIVATE_KEY ? `✅ Set (${process.env.FIREBASE_PRIVATE_KEY.length} chars)` : "❌ Missing");

// FIX: Properly format the private key from Render environment variable
let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';

// CRITICAL FIX: Render stores newlines as literal \n characters, need to convert to actual newlines
if (privateKey && privateKey.includes('\\n')) {
  console.log("🔧 Converting escaped newlines (\\n) to actual newlines...");
  privateKey = privateKey.replace(/\\n/g, '\n');
}

// Validate the key format
if (!privateKey.startsWith('-----BEGIN PRIVATE KEY-----')) {
  console.error("❌ ERROR: Private key doesn't start with correct header");
  console.error("First 50 chars:", privateKey.substring(0, 50));
} else {
  console.log("✅ Private key format looks correct");
}

try {
  // Create complete service account configuration
  const serviceAccount = {
    type: "service_account",
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID || "not-required", // This can be auto-generated
    private_key: privateKey,
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID || "not-required", // This can be auto-generated
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL || 
      `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(process.env.FIREBASE_CLIENT_EMAIL)}`,
    universe_domain: "googleapis.com"
  };

  console.log("📧 Service Account Email:", serviceAccount.client_email);
  console.log("🏢 Project ID:", serviceAccount.project_id);

  // Initialize Firebase Admin SDK
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
  });
  
  console.log("✅ Firebase Admin SDK initialized successfully!");
  
} catch (error) {
  console.error("❌ CRITICAL: Firebase initialization failed!");
  console.error("Error:", error.message);
  console.error("Stack:", error.stack);
  console.log("⚠️ Application will continue but database operations will fail");
}

const db = admin.firestore();
console.log("✅ Firestore instance created");

// Test the connection on startup
if (db) {
  db.collection("health_check").doc("server_start").set({
    timestamp: new Date().toISOString(),
    status: "backend_started",
    environment: process.env.NODE_ENV || 'development'
  })
  .then(() => console.log("✅ Firebase connection test: PASSED"))
  .catch(err => console.error("❌ Firebase connection test: FAILED -", err.message));
}
// ============ FIREBASE DEBUG ENDPOINT ============
app.get("/test-firebase", async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({
        success: false,
        error: "Firebase not initialized",
        message: "Firebase Admin SDK failed to initialize"
      });
    }

    // Test 1: Write to Firestore
    const testRef = db.collection("connection_tests").doc("render_test");
    await testRef.set({
      test: true,
      timestamp: new Date().toISOString(),
      server: "render_backend",
      environment: process.env.NODE_ENV
    });
    
    // Test 2: Read from Firestore
    const doc = await testRef.get();
    const data = doc.data();
    
    // Test 3: Count complaints
    const complaintsSnapshot = await db.collection("complaints").limit(1).get();
    
    res.json({
      success: true,
      message: "✅ Firebase connection successful!",
      tests: {
        write: "PASSED",
        read: "PASSED",
        collection_access: complaintsSnapshot.empty ? "NO_DATA" : "PASSED"
      },
      data: {
        test_document: data,
        complaints_count: complaintsSnapshot.size,
        sample_complaint: complaintsSnapshot.empty ? null : {
          id: complaintsSnapshot.docs[0].id,
          ...complaintsSnapshot.docs[0].data()
        }
      },
      firebase_config: {
        project_id: process.env.FIREBASE_PROJECT_ID,
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        private_key_length: process.env.FIREBASE_PRIVATE_KEY?.length || 0,
        environment: process.env.NODE_ENV || 'development'
      }
    });
    
  } catch (error) {
    console.error("Firebase test error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      error_code: error.code,
      error_details: error.details,
      firebase_info: {
        project_id: process.env.FIREBASE_PROJECT_ID,
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        private_key_preview: process.env.FIREBASE_PRIVATE_KEY ? 
          process.env.FIREBASE_PRIVATE_KEY.substring(0, 100) + "..." : 
          "MISSING"
      },
      fix_suggestion: "Check if FIREBASE_PRIVATE_KEY has actual newlines, not \\n characters"
    });
  }
});

// AI Service URL - FIXED: Use your actual AI service
const AI_SERVICE_URL = 'https://nagrik-raskshak-1.onrender.com';

const app = express();

// 🔥 FIXED CORS CONFIGURATION - ALLOW ALL VERCEL DOMAINS
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // 🔥 ALLOW ALL Vercel and Render domains automatically
    if (origin.endsWith('.vercel.app') || origin.endsWith('.onrender.com')) {
      return callback(null, true);
    }
    
    // Also allow specific localhost domains
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5500',
      'http://127.0.0.1:5500',
      'https://nagrik-raskshak-bz63.vercel.app',
      'https://nagrik-raskshak-qdu3.vercel.app',
      'https://nagrik-raskshak-65qk.vercel.app',
      'https://nagrik-backend.onrender.com',
      'https://nagrik-raskshak-1.onrender.com',
      'https://nagrik-raskshak-f8t1.onrender.com'
    ];
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    console.warn("CORS blocked (but will allow):", origin);
    // 🔥 TEMPORARY: Allow anyway for debugging
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Content-Length', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Length', 'Content-Type'],
  maxAge: 86400 // 24 hours
}));

// 🔥 HANDLE PREFLIGHT REQUESTS
app.options('*', cors());

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

// ============ AI ENDPOINTS ============

/**
 * AI HEALTH CHECK
 * Test: GET /api/ai-health
 */
app.get("/api/ai-health", async (req, res) => {
  try {
    console.log(`Checking AI service health at: ${AI_SERVICE_URL}`);
    
    const response = await fetch(`${AI_SERVICE_URL}/health`, {
      timeout: 5000
    });
    
    if (response.ok) {
      const health = await response.json();
      res.json({
        success: true,
        ai_service: "online",
        status: health.status || "unknown",
        url: AI_SERVICE_URL,
        timestamp: new Date().toISOString()
      });
    } else {
      res.json({
        success: false,
        ai_service: "offline",
        status: "unhealthy",
        error: `HTTP ${response.status}`,
        url: AI_SERVICE_URL,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error("AI health check failed:", error.message);
    res.json({
      success: false,
      ai_service: "offline",
      status: "unreachable",
      error: error.message,
      url: AI_SERVICE_URL,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * AI ANALYSIS ENDPOINT
 * Test: POST /api/ai-analyze
 * Body: { "complaint": "water pipe leaking" }
 */
app.post("/api/ai-analyze", async (req, res) => {
  try {
    const { complaint } = req.body;
    
    if (!complaint || complaint.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: "No complaint text provided" 
      });
    }

    console.log(`🤖 Analyzing complaint: "${complaint.substring(0, 50)}..."`);
    
    // Call AI service
    const aiResponse = await fetch(`${AI_SERVICE_URL}/analyze`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "User-Agent": "NagrikRakshak-Backend/1.0"
      },
      body: JSON.stringify({ complaint: complaint.trim() }),
      timeout: 10000 // 10 second timeout
    });

    if (!aiResponse.ok) {
      console.error(`AI service error: ${aiResponse.status} ${aiResponse.statusText}`);
      throw new Error(`AI service returned ${aiResponse.status}`);
    }

    const analysis = await aiResponse.json();
    
    res.json({
      success: true,
      message: "AI analysis completed",
      analysis: analysis,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("AI analysis failed:", error.message);
    
    // Fallback analysis when AI service is down
    const fallbackAnalysis = {
      department: "Municipality",
      priority: "Medium",
      confidence: 0,
      fallback: true,
      message: "Using fallback analysis (AI service unavailable)"
    };
    
    res.json({
      success: true,
      message: "Fallback analysis (AI service unavailable)",
      analysis: fallbackAnalysis,
      timestamp: new Date().toISOString()
    });
  }
});

// ============ EXISTING ENDPOINTS ============

// Health check endpoint (required for Render)
app.get("/health", (req, res) => {
  res.json({ 
    status: "healthy", 
    service: "Nagrik Rakshak API",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    ai_service_url: AI_SERVICE_URL
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
      ai: ["/api/ai-analyze", "/api/ai-health"],  // Added AI endpoints
      system: ["/health", "/api"]
    }
  });
});

app.get("/", (req, res) => {
  res.json({
    message: "Nagrik Rakshak Backend is running 🚀",
    backend_url: "https://nagrik-raskshak-f8t1.onrender.com",
    ai_service: AI_SERVICE_URL,
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
 * SUBMIT COMPLAINT - UPDATED WITH AI ANALYSIS
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

    // ===== AI ANALYSIS ADDED HERE =====
    let aiAnalysis = {};
    let department = null;
    let priority = "Medium";
    
    try {
      console.log("🤖 Getting AI analysis for complaint...");
      const aiResponse = await fetch(`${AI_SERVICE_URL}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complaint: description }),
        timeout: 8000
      });
      
      if (aiResponse.ok) {
        aiAnalysis = await aiResponse.json();
        department = aiAnalysis.department || aiAnalysis.analysis?.department || null;
        priority = aiAnalysis.priority || aiAnalysis.analysis?.priority || "Medium";
        console.log("✅ AI Analysis successful:", { department, priority });
      } else {
        console.warn("AI service returned error:", aiResponse.status);
      }
    } catch (aiError) {
      console.warn("⚠️ AI analysis skipped:", aiError.message);
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
      department: department,  // From AI analysis
      priority: priority,      // From AI analysis
      ai_analysis: aiAnalysis, // Store full AI analysis
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

    const docRef = await db.collection("complaints").add(complaintData);

    res.json({ 
      success: true, 
      message: "Complaint saved successfully",
      complaintId: docRef.id,
      ai_analysis: aiAnalysis,
      department: department,
      priority: priority
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
        department: data.department || "Unassigned",
        priority: data.priority || "Medium",
        createdAt: createdAt,
        actions: processedActions,
        ai_analysis: data.ai_analysis || null
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
  { q: "what is nagrik rakshak", a: "Nagrik Rakshak is a citizen grievance redressal system where you can report issues like water problems, electricity, roads, garbage, etc." },
  { q: "how to submit complaint", a: "Fill the form above: 1. Enter your name and mobile 2. Describe the problem 3. Select location 4. Upload photo if needed 5. Click Submit" },
  { q: "check status", a: "Your complaint status appears in 'My Past Complaints' section below. You'll see status like New, Under Review, Resolved." },
  { q: "water problem", a: "Water issues are forwarded to Water Department. Describe the problem: no water, low pressure, leakage, dirty water, etc." },
  { q: "electricity issue", a: "Power cuts, street lights, wires - these go to Electricity Department. Mention location and problem details." },
  { q: "garbage", a: "Garbage complaints go to Municipality. Specify if it's regular waste, construction debris, or drain cleaning needed." },
  { q: "road repair", a: "Potholes, broken roads, footpaths are handled by PWD (Public Works Department). Mention exact location." },
  { q: "emergency", a: "For emergencies like live wires, accidents, fires - call emergency services first, then submit complaint here for follow-up." }
];

/**
 * BOT QUERY ENDPOINT
 */
app.post("/bot-query", (req, res) => {
  try {
    const { message } = req.body;
    const query = (message || "").toLowerCase().trim();
    
    console.log("Bot query:", query);
    
    // Find matching FAQ
    let reply = "I can help you with:\n• Submitting complaints\n• Checking status\n• Department information\n• Process guidance\n\nJust ask me anything!";
    
    for (const faq of FAQS) {
      if (query.includes(faq.q.toLowerCase())) {
        reply = faq.a;
        break;
      }
    }
    
    // Check for complaint status queries
    if (query.includes("status") || query.includes("update") || query.includes("track")) {
      reply = "Check your complaint status in the 'My Past Complaints' section below. Each complaint shows its current status and latest updates.";
    }
    
    // Check for complaint submission
    if (query.includes("submit") || query.includes("complaint") || query.includes("report")) {
      reply = "To submit a complaint:\n1. Fill the form above\n2. Add description and location\n3. Upload image if needed\n4. Click Submit\n\nYour complaint will be tracked below.";
    }
    
    res.json({ 
      success: true, 
      reply: reply,
      query: query,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Bot query error:", error);
    res.json({ 
      success: false, 
      reply: "I'm having trouble understanding. Please try again or use the form above to submit a complaint.",
      error: error.message 
    });
  }
});

/**
 * BOT - CHECK COMPLAINT STATUS
 */
app.post("/bot-check-status", async (req, res) => {
  try {
    const { userId, message } = req.body;
    
    if (!userId) {
      return res.json({ 
        success: false, 
        reply: "Please log in first to check your complaint status." 
      });
    }
    
    // Get user's complaints
    const complaintsRef = db.collection("complaints");
    const snapshot = await complaintsRef.where("userId", "==", userId).get();
    
    const complaints = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        description: data.description || "",
        status: data.status || "Pending",
        createdAt: data.createdAt?.toDate?.() || new Date(),
        address: data.address || ""
      };
    });
    
    if (complaints.length === 0) {
      return res.json({ 
        success: true, 
        reply: "You haven't submitted any complaints yet. Use the form above to submit your first complaint." 
      });
    }
    
    // Sort by latest first
    complaints.sort((a, b) => b.createdAt - a.createdAt);
    
    const latest = complaints[0];
    const daysAgo = Math.floor((new Date() - latest.createdAt) / (1000 * 60 * 60 * 24));
    const timeText = daysAgo === 0 ? "today" : daysAgo === 1 ? "yesterday" : `${daysAgo} days ago`;
    
    let reply = `You have ${complaints.length} complaint(s).\n\n`;
    reply += `**Latest complaint** (submitted ${timeText}):\n`;
    reply += `• **Issue:** ${latest.description.substring(0, 80)}${latest.description.length > 80 ? '...' : ''}\n`;
    reply += `• **Status:** ${latest.status}\n`;
    reply += `• **Location:** ${latest.address || 'Not specified'}\n\n`;
    reply += `Check all complaints in 'My Past Complaints' section below.`;
    
    res.json({ 
      success: true, 
      reply: reply,
      count: complaints.length,
      latestStatus: latest.status
    });
    
  } catch (error) {
    console.error("Bot status check error:", error);
    res.json({ 
      success: false, 
      reply: "I'm having trouble accessing your complaints. Please check the 'My Past Complaints' section directly." 
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
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Backend URL: https://nagrik-raskshak-f8t1.onrender.com`);
  console.log(`🤖 AI Service URL: ${AI_SERVICE_URL}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`🤖 AI Health check: http://localhost:${PORT}/api/ai-health`);
  console.log(`📚 API docs: http://localhost:${PORT}/api`);
});

