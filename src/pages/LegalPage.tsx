import TrustPageLayout from "@/components/TrustPageLayout";
import { usePageMeta } from "@/hooks/usePageMeta";

type Kind = "terms" | "privacy" | "help";

const content: Record<Kind, { title: string; description: string; sections: Array<[string, string]> }> = {
  terms: {
    title: "Terms of Service",
    description: "Read the Primegram X terms, including community standards, user content rights, age-restricted rooms, and support contact information.",
    sections: [
      ["Who can use Primegram X", "You must be of legal age (the age of majority where you live) to create or use an account. You are responsible for keeping your account secure and for activity carried out through it. Do not use the service if you are not legally able to agree to these terms."],
      ["Community standards", "Treat people respectfully. Do not post threats, harassment, hateful or discriminatory abuse, scams, impersonation, unlawful material, spam, or content that exploits or endangers anyone. Do not manipulate engagement, disrupt the service, or access another person's account without permission. You can report content or accounts in the app."],
      ["Sexual content", "Sexually explicit content and nudity are not allowed on Primegram X. Never share sexual content involving minors; it is prohibited and will be reported to the appropriate authorities."],
      ["Your content and intellectual property", "You retain ownership of content you create. By posting or sharing it, you give Primegram X a non-exclusive, worldwide, royalty-free licence to host, store, reproduce, display, and distribute that content only as needed to operate, improve, and promote the service. You confirm you have the rights and permissions needed for what you share, including music and other third-party material. You can remove content you posted, subject to limited legal or operational retention."],
      ["Payments and third-party services", "Some features may involve payments or payment processing through providers such as Paystack or M-Pesa. Their services are subject to their own terms and privacy practices. Primegram X does not receive or store full payment credentials handled directly by those providers. Check the amount and terms shown before confirming a transaction."],
      ["Moderation and account actions", "We may review reports, remove content, restrict features, or suspend accounts when we reasonably believe these terms or applicable law have been violated, or when action is needed to protect the community or service. Where appropriate, you may contact support to ask about an action."],
      ["Changes and availability", "Features may change, and access may be interrupted for maintenance, security, or circumstances outside our control. We may update these terms; the latest version will be posted on this page."],
      ["Contact", "Questions about these terms or a community concern? Email support@primegramx.co.ke."],
    ],
  },
  privacy: {
    title: "Privacy Policy",
    description: "Learn what information Primegram X collects, how it is used and protected, payment disclosures, and how to request deletion.",
    sections: [
      ["Information we collect", "Depending on the features you use, we collect account details such as email or phone number, profile information, posts and other content you share, and messaging content. We also process real-time messaging metadata such as participants, timestamps, delivery status, and related technical events. Basic device, log, and usage information helps us operate, troubleshoot, and secure the service."],
      ["How we use information", "We use information to provide social features, deliver messages and notifications, personalize feeds, maintain account security, prevent abuse, process transactions, and respond to support requests or legal obligations."],
      ["Payments: Paystack and M-Pesa", "When you make or receive a payment, payment details may be handled by Paystack, M-Pesa, or another provider shown at checkout. Those providers process transactions under their own terms and privacy policies. We may receive transaction references, status, and limited payment details needed to display receipts, manage balances, and prevent fraud."],
      ["How we protect information", "We use encrypted connections (HTTPS/TLS) to protect information in transit and apply database access controls intended to limit access to authorized accounts and service operations. No online service can guarantee absolute security, so please use a unique password and keep your sign-in details private."],
      ["Sharing and service providers", "We do not sell personal information. We share only what is reasonably necessary with service providers that help host, secure, operate, and support Primegram X, and when required to comply with law or protect people and the service."],
      ["Your choices and deletion rights", "You may update profile information and manage available privacy settings in the app. To request access, correction, or deletion of personal information, use the account-deletion controls in Settings or email support@primegramx.co.ke. We may retain limited records when required by law, payment reconciliation, security, or dispute resolution."],
      ["Retention", "We keep information while needed to provide the service and for legitimate operational purposes. When an account is deleted, we remove or de-identify associated information where practical, subject to legal, security, payment, and backup-retention requirements."],
      ["Children", "Primegram X is intended for users of legal age. We do not knowingly invite children to use the service. If you believe a minor has created an account, contact support@primegramx.co.ke."],
      ["Contact and privacy requests", "For privacy questions or requests, email support@primegramx.co.ke. Please include enough information for us to locate your account without sending your password."],
    ],
  },
  help: {
    title: "Help Center",
    description: "Get help with Primegram X.",
    sections: [
      ["Contact support", "Email support@primegramx.co.ke for help with your account, safety, or app features."],
    ],
  },
};

const LegalPage = ({ kind }: { kind: Kind }) => {
  const page = content[kind];
  usePageMeta({ title: `${page.title} | Primegram X`, description: page.description, path: `/${kind}` });

  return (
    <TrustPageLayout>
      <article className="mx-auto w-full max-w-4xl px-5 pb-20 pt-12 sm:px-8 sm:pt-20">
        <header className="mb-10 border-b border-white/10 pb-8 sm:mb-12 sm:pb-10">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Primegram X · Public policy</p>
          <h1 className="mt-4 text-4xl font-black tracking-[-0.05em] sm:text-5xl">{page.title}</h1>
          <p className="mt-4 text-sm font-semibold leading-7 text-foreground">Primegram X is operated by Aurora ("we", "us", or "our").</p>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">{page.description}</p>
        </header>
        <div className="grid gap-4 sm:gap-5">
          {page.sections.map(([heading, body], index) => (
            <section key={heading} className="liquid-glass rounded-2xl p-5 sm:p-7">
              <div className="relative z-10 grid gap-3 sm:grid-cols-[2.5rem_1fr] sm:gap-5">
                <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-xs font-bold text-primary">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h2 className="text-base font-bold sm:text-lg">{heading}</h2>
                  <p className="mt-2 text-sm leading-7 text-slate-300">{body}</p>
                </div>
              </div>
            </section>
          ))}
        </div>
        <p className="mt-8 text-xs text-muted-foreground">Last updated November 2026 · For questions, contact <a className="text-slate-200 underline decoration-primary/60 underline-offset-4" href="mailto:support@primegramx.co.ke">support@primegramx.co.ke</a>.</p>
      </article>
    </TrustPageLayout>
  );
};

export default LegalPage;
