import { Link } from "react-router-dom";
import TrustPageLayout from "@/components/TrustPageLayout";
import { usePageMeta } from "@/hooks/usePageMeta";

const SUPPORT = "officialprimegram.app@gmail.com";

/** Public page (no sign-in) that explains how to delete a Primegram X account and its data. Linked from the Play listing. */
const DeleteAccountPage = () => {
  usePageMeta({ title: "Delete your account – Primegram X", description: "How to delete your Primegram X account and what happens to your data.", path: "/delete-account" });
  return (
    <TrustPageLayout>
      <article className="mx-auto max-w-2xl space-y-6 px-4 py-10 text-white">
        <h1 className="text-3xl font-extrabold">Delete your Primegram X account</h1>
        <p className="text-white/70">You can delete your account and data at any time, from the app or by email.</p>

        <section className="space-y-2">
          <h2 className="text-lg font-bold">Option 1: In the app (instant)</h2>
          <ol className="list-decimal space-y-1 pl-5 text-white/80">
            <li>Open Primegram X and sign in.</li>
            <li>Go to <strong>Settings</strong>, then <strong>Delete account</strong>.</li>
            <li>Type <strong>DELETE</strong> and tap <strong>Delete forever</strong>.</li>
          </ol>
          <p className="text-sm text-white/60">You must first settle any pending withdrawal. Wallet balance is forfeited, so withdraw it before deleting.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold">Option 2: By email</h2>
          <p className="text-white/80">Can't sign in? Email <a className="font-semibold text-fuchsia-300 underline" href={`mailto:${SUPPORT}?subject=Delete%20my%20Primegram%20X%20account`}>{SUPPORT}</a> from the address on your account, with the subject "Delete my Primegram X account" and your username. We delete the account within 30 days and confirm by email.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold">What is deleted</h2>
          <p className="text-white/80">Your profile, posts, reels, stories, comments, likes, messages, follows, blocks, saved items and settings are permanently removed. This cannot be undone.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold">What we keep</h2>
          <p className="text-white/80">Payment, withdrawal and security records are kept for accounting, fraud prevention and legal obligations, as required by Kenyan law. They are not shown to other users.</p>
        </section>

        <p className="text-sm text-white/60">See our <Link className="underline" to="/privacy">Privacy Policy</Link> for more.</p>
      </article>
    </TrustPageLayout>
  );
};
export default DeleteAccountPage;
