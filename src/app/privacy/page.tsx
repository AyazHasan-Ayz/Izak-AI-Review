import { Brand } from '@/components/brand';
export default function Page() {
  return (
    <main className="center-page privacy">
      <Brand />
      <h1 style={{ marginTop: 40 }}>Your experience. Your choice.</h1>
      <p>You do not need an account to draft a review.</p>
      <h2>Your feedback</h2>
      <p>
        Your rating, experience, selected service and language are sent to our server and then to
        Groq to produce a draft. IZAK does not save this information or your generated review in a
        database, file, browser storage or analytics system. The draft stays in this page while it
        is open.
      </p>
      <p>
        Please leave out personal or sensitive details. Groq and the hosting provider apply their
        own data handling policies. Hosting security services may process network information to
        prevent abuse.
      </p>
      <h2>Your review</h2>
      <p>
        Abuse protection uses a temporary, essential session cookie and daily keyed hashes of
        network addresses. Only generation-attempt counters are stored, not raw IP addresses
        or review content. These counters expire at the end of the UTC day and are removed
        on subsequent generation requests or by scheduled cleanup.
      </p>
      <p>
        AI can make mistakes. Check and edit the draft before using it. Copying writes the review to
        your device clipboard. Nothing is automatically posted.
      </p>
      <h2>Google is your choice</h2>
      <p>
        Every rating has equal access to the Google review link. You choose the rating and submit
        the review on Google yourself. Google applies its own policies after you open its website.
      </p>
    </main>
  );
}
