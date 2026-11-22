import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

type Kind = "terms" | "privacy" | "help";

const content: Record<Kind, { title: string; sections: Array<[string, string]> }> = {
  terms: {
    title: "Terms of Service",
    sections: [
      ["Using Primegram", "You must be 18 or older, or the age of majority where you live, to use Primegram. You are responsible for your account and for everything posted from it."],
      ["Your content", "You keep ownership of what you post. You grant Primegram a licence to host and display it to provide the service. Do not post illegal content, harassment, hate, or content that exploits minors. Adult content is allowed only in the sections that are age-gated and clearly marked."],
      ["Wallet, tips and subscriptions", "Wallet balances are held in KES. Creators receive 95% of tips and subscriptions; the remainder is a platform fee. Creator subscriptions are prepaid for one month and do not auto-renew. Subscription payments are non-refundable once access has been granted."],
      ["Withdrawals", "Withdrawal requests (minimum KES 50) are reviewed and paid manually to an M-Pesa number. Funds are held when you request a withdrawal and are refunded if you cancel or the request is rejected. Accounts may be reviewed for fraud before payment."],
      ["Camera, microphone, photos and notifications", "With your permission the app uses the camera and microphone for calls and posting, your photos and videos so you can choose media to share, and notifications for messages and calls. You can turn any of these off in your phone settings."],
      ["Music", "Songs are streamed from third-party services for personal listening inside the app. Do not use music in a way that infringes someone else's rights."],
      ["Copyright and takedowns", "Only post content you own or have permission to use, including any music you add. If you believe something on Primegram infringes your copyright, send the work, the link to the post and your contact details to primegram.app@gmail.com (subject: Copyright) or through Settings → Help & Support. We remove infringing content promptly and may suspend repeat infringers."],
      ["Community rules", "No violence or threats, harassment, hate, scams or impersonation, sexual content involving minors (zero tolerance, reported to the authorities), or content that breaks the law in Kenya or where you live. Posts you mark as followers-only are visible only to your followers."],
      ["Age", "Primegram is for people 18 and over. Accounts found to belong to under-18s are closed."],
      ["Enforcement", "We may remove content or suspend accounts that violate these terms. You can report content or users from the app."],
      ["Deleting your account", "You can delete your account in Settings → Security. Any remaining wallet balance is forfeited, so withdraw it first."],
      ["Contact", "Questions? Email primegram.app@gmail.com or use Settings → Help & Support → Contact Support."],
    ],
  },
  privacy: {
    title: "Privacy Policy",
    sections: [
      ["What we collect", "Account details (email or phone number), profile information, content you post, messages, wallet and payment records, and basic device information needed to run the app."],
      ["How we use it", "To provide the service, secure accounts, process payments and withdrawals, show you relevant content, and handle reports and support requests."],
      ["Photos, camera and microphone", "Photos and videos are read from your device only when you choose them to post or send. Camera and microphone are used only during calls, video recording and similar features, and are never used in the background."],
      ["Sharing", "We do not sell your personal data. Data is processed by infrastructure providers (hosting, database, SMS and email delivery, and payment processing) strictly to run Primegram."],
      ["Your controls", "Edit your profile, set your account to private, control who can message you, block users, download a copy of your data, or delete your account at any time from Settings."],
      ["Security", "Data is encrypted in transit and protected by row-level access controls. You can enable two-factor authentication and sign out of all devices from Settings → Security."],
      ["Your rights", "Under the Kenya Data Protection Act 2019 and similar laws you can ask to access, correct, export or delete your data, and object to processing. Use Settings, or email primegram.app@gmail.com. Data controller: Primegram, operated by Java Prime."],
      ["Children", "Primegram is not directed at anyone under 18 and we do not knowingly collect data from them."],
      ["Retention", "When you delete your account, your profile, posts and wallet history are removed from our systems, except records we must keep for legal or fraud-prevention reasons."],
    ],
  },
  help: {
    title: "Help Center",
    sections: [
      ["How do I top up my wallet?", "Open Wallet and choose Top up. Enter your M-Pesa number and amount, then approve the prompt on your phone."],
      ["How do I withdraw earnings?", "Open Wallet → Withdraw, enter an amount (min KES 50) and your M-Pesa number. An admin reviews and pays it; you'll see the status in your withdrawals list. You can cancel while it is pending for an instant refund."],
      ["How do creator subscriptions work?", "Creators set a monthly price in Settings → Creator Dashboard. Subscribers pay from their wallet for one month of access; creators receive 95%."],
      ["I didn't get my verification code", "Check spam, wait a minute, then request a new code. For phone numbers use the international format, e.g. +2547XXXXXXXX."],
      ["How do I block or report someone?", "Open their profile or post menu and choose Block or Report."],
      ["Still need help?", "Email our support team at primegram.app@gmail.com and we'll get back to you."],
      ["About Primegram", "Primegram v1.0 — created by Java Prime, sponsored by JP7 ULTRA."],
    ],
  },
};

const LegalPage = ({ kind }: { kind: Kind }) => {
  const navigate = useNavigate();
  const page = content[kind];
  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/10 bg-background/80 px-4 py-3 backdrop-blur-xl">
        <button onClick={() => navigate(-1)} aria-label="Back" className="depth-press"><ArrowLeft className="h-5 w-5 text-foreground" /></button>
        <h1 className="text-base font-semibold text-foreground">{page.title}</h1>
      </header>
      <main className="mx-auto max-w-2xl space-y-5 p-5">
        {page.sections.map(([h, body]) => (
          <section key={h} id={h.startsWith("About") ? "about" : undefined}>
            <h2 className="mb-1 text-sm font-semibold text-foreground">{h}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
          </section>
        ))}
        <p className="pt-4 text-[11px] text-muted-foreground">Last updated November 2026</p>
      </main>
    </div>
  );
};

export default LegalPage;
