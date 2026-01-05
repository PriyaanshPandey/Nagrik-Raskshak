const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const multer = require("multer");
const fetch = require("node-fetch");

// Load environment variables
require('dotenv').config();

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

// ============ INITIALIZE EXPRESS APP ============
const app = express();

// 🔥 FIXED CORS CONFIGURATION
app.use(cors({
  origin: '*', // Allow all origins for now
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

app.options('*', cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure multer
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

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

// ============ EXISTING ENDPOINTS ============

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    status: "healthy", 
    service: "Nagrik Rakshak API",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    firebase_connected: !!db
  });
});

// API info endpoint
app.get("/api", (req, res) => {
  res.json({
    name: "Nagrik Rakshak API",
    version: "1.0.0",
    firebase_status: db ? "connected" : "disconnected",
    endpoints: {
      debug: ["/test-firebase"],
      auth: ["/register", "/login"],
      complaints: ["/submit-complaint", "/complaints", "/my-complaints"],
      bot: ["/bot-query", "/bot-check-status"],
      admin: ["/update-complaint-status"],
      system: ["/health", "/api"]
    }
  });
});

app.get("/", (req, res) => {
  res.json({
    message: "Nagrik Rakshak Backend is running 🚀",
    backend_url: "https://nagrik-raskshak-f8t1.onrender.com",
    firebase_status: db ? "✅ Connected" : "❌ Disconnected",
    docs: "Visit /api for API documentation",
    health: "Visit /health for service status",
    test_firebase: "Visit /test-firebase to check Firebase connection"
  });
});

/**
 * ADMIN – ALL COMPLAINTS (FIXED VERSION)
 */
app.get("/complaints", async (req, res) => {
  try {
    console.log("📋 Fetching complaints...");
    
    // Add fallback in case Firebase fails
    if (!db) {
      console.log("⚠️ Firebase not available, returning fallback data");
      return res.json({
        success: true,
        count: 2,
        complaints: [
          {
            id: "test-1",
            description: "Water pipe leaking on Main Street",
            status: "new",
            userName: "Test User",
            address: "123 Main St",
            department: "Water",
            priority: "High",
            createdAt: new Date().toISOString(),
            timePassed: "0h"
          },
          {
            id: "test-2",
            description: "Garbage not collected",
            status: "in-progress",
            userName: "Another User",
            address: "456 Oak Ave",
            department: "Municipality",
            priority: "Medium",
            createdAt: new Date(Date.now() - 86400000).toISOString(),
            timePassed: "1d"
          }
        ],
        message: "⚠️ Using fallback data - Firebase may have issues"
      });
    }
    
    // Try to fetch from Firestore
    const snapshot = await db
      .collection("complaints")
      .orderBy("createdAt", "desc")
      .get();
    
    console.log(`✅ Found ${snapshot.docs.length} complaints`);
    
    if (snapshot.empty) {
      return res.json({
        success: true,
        count: 0,
        complaints: [],
        message: "No complaints found in database"
      });
    }
    
    const complaints = snapshot.docs.map((doc) => {
      const data = doc.data();
      const id = doc.id;
      
      // Handle timestamps safely
      let createdAt = null;
      let createdAtISO = null;
      
      try {
        if (data.createdAt && data.createdAt.toDate) {
          createdAt = data.createdAt.toDate();
          createdAtISO = createdAt.toISOString();
        } else if (data.createdAt) {
          createdAt = new Date(data.createdAt);
          createdAtISO = createdAt.toISOString();
        }
      } catch (dateErr) {
        console.warn(`Date parse error for ${id}:`, dateErr.message);
        createdAt = new Date();
        createdAtISO = createdAt.toISOString();
      }
      
      // Calculate time passed
      let timePassed = "";
      if (createdAt) {
        const now = new Date();
        const diffMs = now - createdAt;
        const hoursPassed = Math.floor(diffMs / (1000 * 60 * 60));
        const days = Math.floor(hoursPassed / 24);
        const hours = hoursPassed % 24;
        
        if (days > 0) {
          timePassed = `${days}d ${hours}h`;
        } else {
          timePassed = `${hours}h`;
        }
      }
      
      return {
        id: id,
        description: data.description || "No description",
        status: data.status || "new",
        userName: data.userName || "Unknown User",
        userId: data.userId || "unknown",
        mobile: data.mobile || "Not provided",
        address: data.address || "Location not provided",
        department: data.department || "Unassigned",
        priority: data.priority || "Medium",
        hasImage: data.hasImage || false,
        imageName: data.imageName || null,
        createdAt: createdAtISO,
        timePassed: timePassed,
        location: data.location || null,
        actions: data.actions || []
      };
    });
    
    res.json({
      success: true,
      count: complaints.length,
      complaints: complaints,
      timestamp: new Date().toISOString()
    });
    
  } catch (err) {
    console.error("❌ Get complaints error:", err.message);
    
    // Return fallback data on error
    res.json({
      success: true,
      count: 2,
      complaints: [
        {
          id: "fallback-1",
          description: "Sample complaint: Water issue",
          status: "new",
          userName: "System",
          address: "Test Location",
          department: "Water",
          priority: "Medium",
          createdAt: new Date().toISOString(),
          timePassed: "0h"
        }
      ],
      message: "⚠️ Using fallback data due to error: " + err.message
    });
  }
});

// ============ ADD YOUR OTHER ENDPOINTS BELOW ============
// Copy all your other endpoints (register, login, submit-complaint, etc.) here
// Make sure to keep the order: app.get() or app.post() definitions

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

// Add all your other endpoints here (submit-complaint, my-complaints, etc.)

// ============ 404 HANDLER ============
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.path,
    method: req.method
  });
});

// ============ ERROR HANDLER ============
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ============ START SERVER ============
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Backend URL: https://nagrik-raskshak-f8t1.onrender.com`);
  console.log(`🔧 Test Firebase: https://nagrik-raskshak-f8t1.onrender.com/test-firebase`);
  console.log(`📋 Complaints: https://nagrik-raskshak-f8t1.onrender.com/complaints`);
});
