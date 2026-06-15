const status  = process.argv[2]
const jobId   = process.env.JOB_ID
const baseUrl = process.env.SUPABASE_URL
const key     = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!jobId)   { console.error('JOB_ID is required');                    process.exit(1) }
if (!baseUrl) { console.error('SUPABASE_URL is required');              process.exit(1) }
if (!key)     { console.error('SUPABASE_SERVICE_ROLE_KEY is required'); process.exit(1) }

const update = { status }
if (status === 'error') {
  update.error_message = process.env.ERROR_MESSAGE || 'Unknown error'
  update.completed_at  = new Date().toISOString()
}
if (status === 'rendering') {
  update.started_at = new Date().toISOString()
}

const res = await fetch(`${baseUrl}/rest/v1/render_jobs?job_id=eq.${encodeURIComponent(jobId)}`, {
  method:  'PATCH',
  headers: {
    'apikey':        key,
    'Authorization': `Bearer ${key}`,
    'Content-Type':  'application/json',
    'Prefer':        'return=minimal',
  },
  body: JSON.stringify(update),
})

if (!res.ok) {
  const msg = await res.text()
  console.error('Supabase update failed:', msg)
  process.exit(1)
}

console.log(`✓ Job ${jobId} → ${status}`)
