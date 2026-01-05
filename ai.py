
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime, timedelta
import re
import time

# ---------- FIREBASE ----------
cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

# ---------- CLEAN TEXT ----------
def clean(text):
    text = text.lower()
    text = re.sub(r"[^a-z ]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text

# ---------- KEYWORD DATABASE ----------
KEYWORDS = {
    "Water": [
        "water", "supply", "no water", "pipeline", "pipe",
        "tap", "pressure", "tank", "leak", "leakage",
        "dirty water", "drinking water", "water shortage","manhole","open manhole"
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
        "live wire", "electric shock", "fire","big jam",
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

# ---------- SCORING ----------
def keyword_score(text, keywords):
    return sum(1 for k in keywords if k in text)

def predict_department(text):
    scores = {d: keyword_score(text, k) for d, k in KEYWORDS.items()}
    best = max(scores, key=scores.get)
    return best, scores[best] * 20

def predict_priority(text):
    scores = {p: keyword_score(text, k) for p, k in PRIORITY_KEYWORDS.items()}
    best = max(scores, key=scores.get)
    return best, scores[best] * 25

# ---------- SET DEADLINE ----------
def set_deadline(priority):
    now = datetime.now()
    if priority == "High":
        return now + timedelta(hours=24)  # 24 hours
    elif priority == "Medium":
        return now + timedelta(hours=72)  # 72 hours
    else:
        return now + timedelta(days=7)   # 1 week

# ---------- CHECK OVERDUE ----------
def check_overdue(deadline_timestamp):
    if not deadline_timestamp:
        return False
    deadline = deadline_timestamp.replace(tzinfo=None)
    return datetime.now() > deadline

# ---------- FIRESTORE LISTENER ----------
def on_snapshot(col_snapshot, changes, read_time):
    for change in changes:
        if change.type.name == "ADDED":
            doc = change.document
            data = doc.to_dict()

            # Only classify new complaints
            if data.get("status") != "new":
                continue

            text = clean(data.get("description", ""))

            department, dept_conf = predict_department(text)
            priority, pr_conf = predict_priority(text)
            
            # Set deadline based on priority
            deadline = set_deadline(priority)

            # Prepare actions array
            current_actions = data.get("actions", [])
            classification_action = {
    "action": f"AI classified as {priority} priority for {department} department",
    "timestamp": datetime.now().isoformat(),  # CHANGED from datetime.now()
    "by": "AI System"
}
            current_actions.append(classification_action)

            db.collection("complaints").document(doc.id).update({
                "department": department,
                "departmentConfidence": dept_conf,
                "priority": priority,
                "priorityConfidence": pr_conf,
                "status": "classified",  # Changed from 'new' to 'classified'
                "deadline": deadline,
                "actions": current_actions,
                "lastUpdated": datetime.now()
            })

            print(f"✔ {doc.id} → {department}, {priority}, Deadline: {deadline}")

        elif change.type.name == "MODIFIED":
            doc = change.document
            data = doc.to_dict()
            
            # Check if complaint is overdue
            if data.get("status") not in ["resolved", "under_action"]:
                deadline = data.get("deadline")
                if deadline:
                    deadline_date = deadline.replace(tzinfo=None)
                    if datetime.now() > deadline_date:
                        db.collection("complaints").document(doc.id).update({
                            "overdue": True
                        })
                        print(f"⚠ {doc.id} is OVERDUE!")

# ---------- START LISTENING ----------
print("🔥 AI is listening for new complaints...")
db.collection("complaints").on_snapshot(on_snapshot)

# ---------- KEEP SCRIPT ALIVE ----------
while True:
    time.sleep(60)
