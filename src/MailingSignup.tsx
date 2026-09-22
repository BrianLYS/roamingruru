import MemoryChoices from './MemoryChoices';
export default function MailingSignup() {
  return <main className="mailing-signup">
    <a href="/" className="wordmark">roamingruru<span className="wordmark-dot">.</span></a>
    <h1>Join Ruru’s list</h1>
    <MemoryChoices newsletterOnly onForgotten={() => {}}/>
  </main>;
}
