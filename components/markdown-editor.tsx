"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

/* ---------- Minimal, dependency-free Markdown parser ---------- */
function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function inline(text: string) {
  const codes: string[] = []
  text = text.replace(/`([^`]+)`/g, (_, c) => {
    codes.push("<code>" + escapeHtml(c) + "</code>")
    return "\u0000" + (codes.length - 1) + "\u0000"
  })

  text = escapeHtml(text)

  text = text.replace(
    /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
    (_, alt, src, title) =>
      '<img src="' + src + '" alt="' + alt + '"' + (title ? ' title="' + title + '"' : "") + " />",
  )
  text = text.replace(
    /\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
    (_, txt, href, title) =>
      '<a href="' +
      href +
      '"' +
      (title ? ' title="' + title + '"' : "") +
      ' target="_blank" rel="noopener noreferrer">' +
      txt +
      "</a>",
  )
  text = text.replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>")
  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
  text = text.replace(/__([^_]+)__/g, "<strong>$1</strong>")
  text = text.replace(/\*([^*]+)\*/g, "<em>$1</em>")
  text = text.replace(/(^|[\s(])_([^_]+)_(?=[\s).,!?]|$)/g, "$1<em>$2</em>")
  text = text.replace(/~~([^~]+)~~/g, "<del>$1</del>")

  text = text.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[+i])
  return text
}

function parseTable(rows: string[]) {
  const header = rows[0]
    .split("|")
    .slice(1, -1)
    .map((c) => c.trim())
  const body = rows.slice(2)
  let html = "<table><thead><tr>"
  header.forEach((h) => {
    html += "<th>" + inline(h) + "</th>"
  })
  html += "</tr></thead><tbody>"
  body.forEach((r) => {
    const cells = r
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim())
    html += "<tr>"
    cells.forEach((c) => {
      html += "<td>" + inline(c) + "</td>"
    })
    html += "</tr>"
  })
  html += "</tbody></table>"
  return html
}

function parse(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n")
  let html = ""
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    const fence = line.match(/^```(.*)$/)
    if (fence) {
      const buf: string[] = []
      i++
      while (i < lines.length && !/^```/.test(lines[i])) {
        buf.push(lines[i])
        i++
      }
      i++
      html += "<pre><code>" + escapeHtml(buf.join("\n")) + "</code></pre>"
      continue
    }

    if (/^\s*$/.test(line)) {
      i++
      continue
    }

    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      html += "<hr />"
      i++
      continue
    }

    const h = line.match(/^(#{1,6})\s+(.*)$/)
    if (h) {
      const lvl = h[1].length
      html += "<h" + lvl + ">" + inline(h[2].trim()) + "</h" + lvl + ">"
      i++
      continue
    }

    if (/^\s*>\s?/.test(line)) {
      const q: string[] = []
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        q.push(lines[i].replace(/^\s*>\s?/, ""))
        i++
      }
      html += "<blockquote>" + parse(q.join("\n")) + "</blockquote>"
      continue
    }

    if (
      /\|/.test(line) &&
      i + 1 < lines.length &&
      /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]) &&
      /-/.test(lines[i + 1])
    ) {
      const tbl: string[] = []
      while (i < lines.length && /\|/.test(lines[i]) && lines[i].trim() !== "") {
        tbl.push(lines[i].trim())
        i++
      }
      if (tbl.length >= 2) {
        html += parseTable(tbl)
        continue
      }
    }

    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line)
      const items: string[] = []
      while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
        let content = lines[i].replace(/^\s*([-*+]|\d+\.)\s+/, "")
        const task = content.match(/^\[([ xX])\]\s+(.*)$/)
        if (task) {
          const checked = task[1].toLowerCase() === "x" ? " checked" : ""
          content = '<input type="checkbox" disabled' + checked + " /> " + inline(task[2])
        } else {
          content = inline(content)
        }
        items.push("<li>" + content + "</li>")
        i++
      }
      html += (ordered ? "<ol>" : "<ul>") + items.join("") + (ordered ? "</ol>" : "</ul>")
      continue
    }

    const para: string[] = []
    while (
      i < lines.length &&
      !/^\s*$/.test(lines[i]) &&
      !/^(#{1,6})\s/.test(lines[i]) &&
      !/^```/.test(lines[i]) &&
      !/^\s*>/.test(lines[i]) &&
      !/^\s*([-*+]|\d+\.)\s+/.test(lines[i]) &&
      !/^\s*([-*_])(\s*\1){2,}\s*$/.test(lines[i])
    ) {
      para.push(lines[i])
      i++
    }
    if (para.length) html += "<p>" + inline(para.join(" ").trim()) + "</p>"
  }
  return html
}

