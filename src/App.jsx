const login = async (e) => {
  e.preventDefault();

  setError("");
  setMessage("");

  try {
    const response = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(loginForm)
    });

    const text = await response.text();

    let data = {};

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(
        `API returned an invalid response. Status: ${response.status}`
      );
    }

    if (!response.ok) {
      throw new Error(
        data.message ||
        data.error ||
        `Login failed. Status: ${response.status}`
      );
    }

    const accessToken =
      data.access_token ||
      data.data?.access_token ||
      data.tokens?.access_token;

    if (!accessToken) {
      throw new Error("No access token received from API.");
    }

    localStorage.setItem("access_token", accessToken);
    localStorage.setItem("username", loginForm.username);

    setToken(accessToken);
    setUsername(loginForm.username);

    setLoginForm({
      username: "",
      password: ""
    });

    setMessage("Login successful.");

  } catch (err) {
    console.error("LOGIN ERROR:", err);
    setError(err.message || "Failed to fetch.");
  }
};