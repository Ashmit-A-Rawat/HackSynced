#!/usr/bin/env python3
"""
Evidence Judge - DeBERTa/DistilBERT-based evidence quality scoring
Part of AETHER ML Synthesis Pipeline
"""

import sys
import json
import os
import torch
import numpy as np
from typing import Dict, List
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from sentence_transformers import SentenceTransformer

class EvidenceJudge:
    def __init__(self, use_light_model=False):
        print("🤖 Loading Evidence Judge models...", file=sys.stderr)
        try:
            # Set up cache directory
            cache_dir = os.environ.get('TRANSFORMERS_CACHE', '/tmp/huggingface')
            os.makedirs(cache_dir, exist_ok=True)
            
            # Check if light model requested via env or parameter
            use_light = use_light_model or os.environ.get('EVIDENCE_JUDGE_MODEL') == 'distilbert-base-uncased'
            
            if use_light:
                # DistilBERT (66MB) - Much faster for hackathon
                print("🔧 Using DistilBERT (66MB) - Light mode", file=sys.stderr)
                self.tokenizer = AutoTokenizer.from_pretrained(
                    "distilbert-base-uncased",
                    cache_dir=cache_dir
                )
                self.model = AutoModelForSequenceClassification.from_pretrained(
                    "distilbert-base-uncased",
                    num_labels=2,
                    cache_dir=cache_dir
                )
                self.model_name = "distilbert-base-uncased"
            else:
                # Original DeBERTa (286MB) - More accurate
                print("🔧 Using DeBERTa-v3-small (286MB) - Full mode", file=sys.stderr)
                self.tokenizer = AutoTokenizer.from_pretrained(
                    "microsoft/deberta-v3-small",
                    cache_dir=cache_dir
                )
                self.model = AutoModelForSequenceClassification.from_pretrained(
                    "microsoft/deberta-v3-small",
                    num_labels=2,
                    cache_dir=cache_dir
                )
                self.model_name = "deberta-v3-small"
            
            self.model.eval()
            
            # Load sentence encoder for semantic analysis (67MB)
            print("🔧 Loading sentence encoder...", file=sys.stderr)
            self.encoder = SentenceTransformer('all-MiniLM-L6-v2', cache_folder=cache_dir)
            
            print(f"✅ Evidence Judge loaded: {self.model_name}", file=sys.stderr)
            print(f"📦 Model size: {'66MB' if use_light else '286MB'}", file=sys.stderr)
            
        except Exception as e:
            print(f"⚠️ Model loading failed: {e}", file=sys.stderr)
            self.tokenizer = None
            self.model = None
            self.encoder = None
            self.model_name = "fallback"
    
    def judge_evidence_quality(self, evidence_chunks: List[Dict]) -> Dict:
        """
        Analyze evidence quality across multiple dimensions
        """
        if not evidence_chunks:
            return self._get_fallback_result("No evidence chunks")
        
        # Extract texts
        texts = [chunk.get('text', '') for chunk in evidence_chunks if chunk.get('text')]
        
        if not texts:
            return self._get_fallback_result("No text in evidence chunks")
        
        # Use ML model if available, otherwise use heuristics
        if self.model and self.tokenizer and self.model_name != "distilbert-base-uncased":
            # Use DeBERTa for inference
            ml_scores = self._ml_evidence_analysis(texts)
        else:
            # Use heuristic analysis (faster for light mode)
            ml_scores = self._heuristic_evidence_analysis(texts)
        
        # Calculate dimensions
        dimensions = {
            'factual_grounding': self._assess_factual_grounding(texts),
            'logical_coherence': self._assess_coherence(texts),
            'evidence_integration': self._assess_integration(texts),
            'argument_strength': self._assess_strength(texts),
            'objectivity': self._assess_objectivity(texts),
            'ml_confidence': ml_scores.get('confidence', 0.5)
        }
        
        # Calculate overall scores
        avg_score = np.mean(list(dimensions.values())[:-1])  # Exclude ml_confidence
        support_score = float(min(max(avg_score, 0.3), 0.9))
        oppose_score = float(1.0 - support_score)
        
        # Adjust with ML confidence if available
        if ml_scores.get('confidence', 0) > 0.6:
            if ml_scores.get('bias', 'neutral') == 'support':
                support_score = min(support_score * 1.2, 0.95)
                oppose_score = max(oppose_score * 0.8, 0.05)
            elif ml_scores.get('bias', 'neutral') == 'oppose':
                oppose_score = min(oppose_score * 1.2, 0.95)
                support_score = max(support_score * 0.8, 0.05)
        
        winner = 'support' if support_score > oppose_score else 'oppose'
        confidence = float(abs(support_score - oppose_score))
        
        return {
            'overall': {
                'support': support_score,
                'oppose': oppose_score
            },
            'dimension_scores': dimensions,
            'winner': winner,
            'confidence': confidence,
            'model_used': self.model_name
        }
    
    def _ml_evidence_analysis(self, texts: List[str]) -> Dict:
        """Use ML model to analyze evidence"""
        try:
            # Combine texts for analysis
            combined_text = " ".join(texts[:3])[:512]  # Limit for model
            
            inputs = self.tokenizer(
                combined_text,
                return_tensors="pt",
                truncation=True,
                max_length=512,
                padding=True
            )
            
            with torch.no_grad():
                outputs = self.model(**inputs)
                probs = torch.nn.functional.softmax(outputs.logits, dim=-1)
            
            probs_array = probs[0].cpu().numpy()
            
            return {
                'confidence': float(np.max(probs_array)),
                'bias': 'support' if probs_array[0] > probs_array[1] else 'oppose',
                'raw_scores': [float(p) for p in probs_array]
            }
        except Exception as e:
            print(f"⚠️ ML analysis failed: {e}", file=sys.stderr)
            return {
                'confidence': 0.5,
                'bias': 'neutral',
                'raw_scores': [0.5, 0.5]
            }
    
    def _heuristic_evidence_analysis(self, texts: List[str]) -> Dict:
        """Heuristic analysis when ML not available"""
        # Analyze sentiment and factual content
        positive_words = ['good', 'strong', 'effective', 'successful', 'beneficial', 'positive']
        negative_words = ['bad', 'weak', 'ineffective', 'unsuccessful', 'harmful', 'negative']
        
        pos_count = sum(1 for text in texts for word in positive_words if word in text.lower())
        neg_count = sum(1 for text in texts for word in negative_words if word in text.lower())
        
        total = pos_count + neg_count
        if total > 0:
            bias = 'support' if pos_count > neg_count else 'oppose'
            confidence = abs(pos_count - neg_count) / total
        else:
            bias = 'neutral'
            confidence = 0.5
        
        return {
            'confidence': float(confidence),
            'bias': bias,
            'raw_scores': [pos_count/(total+0.1), neg_count/(total+0.1)]
        }
    
    def _assess_factual_grounding(self, texts: List[str]) -> float:
        """Assess how well-grounded the evidence is in facts"""
        # Check for numbers, dates, citations
        factual_indicators = 0
        for text in texts:
            # Check for numbers
            if any(char.isdigit() for char in text):
                factual_indicators += 1
            # Check for citations
            if any(word in text.lower() for word in ['study', 'research', 'data', 'according', 'found']):
                factual_indicators += 1
        
        return float(min(factual_indicators / (len(texts) * 2), 1.0))
    
    def _assess_coherence(self, texts: List[str]) -> float:
        """Assess logical coherence using semantic similarity"""
        if len(texts) < 2:
            return 0.7
        
        if self.encoder:
            try:
                embeddings = self.encoder.encode(texts)
                similarities = []
                for i in range(len(embeddings) - 1):
                    sim = np.dot(embeddings[i], embeddings[i+1]) / (
                        np.linalg.norm(embeddings[i]) * np.linalg.norm(embeddings[i+1])
                    )
                    similarities.append((sim + 1) / 2)  # Convert to 0-1 scale
                
                return float(np.mean(similarities))
            except Exception as e:
                print(f"⚠️ Coherence analysis failed: {e}", file=sys.stderr)
        
        # Fallback: check for topic consistency
        common_words = set(texts[0].lower().split()[:10])
        for text in texts[1:]:
            common_words &= set(text.lower().split()[:10])
        
        return float(min(len(common_words) / 5, 1.0))
    
    def _assess_integration(self, texts: List[str]) -> float:
        """Assess how well integrated the evidence is"""
        # Check for connecting words and phrases
        connectors = ['however', 'moreover', 'furthermore', 'additionally', 'therefore', 'consequently']
        connector_count = sum(
            sum(1 for conn in connectors if conn in text.lower())
            for text in texts
        )
        return float(min(connector_count / max(len(texts), 1), 1.0))
    
    def _assess_strength(self, texts: List[str]) -> float:
        """Assess argument strength"""
        # Combine multiple factors
        factual = self._assess_factual_grounding(texts)
        coherence = self._assess_coherence(texts)
        integration = self._assess_integration(texts)
        
        return float((factual * 0.4 + coherence * 0.4 + integration * 0.2))
    
    def _assess_objectivity(self, texts: List[str]) -> float:
        """Assess objectivity vs. bias"""
        # Check for emotional/subjective words
        subjective_words = ['amazing', 'terrible', 'obviously', 'clearly', 'must', 'should', 'awful', 'fantastic']
        subj_count = sum(
            sum(1 for word in subjective_words if word in text.lower())
            for text in texts
        )
        objectivity = 1.0 - min(subj_count / (len(texts) * 2), 0.8)
        return float(objectivity)
    
    def _get_fallback_result(self, reason: str) -> Dict:
        """Fallback when evidence analysis fails"""
        print(f"⚠️ Using fallback evidence judgment: {reason}", file=sys.stderr)
        return {
            'overall': {'support': 0.5, 'oppose': 0.5},
            'dimension_scores': {
                'factual_grounding': 0.5,
                'logical_coherence': 0.5,
                'evidence_integration': 0.5,
                'argument_strength': 0.5,
                'objectivity': 0.5,
                'ml_confidence': 0.5
            },
            'winner': 'neutral',
            'confidence': 0.5,
            'model_used': 'fallback'
        }

def main():
    """CLI interface for evidence judgment"""
    try:
        data = json.loads(sys.stdin.read())
        
        # Check if light model requested
        use_light = data.get('use_light_model', False)
        
        judge = EvidenceJudge(use_light_model=use_light)
        evidence_chunks = data.get('evidence_chunks', [])
        
        result = judge.judge_evidence_quality(evidence_chunks)
        
        print(json.dumps({
            'success': True,
            'evidence_judgment': result,
            'model_info': {
                'name': judge.model_name,
                'light_mode': use_light
            }
        }))
    
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': str(e),
            'evidence_judgment': {
                'overall': {'support': 0.5, 'oppose': 0.5},
                'dimension_scores': {
                    'factual_grounding': 0.5,
                    'logical_coherence': 0.5,
                    'evidence_integration': 0.5,
                    'argument_strength': 0.5,
                    'objectivity': 0.5
                },
                'winner': 'neutral',
                'confidence': 0.5,
                'model_used': 'error_fallback'
            }
        }))
        sys.exit(1)

if __name__ == "__main__":
    main()