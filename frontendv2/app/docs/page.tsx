import Link from 'next/link'
import { PageShell } from '@/components/ui-kit'
import { CodeBlock } from '@/components/code-block'

const SECTIONS: Array<[string, string]> = [['getting-started', 'Getting started'], ['security-model', 'Security model'], ['access-policies', 'Access policies'], ['key-fragment', 'The key fragment'], ['troubleshooting', 'Troubleshooting'], ['api-reference', 'API reference']]
const H = ({ id, children }: { id: string; children: React.ReactNode }) => <h2 id={id} className="scroll-mt-28 text-2xl font-light tracking-[-.02em]">{children}</h2>
const P = ({ children }: { children: React.ReactNode }) => <p className="mt-4 max-w-3xl text-sm leading-7 text-[#94a3b8]">{children}</p>

const ERRORS: Array<[string, string, string]> = [
  ['PASSWORD_REQUIRED / INVALID_PASSWORD', 'The secret is password protected, or the password was wrong.', 'Re-enter the password. Every 3 wrong attempts triggers an escalating temporary cooldown.'],
  ['RATE_LIMITED / cooldown', 'Too many wrong passwords. Attempts are paused for 15 minutes, then longer.', 'Wait for the cooldown to end, then use the exact password from the sender.'],
  ['SECRET_EXPIRED', 'The expiration time has passed.', 'Ask the sender to create a new secret.'],
  ['SECRET_DESTROYED / MAX_VIEWS_REACHED', 'The secret was viewed the maximum number of times or was view-once.', 'It cannot be recovered. Ask the sender to create a new one.'],
  ['ACCESS_WINDOW_NOT_STARTED / ENDED', 'The link is outside its allowed time window.', 'Try again during the window, or ask the sender to adjust it.'],
  ['Decryption failed', 'The link is missing its key (the part after #) or was altered.', 'Ask the sender for the complete link. Without the key nobody can read the message.'],
]

export default function DocsPage() {
  return <PageShell kicker="Developers / Documentation" title="How SafeSend" accent="works." intro="The security model, what each control does, and how to recover when something goes wrong." wide>
    <div className="grid gap-12 lg:grid-cols-[220px_minmax(0,1fr)]">
      <nav aria-label="Documentation sections" className="lg:sticky lg:top-24 lg:self-start"><ul className="grid gap-3 border-l border-[#172a46] pl-5">{SECTIONS.map(([id, label]) => <li key={id}><a href={`#${id}`} className="text-sm text-[#8b9ab4] hover:text-white">{label}</a></li>)}</ul></nav>
      <div className="grid gap-14">
        <section><H id="getting-started">Getting started</H>
          <P>Write a message on <Link href="/send" className="text-[#38bdf8] underline underline-offset-4">Create secret</Link>, choose the rules, and share the generated link. The recipient opens it on <Link href="/receive" className="text-[#38bdf8] underline underline-offset-4">Open secret</Link> or by following the link directly. Track activity from the Dashboard.</P></section>
        <section><H id="security-model">Security model</H>
          <P>Your message is encrypted in your browser with AES-256-GCM using a random key. Only ciphertext and the initialization vector are sent to the server. The key is placed in the link’s fragment, which browsers never transmit.</P>
          <P>A password is an access control, not an encryption key. It is sent to the server over HTTPS when someone opens the secret, and the server stores only an Argon2 hash of it.</P>
          <P>What the server can see: ciphertext, access policy, event timing, attachment file names and encrypted sizes. Threat detection stores a keyed hash of the request’s network source. File names are visible in the legacy attachment flow; rename sensitive files or put them inside an archive before sharing.</P>
          <P>What the server cannot do: read your message or attachments, or recover them if the link is lost. This also means a secret cannot be retrieved after the fact, even by you.</P></section>
        <section><H id="access-policies">Access policies</H>
          <ul className="mt-4 grid max-w-3xl gap-3 text-sm leading-7 text-[#94a3b8]">
            <li><span className="text-[#e2e8f0]">Expiration.</span> The secret is destroyed at this time even if never opened.</li>
            <li><span className="text-[#e2e8f0]">Maximum views.</span> Each successful open counts. When the limit is reached the secret is destroyed.</li>
            <li><span className="text-[#e2e8f0]">View once.</span> Destroyed immediately after the first successful open.</li>
            <li><span className="text-[#e2e8f0]">Access window.</span> The link only opens between the start and end time. Use a start time alone for a scheduled release.</li>
            <li><span className="text-[#e2e8f0]">Password.</span> Required to open. Repeated wrong guesses trigger escalating temporary cooldowns.</li>
          </ul></section>
        <section><H id="key-fragment">The key fragment</H>
          <P>Everything after the <span className="font-mono text-[#cbd5e1]">#</span> in a SafeSend link is the decryption key. Share the whole link. If a chat app, email client or link shortener drops the fragment, the message becomes unreadable and no one can restore it. Anyone who gets the full link and password can read the secret, so send the password through a separate channel and avoid pasting links into logs or tickets.</P></section>
        <section><H id="troubleshooting">Troubleshooting</H>
          <div className="mt-6 overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><caption className="sr-only">Error codes and recovery steps</caption>
            <thead className="font-mono text-[10px] tracking-widest text-[#64748b]"><tr><th className="pb-3 pr-4">MESSAGE</th><th className="pb-3 pr-4">MEANING</th><th className="pb-3">WHAT TO DO</th></tr></thead>
            <tbody>{ERRORS.map(([c, m, a]) => <tr key={c} className="border-t border-[#172a46] align-top"><td className="py-3 pr-4 font-mono text-xs text-[#e2e8f0]">{c}</td><td className="py-3 pr-4 text-xs leading-5 text-[#94a3b8]">{m}</td><td className="py-3 text-xs leading-5 text-[#94a3b8]">{a}</td></tr>)}</tbody></table></div></section>
        <section><H id="api-reference">API reference</H>
          <P>Requests and responses are JSON unless noted. Failures return <span className="font-mono text-[#cbd5e1]">{'{ success: false, message, code? }'}</span> with an HTTP error status. The overview table on the <Link href="/developers" className="text-[#38bdf8] underline underline-offset-4">API &amp; SDK page</Link> lists every endpoint.</P>
          <div className="mt-6 grid gap-5"><CodeBlock label="POST /api/secrets — request" code={`{\n  "encryptedContent": "<base64 ciphertext>",\n  "iv": "<base64, 12 bytes>",\n  "expiresAt": "2026-12-01T12:00:00.000Z",   // required\n  "accessStart": "…", "accessEnd": "…",       // optional ISO timestamps\n  "maxViews": 3,                               // null = unlimited\n  "burnAfterRead": false,\n  "password": "optional"\n}`}/>
            <CodeBlock label="POST /api/secrets — response (201)" code={`{ "success": true, "secretId": "<id>" }`}/>
            <CodeBlock label="POST /api/secrets/:id/access — response" code={`{\n  "success": true,\n  "encryptedContent": "<base64>", "iv": "<base64>",\n  "viewsRemaining": 2,          // null when unlimited\n  "destroyedAfterAccess": false,\n  "accessToken": "<short-lived bearer token for attachments>"\n}`}/>
            <CodeBlock label="POST /api/secrets/:id/attachments" code={`multipart/form-data\n  file                 encrypted bytes (max 25 MB; png, jpeg, webp, pdf, txt, zip)\n  encryptedKeyBundle   JSON string, encrypted with the secret's key`}/></div></section>
      </div>
    </div>
  </PageShell>
}
