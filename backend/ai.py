# ai.py - Production Flask API
import os
import json
import re
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
from flask_cors import CORS
from google.cloud import firestore
from google.oauth2 import service_account

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS

# ---------- CONFIGURATION ----------
def get_firestore_client():
    """Initialize Firestore with environment variables"""
    try:
        # Use environment variables (for Render deployment)
        credentials_dict = {
            "type": "service_account",
            "project_id": os.environ.get("FIREBASE_PROJECT_ID"),
            "private_key_id": os.environ.get("FIREBASE_PRIVATE_KEY_ID"),
            "private_key": os.environ.get("FIREBASE_PRIVATE_KEY", "").replace("\\n", "\n"),
            "client_email": os.environ.get("FIREBASE_CLIENT_EMAIL"),
            "client_id": os.environ.get("FIREBASE_CLIENT_ID"),
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_x509_cert_url": os.environ.get("FIREBASE_CLIENT_CERT_URL")
        }
        
        credentials = service_account.Credentials.from_service_account_info(credentials_dict)
        return firestore.Client(credentials=credentials, project=credentials_dict["project_id"])
    except Exception as e:
        print(f"Firestore init error: {e}")
        # Return None for API-only mode (no database)
        return None

# Initialize Firestore (optional - only if you want database access)
try:
    db = get_firestore_client()
    HAS_DB = db is not None
except:
    db = None
    HAS_DB = False

# ---------- KEYWORD DATABASE ----------
KEYWORDS = {
    "Water": [
        "water", "supply", "no water", "pipeline", "pipe",
        "tap", "pressure", "tank", "leak", "leakage",
        "dirty water", "drinking water", "water shortage", "manhole", "open manhole"
    ],
    "Electricity": [
        "electric", "electricity", "power", "current",
        "light", "lights", "streetlight",
        "wire", "spark", "shock",
        "transformer", "pole", "meter",
        "voltage", "power cut", "short circuit"
    ],
    "Municipality": [
        "garbage", "waste", "dump", "dumping",
        "drain", "drains", "sewer", "sewage",
        "dirty", "smell", "mosquito",
        "sanitation", "toilet", "dustbin"
    ],
    "PWD": [
        "road", "roads", "pothole", "potholes",
        "bridge", "flyover", "highway",
        "footpath", "divider", "culvert",
        "crack", "collapse", "asphalt",
        "construction", "speed breaker"
    ],
    "Police": [
        "theft", "stolen", "robbery",
        "fight", "fighting", "quarrel",
        "harass", "harassment", "eve teasing",
        "crime", "criminal", "threat",
        "drunk", "alcohol", "drug",
        "noise", "loud", "disturbance",
        "security", "unsafe"
    ],
    "Traffic": [
        "traffic", "signal", "signals",
        "parking", "jam", "congestion",
        "junction", "crossing",
        "wrong side", "accident",
        "rash driving", "speeding",
        "bus stop", "lane"
    ]
}

PRIORITY_KEYWORDS = {
    "High": [
        "live wire", "electric shock", "fire", "big jam",
        "collapse", "fallen", "burst",
        "open manhole", "accident", "danger",
        "emergency", "attack", "fight", "theft"
    ],
    "Medium": [
        "not working", "damaged", "leak",
        "overflow", "blocked", "frequent",
        "low pressure", "delay"
    ],
    "Low": [
        "dirty", "dust", "small", "minor",
        "slow", "dim", "maintenance"
    ]
}

# ---------- TEXT CLEANING ----------
def clean(text):
    """Clean and normalize text"""
    if not text:
        return ""
    text = text.lower()
    text = re.sub(r"[^a-z ]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text

# ---------- SCORING FUNCTIONS ----------
def keyword_score(text, keywords):
    """Calculate keyword match score"""
    if not text:
        return 0
    return sum(1 for k in keywords if k in text)

def predict_department(text):
    """Predict department based on keywords"""
    cleaned_text = clean(text)
    scores = {d: keyword_score(cleaned_text, k) for d, k in KEYWORDS.items()}
    best_dept = max(scores, key=scores.get)
    confidence = min(scores[best_dept] * 20, 100)  # Cap at 100%
    
    # If no keywords found, default to Municipality
    if scores[best_dept] == 0:
        best_dept = "Municipality"
        confidence = 30
    
    return best_dept, confidence

def predict_priority(text):
    """Predict priority based on keywords"""
    cleaned_text = clean(text)
    scores = {p: keyword_score(cleaned_text, k) for p, k in PRIORITY_KEYWORDS.items()}
    best_priority = max(scores, key=scores.get)
    confidence = min(scores[best_priority] * 25, 100)  # Cap at 100%
    
    # If no priority keywords, default to Medium
    if scores[best_priority] == 0:
        best_priority = "Medium"
        confidence = 40
    
    return best_priority, confidence

# ---------- DEADLINE CALCULATION ----------
def set_deadline(priority):
    """Set deadline based on priority"""
    now = datetime.utcnow()
    if priority == "High":
        return now + timedelta(hours=24)  # 24 hours
    elif priority == "Medium":
        return now + timedelta(hours=72)  # 72 hours
    else:
        return now + timedelta(days=7)   # 1 week

# ---------- FLASK API ENDPOINTS ----------
@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "service": "Nagrik Rakshak AI",
        "has_database": HAS_DB,
        "timestamp": datetime.utcnow().isoformat()
    })