/* ---------- Export document helpers ---------- */
function documentStyles() {
  return (
    "body{font-family:system-ui,sans-serif;line-height:1.7;max-width:760px;margin:2rem auto;padding:0 1rem;color:#1e293b;}" +
    "h1,h2{border-bottom:1px solid #e2e8f0;padding-bottom:.3em;}" +
    "pre{background:#0f172a;color:#e2e8f0;padding:1rem;border-radius:.5rem;overflow:auto;}" +
    "code{background:#f1f5f9;padding:.15em .4em;border-radius:.3em;font-family:monospace;}" +
    "pre code{background:transparent;padding:0;color:inherit;}" +
    "blockquote{border-left:4px solid #10b981;margin:1em 0;padding:.4em 1em;color:#475569;background:#f0fdfa;}" +
    "table{border-collapse:collapse;width:100%;}th,td{border:1px solid #cbd5e1;padding:.5em .75em;text-align:left;}th{background:#f1f5f9;}" +
    "img{max-width:100%;}a{color:#0d9488;}"
  )
}

function fullHtmlDocument(bodyHtml: string) {
  return (
    '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8" />\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0" />\n' +
    "<title>Exported Document</title>\n<style>\n" +
    documentStyles() +
    "\n</style>\n</head>\n<body>\n" +
    bodyHtml +
    "\n</body>\n</html>"
  )
}

const SAMPLE = [
  "# Markdown Studio",
  "",
  "A **fast**, _elegant_ editor with a live `HTML` preview. No dependencies, no fuss.",
  "",
  "## Features",
  "",
  "- Live side-by-side rendering",
  "- Copy Markdown or HTML",
  "- Export as `.md`, `.html` or **PDF**",
  "- Light & dark themes",
  "- [x] Auto-saves your work",
  "- [ ] Even unchecked ones",
  "",
  "## Code",
  "",
  "```",
  "function greet(name) {",
  "  return `Hello, ${name}!`;",
  "}",
  "```",
  "",
  "> \u201cSimplicity is the ultimate sophistication.\u201d",
  "",
  "## Table",
  "",
  "| Feature | Status |",
  "| ------- | ------ |",
  "| Preview | Live   |",
  "| Export  | Ready  |",
  "",
  "---",
  "",
  ".md with care [md.jessejesse.com](https://md.jessejesse.com).",
  "",
].join("\n")

const STORAGE_KEY = "markdown-studio:draft"
const THEME_KEY = "markdown-studio:theme"

type Theme = "dark" | "light"

