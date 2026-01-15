import torch
import numpy as np
from transformers import AutoModelForSequenceClassification, AutoTokenizer
from sentence_transformers import SentenceTransformer
import joblib
import os

class MLModelManager:
    def __init__(self, model_cache_dir="./ml_cache"):
        self.model_cache_dir = model_cache_dir
        os.makedirs(model_cache_dir, exist_ok=True)
        
        self.models = {}
        self.loaded = False
        
    def load_all_models(self):
        """Load all ML models at once"""
        if self.loaded:
            return self.models
            
        print("🔄 Loading ML models for synthesis...")
        
        try:
            # 1. Evidence Judge (DeBERTa) - using smaller version for speed
            print("  📊 Loading DeBERTa for evidence judgment...")
            self.models['evidence_tokenizer'] = AutoTokenizer.from_pretrained(
                "microsoft/deberta-v3-small"
            )
            self.models['evidence_model'] = AutoModelForSequenceClassification.from_pretrained(
                "microsoft/deberta-v3-small",
                num_labels=2
            )
            self.models['evidence_model'].eval()
        except Exception as e:
            print(f"  ⚠️ DeBERTa failed, using fallback: {e}")
            self.models['evidence_tokenizer'] = AutoTokenizer.from_pretrained("distilbert-base-uncased")
            self.models['evidence_model'] = AutoModelForSequenceClassification.from_pretrained(
                "distilbert-base-uncased-finetuned-sst-2-english"
            )
            self.models['evidence_model'].eval()
        
        try:
            # 2. Contradiction Detector (RoBERTa MNLI)
            print("  🔍 Loading RoBERTa for contradiction detection...")
            self.models['contradiction_tokenizer'] = AutoTokenizer.from_pretrained("roberta-large-mnli")
            self.models['contradiction_model'] = AutoModelForSequenceClassification.from_pretrained("roberta-large-mnli")
            self.models['contradiction_model'].eval()
        except Exception as e:
            print(f"  ⚠️ RoBERTa failed, using fallback: {e}")
            self.models['contradiction_tokenizer'] = AutoTokenizer.from_pretrained("bert-base-uncased")
            self.models['contradiction_model'] = AutoModelForSequenceClassification.from_pretrained(
                "textattack/bert-base-uncased-MNLI"
            )
            self.models['contradiction_model'].eval()
        
        # 3. Sentence Encoder
        print("  🔤 Loading sentence transformer...")
        self.models['sentence_encoder'] = SentenceTransformer('all-MiniLM-L6-v2')
        
        # 4. Confidence Scorer (initialize with simple model)
        print("  📈 Initializing confidence scorer...")
        self.models['confidence_scorer'] = self._init_confidence_scorer()
        
        print("✅ All ML models loaded successfully!")
        self.loaded = True
        return self.models
    
    def _init_confidence_scorer(self):
        """Initialize or load confidence scoring model"""
        model_path = os.path.join(self.model_cache_dir, "confidence_model.joblib")
        
        if os.path.exists(model_path):
            return joblib.load(model_path)
        else:
            # Initialize with simple XGBoost
            try:
                from xgboost import XGBClassifier
                model = XGBClassifier(
                    n_estimators=50,
                    max_depth=3,
                    learning_rate=0.1,
                    random_state=42
                )
                # Train on dummy data for initialization
                X_dummy = np.random.rand(10, 8)
                y_dummy = np.random.randint(0, 2, 10)
                model.fit(X_dummy, y_dummy)
                return model
            except:
                # Fallback to simple logistic regression
                from sklearn.linear_model import LogisticRegression
                return LogisticRegression(random_state=42)
    
    def save_confidence_model(self, model):
        """Save trained confidence model"""
        model_path = os.path.join(self.model_cache_dir, "confidence_model.joblib")
        joblib.dump(model, model_path)
        self.models['confidence_scorer'] = model
    
    def get_model(self, model_name):
        """Get specific model by name"""
        if not self.loaded:
            self.load_all_models()
        return self.models.get(model_name)