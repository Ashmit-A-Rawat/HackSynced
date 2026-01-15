#!/usr/bin/env python3
"""
Grok Explanation Synthesizer with Free Model Fallbacks
Generates human-readable explanations of ML synthesis results
Tries: Grok → Meta Llama → Google Gemini → Mistral → Template
"""

import sys
import json
import os
from typing import Dict, List, Tuple

# Free models to try in order (all available on OpenRouter)
FREE_MODELS = [
    ("x-ai/grok-2-1212", "Grok 2"),
    ("meta-llama/llama-3.2-3b-instruct:free", "Llama 3.2 3B"),
    ("google/gemini-2.0-flash-exp:free", "Gemini 2.0 Flash"),
    ("mistralai/mistral-7b-instruct:free", "Mistral 7B"),
    ("qwen/qwen-2-7b-instruct:free", "Qwen 2 7B"),
    ("microsoft/phi-3-mini-128k-instruct:free", "Phi-3 Mini")
]

def generate_grok_explanation(ml_result: Dict, support_summary: str, oppose_summary: str) -> Tuple[str, str]:
    """
    Generate explanation using Grok or free fallback models
    
    Returns:
        Tuple of (explanation_text, model_used)
    """
    
    openrouter_key = os.environ.get('OPENROUTER_API_KEY')
    
    if not openrouter_key:
        print("⚠️ No OPENROUTER_API_KEY found, using template explanation", file=sys.stderr)
        return generate_template_explanation(ml_result), "Template"
    
    try:
        import requests
        
        verdict = ml_result.get('final_verdict', 'inconclusive')
        confidence = ml_result.get('confidence', 0.5)
        scores = ml_result.get('scores', {})
        
        # Build prompt
        prompt = f"""You are an expert AI judge explaining a debate verdict.

DEBATE RESULTS:
- Final Verdict: {verdict.upper()}
- Confidence: {int(confidence * 100)}%

SUPPORT ARGUMENT SUMMARY:
{support_summary[:500]}

OPPOSE ARGUMENT SUMMARY:
{oppose_summary[:500]}

ML ANALYSIS SCORES:
- Support Strength: {scores.get('support', {}).get('strength', 0.5):.2f}
- Oppose Strength: {scores.get('oppose', {}).get('strength', 0.5):.2f}
- Evidence Quality: {scores.get('evidence', {}).get('quality_score', 0.5):.2f}
- Contradiction Score: {scores.get('contradictions', {}).get('contradiction_score', 0.5):.2f}

YOUR TASK:
Write a clear, concise explanation (3-4 sentences) of why this verdict was reached. Focus on:
1. What made the winning side stronger
2. Key evidence factors
3. Why the confidence level is what it is

Keep it professional but accessible. No bullet points. Just clear prose."""

        # Try each model in order
        for model_id, model_name in FREE_MODELS:
            try:
                print(f"🔄 Trying model: {model_name} ({model_id})", file=sys.stderr)
                
                response = requests.post(
                    url="https://openrouter.ai/api/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {openrouter_key}",
                        "Content-Type": "application/json",
                        "HTTP-Referer": "http://localhost:5001",
                        "X-Title": "AETHER ML Synthesis"
                    },
                    json={
                        "model": model_id,
                        "messages": [
                            {
                                "role": "user",
                                "content": prompt
                            }
                        ],
                        "max_tokens": 300,
                        "temperature": 0.7
                    },
                    timeout=15
                )
                
                if response.status_code == 200:
                    result = response.json()
                    explanation = result['choices'][0]['message']['content'].strip()
                    print(f"✅ {model_name} succeeded!", file=sys.stderr)
                    return explanation, model_name
                else:
                    print(f"⚠️ {model_name} failed with status {response.status_code}", file=sys.stderr)
                    
            except Exception as model_error:
                print(f"⚠️ {model_name} error: {str(model_error)[:100]}", file=sys.stderr)
                continue
        
        # All models failed, use template
        print("⚠️ All models failed, using template", file=sys.stderr)
        return generate_template_explanation(ml_result), "Template"
            
    except Exception as e:
        print(f"⚠️ Explanation generation failed: {e}", file=sys.stderr)
        return generate_template_explanation(ml_result), "Template"


def generate_template_explanation(ml_result: Dict) -> str:
    """
    Fallback: Generate template-based explanation without AI
    """
    verdict = ml_result.get('final_verdict', 'inconclusive')
    confidence = ml_result.get('confidence', 0.5)
    scores = ml_result.get('scores', {})
    
    support_strength = scores.get('support', {}).get('strength', 0.5)
    oppose_strength = scores.get('oppose', {}).get('strength', 0.5)
    evidence_quality = scores.get('evidence', {}).get('quality_score', 0.5)
    
    confidence_pct = int(confidence * 100)
    
    if verdict == 'support':
        return (
            f"The ML synthesis pipeline determined that Support prevails with {confidence_pct}% confidence. "
            f"The Support argument demonstrated stronger evidence alignment (strength: {support_strength:.2f}) "
            f"compared to the Oppose argument ({oppose_strength:.2f}). "
            f"DeBERTa analysis confirmed evidence quality at {evidence_quality:.2f}, while RoBERTa MNLI "
            f"detected minimal contradictions, and XGBoost calculated high confidence in the verdict."
        )
    elif verdict == 'oppose':
        return (
            f"The ML synthesis pipeline determined that Oppose prevails with {confidence_pct}% confidence. "
            f"The Oppose argument effectively countered the claims (strength: {oppose_strength:.2f}) "
            f"outperforming Support's argumentation ({support_strength:.2f}). "
            f"Critical weaknesses were identified in the supporting evidence through DeBERTa analysis. "
            f"RoBERTa, XGBoost, and DeBERTa models converged on this verdict through multi-dimensional analysis."
        )
    elif verdict == 'inconclusive':
        return (
            f"The ML synthesis pipeline found both arguments too evenly matched to declare a clear winner "
            f"({confidence_pct}% confidence). Support and Oppose demonstrated similar strength "
            f"(Support: {support_strength:.2f}, Oppose: {oppose_strength:.2f}). "
            f"While evidence quality was moderate at {evidence_quality:.2f}, neither side achieved decisive superiority. "
            f"Additional evidence or more specific analysis would be needed for a definitive verdict."
        )
    else:  # mixed
        return (
            f"The ML synthesis pipeline produced a mixed verdict with {confidence_pct}% confidence. "
            f"Both arguments have substantial merit (Support: {support_strength:.2f}, Oppose: {oppose_strength:.2f}), "
            f"but neither achieves clear dominance across all evaluation dimensions. "
            f"The pipeline detected nuanced trade-offs through DeBERTa evidence analysis, RoBERTa contradiction "
            f"detection, and XGBoost confidence scoring that prevent a binary verdict."
        )


def main():
    """CLI interface for explanation generation"""
    try:
        data = json.loads(sys.stdin.read())
        
        ml_result = data.get('ml_result', {})
        support_summary = data.get('support_summary', '')
        oppose_summary = data.get('oppose_summary', '')
        
        explanation, model_used = generate_grok_explanation(ml_result, support_summary, oppose_summary)
        
        print(json.dumps({
            'success': True,
            'explanation': explanation,
            'model_used': model_used,
            'used_ai': model_used != "Template"
        }))
        
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': str(e),
            'explanation': generate_template_explanation({'final_verdict': 'inconclusive', 'confidence': 0.5, 'scores': {}}),
            'model_used': 'Template'
        }))
        sys.exit(1)


if __name__ == "__main__":
    main()