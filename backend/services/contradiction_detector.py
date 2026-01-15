#!/usr/bin/env python3
"""
Contradiction Detector - RoBERTa/DistilRoBERTa-based contradiction detection
Part of AETHER ML Synthesis Pipeline
"""

import sys
import json
import os
import torch
import numpy as np
import re
from typing import Dict, List
from transformers import AutoTokenizer, AutoModelForSequenceClassification

class ContradictionDetector:
    def __init__(self, use_light_model=False):
        print("🔍 Loading Contradiction Detector...", file=sys.stderr)
        try:
            # Set up cache directory
            cache_dir = os.environ.get('TRANSFORMERS_CACHE', '/tmp/huggingface')
            os.makedirs(cache_dir, exist_ok=True)
            
            # Check if light model requested
            use_light = use_light_model or os.environ.get('CONTRADICTION_MODEL') == 'distilroberta-base'
            
            if use_light:
                # DistilRoBERTa (307MB) - Much faster for hackathon
                print("🔧 Using DistilRoBERTa (307MB) - Light mode", file=sys.stderr)
                self.tokenizer = AutoTokenizer.from_pretrained(
                    "cross-encoder/nli-distilroberta-base",
                    cache_dir=cache_dir
                )
                self.model = AutoModelForSequenceClassification.from_pretrained(
                    "cross-encoder/nli-distilroberta-base",
                    cache_dir=cache_dir
                )
                self.model_name = "distilroberta-base"
            else:
                # Original RoBERTa-large (1.43GB) - More accurate
                print("🔧 Using RoBERTa-large-MNLI (1.43GB) - Full mode", file=sys.stderr)
                self.tokenizer = AutoTokenizer.from_pretrained(
                    "roberta-large-mnli",
                    cache_dir=cache_dir
                )
                self.model = AutoModelForSequenceClassification.from_pretrained(
                    "roberta-large-mnli",
                    cache_dir=cache_dir
                )
                self.model_name = "roberta-large-mnli"
            
            self.model.eval()
            print(f"✅ Contradiction Detector loaded: {self.model_name}", file=sys.stderr)
            print(f"📦 Model size: {'307MB' if use_light else '1.43GB'}", file=sys.stderr)
            
        except Exception as e:
            print(f"⚠️ Model loading failed, using fallback: {e}", file=sys.stderr)
            self.tokenizer = None
            self.model = None
            self.model_name = "fallback"
    
    def detect_contradictions(self, support_text: str, oppose_text: str) -> Dict:
        """
        Detect contradictions between support and oppose arguments
        Returns: entailment, neutral, contradiction scores
        """
        if not self.model or not self.tokenizer:
            return self._fallback_detection(support_text, oppose_text)
        
        try:
            # Truncate texts for model input (shorter for faster processing)
            support_sample = support_text[:300]
            oppose_sample = oppose_text[:300]
            
            # Format for NLI: premise = support, hypothesis = oppose
            inputs = self.tokenizer(
                support_sample,
                oppose_sample,
                return_tensors="pt",
                truncation=True,
                max_length=128,  # Shorter for speed
                padding=True
            )
            
            with torch.no_grad():
                outputs = self.model(**inputs)
                probs = torch.nn.functional.softmax(outputs.logits, dim=-1)
            
            probs_array = probs[0].cpu().numpy()
            
            # Extract scores (order: contradiction, neutral, entailment for cross-encoder)
            if self.model_name == "distilroberta-base":
                # cross-encoder/nli-distilroberta-base outputs: contradiction, neutral, entailment
                contradiction_score = float(probs_array[0])
                neutral_score = float(probs_array[1])
                entailment_score = float(probs_array[2])
            else:
                # roberta-large-mnli outputs: entailment, neutral, contradiction
                entailment_score = float(probs_array[0])
                neutral_score = float(probs_array[1])
                contradiction_score = float(probs_array[2])
            
            # Calculate similarity (inverse of contradiction)
            similarity_score = float(1.0 - contradiction_score)
            
            # Identify strong contradictions
            strong_contradictions = self._find_strong_contradictions(
                support_text, oppose_text, contradiction_score
            )
            
            is_contradictory = contradiction_score > 0.6  # Higher threshold
            
            return {
                'contradiction_score': contradiction_score,
                'similarity_score': similarity_score,
                'entailment_score': entailment_score,
                'neutral_score': neutral_score,
                'strong_contradictions': strong_contradictions,
                'is_contradictory': is_contradictory,
                'model_used': self.model_name
            }
        
        except Exception as e:
            print(f"⚠️ Detection error: {e}", file=sys.stderr)
            return self._fallback_detection(support_text, oppose_text)
    
    def _find_strong_contradictions(self, support: str, oppose: str, contradiction_score: float) -> List[Dict]:
        """Identify specific contradictory statements"""
        contradictions = []
        
        if contradiction_score < 0.5:
            return contradictions
        
        # Split into sentences
        support_sentences = self._split_sentences(support)[:5]  # Limit to 5 sentences
        oppose_sentences = self._split_sentences(oppose)[:5]
        
        # Look for direct contradictions
        for s_sent in support_sentences:
            for o_sent in oppose_sentences:
                if self._are_contradictory(s_sent, o_sent):
                    contradictions.append({
                        'support_statement': s_sent[:150],
                        'oppose_statement': o_sent[:150],
                        'confidence': min(contradiction_score + 0.1, 0.95)
                    })
                    if len(contradictions) >= 3:  # Limit to top 3
                        return contradictions
        
        return contradictions
    
    def _split_sentences(self, text: str) -> List[str]:
        """Split text into sentences"""
        sentences = re.split(r'[.!?]+', text)
        return [s.strip() for s in sentences if len(s.strip()) > 20]  # Minimum 20 chars
    
    def _are_contradictory(self, sent1: str, sent2: str) -> bool:
        """Simple heuristic to check if sentences contradict"""
        # Look for opposite sentiment words
        positive_words = set(['good', 'strong', 'effective', 'successful', 'beneficial', 'positive', 'yes', 'should'])
        negative_words = set(['bad', 'weak', 'ineffective', 'unsuccessful', 'harmful', 'negative', 'no', 'should not'])
        
        sent1_lower = sent1.lower()
        sent2_lower = sent2.lower()
        
        sent1_pos = any(word in sent1_lower for word in positive_words)
        sent1_neg = any(word in sent1_lower for word in negative_words)
        sent2_pos = any(word in sent2_lower for word in positive_words)
        sent2_neg = any(word in sent2_lower for word in negative_words)
        
        return (sent1_pos and sent2_neg) or (sent1_neg and sent2_pos)
    
    def _fallback_detection(self, support: str, oppose: str) -> Dict:
        """Fallback contradiction detection without ML models"""
        print("⚠️ Using fallback contradiction detection", file=sys.stderr)
        
        # Simple keyword-based approach
        support_lower = support.lower()
        oppose_lower = oppose.lower()
        
        # Check for opposing sentiments
        support_positive = sum(1 for word in ['good', 'strong', 'effective', 'positive', 'yes', 'should'] 
                              if word in support_lower)
        oppose_negative = sum(1 for word in ['bad', 'weak', 'ineffective', 'negative', 'no', 'should not'] 
                             if word in oppose_lower)
        
        # Also check reverse
        support_negative = sum(1 for word in ['bad', 'weak', 'ineffective', 'negative', 'no', 'should not'] 
                              if word in support_lower)
        oppose_positive = sum(1 for word in ['good', 'strong', 'effective', 'positive', 'yes', 'should'] 
                             if word in oppose_lower)
        
        total_contradictions = (support_positive + oppose_negative + support_negative + oppose_positive)
        contradiction_score = float(min(total_contradictions / 20, 0.7))
        
        return {
            'contradiction_score': contradiction_score,
            'similarity_score': 1.0 - contradiction_score,
            'entailment_score': 0.3,
            'neutral_score': 0.4,
            'strong_contradictions': [],
            'is_contradictory': contradiction_score > 0.5,
            'fallback_used': True,
            'model_used': 'heuristic_fallback'
        }

def main():
    """CLI interface for contradiction detection"""
    try:
        data = json.loads(sys.stdin.read())
        
        # Check if light model requested
        use_light = data.get('use_light_model', False)
        
        detector = ContradictionDetector(use_light_model=use_light)
        support_text = data.get('support_text', '')
        oppose_text = data.get('oppose_text', '')
        
        result = detector.detect_contradictions(support_text, oppose_text)
        
        print(json.dumps({
            'success': True,
            'contradiction_analysis': result,
            'model_info': {
                'name': detector.model_name,
                'light_mode': use_light
            }
        }))
    
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': str(e),
            'contradiction_analysis': {
                'contradiction_score': 0.3,
                'similarity_score': 0.5,
                'entailment_score': 0.3,
                'neutral_score': 0.4,
                'strong_contradictions': [],
                'is_contradictory': False,
                'fallback_used': True,
                'model_used': 'error_fallback'
            }
        }))
        sys.exit(1)

if __name__ == "__main__":
    main()