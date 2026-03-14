import urllib.request
import json
from api.auth import create_access_token

try:
    token = create_access_token("2b52a24e-2922-4f08-bbee-fd301811ccbb")
    req_events = urllib.request.Request('http://localhost:8000/api/events', headers={'Authorization': f'Bearer {token}'})
    
    with urllib.request.urlopen(req_events) as r:
        events = json.loads(r.read().decode())
        if events:
            first_event_id = events[0]['id']
            print(f"Testing Drift on {first_event_id}")
            
            req = urllib.request.Request(
                f'http://localhost:8000/api/events/{first_event_id}/pulse',
                data=json.dumps({'drift_message':'Speaker is late 15m'}).encode(),
                headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {token}'}
            )
            with urllib.request.urlopen(req) as response:
                print(response.read().decode())
except urllib.error.HTTPError as e:
    print('HTTP ERROR CAUGHT:')
    print(e.read().decode())
except Exception as e:
    print('OTHER ERROR:', str(e))
