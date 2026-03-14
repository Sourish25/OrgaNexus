import os, requests, sys
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), 'backend', '.env'))

key = os.getenv('GEMINI_API_KEY_CONTENT')
sys.stderr.write(f"Using key: {key[:12]}...\n")

url = f"https://generativelanguage.googleapis.com/v1beta/models?key={key}"
r = requests.get(url)
data = r.json()

if 'models' not in data:
    sys.stderr.write(f"Error: {data}\n")
else:
    models = data['models']
    sys.stderr.write(f"\nFound {len(models)} models\n\n")
    for m in models:
        name = m.get('name', '')
        display = m.get('displayName', '')
        if 'flash' in name.lower() or 'flash' in display.lower():
            sys.stderr.write(f"  >>> {name}  ({display})\n")
        elif 'gemini' in name.lower():
            sys.stderr.write(f"      {name}  ({display})\n")
