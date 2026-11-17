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
      ["Enforcement", "We may remove content or suspend accounts that violate these terms. You can report content or users from the app."],
      ["Deleting your account", "You can delete your account in Settings → Security. Any remaining wallet balance is forfeited, so withdraw it first."],
      ["Contact", "Questions? Use Settings → Help & Support → Contact Support."],
    ],
  },
  privacy: {
    title: "Privacy Policy",
    sections: [
      ["What we collect", "Account details (email or phone number), profile information, content you post, messages, wallet and payment records, and basic device information needed to run the app."],
      ["How we use it", "To provide the service, secure accounts, process payments and withdrawals, show you relevant content, and handle reports and support requests."],
      ["Sharing", "We do not sell your personal data. Data is processed by infrastructure providers (hosting, database, SMS and email delivery, and payment processing) strictly to run Primegram."],
      ["Your controls", "Edit your profile, set your account to private, control who can message you, block users, download a copy of your data, or delete your account at any time from Settings."],
      ["Security", "Data is encrypted in transit and protected by row-level access controls. You can enable two-factor authentication and sign out of all devices from Settings → Security."],
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
