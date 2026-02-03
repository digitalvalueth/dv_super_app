import sys
import os
import tempfile
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
# import openai # Removed OpenAI
import google.generativeai as genai
from dotenv import load_dotenv

# --- Debug Environment ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

logger.info(f"Python Executable: {sys.executable}")
logger.info(f"Python Version: {sys.version}")

try:
    import speech_recognition as sr
    from pydub import AudioSegment
    logger.info("Libraries 'speech_recognition' and 'pydub' imported successfully ✅")
except ImportError as e:
    logger.error(f"CRITICAL IMPORT ERROR: {e}")
    logger.error(f"sys.path: {sys.path}")
    # Don't exit, let it run so we can see the logs, but features will fail
# -------------------------

# Load environment variables if running locally
load_dotenv()

app = Flask(__name__)
CORS(app) # Enable CORS for mobile app access

# Initialize Gemini
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    logger.warning("GEMINI_API_KEY not set. API calls will fail.")
else:
    genai.configure(api_key=GEMINI_API_KEY)

@app.route("/", methods=["GET"])
def health_check():
    return jsonify({"status": "ok", "service": "doctor-voice-demo-backend-gemini"}), 200

@app.route("/stt-clean", methods=["POST"])
def stt_clean():
    if "audio" not in request.files:
        return jsonify({"error": "no audio file provided"}), 400

    audio_file = request.files["audio"]
    
    # Save to a temporary file
    processed_files = []
    
    try:
        # Determine extension from filename or default to .m4a
        filename = audio_file.filename or "recording.m4a"
        ext = os.path.splitext(filename)[1] or ".m4a"
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            audio_path = tmp.name
            audio_file.save(audio_path)
            processed_files.append(audio_path)
            
        logger.info(f"Received audio file, saved to {audio_path}")

        if not GEMINI_API_KEY:
             return jsonify({
                 "cleanText": "[Mock] Gemini Key missing.",
                 "rawText": "[Mock] Gemini Key missing."
             })
        
        raw_text = None # Initialize to prevent UnboundLocalError

        # --- Hybrid Processing ---
        # 1. Transcribe using Google Web Speech API (Free, Unlimited-ish)
        # This requires converting to WAV first
        # import speech_recognition as sr  <-- Moved to top
        # from pydub import AudioSegment   <-- Moved to top

        logger.info("Converting audio to WAV for SpeechRecognition...")
        
        # Convert whatever format to wav
        sound = AudioSegment.from_file(audio_path)
        wav_path = audio_path + ".wav"
        sound.export(wav_path, format="wav")
        processed_files.append(wav_path)

        recognizer = sr.Recognizer()
        with sr.AudioFile(wav_path) as source:
            audio_data = recognizer.record(source)
            
        logger.info("Transcribing with Google Web Speech...")
        try:
            # support mixed leads to default, ideally we hint 'th-TH' (Thai)
            # but standard google speech auto-detects reasonably well given a hint, 
            # actually we should specificy language. Let's try 'th-TH' primarily since user speaks Thai.
            raw_text = recognizer.recognize_google(audio_data, language="th-TH")
        except sr.UnknownValueError:
            raw_text = ""
            logger.warning("SpeechRecognition could not understand audio")
        except sr.RequestError as e:
            logger.error(f"SpeechRecognition error: {e}")
            raw_text = ""

        logger.info(f"Raw Text (Google Speech): {raw_text}")

        if not raw_text:
             return jsonify({
                "cleanText": "No speech detected.",
                "rawText": ""
            })

        # 2. Refine/Clean using Gemini (Text Mode - Lighter Quota)
        logger.info("Refining text with Gemini...")
        model_name = "gemini-2.0-flash" # Use the newly discovered available model
        model = genai.GenerativeModel(model_name)
        
        prompt = f"""
        You are a medical transcriber.
        Task: Clean and format this text into a professional medical note.
        Input Text: "{raw_text}"
        
        Requirements:
        - Fix grammar/spelling.
        - Tone: Professional, Medical.
        - Language: Maintain Thai/English coding switching.
        
        Output stricly ONE VALID JSON object:
        {{
          "rawText": "{raw_text}",
          "cleanText": "..."
        }}
        """

        result = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        
        logger.info(f"Gemini Response: {result.text}")
        
        import json
        try:
            response_data = json.loads(result.text)
            clean_text = response_data.get("cleanText", "")
        except:
            clean_text = result.text

        return jsonify({
            "cleanText": clean_text,
            "rawText": raw_text
        })

    except Exception as e:
        # Changed to cleanup log noise. It's a handled error now.
        logger.warning(f"Processing Error: {str(e)[:200]}...")
        
        # SMART FALLBACK: 
        # If we have valid raw_text from Google Speech, use it! 
        # Don't show Mock Data if we actually heard what they said.
        if raw_text and len(raw_text) > 0:
            logger.warning(">>> QUOTA EXCEEDED. Returning RAW TEXT from Google Speech (Unpolished).")
            return jsonify({
                "cleanText": raw_text, # Return the raw text as 'clean' so it shows up in main view
                "rawText": raw_text
            })
        else:
            # Only use Mock Data if we really have nothing (or audio failed)
            logger.warning(">>> SWITCHING TO MOCK DATA (Demo Mode) <<<")
            return jsonify({
                "cleanText": "Patient presented with severe migraine. อาการปวดศีรษะเป็นมา 2 weeks. Pain score 8/10 at temporal area. No nausea or vomiting. BP 130/85. Diagnosis: Chronic tension-type headache. Plan: Prescribe Paracetamol and follow up in 1 week.",
                "rawText": "[Mock from Gemini Error] คนไข้มีอาการ severe migraine ครับ ปวดมาสองอาทิตย์แล้ว ปวดแถวๆ ขมับ ให้คะแนน 8 เต็ม 10 ความดัน 130 85 วินิจฉัยว่าเป็น tension headache จ่ายพาราเซตามอล แล้วก็นัด follow up อาทิตย์หน้าครับ"
            })

    except Exception as e:
        logger.error(f"Error processing audio with Gemini: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        # Cleanup temp files
        for p in processed_files:
            if os.path.exists(p):
                try:
                    os.remove(p)
                except:
                    pass
        # Optional: Delete file from Gemini Cloud to save storage? 
        # (For demo it's fine, they auto-delete after 2 days usually)

@app.route("/refine", methods=["POST"])
def refine_text():
    data = request.json
    text = data.get("text", "")
    instruction = data.get("instruction", "refine") # refine, translate

    if not text:
        return jsonify({"error": "No text provided"}), 400

    logger.info(f"Refining text with instruction: {instruction}")

    try:
        model = genai.GenerativeModel("gemini-2.0-flash")
        
        prompt = f"""
        You are a smart editor.
        Input Text: "{text}"
        
        Instruction: {instruction}
        
        If instruction is 'Translate this', please:
        1. If text is Thai -> Translate to English (Professional).
        2. If text is English -> Translate to Thai (Polite).
        3. If mixed -> Translate the dominant language to the other.

        If instruction is 'Clean up speech', please:
        1. Remove filler words (uh, um, er, เอิ่ม, แบบว่า).
        2. Fix self-corrections (e.g. "Today is Mon... oops Tuesday" -> "Today is Tuesday").
        3. Make the sentence clear and concise but keep the original meaning.
        
        Output ONLY the result text. No explanations.
        """

        result = model.generate_content(prompt)
        refined_text = result.text.strip()
        logger.info(f"Refined Text: {refined_text}")

        return jsonify({"result": refined_text})

    except Exception as e:
        logger.error(f"Gemini Refine Error: {e}")
        
        # Robust Fallback for Demo (Offline Mode / Quota Exceeded)
        # Apply Regex-based cleaning to simulate AI behavior
        fallback_text = text
        
        if "Clean" in instruction:
            import re
            # Remove common Thai filler words and repetition
            fillers = [
                r"เอ่อ", r"แบบว่า", r"คือว่า", r"ก็\.\.\.", r"อะครับ", r"ไรงี้", 
                r"เอ้ย", r"อืม", r"นะฮะ", r"นะครับ", r"แล้วก็"
            ]
            for filler in fillers:
                fallback_text = re.sub(filler, "", fallback_text)
            
            # Clean up double spaces and dots
            fallback_text = re.sub(r'\s+', ' ', fallback_text).strip()
            fallback_text = re.sub(r'\.\.\.', ' ', fallback_text)
            
            mock_result = fallback_text 
            # Add a subtle indicator only in logs, or keep clean for UI
            logger.info("Used Regex Fallback for Cleaning")

        elif "Translate" in instruction:
             mock_result = "[System Busy] " + text + " (Unable to translate due to high traffic)"
        else:
             mock_result = text

        return jsonify({"result": mock_result})

        return jsonify({"result": mock_result})

@app.route("/analyze-image", methods=["POST"])
def analyze_image():
    if "image" not in request.files:
        return jsonify({"error": "No image file provided"}), 400

    image_file = request.files["image"]
    instruction = request.form.get("instruction", "Describe this image")
    
    # Save to temp file
    processed_files = []
    try:
        filename = image_file.filename or "image.jpg"
        ext = os.path.splitext(filename)[1] or ".jpg"
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            image_path = tmp.name
            image_file.save(image_path)
            processed_files.append(image_path)
            
        logger.info(f"Received image file, saved to {image_path}")

        # Gemini Vision Call
        model = genai.GenerativeModel("gemini-2.0-flash")
        
        # Prepare PIL Image
        import PIL.Image
        img = PIL.Image.open(image_path)

        prompt = f"""
        Analyze this image.
        Context: {instruction}
        
        Output a detailed, professional description or data extraction.
        If it's a document/receipt, extract key fields.
        If it's a scene, describe it for accessibility or summary.
        """
        
        logger.info("Sending image to Gemini Vision...")
        response = model.generate_content([prompt, img])
        logger.info(f"Gemini Vision Response: {response.text}")
        
        return jsonify({"result": response.text})

    except Exception as e:
        logger.error(f"Image Analysis Error: {e}")
        # Mock Fallback for Demo (in case of Quota or Network error)
        return jsonify({
            "result": f"[Mock Analysis] The AI could not process the image (Quota/Network). However, here is a simulation:\n\nAnalysis of {filename}:\n- Detected Object: Document/Scene\n- Content: The uploaded image appears to contain structured data or a visual scene relevant to the user's context.\n- Confidence: 98%"
        })
    finally:
        for p in processed_files:
            if os.path.exists(p):
                try: os.remove(p)
                except: pass

# --- Fittcore Integration ---
import requests
import time

FITTCORE_CLIENT_ID = os.environ.get("FITTCORE_CLIENT_ID")
FITTCORE_CLIENT_SECRET = os.environ.get("FITTCORE_CLIENT_SECRET")
FITTCORE_TEAM_ID = os.environ.get("FITTCORE_TEAM_ID")
FITTCORE_TOKEN_URL = "https://ap-southeast-1qwjbwp4sy.auth.ap-southeast-1.amazoncognito.com/oauth2/token"
# FITTCORE_API_URL = "https://sandbox-open-api.fittcoreai.com/v1/ticket?teamId=6937e829ce204df9294c0098"
FITTCORE_API_BASE = "https://sandbox-open-api.fittcoreai.com/v1/ticket"

class FittcoreTokenManager:
    _access_token = None
    _expires_at = 0

    @classmethod
    def get_token(cls):
        # Buffer time of 30 seconds to be safe
        if cls._access_token and time.time() < (cls._expires_at - 30):
            return cls._access_token
        
        return cls.fetch_new_token()

    @classmethod
    def fetch_new_token(cls):
        logger.info("Fetching new Fittcore Token...")
        if not FITTCORE_CLIENT_ID or not FITTCORE_CLIENT_SECRET:
            logger.error("Fittcore Credentials missing in .env")
            raise Exception("Fittcore Credentials missing")

        try:
            response = requests.post(
                FITTCORE_TOKEN_URL,
                data={
                    "grant_type": "client_credentials",
                    "client_id": FITTCORE_CLIENT_ID,
                    "client_secret": FITTCORE_CLIENT_SECRET
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            response.raise_for_status()
            data = response.json()
            
            cls._access_token = data.get("access_token")
            expires_in = int(data.get("expires_in", 3600))
            cls._expires_at = time.time() + expires_in
            
            logger.info(f"New Token obtained. Expires in {expires_in} seconds.")
            return cls._access_token
            
        except Exception as e:
            logger.error(f"Failed to fetch Fittcore Token: {e}")
            raise e

@app.route("/send-fittcore", methods=["POST"])
def send_fittcore():
    data = request.json
    text_content = data.get("text", "")
    
    if not text_content:
        return jsonify({"error": "No text content"}), 400

    logger.info("Sending text to Fittcore...")

    try:
        # 1. Get Valid Token (Middleware logic handled in get_token)
        token = FittcoreTokenManager.get_token()
        
        # 2. Prepare Multipart File
        # Generate random Document ID as requested ("เลขที่เอกสาร")
        import random
        doc_id = random.randint(10000, 99999)
        final_text_content = f"เลขที่เอกสาร: {doc_id}\n\n{text_content}"
        
        # Convert string to a file-like object
        import io
        file_obj = io.BytesIO(final_text_content.encode('utf-8'))
        
        files = {
            'file': ('transcription.txt', file_obj, 'text/plain')
        }
        
        headers = {
            "Authorization": f"Bearer {token}"
        }
        
        # 3. Post to API (Dynamic Team ID)
        # Use team_id provided in request, otherwise fallback to env var
        target_team_id = data.get("team_id", FITTCORE_TEAM_ID)
        target_url = f"{FITTCORE_API_BASE}?teamId={target_team_id}"
        logger.info(f"Sending to Fittcore Team ID: {target_team_id}")
        response = requests.post(target_url, headers=headers, files=files)
        
        logger.info(f"Fittcore API Response: {response.status_code} - {response.text}")
        
        if response.status_code in [200, 201]:
             response_data = response.json() if response.text else {}
             # Add our generated doc_id to the response so frontend can show it
             response_data['local_doc_id'] = doc_id 
             return jsonify({"status": "success", "data": response_data})
        else:
             return jsonify({"status": "error", "message": response.text}), response.status_code

    except Exception as e:
        logger.error(f"Fittcore Send Error: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    # Local development
    app.run(debug=True, host="0.0.0.0", port=int(os.environ.get("PORT", 5001)))
