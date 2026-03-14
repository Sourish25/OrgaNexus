import urllib.request
import json
req = urllib.request.Request(
    'http://localhost:8000/api/events/72250b9d-3b9c-4b1d-bd10-a3a2262918d1/pulse',
    data=json.dumps({'drift_message':'Speaker is late 15m'}).encode(),
    headers={'Content-Type': 'application/json', 'Authorization': 'Bearer test'}
)
try:
    urllib.request.urlopen(req)
except Exception as e:
    print(e)
