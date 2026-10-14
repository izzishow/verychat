const assert = require("assert");
const http = require("http");
const db = require("./db");
const auth = require("./auth");

async function runTests() {
  console.log("==========================================");
  console.log("🧪 Starting VeryChat Authentication Tests");
  console.log("==========================================");

  // Test 1: DB - 신규 회원가입
  console.log("\n[Test 1] DB: 신규 회원가입 테스트...");
  const testEmail1 = `tester_${Date.now()}@gmail.com`;
  const result1 = db.upsertGoogleUser({
    google_id: "google_sub_12345",
    email: testEmail1,
    name: "테스터1",
    picture: "https://lh3.googleusercontent.com/test1",
  });
  assert.strictEqual(result1.isNew, true, "신규 회원은 isNew가 true여야 합니다.");
  assert.ok(result1.user.id.startsWith("usr_"), "사용자 ID는 usr_ 접두사를 가져야 합니다.");
  assert.strictEqual(result1.user.email, testEmail1.toLowerCase(), "이메일이 일치해야 합니다.");
  assert.strictEqual(result1.user.name, "테스터1", "이름이 일치해야 합니다.");
  assert.ok(result1.user.created_at, "최초 가입일(created_at)이 기록되어야 합니다.");
  assert.ok(result1.user.last_login_at, "최근 로그인일(last_login_at)이 기록되어야 합니다.");
  console.log("✅ [Test 1 통과] 신규 회원가입 완료:", result1.user.id, result1.user.email);

  // Test 2: DB - 기존 회원 로그인 (중복 생성 방지 확인)
  console.log("\n[Test 2] DB: 기존 회원 재로그인 및 중복 생성 방지 테스트...");
  const initialUserCount = db.getAllUsers().length;
  const result2 = db.upsertGoogleUser({
    google_id: "google_sub_12345",
    email: testEmail1,
    name: "테스터1_업데이트",
    picture: "https://lh3.googleusercontent.com/test1_updated",
  });
  assert.strictEqual(result2.isNew, false, "이미 가입된 회원은 isNew가 false여야 합니다.");
  assert.strictEqual(result2.user.id, result1.user.id, "기존 사용자 ID가 유지되어야 합니다.");
  assert.strictEqual(result2.user.name, "테스터1_업데이트", "이름 업데이트가 반영되어야 합니다.");
  assert.strictEqual(db.getAllUsers().length, initialUserCount, "중복 회원이 생성되지 않아야 합니다.");
  console.log("✅ [Test 2 통과] 기존 회원 재로그인 및 중복 방지 확인 완료");

  // Test 3: HTTP Server & Session Tests
  console.log("\n[Test 3] Express Server 기동 및 세션/API 테스트...");
  // Start server on temporary port
  process.env.PORT = "3456";
  const app = require("express")();
  const server = http.createServer(require("./server"));

  await new Promise((resolve) => server.listen(3456, resolve));
  console.log("임시 테스트 서버 포트 3456에서 대기 중");

  const baseUrl = "http://127.0.0.1:3456";

  try {
    // 3-1: 비로그인 상태 /api/auth/me 확인
    console.log("\n[Test 3-1] 비로그인 상태 세션 확인...");
    const unauthRes = await fetch(`${baseUrl}/api/auth/me`);
    const unauthData = await unauthRes.json();
    assert.strictEqual(unauthData.authenticated, false, "비로그인 상태는 authenticated가 false여야 합니다.");
    assert.strictEqual(unauthData.user, null, "비로그인 상태는 user가 null이어야 합니다.");
    console.log("✅ [Test 3-1 통과] 비로그인 상태 확인 완료");

    // 3-2: 로그인 요청 & 세션 쿠키 발급
    console.log("\n[Test 3-2] 로그인 처리 및 세션 쿠키 발급 테스트...");
    const loginRes = await fetch(`${baseUrl}/api/auth/test-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail1, name: "테스터1_업데이트" }),
    });
    const loginData = await loginRes.json();
    assert.strictEqual(loginData.success, true, "로그인 응답이 성공이어야 합니다.");
    const setCookies = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [loginRes.headers.get("set-cookie")];
    assert.ok(setCookies.length > 0, "세션 쿠키(Set-Cookie)가 발급되어야 합니다.");
    const cookie = setCookies.map((c) => c.split(";")[0]).join("; ");
    console.log("✅ [Test 3-2 통과] 세션 쿠키 발급 완료:", cookie);

    // 3-3: 세션 유지 확인 (/api/auth/me with Cookie)
    console.log("\n[Test 3-3] 세션 쿠키를 통한 로그인 상태 유지 확인...");
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: cookie },
    });
    const meData = await meRes.json();
    assert.strictEqual(meData.authenticated, true, "세션 쿠키 전달 시 authenticated가 true여야 합니다.");
    assert.strictEqual(meData.user.email, testEmail1.toLowerCase(), "세션 사용자 이메일이 일치해야 합니다.");
    console.log("✅ [Test 3-3 통과] 새로고침/재요청 시 세션 유지 확인 완료:", meData.user.name, meData.user.email);

    // 3-4: 인증된 사용자의 메시지 전송 테스트
    console.log("\n[Test 3-4] 인증된 사용자의 메시지 전송 및 Google Verified 아바타 확인...");
    const msgRes = await fetch(`${baseUrl}/api/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ text: "안녕하세요, Google 인증 사용자입니다!" }),
    });
    const msgData = await msgRes.json();
    assert.strictEqual(msgData.success, true);
    assert.strictEqual(msgData.message.user, "테스터1_업데이트");
    assert.strictEqual(msgData.message.isGoogleUser, true);
    console.log("✅ [Test 3-4 통과] 인증된 사용자 메시지 전송 확인 완료");

    // 3-5: 로그아웃 처리 및 세션 종료 확인
    console.log("\n[Test 3-5] 로그아웃 및 세션 종료 테스트...");
    const logoutRes = await fetch(`${baseUrl}/auth/logout`, {
      headers: { Cookie: cookie, Accept: "application/json" },
    });
    const logoutData = await logoutRes.json();
    assert.strictEqual(logoutData.success, true);
    const logoutSetCookies = logoutRes.headers.getSetCookie ? logoutRes.headers.getSetCookie() : [logoutRes.headers.get("set-cookie")];
    assert.ok(logoutSetCookies.length > 0, "로그아웃 쿠키 무효화 헤더가 전달되어야 합니다.");
    const logoutCookie = logoutSetCookies.map((c) => c.split(";")[0]).join("; ");

    // 로그아웃 후 세션 재확인
    const postLogoutMe = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: logoutCookie },
    });
    const postLogoutData = await postLogoutMe.json();
    assert.strictEqual(postLogoutData.authenticated, false, "로그아웃 후 세션이 종료되어야 합니다.");
    console.log("✅ [Test 3-5 통과] 로그아웃 및 세션 완전 종료 확인 완료");

    // Test 4: 인증 실패 및 보안 테스트
    console.log("\n[Test 4] CSRF 및 미설정 상태 실패 방어 테스트...");
    // Callback without state/code
    const failCallback = await fetch(`${baseUrl}/auth/google/callback?code=fake&state=wrong_state`, {
      redirect: "manual",
    });
    const redirectLoc = failCallback.headers.get("location");
    assert.ok(redirectLoc && redirectLoc.includes("auth_error=csrf_mismatch"), "CSRF 불일치 시 차단되어야 합니다.");
    console.log("✅ [Test 4-1 통과] CSRF 공격 및 상태 토큰 불일치 방어 확인:", redirectLoc);

    // Client Secret 미노출 확인
    const configRes = await fetch(`${baseUrl}/api/auth/config`);
    const configData = await configRes.json();
    assert.strictEqual(configData.clientSecret, undefined, "클라이언트 시크릿은 절대 외부에 노출되면 안 됩니다.");
    assert.ok(configData.redirectUri.includes("/auth/google/callback"), "리디렉션 URI가 올바르게 반환되어야 합니다.");
    console.log("✅ [Test 4-2 통과] 보안 검증: Client Secret 미노출 및 안전한 리디렉션 URI 확인");

  } finally {
    server.close();
  }

  console.log("\n==========================================");
  console.log("🎉 모든 인증 및 보안 테스트가 100% 통과했습니다!");
  console.log("==========================================");
}

runTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