@app.route('/analyze', methods=['POST'])
def analyze_complaint():
    """Analyze a single complaint"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400
        
        complaint_text = data.get('complaint', '')
        if not complaint_text:
            return jsonify({"error": "No complaint text provided"}), 400
        
        # Get predictions
        department, dept_confidence = predict_department(complaint_text)
        priority, priority_confidence = predict_priority(complaint_text)
        deadline = set_deadline(priority)
        
        # Prepare response
        response = {
            "analysis": {
                "department": department,
                "department_confidence": dept_confidence,
                "priority": priority,
                "priority_confidence": priority_confidence,
                "deadline": deadline.isoformat(),
                "recommended_action": f"Forward to {department} department",
                "urgency": "High" if priority == "High" else "Normal"
            },
            "metadata": {
                "text_length": len(complaint_text),
                "processed_at": datetime.utcnow().isoformat(),
                "service": "AI Classification Engine"
            }
        }
        
        return jsonify(response)
        
    except Exception as e:
        print(f"Analysis error: {str(e)}")
        return jsonify({
            "error": "Analysis failed",
            "details": str(e),
            "fallback": {
                "department": "Municipality",
                "priority": "Medium",
                "confidence": 0
            }
        }), 500

@app.route('/batch-analyze', methods=['POST'])
def batch_analyze():
    """Analyze multiple complaints at once"""
    try:
        data = request.get_json()
        complaints = data.get('complaints', [])
        
        if not complaints:
            return jsonify({"error": "No complaints provided"}), 400
        
        results = []
        for idx, complaint in enumerate(complaints):
            if not isinstance(complaint, str):
                continue
                
            department, dept_conf = predict_department(complaint)
            priority, prio_conf = predict_priority(complaint)
            
            results.append({
                "id": idx,
                "text_preview": complaint[:100] + "..." if len(complaint) > 100 else complaint,
                "department": department,
                "department_confidence": dept_conf,
                "priority": priority,
                "priority_confidence": prio_conf,
                "status": "analyzed"
            })
        
        return jsonify({
            "count": len(results),
            "results": results,
            "summary": {
                "total": len(complaints),
                "successful": len(results),
                "failed": len(complaints) - len(results)
            }
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/classify-complaint/<complaint_id>', methods=['POST'])
def classify_complaint(complaint_id):
    """Classify an existing complaint in Firestore"""
    if not HAS_DB:
        return jsonify({"error": "Database not available"}), 503
    
    try:
        # Get complaint from Firestore
        doc_ref = db.collection("complaints").document(complaint_id)
        doc = doc_ref.get()
        
        if not doc.exists:
            return jsonify({"error": "Complaint not found"}), 404
        
        data = doc.to_dict()
        description = data.get("description", "")
        
        if not description:
            return jsonify({"error": "No description in complaint"}), 400
        
        # Analyze the complaint
        department, dept_conf = predict_department(description)
        priority, prio_conf = predict_priority(description)
        deadline = set_deadline(priority)
        
        # Update Firestore
        current_actions = data.get("actions", [])
        classification_action = {
            "action": f"AI classified as {priority} priority for {department} department",
            "timestamp": datetime.utcnow().isoformat(),
            "by": "AI System"
        }
        current_actions.append(classification_action)
        
        update_data = {
            "department": department,
            "department_confidence": dept_conf,
            "priority": priority,
            "priority_confidence": prio_conf,
            "status": "classified",
            "deadline": deadline,
            "actions": current_actions,
            "last_updated": datetime.utcnow(),
            "ai_processed": True,
            "ai_processed_at": datetime.utcnow().isoformat()
        }
        
        doc_ref.update(update_data)
        
        return jsonify({
            "success": True,
            "complaint_id": complaint_id,
            "analysis": {
                "department": department,
                "priority": priority,
                "deadline": deadline.isoformat()
            },
            "message": f"Complaint {complaint_id} classified successfully"
        })
        
    except Exception as e:
        print(f"Classification error: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/stats', methods=['GET'])
def get_stats():
    """Get AI service statistics"""
    stats = {
        "service": "Nagrik Rakshak AI",
        "version": "1.0.0",
        "status": "operational",
        "endpoints": [
            {"path": "/health", "method": "GET", "description": "Health check"},
            {"path": "/analyze", "method": "POST", "description": "Analyze complaint"},
            {"path": "/batch-analyze", "method": "POST", "description": "Batch analysis"},
            {"path": "/classify-complaint/<id>", "method": "POST", "description": "Classify existing complaint"},
            {"path": "/stats", "method": "GET", "description": "Service statistics"}
        ],
        "keywords": {
            "departments": len(KEYWORDS),
            "priority_levels": len(PRIORITY_KEYWORDS),
            "total_keywords": sum(len(v) for v in KEYWORDS.values()) + sum(len(v) for v in PRIORITY_KEYWORDS.values())
        },
        "database": {
            "connected": HAS_DB,
            "mode": "Firestore" if HAS_DB else "API-only"
        }
    }
    return jsonify(stats)

# ---------- START APPLICATION ----------
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"🚀 Starting AI Service on port {port}")
    print(f"📊 Database connected: {HAS_DB}")
    print(f"🌐 Endpoints available:")
    print(f"   • GET  /health")
    print(f"   • POST /analyze")
    print(f"   • POST /batch-analyze")
    print(f"   • GET  /stats")
    
    app.run(host='0.0.0.0', port=port, debug=False)
