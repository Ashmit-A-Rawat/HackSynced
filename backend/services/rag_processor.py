#!/usr/bin/env python3
"""
PDF Text Extractor for AETHER System
Simple and reliable version
"""

import os
import sys
import json
import traceback
from typing import Dict, Any

class SimplePDFExtractor:
    """Simple PDF text extractor"""
    
    def __init__(self):
        self.has_pypdf2 = False
        self.has_pymupdf = False
        self.load_libraries()
    
    def load_libraries(self):
        """Try to load PDF libraries"""
        try:
            import PyPDF2
            self.has_pypdf2 = True
            print("PyPDF2 loaded", file=sys.stderr)
        except ImportError:
            print("PyPDF2 not available", file=sys.stderr)
        
        try:
            import fitz  # PyMuPDF
            self.has_pymupdf = True
            print("PyMuPDF loaded", file=sys.stderr)
        except ImportError:
            print("PyMuPDF not available", file=sys.stderr)
    
    def extract_with_pymupdf(self, file_path: str) -> str:
        """Extract using PyMuPDF (best)"""
        import fitz
        text = ""
        try:
            doc = fitz.open(file_path)
            for page_num in range(len(doc)):
                page = doc.load_page(page_num)
                page_text = page.get_text()
                if page_text:
                    text += page_text + "\n"
            doc.close()
            return text.strip()
        except Exception as e:
            print(f"PyMuPDF error: {e}", file=sys.stderr)
            return ""
    
    def extract_with_pypdf2(self, file_path: str) -> str:
        """Extract using PyPDF2"""
        import PyPDF2
        text = ""
        try:
            with open(file_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                for page in pdf_reader.pages:
                    try:
                        page_text = page.extract_text()
                        if page_text:
                            text += page_text + "\n"
                    except:
                        continue
            return text.strip()
        except Exception as e:
            print(f"PyPDF2 error: {e}", file=sys.stderr)
            return ""
    
    def extract_fallback(self, file_path: str) -> str:
        """Fallback: try to read as binary"""
        try:
            with open(file_path, 'rb') as f:
                content = f.read(100000)  # Read first 100KB
            
            # Try to extract readable text
            text = ""
            try:
                # Try UTF-8
                text = content.decode('utf-8', errors='ignore')
            except:
                # Try latin-1
                text = content.decode('latin-1', errors='ignore')
            
            # Clean up
            lines = text.split('\n')
            clean_lines = []
            for line in lines:
                line = line.strip()
                # Keep lines that look like text
                if len(line) > 3 and any(c.isalpha() for c in line):
                    clean_lines.append(line)
            
            return ' '.join(clean_lines)
        except Exception as e:
            print(f"Fallback error: {e}", file=sys.stderr)
            return ""
    
    def extract_text(self, file_path: str) -> Dict[str, Any]:
        """Main extraction method"""
        result = {
            "success": False,
            "text": "",
            "method": "none",
            "error": "",
            "pages": 0
        }
        
        if not os.path.exists(file_path):
            result["error"] = f"File not found: {file_path}"
            return result
        
        # Try PyMuPDF first (best)
        if self.has_pymupdf:
            text = self.extract_with_pymupdf(file_path)
            if text and len(text) > 50:
                result["success"] = True
                result["text"] = text
                result["method"] = "PyMuPDF"
                result["char_count"] = len(text)
                return result
        
        # Try PyPDF2 second
        if self.has_pypdf2:
            text = self.extract_with_pypdf2(file_path)
            if text and len(text) > 50:
                result["success"] = True
                result["text"] = text
                result["method"] = "PyPDF2"
                result["char_count"] = len(text)
                return result
        
        # Try fallback
        text = self.extract_fallback(file_path)
        if text and len(text) > 50:
            result["success"] = True
            result["text"] = text
            result["method"] = "fallback"
            result["char_count"] = len(text)
            return result
        
        # All methods failed
        if not result["error"]:
            result["error"] = "Could not extract text from PDF"
        
        return result

def main():
    """Main entry point"""
    if len(sys.argv) < 2:
        result = {
            "success": False,
            "error": "No file path provided",
            "text": "",
            "method": "none"
        }
        print(f"JSON_RESULT:{json.dumps(result)}")
        return
    
    file_path = sys.argv[1]
    
    extractor = SimplePDFExtractor()
    result = extractor.extract_text(file_path)
    
    # Print result for Node.js
    print(f"JSON_RESULT:{json.dumps(result)}", flush=True)

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        error_result = {
            "success": False,
            "error": f"Unexpected error: {str(e)}",
            "traceback": traceback.format_exc(),
            "text": "",
            "method": "none"
        }
        print(f"JSON_RESULT:{json.dumps(error_result)}", flush=True)