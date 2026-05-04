document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const teacherRequiredNote = document.getElementById("teacher-required-note");

  const userIconBtn = document.getElementById("user-icon-btn");
  const adminMenu = document.getElementById("admin-menu");
  const authStatusText = document.getElementById("auth-status-text");
  const openLoginBtn = document.getElementById("open-login-btn");
  const logoutBtn = document.getElementById("logout-btn");

  const loginModal = document.getElementById("login-modal");
  const loginForm = document.getElementById("login-form");
  const teacherUsernameInput = document.getElementById("teacher-username");
  const teacherPasswordInput = document.getElementById("teacher-password");
  const cancelLoginBtn = document.getElementById("cancel-login-btn");

  let authToken = localStorage.getItem("teacherAuthToken") || "";
  let currentTeacher = "";

  function getAuthHeaders() {
    if (!authToken) {
      return {};
    }
    return {
      Authorization: `Bearer ${authToken}`,
    };
  }

  function showMessage(text, level = "info") {
    messageDiv.textContent = text;
    messageDiv.className = level;
    messageDiv.classList.remove("hidden");

    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function updateAuthUI() {
    const loggedIn = Boolean(authToken && currentTeacher);
    authStatusText.textContent = loggedIn
      ? `Logged in as ${currentTeacher}`
      : "Not logged in";

    openLoginBtn.classList.toggle("hidden", loggedIn);
    logoutBtn.classList.toggle("hidden", !loggedIn);
    teacherRequiredNote.classList.toggle("hidden", loggedIn);

    const signupInputs = signupForm.querySelectorAll("input, select, button");
    signupInputs.forEach((input) => {
      input.disabled = !loggedIn;
    });
  }

  function openLoginModal() {
    loginModal.classList.remove("hidden");
    teacherUsernameInput.focus();
  }

  function closeLoginModal() {
    loginModal.classList.add("hidden");
    loginForm.reset();
  }

  async function refreshAuthStatus() {
    if (!authToken) {
      currentTeacher = "";
      updateAuthUI();
      return;
    }

    try {
      const response = await fetch("/auth/status", {
        headers: getAuthHeaders(),
      });

      const status = await response.json();
      if (status.authenticated) {
        currentTeacher = status.username;
      } else {
        authToken = "";
        currentTeacher = "";
        localStorage.removeItem("teacherAuthToken");
      }
    } catch (error) {
      authToken = "";
      currentTeacher = "";
      localStorage.removeItem("teacherAuthToken");
      console.error("Error checking auth status:", error);
    }

    updateAuthUI();
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons instead of bullet points
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span>${
                        authToken
                          ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>`
                          : ""
                      }</li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons (teacher only)
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    if (!authToken) {
      showMessage("Teacher login required", "error");
      return;
    }

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: getAuthHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    if (!authToken) {
      showMessage("Teacher login required", "error");
      return;
    }

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: getAuthHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = teacherUsernameInput.value.trim();
    const password = teacherPasswordInput.value;

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();
      if (!response.ok) {
        showMessage(result.detail || "Login failed", "error");
        return;
      }

      authToken = result.token;
      currentTeacher = result.username;
      localStorage.setItem("teacherAuthToken", authToken);
      updateAuthUI();
      closeLoginModal();
      showMessage(`Welcome, ${currentTeacher}`, "success");
      fetchActivities();
    } catch (error) {
      showMessage("Login failed. Please try again.", "error");
      console.error("Error logging in:", error);
    }
  });

  logoutBtn.addEventListener("click", async () => {
    try {
      if (authToken) {
        await fetch("/auth/logout", {
          method: "POST",
          headers: getAuthHeaders(),
        });
      }
    } catch (error) {
      console.error("Error logging out:", error);
    }

    authToken = "";
    currentTeacher = "";
    localStorage.removeItem("teacherAuthToken");
    updateAuthUI();
    showMessage("Logged out", "info");
    fetchActivities();
  });

  userIconBtn.addEventListener("click", () => {
    adminMenu.classList.toggle("hidden");
  });

  openLoginBtn.addEventListener("click", openLoginModal);
  cancelLoginBtn.addEventListener("click", closeLoginModal);

  loginModal.addEventListener("click", (event) => {
    if (event.target === loginModal) {
      closeLoginModal();
    }
  });

  document.addEventListener("click", (event) => {
    const withinControls = event.target.closest(".admin-controls");
    if (!withinControls) {
      adminMenu.classList.add("hidden");
    }
  });

  // Initialize app
  refreshAuthStatus().then(fetchActivities);
});