export default function MarkdownEditor() {
  const [markdown, setMarkdown] = useState<string>(SAMPLE)
  const [theme, setTheme] = useState<Theme>("dark")
  const [saveStatus, setSaveStatus] = useState<string>("Auto-saved")
  const [savePulse, setSavePulse] = useState(false)
  const [syncScroll, setSyncScroll] = useState(true)
  const [toast, setToast] = useState<{ msg: string; id: number } | null>(null)
  const [mounted, setMounted] = useState(false)

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const html = useMemo(() => parse(markdown), [markdown])
  const wordCount = markdown.trim() ? markdown.trim().split(/\s+/).length : 0

  /* Restore theme + draft on mount */
  useEffect(() => {
    let savedTheme: string | null = null
    let savedDraft: string | null = null
    try {
      savedTheme = localStorage.getItem(THEME_KEY)
      savedDraft = localStorage.getItem(STORAGE_KEY)
    } catch {}
    if (savedTheme === "light" || savedTheme === "dark") setTheme(savedTheme)
    if (savedDraft !== null && savedDraft !== "") {
      setMarkdown(savedDraft)
      setSaveStatus("Restored")
    }
    setMounted(true)
  }, [])

  /* Persist theme */
  useEffect(() => {
    if (!mounted) return
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {}
  }, [theme, mounted])

  const showToast = useCallback((msg: string) => {
    setToast({ msg, id: Date.now() })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 1800)
  }, [])

  /* Debounced auto-save */
  const scheduleSave = useCallback((value: string) => {
    setSaveStatus("Saving…")
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, value)
        setSaveStatus("Auto-saved")
        setSavePulse(false)
        requestAnimationFrame(() => setSavePulse(true))
      } catch {
        setSaveStatus("Save unavailable")
      }
    }, 500)
  }, [])

  const updateMarkdown = useCallback(
    (value: string) => {
      setMarkdown(value)
      scheduleSave(value)
    },
    [scheduleSave],
  )

  const copyText = useCallback(
    (text: string, label: string) => {
      const fallback = () => {
        const ta = document.createElement("textarea")
        ta.value = text
        ta.style.position = "fixed"
        ta.style.opacity = "0"
        document.body.appendChild(ta)
        ta.select()
        try {
          document.execCommand("copy")
          showToast(label + " copied!")
        } catch {
          showToast("Copy failed")
        }
        document.body.removeChild(ta)
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => showToast(label + " copied!"), fallback)
      } else {
        fallback()
      }
    },
    [showToast],
  )

  const download = useCallback(
    (filename: string, content: string, mime: string) => {
      const blob = new Blob([content], { type: mime })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      showToast("Exported " + filename)
    },
    [showToast],
  )

  const exportPdf = useCallback(() => {
    const win = window.open("", "_blank")
    if (!win) {
      showToast("Allow pop-ups to export PDF")
      return
    }
    win.document.open()
    win.document.write(fullHtmlDocument(html))
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 300)
    showToast("Opening print dialog…")
  }, [html, showToast])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault()
      const el = e.currentTarget
      const s = el.selectionStart
      const en = el.selectionEnd
      const next = el.value.slice(0, s) + "  " + el.value.slice(en)
      updateMarkdown(next)
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = s + 2
      })
    }
  }

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (!syncScroll || !previewRef.current) return
    const el = e.currentTarget
    const ratio = el.scrollTop / (el.scrollHeight - el.clientHeight || 1)
    const p = previewRef.current
    p.scrollTop = ratio * (p.scrollHeight - p.clientHeight)
  }

  const clearEditor = () => {
    if (markdown.trim() === "" || window.confirm("Clear the editor?")) {
      updateMarkdown("")
      inputRef.current?.focus()
    }
  }

  const isDark = theme === "dark"

  return (
    <div data-theme={theme} className="ms-root min-h-screen flex flex-col">
      <style>{THEME_CSS}</style>

      {/* Header */}
      <header className="flex-none border-b app-header backdrop-blur">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 grid place-items-center shadow-lg shadow-emerald-500/20">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#022c22"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M14 3v4a1 1 0 0 0 1 1h4" />
                <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z" />
                <path d="m9 15 2-2-2-2" />
                <path d="M13 11h2" />
              </svg>
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold txt-strong leading-tight tracking-tight">
                Markdown Studio
              </h1>
              <p className="text-xs txt-muted leading-tight flex items-center gap-1.5">
                <span
                  className={"h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block" + (savePulse ? " saving-dot" : "")}
                />
                <span>{saveStatus}</span>
              </p>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setTheme(isDark ? "light" : "dark")}
              className="tool-btn"
              title="Toggle light / dark theme"
            >
              {isDark ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2" />
                  <path d="M12 20v2" />
                  <path d="m4.93 4.93 1.41 1.41" />
                  <path d="m17.66 17.66 1.41 1.41" />
                  <path d="M2 12h2" />
                  <path d="M20 12h2" />
                  <path d="m6.34 17.66-1.41 1.41" />
                  <path d="m19.07 4.93-1.41 1.41" />
                </svg>
              )}
              <span className="hidden sm:inline">{isDark ? "Light" : "Dark"}</span>
            </button>
            <div className="w-px h-6 divider mx-1 hidden sm:block" />
            <button onClick={() => updateMarkdown(SAMPLE)} className="tool-btn" title="Load sample content">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 7v14" />
                <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
              </svg>
              <span className="hidden sm:inline">Sample</span>
            </button>
            <button onClick={clearEditor} className="tool-btn" title="Clear editor">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 6h18" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              <span className="hidden sm:inline">Clear</span>
            </button>
            <div className="w-px h-6 divider mx-1 hidden sm:block" />
            <button onClick={() => copyText(markdown, "Markdown")} className="tool-btn" title="Copy Markdown">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
              </svg>
              <span className="hidden sm:inline">Copy MD</span>
            </button>
            <button onClick={() => copyText(html, "HTML")} className="tool-btn" title="Copy HTML">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m18 16 4-4-4-4" />
                <path d="m6 8-4 4 4 4" />
                <path d="m14.5 4-5 16" />
              </svg>
              <span className="hidden sm:inline">Copy HTML</span>
            </button>
            <div className="w-px h-6 divider mx-1 hidden sm:block" />
            <button
              onClick={() => download("document.md", markdown, "text/markdown;charset=utf-8")}
              className="tool-btn-accent"
              title="Export .md file"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" x2="12" y1="15" y2="3" />
              </svg>
              <span className="hidden sm:inline">.md</span>
            </button>
            <button
              onClick={() => download("document.html", fullHtmlDocument(html), "text/html;charset=utf-8")}
              className="tool-btn-accent"
              title="Export .html file"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" x2="12" y1="15" y2="3" />
              </svg>
              <span className="hidden sm:inline">.html</span>
            </button>
            <button onClick={exportPdf} className="tool-btn-accent" title="Export as PDF">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                <path d="M14 2v6h6" />
                <path d="M10 12v5" />
                <path d="M14 12v5" />
                <path d="M8 15h8" />
              </svg>
              <span className="hidden sm:inline">PDF</span>
            </button>
          </div>
        </div>
      </header>

      {/* Editor / Preview */}
      <main className="flex-1 min-h-0 max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full min-h-0">
          {/* Editor pane */}
          <section className="flex flex-col min-h-0 rounded-2xl border surface overflow-hidden shadow-xl shadow-black/20">
            <div className="flex-none flex items-center justify-between px-4 py-2.5 border-b surface-head">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                <span className="text-xs font-semibold tracking-wide txt-body uppercase">Markdown</span>
              </div>
              <span className="text-xs txt-muted tabular-nums">
                {wordCount} {wordCount === 1 ? "word" : "words"} · {markdown.length} chars
              </span>
            </div>
            <textarea
              ref={inputRef}
              spellCheck={false}
              value={markdown}
              onChange={(e) => updateMarkdown(e.target.value)}
              onKeyDown={handleKeyDown}
              onScroll={handleScroll}
              className="editor-area nice-scroll flex-1 min-h-[300px] w-full resize-none bg-transparent p-4 sm:p-5 outline-none text-sm"
              placeholder={"# Start typing Markdown…\n\n**Bold**, _italic_, `code`, [links](https://md.jessejesse.com), lists, tables and more."}
            />
          </section>

          {/* Preview pane */}
          <section className="flex flex-col min-h-0 rounded-2xl border surface overflow-hidden shadow-xl shadow-black/20">
            <div className="flex-none flex items-center justify-between px-4 py-2.5 border-b surface-head">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-teal-400" />
                <span className="text-xs font-semibold tracking-wide txt-body uppercase">Preview</span>
              </div>
              <label className="flex items-center gap-2 text-xs txt-muted cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="accent-emerald-500"
                  checked={syncScroll}
                  onChange={(e) => setSyncScroll(e.target.checked)}
                />
                Sync scroll
              </label>
            </div>
            <div
              ref={previewRef}
              className="prose-md nice-scroll flex-1 min-h-[300px] overflow-y-auto p-5 sm:p-7"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </section>
        </div>
      </main>

      {/* Toast */}
      <div
        className={
          "toast fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-emerald-500 text-emerald-950 text-sm font-semibold shadow-lg shadow-emerald-500/30 pointer-events-none" +
          (toast ? " show" : "")
        }
      >
        {toast?.msg}
      </div>
    </div>
  )
}

