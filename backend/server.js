const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const multer = require("multer");
const path = require("path");
const fetch = require("node-fetch");  // Added for AI calls

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

// AI Service URL - ADD THIS
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'https://nagrik-ai-service.onrender.com';
// If AI service is not ready, use this fallback:
// const AI_SERVICE_URL = 'https://nagrik-raskshak-1.onrender.com'; // Your backend URL for fallback

const app = express();

// CORS configuration for production
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'nagrik-raskshak-qdu3-2hc0ntlw6-priyaanshpandeys-projects.vercel.app', // Will update after Netlify deployment
  'https://nagrik-backend.onrender.com',
  'https://nagrik-raskshak-1.onrender.com'  // Your current backend URL
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
    backend_url: "https://nagrik-raskshak-1.onrender.com",
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

// FAQ array for bot responses (same as before)
const FAQS = [
  // ... (your existing FAQ array - keep it exactly as is)
];

/**
 * BOT QUERY ENDPOINT
 */
app.post("/bot-query", (req, res) => {
  // ... (your existing bot-query code - keep it exactly as is)
});

/**
 * BOT - CHECK COMPLAINT STATUS
 */
app.post("/bot-check-status", async (req, res) => {
  // ... (your existing bot-check-status code - keep it exactly as is)
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
  console.log(`🔗 Backend URL: https://nagrik-raskshak-1.onrender.com`);
  console.log(`🤖 AI Service URL: ${AI_SERVICE_URL}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`🤖 AI Health check: http://localhost:${PORT}/api/ai-health`);
  console.log(`📚 API docs: http://localhost:${PORT}/api`);
});

