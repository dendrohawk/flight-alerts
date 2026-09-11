"""Routewise static flight affordability dashboard."""

from datetime import date, datetime, timedelta
import os
import re
from urllib.parse import quote
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import httpx
from pathlib import Path

app = FastAPI(title="Routewise Flight Watch",
              description="Static planning UI for affordable nonstop flight alerts")

# Mount the static files directory
current_dir = Path(__file__).parent
app.mount("/static", StaticFiles(directory=os.path.join(Path(__file__).parent,
          "static")), name="static")

SERPAPI_URL = "https://serpapi.com/search"
ARRIVAL_AIRPORTS = {"FLL", "MIA", "PBI"}
DATE_RANGE_PATTERN = re.compile(
    r"[A-Za-z]{3},\s+([A-Za-z]{3}\s+\d{1,2})\s+[–-]\s+"
    r"[A-Za-z]{3},\s+([A-Za-z]{3}\s+\d{1,2}),\s+(\d{4})"
)


class FlightSearch(BaseModel):
    origin: str = Field(default="MCI", min_length=3, max_length=3)
    destination: str = "Port St. Lucie, FL"
    travelers: int = Field(default=2, ge=1, le=9)
    outbound_window: str = "Thu, Dec 17 – Mon, Dec 21, 2026"
    arrival_deadline: str = "Fri, Dec 19 · 4:00 PM"
    return_timing: str = "Sun, Dec 20 · after 10:00 AM"
    excluded_airlines: list[str] = Field(default_factory=list)


def _parse_date_range(value: str) -> tuple[date, date]:
    match = DATE_RANGE_PATTERN.search(value)
    if not match:
        raise HTTPException(status_code=422, detail="Choose a supported outbound date window.")
    year = int(match.group(3))
    try:
        return (
            datetime.strptime(f"{match.group(1)} {year}", "%b %d %Y").date(),
            datetime.strptime(f"{match.group(2)} {year}", "%b %d %Y").date(),
        )
    except ValueError as error:
        raise HTTPException(status_code=422, detail="Choose a valid outbound date window.") from error


def _parse_return_date(value: str, fallback: date) -> date:
    match = re.search(r"([A-Za-z]{3})\s+(\d{1,2})", value)
    if not match:
        return fallback
    try:
        return datetime.strptime(f"{match.group(1)} {match.group(2)} {fallback.year}", "%b %d %Y").date()
    except ValueError:
        return fallback


def _airport_ids(destination: str) -> str:
    normalized = destination.strip().upper()
    if normalized in ARRIVAL_AIRPORTS:
        return normalized
    if "PORT ST" in normalized or "PORT SAINT" in normalized:
        return "FLL,MIA,PBI"
    return normalized


def _time_range(value: str, after: bool = False) -> str:
    match = re.search(r"(\d{1,2}):(\d{2})\s*(AM|PM)", value.upper())
    if not match:
        return "0,23"
    hour = int(match.group(1)) % 12
    if match.group(3) == "PM":
        hour += 12
    return f"{hour},23" if after else f"0,23,0,{hour}"


def _normalize_flight(flight: dict, searched_date: str) -> dict | None:
    legs = flight.get("flights") or []
    if not legs:
        return None
    outbound = legs[0]
    inbound = legs[-1]
    departure = outbound.get("departure_airport") or {}
    arrival = outbound.get("arrival_airport") or {}
    airline = outbound.get("airline") or "Unknown airline"
    flight_number = outbound.get("flight_number") or ""
    return {
        "airline": airline,
        "flight_number": flight_number,
        "airline_code": outbound.get("airline_code", ""),
        "departure_time": departure.get("time", ""),
        "departure_airport": departure.get("id", ""),
        "arrival_time": arrival.get("time", ""),
        "arrival_airport": arrival.get("id", ""),
        "duration": flight.get("total_duration", outbound.get("duration", 0)),
        "price": flight.get("price"),
        "return_date": (inbound.get("departure_airport") or {}).get("time", ""),
        "searched_date": searched_date,
        "booking_link": (
            "https://www.google.com/travel/flights?q="
            + quote(
                f"{departure.get('id', '')} to {arrival.get('id', '')} "
                f"on {searched_date}"
            )
        ),
    }


