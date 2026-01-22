import os
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

api_key = os.environ.get("OPENAI_API_KEY")
print(f"Testing Key: {api_key[:10]}...{api_key[-4:]}")

client = OpenAI(api_key=api_key)

try:
    print("Sending test request to OpenAI...")
    completion = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[{"role": "user", "content": "Hello"}],
        max_tokens=5
    )
    print("✅ Success! API Key is working.")
    print("Response:", completion.choices[0].message.content)
except Exception as e:
    print("❌ Failed! Error details:")
    print(e)
