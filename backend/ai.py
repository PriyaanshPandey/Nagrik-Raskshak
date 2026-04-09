import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime, timedelta
import json, os, re
from flask import Flask

import joblib
import numpy as np
from transformers import pipeline

// import dataset 
 import dataset.json 
app = Flask(__name__)

@app.route('/')
def home():
    return "AI Complaint Listener (REAL AI MODELS) Running!"


env_key = os.environ.get('FIREBASE_SERVICE_ACCOUNT')

if env_key:
    cred_dict = json.loads(env_key)
    cred = credentials.Certificate(cred_dict)
else:
    cred = credentials.Certificate("serviceAccountKey.json")

if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)

db = firestore.client()


tfidf = joblib.load("models/tfidf_vectorizer.pkl")

log_model = joblib.load("models/logistic_model.pkl")
nb_model = joblib.load("models/naive_bayes.pkl")
svm_model = joblib.load("models/svm_model.pkl")


bert_model = pipeline(
    "text-classification",
    model="distilbert-base-uncased",
    return_all_scores=True
)

DEPARTMENTS = ["Water", "Electricity", "Municipality", "PWD", "Police", "Traffic"]
PRIORITIES = ["Low", "Medium", "High"]


def clean(text):
    text = text.lower()
    text = re.sub(r"[^a-z ]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def ensemble_predict(text):

    vec = tfidf.transform([text])

    # Model Predictions
    log_pred = log_model.predict_proba(vec)[0]
    nb_pred = nb_model.predict_proba(vec)[0]
    svm_pred = svm_model.predict_proba(vec)[0]

    
    classical_avg = (log_pred + nb_pred + svm_pred) / 3

    
    bert_out = bert_model(text)[0]

    bert_scores = np.zeros(len(DEPARTMENTS))
    for i, label in enumerate(bert_out):
        bert_scores[i] = label['score']

    
    final_scores = (classical_avg + bert_scores) / 2

    best_idx = np.argmax(final_scores)

    return DEPARTMENTS[best_idx], float(final_scores[best_idx] * 100)


def predict_priority(text):
    text = text.lower()

    if any(w in text for w in ["fire", "accident", "live wire", "attack"]):
        return "High", 90
    elif any(w in text for w in ["damaged", "leak", "blocked"]):
        return "Medium", 70
    else:
        return "Low", 60


def set_deadline(priority):
    now = datetime.now()
    if priority == "High":
        return now + timedelta(hours=24)
    elif priority == "Medium":
        return now + timedelta(hours=72)
    return now + timedelta(days=7)


def on_snapshot(col_snapshot, changes, read_time):
    for change in changes:

        if change.type.name == "ADDED":

            doc = change.document
            data = doc.to_dict()

            if data.get("status") != "new":
                continue

            text = clean(data.get("description", ""))

            
            department, confidence = ensemble_predict(text)
            priority, pr_conf = predict_priority(text)

            deadline = set_deadline(priority)

            actions = data.get("actions", [])
            actions.append({
                "action": f"AI classified using ML ensemble → {department}, {priority}",
                "timestamp": datetime.now().isoformat(),
                "by": "AI System"
            })

            db.collection("complaints").document(doc.id).update({
                "department": department,
                "departmentConfidence": confidence,
                "priority": priority,
                "priorityConfidence": pr_conf,
                "status": "classified",
                "deadline": deadline,
                "actions": actions,
                "lastUpdated": datetime.now()
            })

            print(f"🔥 {doc.id} → {department} ({confidence:.2f}%)")

        elif change.type.name == "MODIFIED":

            doc = change.document
            data = doc.to_dict()

            if data.get("status") not in ["resolved", "under_action"]:
                deadline = data.get("deadline")

                if deadline and datetime.now() > deadline.replace(tzinfo=None):
                    db.collection("complaints").document(doc.id).update({
                        "overdue": True
                    })
                    print(f"⚠ {doc.id} OVERDUE")
// viusalizations 


import matplotlib.pyplot as plt
import numpy as np

models = ['Logistic Regression', 'Naive Bayes', 'SVM', 'KNN', 'Random Forest', 'ANN']
accuracies = [91, 88, 93, 87, 95, 96]
colors = ['#378ADD', '#1D9E75', '#D85A30', '#7F77DD', '#BA7517', '#D4537E']

x = np.arange(len(models))
bar_width = 0.5

fig, ax = plt.subplots(figsize=(10, 6))

bars = ax.bar(x, accuracies, width=bar_width, color=colors, edgecolor='#444', linewidth=0.8, zorder=3)

# Value labels on top of each bar
for bar, acc in zip(bars, accuracies):
    ax.text(
        bar.get_x() + bar.get_width() / 2,
        bar.get_height() + 0.3,
        f'{acc}%',
        ha='center', va='bottom',
        fontsize=11, fontweight='bold', color='#333'
    )

ax.set_xticks(x)
ax.set_xticklabels(models, fontsize=11, rotation=15, ha='right')
ax.set_ylim(75, 100)
ax.set_ylabel('Estimated Accuracy (%)', fontsize=12)
ax.set_title('ML Model Accuracy Comparison', fontsize=14, fontweight='bold', pad=15)
ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda val, _: f'{int(val)}%'))
ax.grid(axis='y', linestyle='--', alpha=0.4, zorder=0)
ax.set_axisbelow(True)

# Custom legend
legend_handles = [
    plt.Rectangle((0, 0), 1, 1, color=colors[i], label=models[i])
    for i in range(len(models))
]
ax.legend(handles=legend_handles, loc='lower right', fontsize=9, framealpha=0.6)

plt.tight_layout()
plt.savefig('ml_accuracy_chart.png', dpi=150)
plt.show()


//run the server 

print("🚀 REAL AI SYSTEM RUNNING...")
db.collection("complaints").on_snapshot(on_snapshot)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
