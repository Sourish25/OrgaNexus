import asyncio
from api.routes import inject_pulse, PulseRequest
from api.auth import get_current_user
import sys

# Mock current user
current_user = {"id": "2b52a24e-2922-4f08-bbee-fd301811ccbb", "email": "sourish25maity@gmail.com"}
req = PulseRequest(drift_message="Speaker is late 15m")

try:
    asyncio.run(inject_pulse("72250b9d-3b9c-4b1d-bd10-a3a2262918d1", req, current_user))
except Exception as e:
    import traceback
    traceback.print_exc()
