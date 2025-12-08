import { useState, useEffect } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://api.example.com/v1'

const STEPS = [
  { id: 'upload', label: 'Upload CV' },
  { id: 'extract', label: 'Extract & Analyze' },
  { id: 'optimize', label: 'AI Optimization' },
  { id: 'generate', label: 'Generate Documents' },
  { id: 'complete', label: 'Ready' }
]

export default function App() {
  const [cvFile, setCvFile] = useState(null)
  const [jobDescription, setJobDescription] = useState('')
  const [status, setStatus] = useState('idle')
  const [currentStep, setCurrentStep] = useState(0)
  const [downloadLinks, setDownloadLinks] = useState({})
  const [error, setError] = useState('')

  const handleGenerate = async () => {
    setError('')
    setDownloadLinks({})
    if (!cvFile || !jobDescription) {
      setError('Upload a CV and paste a job description first.')
      return
    }
    setStatus('starting')
    setCurrentStep(0)

    try {
      // 1. Start the job
      const form = new FormData()
      form.append('resume', cvFile)
      form.append('manualJobDescription', jobDescription)

      const startRes = await fetch(`${API_BASE}/api/process-cv`, { method: 'POST', body: form })

      if (!startRes.ok) throw new Error(`Failed to start job: ${startRes.statusText}`)

      const startData = await startRes.json()
      const jobId = startData.jobId || startData.id

      if (startData.success === false) {
        throw new Error(startData.error?.message || 'Job started failed')
      }

      if (!jobId) throw new Error('No Job ID received from backend')

      setStatus('processing')
      setCurrentStep(1) // Moved from upload to next step

      // 2. Poll for status
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(`${API_BASE}/api/job-status?jobId=${jobId}`)
          if (!statusRes.ok) {
            console.warn('Status check failed', statusRes.status)
            return
          }

          const statusData = await statusRes.json()
          console.log('Poll result:', statusData)

          // Map backend status to steps
          const backendStatus = (statusData.status || '').toLowerCase()

          if (backendStatus === 'uploaded') setCurrentStep(1)
          if (backendStatus.includes('score') || backendStatus.includes('extract')) setCurrentStep(2)
          if (backendStatus.includes('enhance') || backendStatus.includes('generate')) setCurrentStep(3)

          if (backendStatus === 'completed' || statusData.state === 'COMPLETED') {
            clearInterval(pollInterval)
            setStatus('completed')
            setCurrentStep(4)
            setDownloadLinks(statusData.downloadLinks || statusData.results || {})
          } else if (backendStatus === 'failed') {
            clearInterval(pollInterval)
            setStatus('failed')
            setError(statusData.error || 'Job failed on server')
          }
        } catch (pollErr) {
          console.error('Polling error', pollErr)
        }
      }, 3000)

    } catch (err) {
      console.error(err)
      setError(err.message || 'Something went wrong.')
      setStatus('idle')
    }
  }

  return (
    <main className="min-h-screen text-slate-900 font-sans selection:bg-accent/20">
      <header className="bg-gradient-to-r from-brand to-slate-900 text-white py-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
        <div className="max-w-5xl mx-auto px-6 flex flex-col gap-6 relative z-10">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-accent/20 text-accent text-xs font-bold uppercase tracking-widest rounded-full border border-accent/20">Phase 1 Launch x Deepmind</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
            Get the Perfect CV for <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-emerald-300">Any Job</span>
          </h1>
          <p className="text-slate-300 max-w-2xl text-lg leading-relaxed">
            Upload your CV, paste a job description, and let our AI agents instantly engineer an ATS-optimized tailored CV and cover letter.
          </p>
          <div className="flex flex-wrap gap-6 text-sm font-medium text-slate-400 mt-2">
            <Feature icon="⚡" text="Serverless Architecture" />
            <Feature icon="🤖" text="Multi-Agent LLM Pipeline" />
            <Feature icon="✨" text="Modern React Frontend" />
          </div>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-6 -mt-12 relative z-20 pb-20">
        <div className="bg-white shadow-2xl shadow-slate-200/50 rounded-2xl overflow-hidden border border-slate-100">
          <div className="grid md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-slate-100">

            {/* Input Section */}
            <div className="p-8 flex flex-col gap-6">
              <div className="space-y-4">
                <label className="block text-sm font-bold text-slate-700 uppercase tracking-wide">1. Upload Original CV</label>
                <div className="relative group">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => setCvFile(e.target.files?.[0])}
                    className="peer absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center transition-all peer-hover:border-accent peer-hover:bg-accent/5 peer-focus:ring-4 peer-focus:ring-accent/20 bg-slate-50">
                    {cvFile ? (
                      <div className="flex items-center justify-center gap-2 text-emerald-600 font-medium">
                        <CheckCircle className="w-5 h-5" />
                        <span className="truncate max-w-[200px]">{cvFile.name}</span>
                      </div>
                    ) : (
                      <div className="text-slate-500">
                        <span className="block text-2xl mb-2">📄</span>
                        <span className="font-medium">Drop PDF or DOCX here</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4 flex-1 flex flex-col">
                <label className="block text-sm font-bold text-slate-700 uppercase tracking-wide">2. Job Description</label>
                <textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  className="w-full flex-1 min-h-[200px] border border-slate-200 rounded-xl p-4 focus:ring-2 focus:ring-accent focus:border-transparent outline-none resize-none bg-slate-50 text-slate-600 text-sm leading-relaxed transition-all placeholder:text-slate-400"
                  placeholder="Paste the full job description here..."
                />
              </div>

              <button
                onClick={handleGenerate}
                disabled={status === 'processing' || status === 'starting'}
                className="w-full bg-slate-900 text-white font-bold rounded-xl py-4 px-6 shadow-lg shadow-slate-900/20 hover:bg-black hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {status === 'processing' || status === 'starting' ? (
                  <>
                    <Spinner /> Processing...
                  </>
                ) : 'Generate Tailored Documents'}
              </button>
              {error && <div className="p-4 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 flex gap-2">⚠️ {error}</div>}
            </div>

            {/* Output / Status Section */}
            <div className="bg-slate-50/50 p-8 flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                  System Status
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                </h3>

                <div className="space-y-6 relative">
                  {/* Connecting Line */}
                  <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-slate-200 z-0"></div>

                  {STEPS.map((step, index) => {
                    const isActive = index === currentStep;
                    const isCompleted = index < currentStep;

                    return (
                      <div key={step.id} className={`relative z-10 flex items-center gap-4 transition-all duration-500 ${isActive || isCompleted ? 'opacity-100' : 'opacity-40'}`}>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${isActive ? 'border-accent bg-white text-accent scale-110 shadow-lg shadow-accent/20' :
                            isCompleted ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-200 bg-white text-slate-300'
                          }`}>
                          {isCompleted ? <CheckIcon /> : isActive ? <Spinner size="sm" color="text-accent" /> : <span className="text-sm font-bold">{index + 1}</span>}
                        </div>
                        <div>
                          <p className={`font-semibold ${isActive ? 'text-accent' : isCompleted ? 'text-slate-900' : 'text-slate-500'}`}>{step.label}</p>
                          {isActive && <p className="text-xs text-slate-500 animate-pulse">Processing...</p>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className={`transition-all duration-500 ${status === 'completed' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                <div className="bg-white border-2 border-emerald-100 rounded-xl p-6 shadow-xl shadow-emerald-500/5 mt-8">
                  <div className="flex items-center gap-3 mb-4 text-emerald-700">
                    <CheckCircle className="w-6 h-6" />
                    <h4 className="font-bold">Documents Ready</h4>
                  </div>
                  <div className="space-y-3">
                    <DownloadBtn href={downloadLinks.cv_pdf_url} label="Tailored CV (PDF)" />
                    <DownloadBtn href={downloadLinks.cv_docx_url} label="Tailored CV (DOCX)" secondary />
                    <DownloadBtn href={downloadLinks.cover_letter_pdf_url} label="Cover Letter (PDF)" secondary />
                    <DownloadBtn href={downloadLinks.cover_letter_text_url} label="Cover Letter (Text)" secondary />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

function Feature({ icon, text }) {
  return (
    <div className="flex items-center gap-2 bg-slate-800/50 rounded-full px-3 py-1 border border-slate-700/50">
      <span>{icon}</span>
      <span>{text}</span>
    </div>
  )
}

function DownloadBtn({ href, label, secondary }) {
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noreferrer" className={`block w-full text-center py-3 rounded-lg font-medium transition-all ${secondary ? 'bg-slate-50 text-slate-700 hover:bg-slate-100' : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-600/20'}`}>
      {label}
    </a>
  )
}

function Spinner({ size = 'md', color = 'text-current' }) {
  const dims = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  return (
    <svg className={`animate-spin ${dims} ${color}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  )
}

function CheckCircle({ className }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  )
}
