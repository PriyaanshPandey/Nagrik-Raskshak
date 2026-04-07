import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.naive_bayes import MultinomialNB
from sklearn.svm import SVC
import joblib


df = pd.read_csv("complaints.csv")

X = df["complaint"]
y = df["department"]

tfidf = TfidfVectorizer(max_features=5000)
X_vec = tfidf.fit_transform(X)

log_model = LogisticRegression()
nb_model = MultinomialNB()
svm_model = SVC(probability=True)

log_model.fit(X_vec, y)
nb_model.fit(X_vec, y)
svm_model.fit(X_vec, y)


joblib.dump(tfidf, "models/tfidf_vectorizer.pkl")
joblib.dump(log_model, "models/logistic_model.pkl")
joblib.dump(nb_model, "models/naive_bayes.pkl")
joblib.dump(svm_model, "models/svm_model.pkl")

print("✅ Models trained & saved!")
