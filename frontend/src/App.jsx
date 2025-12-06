import { useState } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://api.example.com/v1'

export default function App() {
  const [cvFile, setCvFile] = useState(null)
  const [jobDescription, setJobDescription] = useState('')
  const [status, setStatus] = useState('Idle')
  const [downloadLinks, setDownloadLinks] = useState({})
  const [error, setError] = useState('')

  const handleGenerate = async () => {
    setError('')
    setDownloadLinks({})
    if (!cvFile || !jobDescription) {
      setError('Upload a CV and paste a job description first.')
      return
    }
    setStatus('Starting job...')

    try {
      // 1. Start the job
      const form = new FormData()
      form.append('resume', cvFile)
      form.append('manualJobDescription', jobDescription) // Send JD with the file

      const startRes = await fetch(`${API_BASE}/api/process-cv`, { method: 'POST', body: form })

      if (!startRes.ok) {
        throw new Error(`Failed to start job: ${startRes.statusText}`)
      }

      const startData = await startRes.json()
      const jobId = startData.jobId || startData.id

      if (!jobId) {
        throw new Error('No Job ID received from backend')
      }

      setStatus('Processing... (this may take a minute)')

      // 2. Poll for status
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(`${API_BASE}/api/job-status?jobId=${jobId}`)
          if (!statusRes.ok) {
            // Keep polling if 404 (maybe consistency lag) or stop? 
            // Usually 500 means retry, 4xx might mean fail. 
            // For now, let's log and continue hoping it's transient or handled by error count
            console.warn('Status check failed', statusRes.status)
            return
          }

          const statusData = await statusRes.json()
          console.log('Poll result:', statusData)

          if (statusData.status === 'COMPLETED' || statusData.state === 'COMPLETED') {
            clearInterval(pollInterval)
            setStatus('Done! Ready to download')
            setDownloadLinks(statusData.downloadLinks || statusData.results || {})
          } else if (statusData.status === 'FAILED' || statusData.state === 'FAILED') {
            clearInterval(pollInterval)
            setStatus('Job Failed')
            setError(statusData.error || 'Job failed on server')
          } else {
            setStatus(`Processing... (${statusData.status || 'running'})`)
          }
        } catch (pollErr) {
          console.error('Polling error', pollErr)
        }
      }, 3000)

    } catch (err) {
      console.error(err)
      setError('Something went wrong. Check console for details.')
      setStatus('Idle')
    }
  }

  return (
    <main className="min-h-screen text-slate-900">
      <header className="bg-brand text-white py-12">
        <div className="max-w-5xl mx-auto px-6 flex flex-col gap-4">
          <p className="uppercase tracking-[0.2em] text-sm text-accent font-semibold">Phase 1 Launch</p>
          <h1 className="text-3xl md:text-4xl font-bold">Get the Perfect CV for Any Job</h1>
          <p className="text-slate-200 max-w-3xl">
            Upload your CV, paste a job description, and instantly download an ATS-optimized tailored CV and cover letter built on
            premium templates.
          </p>
          <div className="flex gap-3 text-sm text-slate-200">
            <span>Serverless</span>
            <span>•</span>
            <span>LLM rewritten content</span>
            <span>•</span>
            <span>React + Tailwind frontend</span>
          </div>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-6 -mt-10">
        <div className="bg-white shadow-xl rounded-2xl p-6 md:p-8 grid md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-4">
            <label className="font-semibold">Upload original CV (PDF or DOCX)</label>
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={(e) => setCvFile(e.target.files?.[0])}
              className="border rounded-lg p-3"
            />
            <label className="font-semibold">Paste Job Description</label>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              rows={8}
              placeholder="Paste the JD here"
              className="border rounded-lg p-3 focus:ring-2 focus:ring-accent"
            />
            <button
              className="bg-accent text-white font-semibold rounded-lg py-3 px-4 shadow hover:-translate-y-0.5 transition"
              onClick={handleGenerate}
            >
              Generate Tailored CV & Cover Letter
            </button>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <p className="text-sm text-slate-500">Status: {status}</p>
          </div>

          <div className="bg-slate-50 border rounded-xl p-4 flex flex-col gap-3">
            <h3 className="font-semibold text-lg">Downloads</h3>
            <DownloadLink label="Tailored CV (PDF)" href={downloadLinks.cv_pdf_url} />
            <DownloadLink label="Tailored CV (DOCX)" href={downloadLinks.cv_docx_url} />
            <DownloadLink label="Cover Letter (PDF)" href={downloadLinks.cover_letter_pdf_url} />
            <DownloadLink label="Cover Letter (Text)" href={downloadLinks.cover_letter_text_url} />
            <div className="text-xs text-slate-500 leading-relaxed">
              <p>Quality controls:</p>
              <ul className="list-disc list-inside">
                <li>ATS-compliant output, no tables or icons in text layer.</li>
                <li>LLM rewrites only; HTML/CSS templates handle beauty.</li>
                <li>Serverless pipeline on AWS (API Gateway + Lambda + S3 + CloudFront).</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

function DownloadLink({ label, href }) {
  if (!href) {
    return <p className="text-slate-400">{label} — pending</p>
  }
  return (
    <a className="text-accent font-semibold" href={href} target="_blank" rel="noreferrer">
      {label}
    </a>
  )
}