def _search_serpapi(criteria: FlightSearch, api_key: str) -> tuple[list[dict], int]:
    outbound_start, outbound_end = _parse_date_range(criteria.outbound_window)
    return_date = _parse_return_date(criteria.return_timing, outbound_end)
    if return_date < outbound_start:
        raise HTTPException(status_code=422, detail="Return date must follow the outbound window.")
    # A round-trip search cannot depart after its return date. The form's
    # selectable window can be wider than the chosen return timing.
    outbound_end = min(outbound_end, return_date)

    params = {
        "engine": "google_flights",
        "api_key": api_key,
        "departure_id": criteria.origin.strip().upper(),
        "arrival_id": _airport_ids(criteria.destination),
        "type": "1",
        "return_date": return_date.isoformat(),
        "adults": str(criteria.travelers),
        "travel_class": "1",
        "stops": "1",
        "outbound_times": _time_range(criteria.arrival_deadline),
        "return_times": _time_range(criteria.return_timing, after=True),
        "sort_by": "2",
        "deep_search": "true",
        "gl": "us",
        "hl": "en",
        "currency": "USD",
    }
    if criteria.excluded_airlines:
        params["exclude_airlines"] = ",".join(criteria.excluded_airlines)

    flights: list[dict] = []
    searched_dates = 0
    current = outbound_start
    with httpx.Client(timeout=20) as client:
        while current <= outbound_end:
            response = client.get(
                SERPAPI_URL,
                params={**params, "outbound_date": current.isoformat()},
            )
            response.raise_for_status()
            payload = response.json()
            if payload.get("error"):
                raise RuntimeError(payload["error"])
            for raw_flight in (payload.get("best_flights") or []) + (payload.get("other_flights") or []):
                normalized = _normalize_flight(raw_flight, current.isoformat())
                if normalized:
                    flights.append(normalized)
            searched_dates += 1
            current += timedelta(days=1)

    unique = {
        (flight["airline"], flight["flight_number"], flight["departure_time"], flight["price"]): flight
        for flight in flights
    }
    return sorted(unique.values(), key=lambda flight: flight["price"] or 0), searched_dates


# In-memory activity database
activities = {
    "Chess Club": {
        "description": "Learn strategies and compete in chess tournaments",
        "schedule": "Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 12,
        "participants": ["michael@mergington.edu", "daniel@mergington.edu"]
    },
    "Programming Class": {
        "description": "Learn programming fundamentals and build software projects",
        "schedule": "Tuesdays and Thursdays, 3:30 PM - 4:30 PM",
        "max_participants": 20,
        "participants": ["emma@mergington.edu", "sophia@mergington.edu"]
    },
    "Gym Class": {
        "description": "Physical education and sports activities",
        "schedule": "Mondays, Wednesdays, Fridays, 2:00 PM - 3:00 PM",
        "max_participants": 30,
        "participants": ["john@mergington.edu", "olivia@mergington.edu"]
    }
}


@app.get("/")
def root():
    return RedirectResponse(url="/static/index.html")


@app.post("/api/flights/search")
def search_flights(criteria: FlightSearch):
    """Search live Google Flights data without exposing the provider credential."""
    origin = criteria.origin.strip().upper()
    if not re.fullmatch(r"[A-Z]{3}", origin):
        raise HTTPException(status_code=422, detail="Origin must be a three-letter airport code.")
    criteria.origin = origin

    api_key = os.getenv("SERPAPI_KEY")
    if not api_key:
        return {
            "provider": "mock",
            "reason": "SERPAPI_KEY is not configured.",
            "flights": [],
            "searched_dates": 0,
        }
    try:
        flights, searched_dates = _search_serpapi(criteria, api_key)
    except httpx.HTTPStatusError as error:
        return {
            "provider": "mock",
            "reason": f"SerpApi returned HTTP {error.response.status_code}.",
            "flights": [],
            "searched_dates": 0,
        }
    except (httpx.RequestError, RuntimeError) as error:
        return {
            "provider": "mock",
            "reason": f"Live provider unavailable: {error}",
            "flights": [],
            "searched_dates": 0,
        }
    return {
        "provider": "serpapi",
        "reason": None,
        "flights": flights,
        "searched_dates": searched_dates,
        "limitations": [
            "SerpApi accepts one outbound date per request; the selected date window is searched one day at a time.",
            "Outbound dates after the selected return date are skipped because round trips cannot return before departure.",
            "Arrival and return timing filters are hourly ranges, so minute-level deadlines are approximate.",
        ],
    }


@app.get("/activities")
def get_activities():
    return activities


@app.post("/activities/{activity_name}/signup")
def signup_for_activity(activity_name: str, email: str):
    """Sign up a student for an activity"""
    # Validate activity exists
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Get the specific activity
    activity = activities[activity_name]

    # Add student
    activity["participants"].append(email)
    return {"message": f"Signed up {email} for {activity_name}"}