const THEME_CSS = `
[data-theme="dark"].ms-root {
  color-scheme: dark;
  --bg: #020617;
  --grad-1: rgba(16,185,129,0.12);
  --grad-2: rgba(20,184,166,0.10);
  --panel: rgba(15,23,42,0.40);
  --panel-head: rgba(15,23,42,0.60);
  --border: #1e293b;
  --border-strong: #334155;
  --text: #e2e8f0;
  --text-strong: #f1f5f9;
  --text-body: #cbd5e1;
  --text-muted: #64748b;
  --btn-bg: #0f172a;
  --btn-hover: #1e293b;
  --code-bg: #0f172a;
  --code-text: #5eead4;
  --code-border: #1e293b;
  --pre-bg: #0b1120;
  --pre-text: #e2e8f0;
  --table-head: #0f172a;
  --table-stripe: rgba(15,23,42,0.5);
  --quote-bg: rgba(16,185,129,0.06);
  --quote-text: #94a3b8;
  --hr: #1e293b;
  --placeholder: #475569;
  --scroll-thumb: #1e293b;
  --scroll-thumb-hover: #334155;
  --header-border: rgba(30,41,59,0.8);
}
[data-theme="light"].ms-root {
  color-scheme: light;
  --bg: #f1f5f9;
  --grad-1: rgba(16,185,129,0.14);
  --grad-2: rgba(20,184,166,0.10);
  --panel: rgba(255,255,255,0.75);
  --panel-head: rgba(255,255,255,0.85);
  --border: #e2e8f0;
  --border-strong: #cbd5e1;
  --text: #1e293b;
  --text-strong: #0f172a;
  --text-body: #334155;
  --text-muted: #94a3b8;
  --btn-bg: #ffffff;
  --btn-hover: #f1f5f9;
  --code-bg: #f1f5f9;
  --code-text: #0d9488;
  --code-border: #e2e8f0;
  --pre-bg: #0f172a;
  --pre-text: #e2e8f0;
  --table-head: #f1f5f9;
  --table-stripe: rgba(241,245,249,0.6);
  --quote-bg: #f0fdfa;
  --quote-text: #475569;
  --hr: #e2e8f0;
  --placeholder: #94a3b8;
  --scroll-thumb: #cbd5e1;
  --scroll-thumb-hover: #94a3b8;
  --header-border: rgba(226,232,240,0.9);
}

.ms-root {
  color: var(--text);
  background:
    radial-gradient(1200px 600px at 15% -10%, var(--grad-1), transparent 60%),
    radial-gradient(1000px 500px at 110% 10%, var(--grad-2), transparent 55%),
    var(--bg);
  transition: background-color .3s ease, color .3s ease;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}

.ms-root .surface { background: var(--panel); border-color: var(--border); }
.ms-root .surface-head { background: var(--panel-head); border-color: var(--border); }
.ms-root .app-header { border-color: var(--header-border); }
.ms-root .divider { background: var(--border); }
.ms-root .txt-strong { color: var(--text-strong); }
.ms-root .txt-muted { color: var(--text-muted); }
.ms-root .txt-body { color: var(--text-body); }

.ms-root .editor-area {
  font-family: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace;
  line-height: 1.65;
  tab-size: 2;
  color: var(--text);
}
.ms-root .editor-area::placeholder { color: var(--placeholder); }

.ms-root .nice-scroll::-webkit-scrollbar { width: 10px; height: 10px; }
.ms-root .nice-scroll::-webkit-scrollbar-track { background: transparent; }
.ms-root .nice-scroll::-webkit-scrollbar-thumb {
  background: var(--scroll-thumb); border-radius: 999px; border: 2px solid transparent; background-clip: content-box;
}
.ms-root .nice-scroll::-webkit-scrollbar-thumb:hover { background: var(--scroll-thumb-hover); background-clip: content-box; }

.ms-root .prose-md { color: var(--text-body); line-height: 1.7; word-wrap: break-word; }
.ms-root .prose-md h1, .ms-root .prose-md h2, .ms-root .prose-md h3, .ms-root .prose-md h4 {
  color: var(--text-strong); font-weight: 700; line-height: 1.25; margin: 1.4em 0 0.6em;
}
.ms-root .prose-md h1 { font-size: 1.9rem; border-bottom: 1px solid var(--border); padding-bottom: .3em; }
.ms-root .prose-md h2 { font-size: 1.5rem; border-bottom: 1px solid var(--border); padding-bottom: .25em; }
.ms-root .prose-md h3 { font-size: 1.25rem; }
.ms-root .prose-md h4 { font-size: 1.05rem; }
.ms-root .prose-md p { margin: 0.85em 0; }
.ms-root .prose-md a { color: #14b8a6; text-decoration: none; border-bottom: 1px solid rgba(20,184,166,.4); }
.ms-root .prose-md a:hover { border-bottom-color: #14b8a6; }
.ms-root .prose-md strong { color: var(--text-strong); font-weight: 700; }
.ms-root .prose-md em { color: var(--text); }
.ms-root .prose-md del { color: var(--text-muted); }
.ms-root .prose-md ul, .ms-root .prose-md ol { margin: 0.85em 0; padding-left: 1.5em; }
.ms-root .prose-md ul { list-style: disc; }
.ms-root .prose-md ol { list-style: decimal; }
.ms-root .prose-md li { margin: 0.3em 0; }
.ms-root .prose-md li input[type="checkbox"] { margin-right: .5em; transform: translateY(1px); accent-color: #10b981; }
.ms-root .prose-md blockquote {
  margin: 1em 0; padding: 0.4em 1.1em; border-left: 4px solid #10b981;
  background: var(--quote-bg); color: var(--quote-text); border-radius: 0 .5rem .5rem 0;
}
.ms-root .prose-md code {
  font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 0.875em;
  background: var(--code-bg); color: var(--code-text); padding: 0.15em 0.4em; border-radius: 0.35rem;
  border: 1px solid var(--code-border);
}
.ms-root .prose-md pre {
  background: var(--pre-bg); border: 1px solid var(--border); border-radius: 0.75rem;
  padding: 1rem 1.1rem; overflow-x: auto; margin: 1em 0;
}
.ms-root .prose-md pre code { background: transparent; border: 0; padding: 0; color: var(--pre-text); font-size: 0.85rem; }
.ms-root .prose-md hr { border: 0; border-top: 1px solid var(--hr); margin: 1.6em 0; }
.ms-root .prose-md img { max-width: 100%; border-radius: 0.6rem; margin: 0.6em 0; border: 1px solid var(--border); }
.ms-root .prose-md table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 0.9rem; }
.ms-root .prose-md th, .ms-root .prose-md td { border: 1px solid var(--border); padding: 0.5em 0.75em; text-align: left; }
.ms-root .prose-md th { background: var(--table-head); color: var(--text-strong); font-weight: 600; }
.ms-root .prose-md tr:nth-child(even) td { background: var(--table-stripe); }

.ms-root .toast {
  transition: opacity .3s ease, transform .3s ease;
  opacity: 0; transform: translateY(12px);
}
.ms-root .toast.show { opacity: 1; transform: translateY(0); }

.ms-root .tool-btn, .ms-root .tool-btn-accent {
  display: inline-flex; align-items: center; gap: .45rem;
  font-size: .8rem; font-weight: 600; padding: .5rem .7rem; border-radius: .6rem;
  transition: all .15s ease; cursor: pointer; border: 1px solid var(--border);
}
.ms-root .tool-btn { color: var(--text-body); background: var(--btn-bg); }
.ms-root .tool-btn:hover { background: var(--btn-hover); color: var(--text-strong); border-color: var(--border-strong); }
.ms-root .tool-btn:active { transform: scale(.96); }
.ms-root .tool-btn-accent {
  color: #022c22; border-color: transparent;
  background: linear-gradient(135deg, #34d399, #14b8a6);
}
.ms-root .tool-btn-accent:hover { filter: brightness(1.08); box-shadow: 0 4px 16px rgba(16,185,129,.3); }
.ms-root .tool-btn-accent:active { transform: scale(.96); }

@keyframes savePulse { 0% { transform: scale(.6); opacity: .4; } 50% { transform: scale(1.15); opacity: 1; } 100% { transform: scale(.9); opacity: .7; } }
.ms-root .saving-dot { animation: savePulse .6s ease; }
`
