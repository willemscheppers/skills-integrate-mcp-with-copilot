"""
High School Management System API

A super simple FastAPI application that allows students to view and sign up
for extracurricular activities at Mergington High School.
"""

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
import os
import json
import secrets
from pathlib import Path

app = FastAPI(title="Mergington High School API",
              description="API for viewing and signing up for extracurricular activities")


class TeacherLoginRequest(BaseModel):
    username: str
    password: str

# Mount the static files directory
current_dir = Path(__file__).parent
app.mount("/static", StaticFiles(directory=os.path.join(Path(__file__).parent,
          "static")), name="static")


def load_teacher_credentials():
    """Load teacher usernames/passwords from a local JSON file."""
    teachers_file = current_dir / "teachers.json"
    if not teachers_file.exists():
        return {}

    with teachers_file.open("r", encoding="utf-8") as f:
        data = json.load(f)
    return data.get("teachers", {})


teacher_credentials = load_teacher_credentials()
active_sessions = {}

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
    },
    "Soccer Team": {
        "description": "Join the school soccer team and compete in matches",
        "schedule": "Tuesdays and Thursdays, 4:00 PM - 5:30 PM",
        "max_participants": 22,
        "participants": ["liam@mergington.edu", "noah@mergington.edu"]
    },
    "Basketball Team": {
        "description": "Practice and play basketball with the school team",
        "schedule": "Wednesdays and Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["ava@mergington.edu", "mia@mergington.edu"]
    },
    "Art Club": {
        "description": "Explore your creativity through painting and drawing",
        "schedule": "Thursdays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["amelia@mergington.edu", "harper@mergington.edu"]
    },
    "Drama Club": {
        "description": "Act, direct, and produce plays and performances",
        "schedule": "Mondays and Wednesdays, 4:00 PM - 5:30 PM",
        "max_participants": 20,
        "participants": ["ella@mergington.edu", "scarlett@mergington.edu"]
    },
    "Math Club": {
        "description": "Solve challenging problems and participate in math competitions",
        "schedule": "Tuesdays, 3:30 PM - 4:30 PM",
        "max_participants": 10,
        "participants": ["james@mergington.edu", "benjamin@mergington.edu"]
    },
    "Debate Team": {
        "description": "Develop public speaking and argumentation skills",
        "schedule": "Fridays, 4:00 PM - 5:30 PM",
        "max_participants": 12,
        "participants": ["charlotte@mergington.edu", "henry@mergington.edu"]
    }
}


def require_teacher(authorization: str | None = Header(default=None)):
    """Require a valid teacher bearer token for protected operations."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Teacher login required")

    token = authorization.replace("Bearer ", "", 1).strip()
    teacher_username = active_sessions.get(token)
    if not teacher_username:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    return teacher_username


@app.get("/")
def root():
    return RedirectResponse(url="/static/index.html")


@app.get("/activities")
def get_activities():
    return activities


@app.post("/auth/login")
def teacher_login(payload: TeacherLoginRequest):
    """Login endpoint for teachers/admins."""
    expected_password = teacher_credentials.get(payload.username)
    if not expected_password or expected_password != payload.password:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = secrets.token_urlsafe(32)
    active_sessions[token] = payload.username
    return {"message": "Login successful", "token": token, "username": payload.username}


@app.post("/auth/logout")
def teacher_logout(teacher_username: str = Depends(require_teacher),
                   authorization: str | None = Header(default=None)):
    """Logout endpoint for teachers/admins."""
    token = authorization.replace("Bearer ", "", 1).strip()
    active_sessions.pop(token, None)
    return {"message": f"Logged out {teacher_username}"}


@app.get("/auth/status")
def teacher_status(authorization: str | None = Header(default=None)):
    """Return current teacher login state."""
    if not authorization or not authorization.startswith("Bearer "):
        return {"authenticated": False}

    token = authorization.replace("Bearer ", "", 1).strip()
    teacher_username = active_sessions.get(token)
    if not teacher_username:
        return {"authenticated": False}

    return {"authenticated": True, "username": teacher_username}


@app.post("/activities/{activity_name}/signup")
def signup_for_activity(activity_name: str, email: str,
                        teacher_username: str = Depends(require_teacher)):
    """Sign up a student for an activity"""
    # Validate activity exists
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Get the specific activity
    activity = activities[activity_name]

    # Validate student is not already signed up
    if email in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is already signed up"
        )

    # Add student
    activity["participants"].append(email)
    return {
        "message": f"Signed up {email} for {activity_name}",
        "teacher": teacher_username
    }


@app.delete("/activities/{activity_name}/unregister")
def unregister_from_activity(activity_name: str, email: str,
                             teacher_username: str = Depends(require_teacher)):
    """Unregister a student from an activity"""
    # Validate activity exists
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Get the specific activity
    activity = activities[activity_name]

    # Validate student is signed up
    if email not in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is not signed up for this activity"
        )

    # Remove student
    activity["participants"].remove(email)
    return {
        "message": f"Unregistered {email} from {activity_name}",
        "teacher": teacher_username
    }
