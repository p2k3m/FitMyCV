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
    if (!cvFile || !jobDescription) {
      setError('Upload a CV and paste a job description first.')
      return
    }
    setStatus('Uploading CV...')

    try {
      const form = new FormData()
      form.append('file', cvFile)
      const uploadRes = await fetch(`${API_BASE}/cv/upload`, { method: 'POST', body: form })
      const upload = await uploadRes.json()

      setStatus('Parsing CV...')
      const parseRes = await fetch(`${API_BASE}/cv/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ upload_id: upload.upload_id, object_key: upload.object_key || upload.upload_id }),
      })
      const parsed = await parseRes.json()

      setStatus('Analyzing JD...')
      const jdRes = await fetch(`${API_BASE}/jd/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_description: jobDescription }),
      })
      const jd = await jdRes.json()

      setStatus('Rewriting CV...')
      const rewriteRes = await fetch(`${API_BASE}/cv/rewrite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cv_sections: parsed.sections || parsed, jd_analysis: jd }),
      })
      const tailored = await rewriteRes.json()

      setStatus('Formatting PDFs...')
      const formatRes = await fetch(`${API_BASE}/cv/format`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tailored_cv: tailored.tailored_cv || tailored, template_id: 'template-modern' }),
      })
      const links = await formatRes.json()
      setDownloadLinks(links)
      setStatus('Done! Ready to download')
    } catch (err) {
      console.error(err)
      setError('Something went wrong. Check API availability and try again.')
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
