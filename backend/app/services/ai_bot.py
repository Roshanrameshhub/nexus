import httpx
from typing import Dict, List, Optional
from app.config.settings import settings

class AIHomeworkBot:
    def __init__(self):
        self.api_url = "https://openrouter.ai/api/v1/chat/completions"
        self.headers = {
            "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
            "Content-Type": "application/json"
        }
    
    async def get_help(self, question: str, subject: str = None, grade: str = None) -> Dict:
        try:
            context = "You are a helpful homework assistant for students. "
            if subject:
                context += f"Specializing in {subject}. "
            if grade:
                context += f"Student is in grade {grade}. "
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    self.api_url,
                    headers=self.headers,
                    json={
                        "model": "openai/gpt-3.5-turbo",
                        "messages": [
                            {"role": "system", "content": context},
                            {"role": "user", "content": question}
                        ],
                        "max_tokens": 500,
                        "temperature": 0.7
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    answer = data["choices"][0]["message"]["content"]
                    return {
                        "success": True,
                        "answer": answer,
                        "subject": subject,
                        "grade": grade
                    }
                else:
                    return {
                        "success": False,
                        "error": f"API Error: {response.status_code} - {response.text}"
                    }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    async def explain_concept(self, concept: str, level: str = "beginner") -> Dict:
        prompt = f"Explain the concept '{concept}' at {level} level. Include definition, key points, and examples."
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                self.api_url,
                headers=self.headers,
                json={
                    "model": "openai/gpt-3.5-turbo",
                    "messages": [
                        {"role": "system", "content": "You are a patient tutor."},
                        {"role": "user", "content": prompt}
                    ],
                    "max_tokens": 400
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "success": True,
                    "concept": concept,
                    "level": level,
                    "explanation": data["choices"][0]["message"]["content"]
                }
            return {"success": False, "error": "Failed to get explanation"}

class DictionaryService:
    def __init__(self):
        self.api_url = "https://api.dictionaryapi.dev/api/v2/entries/en"
    
    async def define_word(self, word: str) -> Dict:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{self.api_url}/{word}")
                if response.status_code == 200:
                    data = response.json()
                    return self._parse_definition(data, word)
                return {"success": False, "message": "Word not found"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def _parse_definition(self, data: List, word: str) -> Dict:
        result = {"word": word, "success": True, "definitions": []}
        for entry in data:
            for meaning in entry.get("meanings", []):
                for definition in meaning.get("definitions", []):
                    result["definitions"].append({
                        "part_of_speech": meaning.get("partOfSpeech", ""),
                        "definition": definition.get("definition", ""),
                        "example": definition.get("example", "")
                    })
        return result
    
    async def get_synonyms(self, word: str) -> Dict:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"https://api.datamuse.com/words?rel_syn={word}")
                if response.status_code == 200:
                    synonyms = response.json()
                    return {"word": word, "synonyms": [s["word"] for s in synonyms[:10]]}
                return {"word": word, "synonyms": []}
        except:
            return {"word": word, "synonyms": []}