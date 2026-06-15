import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    global: { fetch },
    realtime: { transport: ws },
  }
)

const status = process.argv[2]
const jobId = process.env.JOB_ID

if (!jobId) {
  console.error('JOB_ID is required')
  process.exit(1)
}

const update = { status }

if (status === 'error') {
  update.error_message = process.env.ERROR_MESSAGE || 'Unknown error'
  update.completed_at = new Date().toISOString()
}

if (status === 'rendering') {
  update.started_at = new Date().toISOString()
}

const { error } = await supabase
  .from('render_jobs')
  .update(update)
  .eq('id', jobId)

if (error) {
  console.error('Supabase update failed:', error.message)
  process.exit(1)
}

console.log(`✓ Job ${jobId} → ${status}`)
