const crypto = require("crypto");
const db = require("./db");

function getBaseUrl(req) {
  if (process.env.BASE_URL && process.env.BASE_URL.trim()) {
    return process.env.BASE_URL.trim().replace(/\/+$/, "");
  }
  const proto = (req.headers["x-forwarded-proto"] || req.protocol || "https").split(",")[0].trim();
  const host = req.get("host");
  return `${proto}://${host}`;
}

function getRedirectUri(req) {
  return `${getBaseUrl(req)}/auth/google/callback`;
}

function isGoogleOAuthConfigured() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  return Boolean(
    clientId &&
    clientSecret &&
    clientId.trim() !== "" &&
    clientSecret.trim() !== "" &&
    !clientId.includes("your-google-client-id")
  );
}

// 1. GET /auth/google - Initiate Google OAuth
async function handleGoogleLogin(req, res) {
  if (!isGoogleOAuthConfigured()) {
    // Redirect with setup notification so user can see step-by-step guidance
    return res.redirect("/?auth_error=setup_required");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID.trim();
  const redirectUri = getRedirectUri(req);

  // Generate secure random state token to protect against CSRF attacks
  const state = crypto.randomBytes(24).toString("hex");
  req.session.oauth_state = state;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: state,
    access_type: "offline",
    prompt: "select_account",
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  res.redirect(authUrl);
}

// 2. GET /auth/google/callback - Handle Google OAuth Callback
async function handleGoogleCallback(req, res) {
  const { code, state, error } = req.query;

  if (error) {
    console.error("Google OAuth error from Google:", error);
    return res.redirect(`/?auth_error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return res.redirect("/?auth_error=missing_code");
  }

  // Verify CSRF state token
  const savedState = req.session.oauth_state;
  req.session.oauth_state = null; // Clear state once used

  if (!savedState || savedState !== state) {
    console.error("CSRF state mismatch. Expected:", savedState, "Received:", state);
    return res.redirect("/?auth_error=csrf_mismatch");
  }

  if (!isGoogleOAuthConfigured()) {
    return res.redirect("/?auth_error=setup_required");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET.trim();
  const redirectUri = getRedirectUri(req);

  try {
    // Exchange authorization code for access token & id_token with Google
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code: code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error("Token exchange failed:", tokenData);
      return res.redirect("/?auth_error=token_exchange_failed");
    }

    // Fetch verified user profile from Google using access token
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const userInfo = await userInfoRes.json();

    if (!userInfoRes.ok || !userInfo.email) {
      console.error("Failed to fetch user profile from Google:", userInfo);
      return res.redirect("/?auth_error=userinfo_failed");
    }

    // Register or login user in database
    const { user, isNew } = db.upsertGoogleUser({
      google_id: userInfo.sub,
      email: userInfo.email,
      name: userInfo.name || userInfo.email.split("@")[0],
      picture: userInfo.picture || null,
    });

    // Store user ID in session
    req.session.userId = user.id;

    console.log(`User ${isNew ? "registered" : "logged in"}: ${user.email} (${user.id})`);
    return res.redirect(`/?login_success=1${isNew ? "&new_user=1" : ""}`);
  } catch (err) {
    console.error("Google authentication error:", err);
    return res.redirect("/?auth_error=auth_internal_error");
  }
}

// 3. GET /api/auth/me - Return authenticated user details
function handleGetMe(req, res) {
  const isConfigured = isGoogleOAuthConfigured();
  const userId = req.session ? req.session.userId : null;

  if (!userId) {
    return res.json({
      success: true,
      authenticated: false,
      user: null,
      configured: isConfigured,
    });
  }

  const user = db.getUserById(userId);
  if (!user) {
    // User no longer exists in DB, invalidate session
    if (req.session) req.session.userId = null;
    return res.json({
      success: true,
      authenticated: false,
      user: null,
      configured: isConfigured,
    });
  }

  return res.json({
    success: true,
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      created_at: user.created_at,
      last_login_at: user.last_login_at,
    },
    configured: isConfigured,
  });
}

// 4. POST /auth/logout & GET /auth/logout - End session
function handleLogout(req, res) {
  if (req.session) {
    req.session = null;
  }

  if (req.headers.accept && req.headers.accept.includes("application/json")) {
    return res.json({ success: true, message: "Logged out successfully" });
  }

  res.redirect("/?logout=1");
}

// 5. GET /api/auth/config - Provide OAuth status & redirect URI (safe, no secrets)
function handleGetConfig(req, res) {
  res.json({
    success: true,
    configured: isGoogleOAuthConfigured(),
    redirectUri: getRedirectUri(req),
    baseUrl: getBaseUrl(req),
  });
}

module.exports = {
  isGoogleOAuthConfigured,
  getBaseUrl,
  getRedirectUri,
  handleGoogleLogin,
  handleGoogleCallback,
  handleGetMe,
  handleLogout,
  handleGetConfig,
};
