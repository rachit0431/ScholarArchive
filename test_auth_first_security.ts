import http from 'http';

function request(options: http.RequestOptions, body?: any): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string; json?: any }> {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json: any = undefined;
        try {
          json = JSON.parse(data);
        } catch {
          // not json
        }
        resolve({ statusCode: res.statusCode || 0, headers: res.headers, body: data, json });
      });
    });

    req.on('error', reject);

    if (body) {
      if (typeof body === 'object') {
        req.setHeader('Content-Type', 'application/json');
        req.write(JSON.stringify(body));
      } else {
        req.write(body);
      }
    }

    req.end();
  });
}

async function runTests() {
  console.log('--- STARTING COMPLETE AUTHENTICATION-FIRST SECURITY AUDIT ---');
  let failures = 0;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      console.log(`[PASS] ${desc}`);
    } else {
      console.error(`[FAIL] ${desc}`);
      failures++;
    }
  }

  // ==========================================
  // SECTION A: LOGGED OUT / UNAUTHENTICATED
  // ==========================================
  console.log('\n--- Testing Section A: Logged Out State ---');

  // 1. GET /api/papers without token
  const resPapers = await request({ hostname: 'localhost', port: 3000, path: '/api/papers', method: 'GET' });
  assert(resPapers.statusCode === 401, `GET /api/papers returns 401 when logged out (got ${resPapers.statusCode})`);

  // 2. GET /api/stats without token
  const resStats = await request({ hostname: 'localhost', port: 3000, path: '/api/stats', method: 'GET' });
  assert(resStats.statusCode === 401, `GET /api/stats returns 401 when logged out (got ${resStats.statusCode})`);

  // 3. GET /api/subjects without token
  const resSubjects = await request({ hostname: 'localhost', port: 3000, path: '/api/subjects', method: 'GET' });
  assert(resSubjects.statusCode === 401, `GET /api/subjects returns 401 when logged out (got ${resSubjects.statusCode})`);

  // 4. GET /api/papers/p1 without token
  const resPaper1 = await request({ hostname: 'localhost', port: 3000, path: '/api/papers/p1', method: 'GET' });
  assert(resPaper1.statusCode === 401, `GET /api/papers/p1 returns 401 when logged out (got ${resPaper1.statusCode})`);

  // 5. GET /api/papers/view/p1 without token
  const resViewPdf = await request({ hostname: 'localhost', port: 3000, path: '/api/papers/view/p1', method: 'GET' });
  assert(resViewPdf.statusCode === 401, `GET /api/papers/view/p1 returns 401 when logged out (got ${resViewPdf.statusCode})`);

  // 6. GET /api/papers/p1/pdf alias without token
  const resAliasPdf = await request({ hostname: 'localhost', port: 3000, path: '/api/papers/p1/pdf', method: 'GET' });
  assert(resAliasPdf.statusCode === 401, `GET /api/papers/p1/pdf returns 401 when logged out (got ${resAliasPdf.statusCode})`);

  // 7. GET /api/papers/download/p1 without token
  const resDownload = await request({ hostname: 'localhost', port: 3000, path: '/api/papers/download/p1', method: 'GET' });
  assert(resDownload.statusCode === 401, `GET /api/papers/download/p1 returns 401 when logged out (got ${resDownload.statusCode})`);

  // 8. GET /api/papers/p1/download alias without token
  const resDownloadAlias = await request({ hostname: 'localhost', port: 3000, path: '/api/papers/p1/download', method: 'GET' });
  assert(resDownloadAlias.statusCode === 401, `GET /api/papers/p1/download returns 401 when logged out (got ${resDownloadAlias.statusCode})`);

  // 9. Direct /uploads path
  const resUploads = await request({ hostname: 'localhost', port: 3000, path: '/uploads/sample.pdf', method: 'GET' });
  assert(resUploads.statusCode === 401, `Direct /uploads/sample.pdf returns 401 (got ${resUploads.statusCode})`);

  // 10. Admin endpoint without token
  const resAdmin = await request({ hostname: 'localhost', port: 3000, path: '/api/students', method: 'GET' });
  assert(resAdmin.statusCode === 401, `GET /api/students returns 401 when logged out (got ${resAdmin.statusCode})`);

  // ==========================================
  // SECTION B: STUDENT AUTHENTICATION & ACCESS
  // ==========================================
  console.log('\n--- Testing Section B: Student Authentication & Permissions ---');

  // Sign up a real student
  const studentEmail = `audit_student_${Date.now()}@college.edu`;
  const studentSignupRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/student-signup',
    method: 'POST',
  }, {
    name: 'Audit Student',
    email: studentEmail,
    password: 'SecurePassword123!',
    year: '3rd Year',
    semester: 'Semester 5',
  });

  assert(studentSignupRes.statusCode === 201 && !!studentSignupRes.json?.token, 'Student sign up succeeds and issues token');
  const studentToken = studentSignupRes.json?.token;

  // With student token, verify paper access
  const studentPapersRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/papers',
    method: 'GET',
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert(studentPapersRes.statusCode === 200 && Array.isArray(studentPapersRes.json) && studentPapersRes.json.length > 0, `Student can access papers archive (found ${studentPapersRes.json?.length} papers)`);

  const samplePaper = studentPapersRes.json[0];

  // Student can view PDF
  const studentViewRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/papers/view/${samplePaper.id}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert(studentViewRes.statusCode === 200 && studentViewRes.headers['content-type'] === 'application/pdf', 'Student can view PDF inline with content-type application/pdf');

  // Student can download PDF
  const studentDownloadRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/papers/download/${samplePaper.id}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert(studentDownloadRes.statusCode === 200 && studentDownloadRes.headers['content-type'] === 'application/pdf', 'Student can download PDF attachment');

  // Student CANNOT access admin endpoints (e.g. /api/students or /api/papers POST)
  const studentAdminRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/students',
    method: 'GET',
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert(studentAdminRes.statusCode === 403, `Student is forbidden from accessing Admin User Management (/api/students) (got ${studentAdminRes.statusCode})`);

  // ==========================================
  // SECTION C: ADMIN AUTHENTICATION & ACCESS
  // ==========================================
  console.log('\n--- Testing Section C: Admin Authentication & Permissions ---');

  const adminLoginRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/admin-login',
    method: 'POST',
  }, {
    email: 'admin@college.edu',
    password: 'admin123',
  });
  assert(adminLoginRes.statusCode === 200 && !!adminLoginRes.json?.token, 'Admin successfully logs in');
  const adminToken = adminLoginRes.json?.token;

  // Admin can access system stats
  const adminStatsRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/stats',
    method: 'GET',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(adminStatsRes.statusCode === 200 && adminStatsRes.json?.totalStudents > 0, `Admin accesses stats with totalStudents count (${adminStatsRes.json?.totalStudents})`);

  // Admin can access student management
  const adminStudentsRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/students',
    method: 'GET',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(adminStudentsRes.statusCode === 200 && Array.isArray(adminStudentsRes.json), 'Admin accesses full registered students list');

  // Admin can add a subject
  const newSubCode = `AUD${Date.now().toString().slice(-4)}`;
  const adminSubRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/subjects',
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
  }, {
    name: 'Security Systems Audit',
    code: newSubCode,
    department: 'Computer Science',
    btechYear: '4th Year',
    semester: 'Semester 7',
    credits: 4,
  });
  assert(adminSubRes.statusCode === 201, `Admin can create curricular subject (code: ${newSubCode})`);

  // ==========================================
  // SECTION D: LOGOUT & POST-LOGOUT VERIFICATION
  // ==========================================
  console.log('\n--- Testing Section D: Logout & Immediate Session Revocation ---');

  // Student logs out
  const logoutRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/logout',
    method: 'POST',
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert(logoutRes.statusCode === 200, 'Student logs out and session is revoked on server');

  // Now verify that the previous student token is completely rejected
  const postLogoutPapers = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/papers',
    method: 'GET',
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert(postLogoutPapers.statusCode === 401, `After logout, GET /api/papers with old token returns 401 Unauthorized (got ${postLogoutPapers.statusCode})`);

  const postLogoutView = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/papers/view/${samplePaper.id}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert(postLogoutView.statusCode === 401, `After logout, PDF view returns 401 Unauthorized (got ${postLogoutView.statusCode})`);

  const postLogoutDownload = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/papers/download/${samplePaper.id}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert(postLogoutDownload.statusCode === 401, `After logout, PDF download returns 401 Unauthorized (got ${postLogoutDownload.statusCode})`);

  console.log('\n==========================================');
  if (failures === 0) {
    console.log('ALL AUTHENTICATION-FIRST SECURITY AUDITS PASSED PERFECTLY!');
  } else {
    console.error(`AUDIT COMPLETED WITH ${failures} FAILURE(S)!`);
  }
  console.log('==========================================\n');
}

runTests().catch(console.error);
