import urllib.request
import json
from api.auth import create_access_token

token = create_access_token("2b52a24e-2922-4f08-bbee-fd301811ccbb")

req = urllib.request.Request(
    'http://localhost:8000/api/events/72250b9d-3b9c-4b1d-bd10-a3a2262918d1/pulse',
    data=json.dumps({'drift_message':'Speaker is late 15m'}).encode(),
    headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {token}'}
)
try:
    with urllib.request.urlopen(req) as response:
        print(response.read().decode())
except Exception as e:
    import traceback
    print("ERROR CAUGHT")
    print(e.read().decode())
