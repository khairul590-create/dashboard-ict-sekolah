// Tarikh tempatan (waktu peranti) — elak bug timezone.
// new Date().toISOString() pulang UTC; di Malaysia (UTC+8) waktu 00:00–07:59
// ia jadi hari semalam. Helper ni bina string dari komponen tempatan.

export function todayLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function monthLocal() {
  return todayLocal().slice(0, 7)
}
