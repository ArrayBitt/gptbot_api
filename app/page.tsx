export default function HomePage() {
  return (
    <main style={{ fontFamily: "system-ui", padding: 24, maxWidth: 720 }}>
      <h1>gptbot-api v2 (local)</h1>
      <p>API ชุดใหม่สำหรับทดลองผ่าน ngrok — ไม่กระทบ Firebase production</p>
      <ul>
        <li>
          <code>GET /api/v2/jobs/list</code>
        </li>
        <li>
          <code>GET /api/v2/jobs/list?with_group=1</code> (ได้ position_group)
        </li>
        <li>
          <code>GET /api/v2/jobs/search?q=บัญชี</code>
        </li>
        <li>
          <code>GET /api/v2/jobs/detail?position_name=...&amp;company=...</code>
        </li>
      </ul>
    </main>
  )
}
