#!/usr/bin/env python3
"""
Confidence Scorer - XGBoost-based confidence calculation
Part of AETHER ML Synthesis Pipeline
"""

import sys
import json
import numpy as np
from typing import Dict

class ConfidenceScorer:
    def __init__(self):
        print("📈 Initializing Confidence Scorer...", file=sys.stderr)
        # Simple logistic function for now - can be replaced with trained XGBoost
        print("✅ Confidence Scorer ready", file=sys.stderr)
    
    def calculate_confidence(self, 
                            evidence_judgment: Dict,
                            contradiction_analysis: Dict,
                            support_strength: float,
                            oppose_strength: float) -> Dict:
        """
        Calculate confidence based on multiple factors
        """
        features = self._extract_features(
            evidence_judgment,
            contradiction_analysis,
            support_strength,
            oppose_strength
        )
        
        # Calculate confidence using weighted features
        base_confidence = self._calculate_base_confidence(features)
        
        # Adjust based on contradiction
        if contradiction_analysis.get('is_contradictory', False):
            base_confidence *= 0.85  # Reduce confidence when high contradiction
        
        # Adjust based on evidence quality
        evidence_quality = evidence_judgment.get('confidence', 0.5)
        final_confidence = float((base_confidence + evidence_quality) / 2)
        
        # Ensure confidence is between 0.3 and 0.95
        final_confidence = max(0.3, min(final_confidence, 0.95))
        
        return {
            'confidence': final_confidence,
            'confidence_level': self._get_confidence_level(final_confidence),
            'factors': {
                'strength_difference': abs(support_strength - oppose_strength),
                'evidence_quality': evidence_quality,
                'contradiction_penalty': 1.0 if not contradiction_analysis.get('is_contradictory') else 0.85
            }
        }
    
    def _extract_features(self, evidence_judgment, contradiction_analysis, 
                         support_strength, oppose_strength) -> Dict:
        """Extract numerical features for confidence calculation"""
        return {
            'strength_diff': abs(support_strength - oppose_strength),
            'evidence_confidence': evidence_judgment.get('confidence', 0.5),
            'contradiction_score': contradiction_analysis.get('contradiction_score', 0.5),
            'similarity_score': contradiction_analysis.get('similarity_score', 0.5),
            'support_strength': support_strength,
            'oppose_strength': oppose_strength,
            'evidence_factual': evidence_judgment.get('dimension_scores', {}).get('factual_grounding', 0.5),
            'evidence_coherence': evidence_judgment.get('dimension_scores', {}).get('logical_coherence', 0.5)
        }
    
    def _calculate_base_confidence(self, features: Dict) -> float:
        """Calculate base confidence from features"""
        # Weighted combination
        weights = {
            'strength_diff': 0.30,
            'evidence_confidence': 0.25,
            'similarity_score': 0.15,
            'evidence_factual': 0.15,
            'evidence_coherence': 0.15
        }
        
        weighted_sum = 0
        for key, weight in weights.items():
            weighted_sum += features.get(key, 0.5) * weight
        
        # Apply sigmoid to get between 0 and 1
        confidence = 1 / (1 + np.exp(-10 * (weighted_sum - 0.5)))
        return float(confidence)
    
    def _get_confidence_level(self, confidence: float) -> str:
        """Convert numeric confidence to level"""
        if confidence >= 0.8:
            return 'HIGH'
        elif confidence >= 0.6:
            return 'MEDIUM'
        else:
            return 'LOW'

def main():
    """CLI interface for confidence scoring"""
    try:
        data = json.loads(sys.stdin.read())
        
        scorer = ConfidenceScorer()
        
        evidence_judgment = data.get('evidence_judgment', {})
        contradiction_analysis = data.get('contradiction_analysis', {})
        support_strength = data.get('support_strength', 0.5)
        oppose_strength = data.get('oppose_strength', 0.5)
        
        result = scorer.calculate_confidence(
            evidence_judgment,
            contradiction_analysis,
            support_strength,
            oppose_strength
        )
        
        print(json.dumps({
            'success': True,
            'confidence_result': result
        }))
    
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': str(e)
        }))
        sys.exit(1)

if __name__ == "__main__":
    main()